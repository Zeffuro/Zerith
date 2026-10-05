use crate::{archive::Metadata, trusted_url};
use serde::{Deserialize, Serialize};
use std::{
    io::Write,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{Monitor, State, WebviewWindow, Window, WindowEvent};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedWindow {
    pub width: f64,
    pub height: f64,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub scale: f64,
    pub fullscreen: bool,
    pub maximized: bool,
}

struct Stored {
    saved: SavedWindow,
    suppressed_until: Instant,
}

pub struct Preferences {
    path: PathBuf,
    stored: Mutex<Stored>,
}

#[derive(Serialize)]
pub struct WindowState {
    fullscreen: bool,
    width: f64,
    height: f64,
    maximized: bool,
}

impl SavedWindow {
    fn valid(&self) -> bool {
        self.width.is_finite()
            && self.height.is_finite()
            && self.scale.is_finite()
            && (320.0..=8192.0).contains(&self.width)
            && (240.0..=8192.0).contains(&self.height)
            && (0.5..=8.0).contains(&self.scale)
            && self.x.is_some() == self.y.is_some()
    }

    fn clamp(&mut self, monitors: &[Monitor]) {
        let selected = monitors
            .iter()
            .find(|monitor| {
                let area = monitor.work_area();
                self.x.zip(self.y).is_some_and(|(x, y)| {
                    i64::from(x) >= i64::from(area.position.x)
                        && i64::from(y) >= i64::from(area.position.y)
                        && i64::from(x) < i64::from(area.position.x) + i64::from(area.size.width)
                        && i64::from(y) < i64::from(area.position.y) + i64::from(area.size.height)
                })
            })
            .or_else(|| monitors.first());
        let Some(monitor) = selected else {
            self.x = None;
            self.y = None;
            return;
        };
        let area = monitor.work_area();
        self.scale = monitor.scale_factor();
        self.width = self
            .width
            .min((f64::from(area.size.width) / self.scale - 32.0).max(320.0));
        self.height = self
            .height
            .min((f64::from(area.size.height) / self.scale - 64.0).max(240.0));
        if let (Some(x), Some(y)) = (self.x, self.y) {
            let max_x = i64::from(area.position.x) + i64::from(area.size.width)
                - (self.width * self.scale).ceil() as i64
                - 16;
            let max_y = i64::from(area.position.y) + i64::from(area.size.height)
                - (self.height * self.scale).ceil() as i64
                - 48;
            self.x = Some(i64::from(x).clamp(
                i64::from(area.position.x),
                max_x.max(i64::from(area.position.x)),
            ) as i32);
            self.y = Some(i64::from(y).clamp(
                i64::from(area.position.y),
                max_y.max(i64::from(area.position.y)),
            ) as i32);
        }
    }
}

impl Preferences {
    pub fn load(path: PathBuf, metadata: &Metadata, monitors: Vec<Monitor>) -> Self {
        let fallback = SavedWindow {
            width: f64::from(metadata.width),
            height: f64::from(metadata.height),
            x: None,
            y: None,
            scale: 1.0,
            fullscreen: false,
            maximized: false,
        };
        let mut saved = std::fs::metadata(&path)
            .ok()
            .filter(|info| info.len() <= 4096)
            .and_then(|_| std::fs::read(&path).ok())
            .and_then(|bytes| serde_json::from_slice::<SavedWindow>(&bytes).ok())
            .filter(SavedWindow::valid)
            .unwrap_or(fallback);
        saved.clamp(&monitors);
        Self {
            path,
            stored: Mutex::new(Stored {
                saved,
                suppressed_until: Instant::now() + Duration::from_millis(800),
            }),
        }
    }

    pub fn saved(&self) -> SavedWindow {
        self.stored.lock().unwrap().saved.clone()
    }

    fn write(&self, saved: &SavedWindow) -> Result<(), String> {
        let parent = self
            .path
            .parent()
            .ok_or("Window preferences directory is missing")?;
        let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        temporary
            .write_all(&serde_json::to_vec(saved).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        temporary.as_file().sync_all().map_err(|e| e.to_string())?;
        temporary.persist(&self.path).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn capture(&self, window: &Window) {
        if Instant::now() < self.stored.lock().unwrap().suppressed_until {
            return;
        }
        let Ok(fullscreen) = window.is_fullscreen() else {
            return;
        };
        let Ok(maximized) = window.is_maximized() else {
            return;
        };
        let geometry = if fullscreen || maximized || window.is_minimized().unwrap_or(true) {
            None
        } else {
            match (
                window.inner_size(),
                window.outer_position(),
                window.scale_factor(),
            ) {
                (Ok(size), Ok(position), Ok(scale)) => Some((size, position, scale)),
                _ => None,
            }
        };
        let fullscreen = window.is_fullscreen().unwrap_or(fullscreen);
        let maximized = window.is_maximized().unwrap_or(maximized);
        let mut stored = self.stored.lock().unwrap();
        if Instant::now() < stored.suppressed_until {
            return;
        }
        stored.saved.fullscreen = fullscreen;
        if fullscreen {
            return;
        }
        stored.saved.maximized = maximized;
        if maximized {
            return;
        }
        if let Some((size, position, scale)) = geometry {
            let width = f64::from(size.width) / scale;
            let height = f64::from(size.height) / scale;
            if (320.0..=8192.0).contains(&width) && (240.0..=8192.0).contains(&height) {
                stored.saved.width = width;
                stored.saved.height = height;
                stored.saved.x = Some(position.x);
                stored.saved.y = Some(position.y);
                stored.saved.scale = scale;
            }
        }
    }

    pub fn observe(&self, window: &Window, event: &WindowEvent) {
        // Moved can precede the native maximized-state update.
        if matches!(
            event,
            WindowEvent::Resized(_)
                | WindowEvent::ScaleFactorChanged { .. }
                | WindowEvent::CloseRequested { .. }
        ) {
            self.capture(window);
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                let saved = self.saved();
                if let Err(error) = self.write(&saved) {
                    eprintln!("Cannot save window preferences: {error}");
                }
            }
        }
    }
}

fn state(window: &WebviewWindow) -> Result<WindowState, String> {
    if window.label() != "main" || !trusted_url(&window.url().map_err(|e| e.to_string())?) {
        return Err("Desktop window commands are unavailable for this origin".into());
    }
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    Ok(WindowState {
        fullscreen: window.is_fullscreen().map_err(|e| e.to_string())?,
        width: f64::from(size.width) / scale,
        height: f64::from(size.height) / scale,
        maximized: window.is_maximized().map_err(|e| e.to_string())?,
    })
}

#[tauri::command]
pub fn desktop_get_window_state(window: WebviewWindow) -> Result<WindowState, String> {
    state(&window)
}

#[tauri::command]
pub fn desktop_set_fullscreen(
    window: WebviewWindow,
    preferences: State<'_, Preferences>,
    fullscreen: bool,
) -> Result<WindowState, String> {
    let before = state(&window)?;
    if before.fullscreen == fullscreen {
        return Ok(before);
    }
    preferences.capture(&window.as_ref().window());
    let previous = preferences.saved();
    {
        let mut stored = preferences.stored.lock().unwrap();
        stored.suppressed_until = Instant::now() + Duration::from_millis(800);
    }
    window
        .set_fullscreen(fullscreen)
        .map_err(|e| e.to_string())?;
    if !fullscreen && previous.maximized {
        window.maximize().map_err(|e| e.to_string())?;
    }
    let saved = {
        let mut stored = preferences.stored.lock().unwrap();
        stored.saved.fullscreen = fullscreen;
        stored.saved.clone()
    };
    preferences.write(&saved)?;
    state(&window)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preference_validation_rejects_unusable_bounds() {
        let mut saved = SavedWindow {
            width: 1280.0,
            height: 720.0,
            x: None,
            y: None,
            scale: 1.0,
            fullscreen: false,
            maximized: false,
        };
        assert!(saved.valid());
        saved.width = f64::INFINITY;
        assert!(!saved.valid());
        saved.width = 1280.0;
        saved.x = Some(0);
        assert!(!saved.valid());
        saved.y = Some(0);
        saved.scale = 0.0;
        assert!(!saved.valid());
    }
}
