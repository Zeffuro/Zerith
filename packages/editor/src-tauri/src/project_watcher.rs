use notify::event::ModifyKind;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileWatcherPayload {
    path: String,
}

#[derive(Default)]
pub(crate) struct ProjectFileWatcherState {
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

#[tauri::command]
pub(crate) fn start_project_file_watcher(
    app_handle: AppHandle,
    state: State<'_, ProjectFileWatcherState>,
    project_path: String,
) -> Result<(), String> {
    let requested_path = PathBuf::from(project_path);
    if !requested_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            requested_path.display()
        ));
    }

    if !requested_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            requested_path.display()
        ));
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
        .map_err(|error| {
            format!(
                "Failed to watch project path '{}': {error}",
                normalized_project_path.display()
            )
        })?;

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let app_handle_for_thread = app_handle.clone();
    let project_path_for_thread = normalized_project_path.clone();
    let worker_handle = std::thread::spawn(move || {
        process_project_file_events(
            app_handle_for_thread,
            project_path_for_thread,
            event_rx,
            stop_rx,
        )
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
pub(crate) fn stop_project_file_watcher(
    state: State<'_, ProjectFileWatcherState>,
) -> Result<(), String> {
    let mut watcher_guard = state
        .watcher
        .lock()
        .map_err(|error| format!("Project watcher lock poisoned: {error}"))?;

    if let Some(existing_watcher) = watcher_guard.take() {
        existing_watcher.stop();
    }

    Ok(())
}

fn emit_project_file_event(
    app_handle: &AppHandle,
    event_name: &str,
    project_path: &Path,
    path: &Path,
) {
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
                        emit_project_file_event(
                            app_handle,
                            "project:file-removed",
                            project_path,
                            old_path,
                        );
                    }

                    if let Some(new_path) = event.paths.get(1) {
                        emit_project_file_event(
                            app_handle,
                            "project:file-added",
                            project_path,
                            new_path,
                        );
                    }
                } else {
                    for path in &event.paths {
                        emit_project_file_event(
                            app_handle,
                            "project:file-changed",
                            project_path,
                            path,
                        );
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
