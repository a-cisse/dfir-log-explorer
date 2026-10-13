use dfir_log_core::*;
use std::{
    io::Write,
    sync::atomic::{AtomicBool, Ordering},
};

fn source(bytes: &[u8]) -> tempfile::NamedTempFile {
    let mut file = tempfile::NamedTempFile::new().unwrap();
    file.write_all(bytes).unwrap();
    file
}
fn query() -> Query {
    Query {
        limit: 500,
        ..Default::default()
    }
}
fn import(engine: &mut Engine, bytes: &[u8], mode: ParserMode) -> SourceSummary {
    let file = source(bytes);
    engine
        .import(file.path(), mode, &AtomicBool::new(false), |_| {})
        .unwrap()
}

#[test]
fn save_reopen_append_preserves_raw_provenance_and_source_local_positions() {
    let directory = tempfile::tempdir().unwrap();
    let case_path = directory.path().join("incident.dfir");
    let mut engine = Engine::new().unwrap();
    let first = import(
        &mut engine,
        b"first\r\n\ninvalid \xff\nlast",
        ParserMode::Text,
    );
    let before = engine.detail(3).unwrap().raw_hex;
    let saved = engine.save_case(&case_path).unwrap();
    assert_eq!(saved.name, "incident");
    assert_eq!(saved.sources[0].sha256, first.sha256);
    drop(engine);
    let mut reopened = Engine::open_case(&case_path).unwrap();
    assert_eq!(reopened.query(&query()).unwrap().total, 4);
    assert_eq!(reopened.detail(3).unwrap().raw_hex, before);
    let second = import(&mut reopened, b"next\n", ParserMode::Text);
    assert_eq!(second.id, 2);
    let event = reopened.detail(5).unwrap();
    assert_eq!(
        (
            event.event.source_id,
            event.event.line_number,
            event.event.byte_offset
        ),
        (2, 1, 0)
    );
    drop(reopened);
    let reopened = Engine::open_case(&case_path).unwrap();
    let case = reopened.case_summary().unwrap();
    assert_eq!(case.sources.len(), 2);
    assert_eq!(case.sources[0].provenance, first.provenance);
    assert_eq!(
        reopened
            .query(&Query {
                source_id: Some(1),
                ..query()
            })
            .unwrap()
            .total,
        4
    );
    assert_eq!(
        reopened
            .query(&Query {
                source_id: Some(2),
                ..query()
            })
            .unwrap()
            .rows[0]
            .id,
        5
    );
    assert!(reopened
        .query(&Query {
            source_id: Some(999),
            ..query()
        })
        .unwrap()
        .rows
        .is_empty());
}

#[test]
fn save_never_overwrites_and_open_never_initializes_unknown_cases() {
    let file = source(b"not a database");
    let mut engine = Engine::new().unwrap();
    import(&mut engine, b"keep\n", ParserMode::Text);
    assert!(matches!(
        engine.save_case(file.path()),
        Err(EngineError::CaseExists)
    ));
    assert!(Engine::open_case(file.path()).is_err());
    assert_eq!(std::fs::read(file.path()).unwrap(), b"not a database");
    let directory = tempfile::tempdir().unwrap();
    let missing = directory.path().join("missing.dfir");
    assert!(Engine::open_case(&missing).is_err());
    assert!(!missing.exists());
    let unknown = directory.path().join("future.dfir");
    {
        let database = duckdb::Connection::open(&unknown).unwrap();
        database.execute_batch("CREATE TABLE case_meta (schema_version INTEGER, name VARCHAR); INSERT INTO case_meta VALUES (999, 'future');").unwrap();
    }
    assert!(matches!(
        Engine::open_case(&unknown),
        Err(EngineError::UnsupportedCase)
    ));
    assert_eq!(engine.query(&query()).unwrap().total, 1);
}

#[test]
fn failed_appends_leave_case_metadata_attributes_cache_and_ids_unchanged() {
    let directory = tempfile::tempdir().unwrap();
    let case_path = directory.path().join("rollback.dfir");
    let mut engine = Engine::new().unwrap();
    import(&mut engine, b"old\n", ParserMode::Text);
    engine.save_case(&case_path).unwrap();
    assert_eq!(engine.query(&query()).unwrap().statistics.total, 1);
    let next = source(b"{\"user\":\"new\"}\n");
    let flag = AtomicBool::new(false);
    let result = engine.import(next.path(), ParserMode::JsonLines, &flag, |_| {
        flag.store(true, Ordering::Relaxed);
    });
    assert!(matches!(result, Err(EngineError::Cancelled)));
    let long = source(&vec![b'x'; MAX_LINE_BYTES + 1]);
    assert!(matches!(
        engine.import(
            long.path(),
            ParserMode::Text,
            &AtomicBool::new(false),
            |_| {}
        ),
        Err(EngineError::LineTooLong)
    ));
    assert_eq!(engine.case_summary().unwrap().sources.len(), 1);
    assert_eq!(engine.query(&query()).unwrap().statistics.total, 1);
    let added = import(&mut engine, b"after rollback\n", ParserMode::Text);
    assert_eq!(added.id, 2);
    assert_eq!(engine.detail(2).unwrap().raw, "after rollback");
    drop(engine);
    assert_eq!(
        Engine::open_case(&case_path)
            .unwrap()
            .query(&query())
            .unwrap()
            .total,
        2
    );
}

#[test]
fn structured_json_nginx_filters_and_time_ranges_work_across_sources() {
    let mut engine = Engine::new().unwrap();
    import(
        &mut engine,
        b"192.0.2.1 - - [13/Oct/2026:10:00:00 +0200] \"GET / HTTP/1.1\" 200 42 \"-\" \"agent\"\n",
        ParserMode::Nginx,
    );
    import(&mut engine, br#"{"timestamp":"2026-10-13T08:00:00Z","method":"POST","status":"401","user":"a\u0062","nested":{"x":1}}
{"timestamp":"2026-10-13T08:00:01","source_ip":"192.0.2.2","status":999,"user":"other"}
{"timestamp_ms":1791878401000,"method":"GET","user":"ab"}
not json

"#, ParserMode::JsonLines);
    assert_eq!(engine.query(&query()).unwrap().total, 6);
    let page = engine
        .query(&Query {
            json_filter: Some(JsonFilter {
                key: "user".into(),
                value: "ab".into(),
            }),
            ..query()
        })
        .unwrap();
    assert_eq!(page.total, 2);
    assert_eq!(
        engine
            .query(&Query {
                search: "ab".into(),
                ..query()
            })
            .unwrap()
            .total,
        2
    ); // decoded escaped fields
    assert_eq!(
        engine
            .query(&Query {
                json_filter: Some(JsonFilter {
                    key: "user' OR 1=1 --".into(),
                    value: "ab".into()
                }),
                ..query()
            })
            .unwrap()
            .total,
        0
    );
    assert_eq!(
        engine
            .query(&Query {
                parser: Some(ParserMode::Nginx),
                ..query()
            })
            .unwrap()
            .total,
        1
    );
    assert_eq!(
        engine
            .query(&Query {
                parser: Some(ParserMode::JsonLines),
                ..query()
            })
            .unwrap()
            .total,
        5
    );
    assert_eq!(
        engine
            .query(&Query {
                has_timestamp: Some(false),
                ..query()
            })
            .unwrap()
            .total,
        3
    );
    let first = engine.detail(1).unwrap().event.fields.timestamp_ms.unwrap();
    assert_eq!(
        engine
            .query(&Query {
                time_from: Some(first),
                time_to: Some(first + 1000),
                ..query()
            })
            .unwrap()
            .total,
        2
    );
    let bad = engine.detail(3).unwrap();
    assert_eq!(bad.event.fields.parse_status, ParseStatus::Partial);
    assert_eq!(bad.event.fields.timestamp_ms, None);
    assert_eq!(bad.event.fields.source_ip.as_deref(), Some("192.0.2.2"));
    assert!(bad.event.fields.json_fields.unwrap()["status"].as_i64() == Some(999));
    assert_eq!(
        engine.detail(2).unwrap().event.fields.json_fields.unwrap()["nested"]["x"],
        1
    );
    assert_eq!(engine.query(&query()).unwrap().statistics.total_requests, 3);
}

#[test]
fn json_dates_do_not_guess_timezone_or_units_and_bad_fields_preserve_valid_evidence() {
    let bad = parse_line(
        r#"{"timestamp":"2026-10-13T08:00:00","timestamp_ms":1791878400000,"source_ip":"192.0.2.5","response_bytes":-1,"method":12}"#,
        ParserMode::JsonLines,
    );
    assert_eq!(bad.parse_status, ParseStatus::Partial);
    assert_eq!(bad.timestamp_ms, None); // invalid preferred timestamp never falls back silently
    assert_eq!(bad.source_ip.as_deref(), Some("192.0.2.5"));
    assert_eq!(bad.response_bytes, None);
    assert_eq!(bad.method, None);
    let offset = parse_line(
        r#"{"time_local":"13/Oct/2026:10:00:00 +0200","request":"GET /login HTTP/2.0","status":201,"body_bytes_sent":"42"}"#,
        ParserMode::Auto,
    );
    assert_eq!(offset.parse_status, ParseStatus::Parsed);
    assert_eq!(
        offset.timestamp.as_deref(),
        Some("2026-10-13T10:00:00+02:00")
    );
    assert_eq!(offset.timestamp_ms, Some(1791878400000));
    assert_eq!(offset.path.as_deref(), Some("/login"));
    for line in [
        r#"{"timestamp":1791878400}"#,
        r#"{"timestamp_ms":9223372036854775807}"#,
        r#"{"timestamp":"2026-02-30T08:00:00Z"}"#,
    ] {
        let parsed = parse_line(line, ParserMode::JsonLines);
        assert_eq!(parsed.parse_status, ParseStatus::Partial);
        assert_eq!(parsed.timestamp_ms, None);
    }
    for line in ["null", "[]", "true", "42", "", "{bad}"] {
        assert_eq!(
            parse_line(line, ParserMode::JsonLines).parse_status,
            ParseStatus::Unparsed
        );
    }
    assert_eq!(
        parse_line("{bad}", ParserMode::Text).parse_status,
        ParseStatus::Parsed
    );
    assert_eq!(
        parse_line("not an access log", ParserMode::Nginx).parse_status,
        ParseStatus::Unparsed
    );
}

#[test]
fn json_fields_survive_reopening_but_do_not_expand_list_payloads() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("json.dfir");
    let mut engine = Engine::new().unwrap();
    let value = "a".repeat(32_768);
    let row =
        serde_json::json!({"user": value, "status": 200, "timestamp": "2026-10-13T08:00:00Z"})
            .to_string();
    import(&mut engine, row.as_bytes(), ParserMode::JsonLines);
    import(
        &mut engine,
        br#"{"user":"al\u0069ce"}"#,
        ParserMode::JsonLines,
    );
    engine.save_case(&path).unwrap();
    drop(engine);
    let engine = Engine::open_case(&path).unwrap();
    assert_eq!(
        engine
            .query(&Query {
                search: "alice".into(),
                ..query()
            })
            .unwrap()
            .total,
        1
    );
    let page = engine.query(&query()).unwrap();
    assert!(serde_json::to_vec(&page).unwrap().len() < 5000);
    assert!(page.rows[0].fields.json_fields.is_none());
    assert_eq!(
        engine.detail(1).unwrap().event.fields.json_fields.unwrap()["user"],
        value
    );
}

#[test]
fn duplicate_json_keys_are_diagnosed_and_demo_metadata_commits_with_source() {
    let duplicate = parse_line(
        r#"{"user":"first","user":"last","status":200}"#,
        ParserMode::JsonLines,
    );
    assert_eq!(duplicate.parse_status, ParseStatus::Partial);
    assert!(duplicate.parse_error.unwrap().contains("Duplicate"));
    assert_eq!(duplicate.json_fields.unwrap()["user"], "last");
    let file = source(b"demo\n");
    let mut engine = Engine::new().unwrap();
    engine
        .import_with_identity(
            file.path(),
            ParserMode::Text,
            &AtomicBool::new(false),
            |_| {},
            Some(("Synthetic sample", "Bundled synthetic fixture")),
        )
        .unwrap();
    let source = &engine.case_summary().unwrap().sources[0];
    assert_eq!(source.name, "Synthetic sample");
    assert_eq!(source.provenance, "Bundled synthetic fixture");
}

#[cfg(unix)]
#[test]
fn failed_snapshot_publication_restores_the_original_connection() {
    let directory = tempfile::tempdir().unwrap();
    let destination = directory.path().join("occupied.dfir");
    std::os::unix::fs::symlink(directory.path().join("missing-target"), &destination).unwrap();
    let mut engine = Engine::new().unwrap();
    import(&mut engine, b"keep this evidence\n", ParserMode::Text);
    assert_eq!(engine.query(&query()).unwrap().total, 1);
    // A dangling link passes try_exists, but atomic publication must refuse it.
    // This exercises the error path after the original connection was closed.
    assert!(matches!(
        engine.save_case(&destination),
        Err(EngineError::CaseExists)
    ));
    assert!(std::fs::symlink_metadata(&destination)
        .unwrap()
        .file_type()
        .is_symlink());
    assert!(engine.case_summary().unwrap().path.is_none());
    assert_eq!(engine.detail(1).unwrap().raw, "keep this evidence");
    assert_eq!(engine.query(&query()).unwrap().total, 1);
    engine
        .save_case(&directory.path().join("recovered.dfir"))
        .unwrap();
}
