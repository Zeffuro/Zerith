mod export;
mod git;
mod installed_smoke;
mod native_fs;
mod project_watcher;

use project_watcher::ProjectFileWatcherState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let smoke =
        installed_smoke::InstalledSmokeState::from_args().expect("invalid installed smoke config");
    let smoke_enabled = smoke.enabled();
    tauri::Builder::default()
        .manage(smoke)
        .setup(move |app| {
            if smoke_enabled {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide()?;
                }
            }
            Ok(())
        })
        .manage(ProjectFileWatcherState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            installed_smoke::installed_smoke_config,
            installed_smoke::installed_smoke_complete,
            export::export_game,
            export::hash_export_sources,
            native_fs::write_text_file_atomic,
            native_fs::write_binary_file_atomic,
            native_fs::copy_asset_file_exclusive,
            git::commands::git_branch_summary,
            git::commands::git_checkout_branch,
            git::commands::git_commit_staged,
            git::commands::git_create_branch,
            git::commands::git_diff_file,
            git::commands::git_diff_summary,
            git::commands::git_init_repository,
            git::commands::git_push_current_branch,
            git::commands::git_remote_summary,
            git::commands::git_stage_all,
            git::commands::git_stage_file,
            git::commands::git_status,
            git::commands::git_unstage_file,
            project_watcher::start_project_file_watcher,
            project_watcher::stop_project_file_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
