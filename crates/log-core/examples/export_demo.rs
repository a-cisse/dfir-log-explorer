use dfir_log_core::{Engine, ParserMode, Query, PAGE_SIZE};
use serde_json::json;
use std::{path::Path, sync::atomic::AtomicBool};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut engine = Engine::new()?;
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/apache-mixed.log");
    let mut summary = engine.import(&path, ParserMode::Auto, &AtomicBool::new(false), |_| {})?;
    summary.name = "apache-mixed.log (synthetic sample)".into();
    summary.elapsed_ms = 0;
    summary.provenance = "Bundled synthetic fixture".into();
    let page = engine.query(&Query {
        limit: PAGE_SIZE,
        ..Default::default()
    })?;
    let events = page
        .rows
        .iter()
        .map(|row| engine.detail(row.id))
        .collect::<Result<Vec<_>, _>>()?;
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({ "summary": summary, "events": events }))?
    );
    Ok(())
}
