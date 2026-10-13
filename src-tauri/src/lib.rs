use dfir_log_core::{
    Engine, EventDetail, ImportProgress, ParserMode, Query, QueryPage, SourceSummary,
};
use std::{
    io::Write,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{ipc::Channel, State};
use tauri_plugin_dialog::DialogExt;

struct AppState {
    engine: Arc<Mutex<Engine>>,
    selected: Arc<Mutex<Option<PathBuf>>>,
    cancelled: Arc<AtomicBool>,
    busy: Arc<AtomicBool>,
}

struct BusyGuard(Arc<AtomicBool>);
impl Drop for BusyGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn lock_error() -> String {
    "The local session is unavailable. Restart the application.".into()
}

#[tauri::command]
async fn pick_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    if state.busy.load(Ordering::Acquire) {
        return Err("Wait for the current import to finish or cancel it.".into());
    }
    let selected = Arc::clone(&state.selected);
    tauri::async_runtime::spawn_blocking(move || {
        let file = app
            .dialog()
            .file()
            .add_filter("Log and text files", &["log", "txt", "access", "out"])
            .add_filter("All files", &["*"])
            .blocking_pick_file();
        let Some(file) = file else { return Ok(None) };
        let path = file
            .into_path()
            .map_err(|_| "Select a local file.".to_string())?;
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        *selected.lock().map_err(|_| lock_error())? = Some(path);
        Ok(Some(name))
    })
    .await
    .map_err(|_| lock_error())?
}

#[tauri::command]
async fn import_file(
    mode: ParserMode,
    on_progress: Channel<ImportProgress>,
    state: State<'_, AppState>,
) -> Result<SourceSummary, String> {
    let path = state
        .selected
        .lock()
        .map_err(|_| lock_error())?
        .clone()
        .ok_or_else(|| "Choose a source file first.".to_string())?;
    start_import(state, Some(path), mode, on_progress).await
}

#[tauri::command]
async fn import_demo(
    on_progress: Channel<ImportProgress>,
    state: State<'_, AppState>,
) -> Result<SourceSummary, String> {
    start_import(state, None, ParserMode::Auto, on_progress).await
}

async fn start_import(
    state: State<'_, AppState>,
    path: Option<PathBuf>,
    mode: ParserMode,
    on_progress: Channel<ImportProgress>,
) -> Result<SourceSummary, String> {
    state
        .busy
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| "An import is already running.".to_string())?;
    state.cancelled.store(false, Ordering::Relaxed);
    let engine = Arc::clone(&state.engine);
    let cancelled = Arc::clone(&state.cancelled);
    let guard = BusyGuard(Arc::clone(&state.busy));
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let is_demo = path.is_none();
        let mut sample = None;
        let source_path = match path {
            Some(path) => path,
            None => {
                let mut file = tempfile::Builder::new()
                    .prefix("synthetic-apache-")
                    .suffix(".log")
                    .tempfile()
                    .map_err(|_| "Unable to create the local sample.".to_string())?;
                file.write_all(include_bytes!("../../tests/fixtures/apache-mixed.log"))
                    .map_err(|_| "Unable to write the local sample.".to_string())?;
                let path = file.path().to_path_buf();
                sample = Some(file);
                path
            }
        };
        let result = engine
            .lock()
            .map_err(|_| lock_error())?
            .import(&source_path, mode, &cancelled, |progress| {
                if on_progress.send(progress).is_err() {
                    cancelled.store(true, Ordering::Relaxed);
                }
            })
            .map_err(|error| error.to_string());
        drop(sample);
        result.map(|mut summary| {
            if is_demo {
                summary.name = "apache-mixed.log (synthetic sample)".into();
            }
            summary
        })
    })
    .await
    .map_err(|_| lock_error())?
}

#[tauri::command]
fn cancel_import(state: State<'_, AppState>) {
    state.cancelled.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn query_events(query: Query, state: State<'_, AppState>) -> Result<QueryPage, String> {
    if state.busy.load(Ordering::Acquire) {
        return Err("Wait for the import to finish.".into());
    }
    let engine = Arc::clone(&state.engine);
    tauri::async_runtime::spawn_blocking(move || {
        engine
            .lock()
            .map_err(|_| lock_error())?
            .query(&query)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|_| lock_error())?
}

#[tauri::command]
async fn event_detail(id: u64, state: State<'_, AppState>) -> Result<EventDetail, String> {
    if state.busy.load(Ordering::Acquire) {
        return Err("Wait for the import to finish.".into());
    }
    let engine = Arc::clone(&state.engine);
    tauri::async_runtime::spawn_blocking(move || {
        engine
            .lock()
            .map_err(|_| lock_error())?
            .detail(id)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|_| lock_error())?
}

pub fn run() {
    let engine = match Engine::new() {
        Ok(engine) => engine,
        Err(_) => {
            eprintln!("Unable to initialize local session storage. Check available disk space and temporary-directory access.");
            std::process::exit(1);
        }
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            engine: Arc::new(Mutex::new(engine)),
            selected: Arc::new(Mutex::new(None)),
            cancelled: Arc::new(AtomicBool::new(false)),
            busy: Arc::new(AtomicBool::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            pick_file,
            import_file,
            import_demo,
            cancel_import,
            query_events,
            event_detail
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start the desktop application");
}
