mod export;
mod git;
mod project_watcher;

use project_watcher::ProjectFileWatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProjectFileWatcherState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            export::export_game,
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
