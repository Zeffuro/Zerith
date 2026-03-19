use notify::event::ModifyKind;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Duration;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportGameRequest {
    base: Option<String>,
    game_path: String,
    out_dir: Option<String>,
    zip: Option<bool>,
    zip_file: Option<String>,
}

#[derive(Debug, Serialize)]
struct ExportGameResponse {
    stderr: String,
    stdout: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileWatcherPayload {
    path: String,
}

#[derive(Default)]
struct ProjectFileWatcherState {
    watcher: Mutex<Option<ProjectFileWatcher>>,
}

struct ProjectFileWatcher {
    project_path: PathBuf,
    stop_tx: Sender<()>,
    worker_handle: Option<JoinHandle<()>>,
    _watcher: RecommendedWatcher,
}

impl ProjectFileWatcher {
    fn stop(mut self) {
        let _ = self.stop_tx.send(());
        if let Some(worker_handle) = self.worker_handle.take() {
            let _ = worker_handle.join();
        }
    }
}

fn find_workspace_root(start: &Path) -> Option<PathBuf> {
    for candidate in start.ancestors() {
        let package_manifest = candidate.join("package.json");
        let build_script = candidate
            .join("packages")
            .join("player")
            .join("scripts")
            .join("build-game.mjs");

        if package_manifest.exists() && build_script.exists() {
            return Some(candidate.to_path_buf());
        }
    }

    None
}

fn npm_executable() -> OsString {
    if cfg!(target_os = "windows") {
        OsString::from("npm.cmd")
    } else {
        OsString::from("npm")
    }
}

#[tauri::command]
fn start_project_file_watcher(
    app_handle: AppHandle,
    state: State<'_, ProjectFileWatcherState>,
    project_path: String,
) -> Result<(), String> {
    let requested_path = PathBuf::from(project_path);
    if !requested_path.exists() {
        return Err(format!("Project path does not exist: {}", requested_path.display()));
    }

    if !requested_path.is_dir() {
        return Err(format!("Project path is not a directory: {}", requested_path.display()));
    }

    let normalized_project_path = requested_path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve project path: {error}"))?;

    let mut watcher_guard = state
        .watcher
        .lock()
        .map_err(|error| format!("Project watcher lock poisoned: {error}"))?;

    if let Some(existing_watcher) = watcher_guard.as_ref() {
        if paths_match(&existing_watcher.project_path, &normalized_project_path) {
            return Ok(());
        }
    }

    if let Some(existing_watcher) = watcher_guard.take() {
        existing_watcher.stop();
    }

    let (event_tx, event_rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher = RecommendedWatcher::new(
        move |event| {
            let _ = event_tx.send(event);
        },
        notify::Config::default(),
    )
    .map_err(|error| format!("Failed to create file watcher: {error}"))?;

    watcher
        .watch(&normalized_project_path, RecursiveMode::Recursive)
        .map_err(|error| format!("Failed to watch project path '{}': {error}", normalized_project_path.display()))?;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let app_handle_for_thread = app_handle.clone();
    let project_path_for_thread = normalized_project_path.clone();
    let worker_handle = std::thread::spawn(move || {
        process_project_file_events(app_handle_for_thread, project_path_for_thread, event_rx, stop_rx)
    });

    *watcher_guard = Some(ProjectFileWatcher {
        project_path: normalized_project_path,
        stop_tx,
        worker_handle: Some(worker_handle),
        _watcher: watcher,
    });

    Ok(())
}

#[tauri::command]
fn stop_project_file_watcher(state: State<'_, ProjectFileWatcherState>) -> Result<(), String> {
    let mut watcher_guard = state
        .watcher
        .lock()
        .map_err(|error| format!("Project watcher lock poisoned: {error}"))?;

    if let Some(existing_watcher) = watcher_guard.take() {
        existing_watcher.stop();
    }

    Ok(())
}

#[tauri::command]
fn export_game(request: ExportGameRequest) -> Result<ExportGameResponse, String> {
    let current_dir = std::env::current_dir().map_err(|error| format!("Failed to read current directory: {error}"))?;
    let workspace_root = find_workspace_root(&current_dir).ok_or_else(|| {
        format!(
            "Failed to locate workspace root from {}",
            current_dir.display()
        )
    })?;

    let mut args: Vec<String> = vec![
        "run".to_owned(),
        "build:game".to_owned(),
        "--".to_owned(),
        "--game".to_owned(),
        request.game_path,
    ];

    if let Some(out_dir) = request.out_dir {
        args.push("--outDir".to_owned());
        args.push(out_dir);
    }

    if request.zip.unwrap_or(false) {
        args.push("--zip".to_owned());
    }

    if let Some(zip_file) = request.zip_file {
        args.push("--zipFile".to_owned());
        args.push(zip_file);
    }

    if let Some(base) = request.base {
        args.push("--base".to_owned());
        args.push(base);
    }

    let output = Command::new(npm_executable())
        .args(&args)
        .current_dir(&workspace_root)
        .output()
        .map_err(|error| format!("Failed to run export command: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let combined = if stderr.trim().is_empty() {
            stdout.clone()
        } else if stdout.trim().is_empty() {
            stderr.clone()
        } else {
            format!("{stderr}\n{stdout}")
        };
        return Err(combined.trim().to_owned());
    }

    Ok(ExportGameResponse { stderr, stdout })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProjectFileWatcherState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            export_game,
            start_project_file_watcher,
            stop_project_file_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn emit_project_file_event(app_handle: &AppHandle, event_name: &str, project_path: &Path, path: &Path) {
    if !path.starts_with(project_path) {
        return;
    }

    let payload = ProjectFileWatcherPayload {
        path: path.to_string_lossy().to_string(),
    };

    if let Err(error) = app_handle.emit(event_name, payload) {
        eprintln!("Failed to emit '{event_name}' event: {error}");
    }
}

fn flush_project_file_events(app_handle: &AppHandle, project_path: &Path, events: &mut Vec<Event>) {
    for event in events.drain(..) {
        match event.kind {
            EventKind::Create(_) => {
                for path in &event.paths {
                    emit_project_file_event(app_handle, "project:file-added", project_path, path);
                }
            }
            EventKind::Remove(_) => {
                for path in &event.paths {
                    emit_project_file_event(app_handle, "project:file-removed", project_path, path);
                }
            }
            EventKind::Modify(ModifyKind::Name(_)) => {
                if event.paths.len() >= 2 {
                    if let Some(old_path) = event.paths.first() {
                        emit_project_file_event(app_handle, "project:file-removed", project_path, old_path);
                    }

                    if let Some(new_path) = event.paths.get(1) {
                        emit_project_file_event(app_handle, "project:file-added", project_path, new_path);
                    }
                } else {
                    for path in &event.paths {
                        emit_project_file_event(app_handle, "project:file-changed", project_path, path);
                    }
                }
            }
            EventKind::Modify(_) | EventKind::Any | EventKind::Other => {
                for path in &event.paths {
                    emit_project_file_event(app_handle, "project:file-changed", project_path, path);
                }
            }
            EventKind::Access(_) => {}
        }
    }
}

fn process_project_file_events(
    app_handle: AppHandle,
    project_path: PathBuf,
    event_rx: Receiver<notify::Result<Event>>,
    stop_rx: Receiver<()>,
) {
    let mut buffered_events: Vec<Event> = Vec::new();

    loop {
        if stop_rx.try_recv().is_ok() {
            break;
        }

        match event_rx.recv_timeout(Duration::from_millis(200)) {
            Ok(Ok(event)) => buffered_events.push(event),
            Ok(Err(error)) => eprintln!("Project watcher error: {error}"),
            Err(RecvTimeoutError::Timeout) => {
                if buffered_events.is_empty() {
                    continue;
                }

                flush_project_file_events(&app_handle, &project_path, &mut buffered_events);
            }
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }

    if !buffered_events.is_empty() {
        flush_project_file_events(&app_handle, &project_path, &mut buffered_events);
    }
}

fn paths_match(left: &Path, right: &Path) -> bool {
    let left_value = left.to_string_lossy();
    let right_value = right.to_string_lossy();
    left_value.eq_ignore_ascii_case(&right_value)
}

