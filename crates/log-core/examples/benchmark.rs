use dfir_log_core::{Engine, ParserMode, Query, PAGE_SIZE};
use serde_json::json;
use std::{
    io::{BufWriter, Write},
    sync::atomic::AtomicBool,
    time::Instant,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let events: u64 = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "1000000".into())
        .parse()?;
    if events == 0 || events > 10_000_000 {
        return Err("Choose between 1 and 10,000,000 synthetic events.".into());
    }
    let mut source = tempfile::NamedTempFile::new()?;
    {
        let mut writer = BufWriter::new(source.as_file_mut());
        for index in 0..events {
            let (route, status) = if index % 100 == 0 {
                ("/login", 401)
            } else {
                ("/api/health", 200)
            };
            writeln!(writer, "192.0.2.10 - - [13/Oct/2026:09:14:00 +0000] \"GET {route} HTTP/1.1\" {status} 128 \"-\" \"SyntheticBenchmark/1.0\"")?;
        }
        writer.flush()?;
    }
    let mut engine = Engine::new()?;
    let started = Instant::now();
    let imported = engine.import(
        source.path(),
        ParserMode::Auto,
        &AtomicBool::new(false),
        |_| {},
    )?;
    let seconds = started.elapsed().as_secs_f64();
    assert_eq!(imported.total_events, events);
    assert_eq!(imported.parsed_events, events);
    let query = Query {
        limit: PAGE_SIZE,
        ..Default::default()
    };
    let first = engine.query(&query)?;
    assert_eq!(first.total, events);
    let mut search_ms = Vec::new();
    for _ in 0..5 {
        let page = engine.query(&Query {
            search: "/login".into(),
            ..query.clone()
        })?;
        assert_eq!(page.total, events.div_ceil(100));
        search_ms.push(page.elapsed_ms);
    }
    let last = engine.query(&Query {
        offset: events.saturating_sub(PAGE_SIZE as u64),
        ..query
    })?;
    assert_eq!(last.rows.last().unwrap().id, events);
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "profile": if cfg!(debug_assertions) { "debug" } else { "release" },
            "events": events,
            "source_bytes": imported.total_bytes,
            "import_seconds": seconds,
            "import_mib_per_second": imported.total_bytes as f64 / 1048576.0 / seconds,
            "events_per_second": events as f64 / seconds,
            "first_page_ms": first.elapsed_ms,
            "literal_search_ms": search_ms,
            "last_page_ms": last.elapsed_ms,
            "database_memory_limit": "512MB (not a process-wide cap)",
            "duckdb_threads": 2
        }))?
    );
    Ok(())
}
