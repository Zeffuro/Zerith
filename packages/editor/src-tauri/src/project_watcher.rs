mod delivery;

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileWatcherPayload {
    path: String,
    generation: u64,
}

#[derive(Default)]
pub(crate) struct ProjectFileWatcherState {
    sessions: Mutex<HashMap<String, WatcherSession>>,
}

#[derive(Default)]
struct WatcherSession {
    latest_generation: u64,
    close_listener_registered: bool,
    watcher: Option<ProjectFileWatcher>,
}

struct ProjectFileWatcher {
    generation: u64,
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
    window: WebviewWindow,
    state: State<'_, ProjectFileWatcherState>,
    project_path: String,
    generation: u64,
) -> Result<(), String> {
    let normalized_project_path = PathBuf::from(project_path)
        .canonicalize()
        .map_err(|error| format!("Failed to resolve project path: {error}"))?;
    if !normalized_project_path.is_dir() {
        return Err("Project path is not a directory.".to_owned());
    }
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|error| format!("Project watcher lock poisoned: {error}"))?;
    let window_label = window.label().to_owned();
    let session = sessions.entry(window_label.clone()).or_default();
    if !session.close_listener_registered {
        let close_app = app_handle.clone();
        let close_label = window_label.clone();
        window.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let state = close_app.state::<ProjectFileWatcherState>();
                if let Ok(mut sessions) = state.sessions.lock() {
                    if let Some(mut session) = sessions.remove(&close_label) {
                        if let Some(watcher) = session.watcher.take() {
                            watcher.stop();
                        }
                    }
                };
            }
        });
        session.close_listener_registered = true;
    }
    if !session.accept_start(generation) {
        return Ok(());
    }

    let (event_tx, event_rx) = mpsc::sync_channel::<()>(delivery::CHANNEL_CAPACITY);
    let overflow = Arc::new(AtomicBool::new(false));
    let overflow_for_callback = Arc::clone(&overflow);
    let callback_path = normalized_project_path.clone();
    let mut watcher = RecommendedWatcher::new(
        move |event: notify::Result<notify::Event>| match event {
            Ok(event)
                if event.need_rescan()
                    || (!matches!(event.kind, EventKind::Access(_))
                        && event
                            .paths
                            .iter()
                            .any(|path| path.starts_with(&callback_path))) =>
            {
                if event_tx.try_send(()).is_err() {
                    overflow_for_callback.store(true, Ordering::Release);
                }
            }
            Err(error) => {
                eprintln!("Project watcher error: {error}");
                overflow_for_callback.store(true, Ordering::Release);
            }
            _ => {}
        },
        notify::Config::default(),
    )
    .map_err(|error| format!("Failed to create file watcher: {error}"))?;
    watcher
        .watch(&normalized_project_path, RecursiveMode::Recursive)
        .map_err(|error| format!("Failed to watch project: {error}"))?;

    if let Some(existing) = session.watcher.take() {
        existing.stop();
    }
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let worker_handle = std::thread::spawn(move || {
        delivery::process_events(event_rx, stop_rx, overflow, || {
            emit_project_invalidation(
                &app_handle,
                &window_label,
                &normalized_project_path,
                generation,
            );
        });
    });
    session.watcher = Some(ProjectFileWatcher {
        generation,
        stop_tx,
        worker_handle: Some(worker_handle),
        _watcher: watcher,
    });
    Ok(())
}

#[tauri::command]
pub(crate) fn stop_project_file_watcher(
    window: WebviewWindow,
    state: State<'_, ProjectFileWatcherState>,
    generation: u64,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|error| format!("Project watcher lock poisoned: {error}"))?;
    let session = sessions.entry(window.label().to_owned()).or_default();
    let active_generation = session.watcher.as_ref().map(|watcher| watcher.generation);
    if session.accept_stop(generation, active_generation) {
        if let Some(existing) = session.watcher.take() {
            existing.stop();
        }
    }
    Ok(())
}

impl WatcherSession {
    fn accept_start(&mut self, generation: u64) -> bool {
        if generation <= self.latest_generation {
            return false;
        }
        self.latest_generation = generation;
        true
    }

    fn accept_stop(&mut self, generation: u64, active_generation: Option<u64>) -> bool {
        self.latest_generation = self.latest_generation.max(generation);
        active_generation == Some(generation)
    }
}

fn emit_project_invalidation(
    app_handle: &AppHandle,
    window_label: &str,
    project_path: &Path,
    generation: u64,
) {
    let payload = ProjectFileWatcherPayload {
        path: project_path.to_string_lossy().to_string(),
        generation,
    };
    if let Err(error) = app_handle.emit_to(window_label, "project:file-changed", payload) {
        eprintln!("Failed to emit project invalidation: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::WatcherSession;

    #[test]
    fn stale_start_cannot_replace_a_newer_session() {
        let mut session = WatcherSession::default();
        assert!(session.accept_start(10));
        assert!(session.accept_start(12));
        assert!(!session.accept_start(11));
        assert!(!session.accept_start(12));
        assert!(!session.accept_stop(10, Some(12)));
        assert!(session.accept_stop(12, Some(12)));
        assert!(!session.accept_start(12));
    }

    #[test]
    fn cleanup_before_start_cancels_that_pending_generation() {
        let mut session = WatcherSession::default();
        assert!(!session.accept_stop(10, None));
        assert!(!session.accept_start(10));
        assert!(session.accept_start(11));
    }
}
