use crate::{
    parse_line, query::statistics, ParseStatus, ParsedFields, ParserMode, Query, Statistics,
};
use duckdb::{params, params_from_iter, types::Value, Config, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{BufRead, BufReader, Read},
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};
use tempfile::TempDir;
use thiserror::Error;

pub const MAX_LINE_BYTES: usize = 1024 * 1024;
pub const PAGE_SIZE: u32 = 500;

// List responses are previews, including extracted strings. The full fields
// are returned only by detail(), so a long URL/agent cannot inflate a page IPC.
const LIST_COLUMNS: &str = "id, line_number, byte_offset, substring(message, 1, 240), parser,
    timestamp, timestamp_ms, substring(source_ip, 1, 160), substring(method, 1, 32),
    substring(path, 1, 240), substring(protocol, 1, 32), status, response_bytes,
    substring(referrer, 1, 240), substring(user_agent, 1, 240), substring(parse_error, 1, 512), parse_status";

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("Unable to read the selected file or local session storage.")]
    Io(#[from] std::io::Error),
    #[error("The local analysis database could not complete the operation.")]
    Database(#[from] duckdb::Error),
    #[error("Import cancelled. No events from this import were kept.")]
    Cancelled,
    #[error(
        "A line exceeds the 1 MiB safety limit. Import was rolled back; the source is unchanged."
    )]
    LineTooLong,
    #[error("The source changed during import. Import was rolled back; retry with a stable copy.")]
    SourceChanged,
    #[error("Select a regular file, not a directory or device.")]
    NotRegularFile,
    #[error("This version supports uncompressed UTF-8 text logs. Compressed, UTF-16, and binary formats need a dedicated reader.")]
    UnsupportedFormat,
    #[error("Invalid query: use a 1–500 limit, nonnegative offset, values up to 4096 characters, and a valid increasing time range.")]
    InvalidQuery,
    #[error("The selected event does not exist in this session.")]
    EventNotFound,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub bytes_read: u64,
    pub total_bytes: u64,
    pub lines_read: u64,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSummary {
    pub name: String,
    pub provenance: String,
    pub parser_mode: ParserMode,
    pub partial_events: u64,
    pub unparsed_events: u64,
    pub total_bytes: u64,
    pub total_events: u64,
    pub parsed_events: u64,
    pub text_events: u64,
    pub warning_events: u64,
    pub sha256: String,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventRow {
    pub id: u64,
    pub line_number: u64,
    pub byte_offset: u64,
    pub preview: String,
    #[serde(flatten)]
    pub fields: ParsedFields,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDetail {
    #[serde(flatten)]
    pub event: EventRow,
    pub raw: String,
    pub raw_hex: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryPage {
    pub statistics: Statistics,
    pub rows: Vec<EventRow>,
    pub total: u64,
    pub offset: u64,
    pub limit: u32,
    pub elapsed_ms: u64,
}

/// One temporary, disk-backed database per analysis session. A single owner
/// serializes access; the desktop layer runs all operations off the UI thread.
type StatisticsCache = std::collections::VecDeque<(String, Vec<Value>, Statistics)>;

pub struct Engine {
    statistics_cache: std::cell::RefCell<StatisticsCache>,
    connection: Connection,
    _storage: TempDir,
}

impl Engine {
    pub fn new() -> Result<Self, EngineError> {
        let storage = tempfile::Builder::new()
            .prefix("dfir-log-explorer-")
            .tempdir()?;
        let config = Config::default()
            .enable_external_access(false)?
            .max_memory("512MB")?
            .threads(2)?;
        let connection =
            Connection::open_with_flags(storage.path().join("session.duckdb"), config)?;
        connection.execute_batch(
            "SET autoinstall_known_extensions = false;
             SET autoload_known_extensions = false;
             SET allow_community_extensions = false;
             SET lock_configuration = true;
             CREATE TABLE events (
                id BIGINT, line_number BIGINT, byte_offset BIGINT, raw BLOB,
                message VARCHAR, parser VARCHAR, timestamp VARCHAR, timestamp_ms BIGINT,
                source_ip VARCHAR, method VARCHAR, path VARCHAR, protocol VARCHAR,
                status INTEGER, response_bytes BIGINT, referrer VARCHAR, user_agent VARCHAR,
                parse_error VARCHAR, parse_status VARCHAR
             );",
        )?;
        Ok(Self {
            statistics_cache: std::cell::RefCell::new(StatisticsCache::new()),
            connection,
            _storage: storage,
        })
    }

    /// Import atomically. Raw source bytes, including terminators and invalid
    /// UTF-8, are retained. Cancellation/error preserves the previous session.
    pub fn import(
        &mut self,
        path: &Path,
        mode: ParserMode,
        cancelled: &AtomicBool,
        mut progress: impl FnMut(ImportProgress),
    ) -> Result<SourceSummary, EngineError> {
        if !std::fs::metadata(path)?.is_file() {
            return Err(EngineError::NotRegularFile);
        }
        let file = File::open(path)?;
        let before = file.metadata()?;
        if !before.is_file() {
            return Err(EngineError::NotRegularFile);
        }
        let total_bytes = before.len();
        let started = Instant::now();
        let mut last_progress = Instant::now();
        let mut reader = BufReader::with_capacity(256 * 1024, file);
        let signature = reader.fill_buf()?;
        if signature.starts_with(b"\x1f\x8b")
            || signature.starts_with(b"PK\x03\x04")
            || signature.starts_with(b"ElfFile\0")
            || signature.starts_with(b"\xff\xfe")
            || signature.starts_with(b"\xfe\xff")
        {
            return Err(EngineError::UnsupportedFormat);
        }
        let mut buffer = Vec::with_capacity(4096);
        let mut hash = Sha256::new();
        let (
            mut bytes_read,
            mut lines,
            mut parsed,
            mut text,
            mut warnings,
            mut partial,
            mut unparsed,
        ) = (0u64, 0u64, 0u64, 0u64, 0u64, 0u64, 0u64);

        self.connection.execute_batch("BEGIN TRANSACTION;")?;
        let result = (|| {
            self.connection.execute_batch("DELETE FROM events;")?;
            let mut appender = self.connection.appender("events")?;
            progress(ImportProgress {
                bytes_read: 0,
                total_bytes,
                lines_read: 0,
                elapsed_ms: 0,
            });
            loop {
                if cancelled.load(Ordering::Relaxed) {
                    return Err(EngineError::Cancelled);
                }
                buffer.clear();
                let size = reader
                    .by_ref()
                    .take((MAX_LINE_BYTES + 1) as u64)
                    .read_until(b'\n', &mut buffer)?;
                if size == 0 {
                    break;
                }
                if size > MAX_LINE_BYTES {
                    return Err(EngineError::LineTooLong);
                }
                hash.update(&buffer);
                let display_bytes = buffer.strip_suffix(b"\n").unwrap_or(&buffer);
                let display_bytes = display_bytes.strip_suffix(b"\r").unwrap_or(display_bytes);
                let message = String::from_utf8_lossy(display_bytes);
                let mut fields = parse_line(&message, mode);
                if std::str::from_utf8(display_bytes).is_err() {
                    let warning = "Invalid UTF-8; display uses replacement characters. Original bytes are preserved.";
                    fields.parse_error = Some(match fields.parse_error {
                        Some(error) => format!("{error} {warning}"),
                        None => warning.into(),
                    });
                }
                lines += 1;
                parsed += u64::from(fields.parse_status == ParseStatus::Parsed);
                partial += u64::from(fields.parse_status == ParseStatus::Partial);
                unparsed += u64::from(fields.parse_status == ParseStatus::Unparsed);
                text += u64::from(fields.parser == "text");
                warnings += u64::from(fields.parse_error.is_some());
                appender.append_row(params![
                    lines as i64,
                    lines as i64,
                    bytes_read as i64,
                    buffer.as_slice(),
                    message.as_ref(),
                    fields.parser,
                    fields.timestamp,
                    fields.timestamp_ms,
                    fields.source_ip,
                    fields.method,
                    fields.path,
                    fields.protocol,
                    fields.status,
                    fields.response_bytes,
                    fields.referrer,
                    fields.user_agent,
                    fields.parse_error,
                    fields.parse_status.as_str(),
                ])?;
                bytes_read += size as u64;
                if last_progress.elapsed() >= Duration::from_millis(100) {
                    progress(ImportProgress {
                        bytes_read,
                        total_bytes,
                        lines_read: lines,
                        elapsed_ms: started.elapsed().as_millis() as u64,
                    });
                    last_progress = Instant::now();
                }
            }
            appender.flush()?;
            drop(appender);
            if cancelled.load(Ordering::Relaxed) {
                return Err(EngineError::Cancelled);
            }
            let after = reader.get_ref().metadata()?;
            if bytes_read != total_bytes
                || after.len() != total_bytes
                || before.modified().ok() != after.modified().ok()
            {
                return Err(EngineError::SourceChanged);
            }
            self.connection.execute_batch("COMMIT;")?;
            Ok(())
        })();
        if let Err(error) = result {
            // Rollback must complete before the connection can be reused.
            self.connection.execute_batch("ROLLBACK;")?;
            return Err(error);
        }
        self.statistics_cache.borrow_mut().clear();
        progress(ImportProgress {
            bytes_read,
            total_bytes,
            lines_read: lines,
            elapsed_ms: started.elapsed().as_millis() as u64,
        });
        Ok(SourceSummary {
            provenance: path.to_string_lossy().into_owned(),
            parser_mode: mode,
            partial_events: partial,
            unparsed_events: unparsed,
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            total_bytes,
            total_events: lines,
            parsed_events: parsed,
            text_events: text,
            warning_events: warnings,
            sha256: format!("{:x}", hash.finalize()),
            elapsed_ms: started.elapsed().as_millis() as u64,
        })
    }

    pub fn query(&self, query: &Query) -> Result<QueryPage, EngineError> {
        let started = Instant::now();
        let (predicate, values) = query.predicate()?;
        let cached = self
            .statistics_cache
            .borrow()
            .iter()
            .find(|(p, v, _)| p == &predicate && v == &values)
            .map(|(_, _, s)| s.clone());
        let statistics = match cached {
            Some(stats) => stats,
            None => {
                let stats = statistics(&self.connection, &predicate, &values)?;
                let mut cache = self.statistics_cache.borrow_mut();
                if cache.len() == 4 {
                    cache.pop_front();
                }
                cache.push_back((predicate.clone(), values.clone(), stats.clone()));
                stats
            }
        };
        let total = statistics.total;
        let rows = if query.is_original_order() {
            let mut statement = self.connection.prepare(&format!(
                "SELECT {LIST_COLUMNS} FROM events WHERE id > ? ORDER BY id LIMIT ?"
            ))?;
            statement
                .query_map(params![query.offset as i64, query.limit], event_row)?
                .collect::<Result<Vec<_>, _>>()?
        } else {
            let direction = if query.descending { "DESC" } else { "ASC" };
            let mut statement = self.connection.prepare(&format!(
                "SELECT {LIST_COLUMNS} FROM events WHERE {predicate} ORDER BY {} {direction} NULLS LAST, id ASC LIMIT ? OFFSET ?",
                query.sort_by.sql()
            ))?;
            let mut page_values = values;
            page_values.push(Value::BigInt(query.limit as i64));
            page_values.push(Value::BigInt(query.offset as i64));
            statement
                .query_map(params_from_iter(page_values.iter()), event_row)?
                .collect::<Result<Vec<_>, _>>()?
        };
        Ok(QueryPage {
            statistics,
            rows,
            total,
            offset: query.offset,
            limit: query.limit,
            elapsed_ms: started.elapsed().as_millis() as u64,
        })
    }

    pub fn detail(&self, id: u64) -> Result<EventDetail, EngineError> {
        if id > i64::MAX as u64 {
            return Err(EngineError::EventNotFound);
        }
        let mut statement = self.connection.prepare(
            "SELECT id, line_number, byte_offset, substring(message, 1, 240), parser,
                    timestamp, timestamp_ms, source_ip, method, path, protocol, status,
                    response_bytes, referrer, user_agent, parse_error, parse_status, message, raw
             FROM events WHERE id = ?",
        )?;
        let mut rows = statement.query(params![id as i64])?;
        let row = rows.next()?.ok_or(EngineError::EventNotFound)?;
        let raw_bytes: Vec<u8> = row.get(18)?;
        Ok(EventDetail {
            event: event_row(row)?,
            raw: row.get(17)?,
            raw_hex: std::str::from_utf8(&raw_bytes)
                .err()
                .map(|_| raw_bytes.iter().map(|byte| format!("{byte:02x}")).collect()),
        })
    }
}

fn event_row(row: &duckdb::Row<'_>) -> duckdb::Result<EventRow> {
    Ok(EventRow {
        id: row.get::<_, i64>(0)? as u64,
        line_number: row.get::<_, i64>(1)? as u64,
        byte_offset: row.get::<_, i64>(2)? as u64,
        preview: row.get(3)?,
        fields: ParsedFields {
            parser: row.get(4)?,
            parse_status: match row.get::<_, String>(16)?.as_str() {
                "parsed" => ParseStatus::Parsed,
                "partial" => ParseStatus::Partial,
                _ => ParseStatus::Unparsed,
            },
            timestamp: row.get(5)?,
            timestamp_ms: row.get(6)?,
            source_ip: row.get(7)?,
            method: row.get(8)?,
            path: row.get(9)?,
            protocol: row.get(10)?,
            status: row.get(11)?,
            response_bytes: row.get(12)?,
            referrer: row.get(13)?,
            user_agent: row.get(14)?,
            parse_error: row.get(15)?,
        },
    })
}

#[cfg(test)]
mod security_tests {
    use super::*;

    #[test]
    fn database_disables_external_access_and_extension_downloads() {
        let engine = Engine::new().unwrap();
        for setting in [
            "enable_external_access",
            "autoinstall_known_extensions",
            "autoload_known_extensions",
            "allow_community_extensions",
        ] {
            let enabled: bool = engine
                .connection
                .query_row(&format!("SELECT current_setting('{setting}')"), [], |row| {
                    row.get(0)
                })
                .unwrap();
            assert!(!enabled, "{setting} must be disabled");
        }
        let source = tempfile::NamedTempFile::new().unwrap();
        assert!(engine
            .connection
            .query_row(
                "SELECT content FROM read_text(?)",
                params![source.path().to_str().unwrap()],
                |row| row.get::<_, String>(0)
            )
            .is_err());
        assert!(engine
            .connection
            .execute_batch("SET enable_external_access = true")
            .is_err());
    }
}
