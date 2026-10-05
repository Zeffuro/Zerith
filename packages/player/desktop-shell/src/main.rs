#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod archive;
mod archive_bounds;
mod window_state;

use archive::GameArchive;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use window_state::{desktop_get_window_state, desktop_set_fullscreen, Preferences};

fn trusted_url(url: &tauri::Url) -> bool {
    url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && matches!(
            (url.scheme(), url.host_str()),
            ("game", Some("localhost")) | ("http", Some("game.localhost"))
        )
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let executable = std::env::current_exe()?;
    let archive = Arc::new(GameArchive::open(&executable.with_file_name("game.zpack"))?);
    let protocol = Arc::clone(&archive);
    tauri::Builder::default()
        .register_uri_scheme_protocol("game", move |_, request| protocol.respond(request))
        .invoke_handler(tauri::generate_handler![desktop_get_window_state, desktop_set_fullscreen])
        .setup(move |app| {
            let metadata = &archive.metadata;
            let data_base = match std::env::var_os("ZERITH_PLAYER_DATA_DIR") {
                Some(path) => std::path::PathBuf::from(path),
                None => app.path().app_local_data_dir()?,
            };
            let data = data_base.join(&metadata.game_id);
            std::fs::create_dir_all(data.join("webview"))?;
            let preferences = Preferences::load(data.join("window.json"), metadata, app.available_monitors()?);
            let saved = preferences.saved();
            app.manage(preferences);
            let injected = serde_json::json!({
                "gameId": metadata.game_id, "title": metadata.title,
                "width": metadata.width, "height": metadata.height,
            });
            let script = format!("Object.defineProperty(window, '__ZERITH_DESKTOP__', {{ value: Object.freeze({injected}), writable: false, configurable: false }})");
            let mut profile_id = [0u8; 16];
            profile_id.copy_from_slice(&Sha256::digest(metadata.game_id.as_bytes())[..16]);
            let url = if cfg!(windows) { "http://game.localhost/" } else { "game://localhost/" };
            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse()?))
                .title(&metadata.title)
                .inner_size(saved.width, saved.height)
                .min_inner_size(320.0, 240.0)
                .resizable(true)
                .visible(false)
                .disable_drag_drop_handler()
                .data_directory(data.join("webview"))
                .data_store_identifier(profile_id)
                .initialization_script(script)
                .on_navigation(trusted_url)
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .on_download(|_, _| false);
            if saved.x.is_none() { builder = builder.center(); }
            let window = builder.build()?;
            if let (Some(x), Some(y)) = (saved.x, saved.y) {
                window.set_position(tauri::PhysicalPosition::new(x, y))?;
            }
            if saved.maximized { window.maximize()?; }
            if saved.fullscreen { window.set_fullscreen(true)?; }
            window.show()?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let Some(preferences) = window.try_state::<Preferences>() {
                    preferences.observe(window, event);
                }
            }
        })
        .run(tauri::generate_context!())?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Cannot start game player: {error}");
        std::process::exit(1);
    }
}
