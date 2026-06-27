use notify::event::ModifyKind;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportGameRequest {
    base: Option<String>,
    cache_policy: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusRequest {
    project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCreateBranchRequest {
    branch_name: String,
    project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCheckoutBranchRequest {
    branch_name: String,
    project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitStagedRequest {
    message: String,
    project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitPushCurrentBranchRequest {
    dry_run: Option<bool>,
    project_path: String,
    remote_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStageAllResponse {
    is_repository: bool,
    raw_output: String,
    repository_root: Option<String>,
    staged_count: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitRemoteEntry {
    fetch_url: Option<String>,
    name: String,
    push_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitRemoteSummaryResponse {
    is_repository: bool,
    raw_remotes: String,
    remotes: Vec<GitRemoteEntry>,
    repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitPushCurrentBranchResponse {
    branch_name: Option<String>,
    dry_run: bool,
    is_repository: bool,
    raw_output: String,
    remote_name: Option<String>,
    repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusEntry {
    index: String,
    path: String,
    working_tree: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusResponse {
    ahead: u32,
    behind: u32,
    branch: Option<String>,
    entries: Vec<GitStatusEntry>,
    is_repository: bool,
    raw_status: String,
    repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitBranchEntry {
    current: bool,
    name: String,
    upstream: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitBranchSummaryResponse {
    branches: Vec<GitBranchEntry>,
    current: Option<String>,
    is_repository: bool,
    raw_branches: String,
    repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCreateBranchResponse {
    branch_name: Option<String>,
    is_repository: bool,
    raw_output: String,
    repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCheckoutBranchResponse {
    branch_name: Option<String>,
    is_repository: bool,
    raw_output: String,
    repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitStagedResponse {
    commit_hash: Option<String>,
    is_repository: bool,
    raw_output: String,
    repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffFileSummary {
    binary: bool,
    deletions: u32,
    insertions: u32,
    path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffSummaryResponse {
    files: Vec<GitDiffFileSummary>,
    is_repository: bool,
    raw_numstat: String,
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
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to read current directory: {error}"))?;
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

    if let Some(cache_policy) = request.cache_policy {
        args.push("--cachePolicy".to_owned());
        args.push(cache_policy);
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

#[tauri::command]
fn git_status(request: GitStatusRequest) -> Result<GitStatusResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(empty_git_status_response(false));
    }

    let repository_root = run_git_command(&project_path, &["rev-parse", "--show-toplevel"])
        .ok()
        .and_then(|output| {
            if !output.status.success() {
                return None;
            }

            let root = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            if root.is_empty() {
                None
            } else {
                Some(root)
            }
        });

    let status_output = run_git_command(&project_path, &["status", "--porcelain=v1", "--branch"])?;
    let stdout = String::from_utf8_lossy(&status_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&status_output.stderr).to_string();
    if !status_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    let mut response = empty_git_status_response(true);
    response.raw_status = stdout.clone();
    response.repository_root = repository_root;

    for line in stdout.lines() {
        if let Some(branch_line) = line.strip_prefix("## ") {
            parse_git_branch_line(branch_line, &mut response);
            continue;
        }

        if let Some(entry) = parse_git_status_entry(line) {
            response.entries.push(entry);
        }
    }

    Ok(response)
}

#[tauri::command]
fn git_diff_summary(request: GitStatusRequest) -> Result<GitDiffSummaryResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(empty_git_diff_summary_response(false));
    }

    let unstaged = run_git_numstat(&project_path, &["diff", "--numstat", "--"])?;
    let staged = run_git_numstat(&project_path, &["diff", "--cached", "--numstat", "--"])?;
    let raw_numstat = join_git_numstat_output(&unstaged, &staged);
    let files = parse_git_numstat_summary(&raw_numstat);

    Ok(GitDiffSummaryResponse {
        files,
        is_repository: true,
        raw_numstat,
    })
}

#[tauri::command]
fn git_branch_summary(request: GitStatusRequest) -> Result<GitBranchSummaryResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(empty_git_branch_summary_response(false));
    }

    let repository_root = read_git_repository_root(&project_path);
    let branch_output = run_git_command(
        &project_path,
        &[
            "branch",
            "--format=%(HEAD)%09%(refname:short)%09%(upstream:short)",
        ],
    )?;
    let stdout = String::from_utf8_lossy(&branch_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&branch_output.stderr).to_string();
    if !branch_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    let branches = parse_git_branch_summary(&stdout);
    let current = branches
        .iter()
        .find(|branch| branch.current)
        .map(|branch| branch.name.clone());

    Ok(GitBranchSummaryResponse {
        branches,
        current,
        is_repository: true,
        raw_branches: stdout,
        repository_root,
    })
}

#[tauri::command]
fn git_create_branch(request: GitCreateBranchRequest) -> Result<GitCreateBranchResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(GitCreateBranchResponse {
            branch_name: None,
            is_repository: false,
            raw_output: String::new(),
            repository_root: None,
        });
    }

    let branch_name = request.branch_name.trim();
    if branch_name.is_empty() {
        return Err("Branch name is required.".to_owned());
    }

    if branch_name.starts_with('-') {
        return Err("Branch name cannot start with '-'.".to_owned());
    }

    validate_git_branch_name(&project_path, branch_name)?;
    if git_branch_exists(&project_path, branch_name)? {
        return Err(format!("Branch already exists: {branch_name}"));
    }

    let branch_output = run_git_command(&project_path, &["branch", branch_name])?;
    let stdout = String::from_utf8_lossy(&branch_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&branch_output.stderr).to_string();
    if !branch_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitCreateBranchResponse {
        branch_name: Some(branch_name.to_owned()),
        is_repository: true,
        raw_output: stdout,
        repository_root: read_git_repository_root(&project_path),
    })
}

#[tauri::command]
fn git_checkout_branch(
    request: GitCheckoutBranchRequest,
) -> Result<GitCheckoutBranchResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(GitCheckoutBranchResponse {
            branch_name: None,
            is_repository: false,
            raw_output: String::new(),
            repository_root: None,
        });
    }

    let branch_name = request.branch_name.trim();
    if branch_name.is_empty() {
        return Err("Branch name is required.".to_owned());
    }

    if branch_name.starts_with('-') {
        return Err("Branch name cannot start with '-'.".to_owned());
    }

    validate_git_branch_name(&project_path, branch_name)?;
    if !git_branch_exists(&project_path, branch_name)? {
        return Err(format!("Branch does not exist: {branch_name}"));
    }

    if !is_git_worktree_clean(&project_path)? {
        return Err(
            "Checkout aborted: save, commit, or stash project changes before switching branches."
                .to_owned(),
        );
    }

    let checkout_output = run_git_command(&project_path, &["checkout", branch_name])?;
    let stdout = String::from_utf8_lossy(&checkout_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&checkout_output.stderr).to_string();
    if !checkout_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitCheckoutBranchResponse {
        branch_name: Some(branch_name.to_owned()),
        is_repository: true,
        raw_output: join_git_command_output(&stdout, &stderr),
        repository_root: read_git_repository_root(&project_path),
    })
}

#[tauri::command]
fn git_commit_staged(request: GitCommitStagedRequest) -> Result<GitCommitStagedResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(GitCommitStagedResponse {
            commit_hash: None,
            is_repository: false,
            raw_output: String::new(),
            repository_root: None,
        });
    }

    let message = request.message.trim();
    if message.is_empty() {
        return Err("Commit message is required.".to_owned());
    }

    let status = read_git_porcelain_status(&project_path)?;
    if !has_staged_changes(&status) {
        return Err("Commit aborted: stage changes before committing.".to_owned());
    }

    if has_unstaged_or_untracked_changes(&status) {
        return Err(
            "Commit aborted: save, stage, or remove unstaged/untracked changes before committing."
                .to_owned(),
        );
    }

    let commit_output = run_git_command(&project_path, &["commit", "-m", message])?;
    let stdout = String::from_utf8_lossy(&commit_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&commit_output.stderr).to_string();
    if !commit_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitCommitStagedResponse {
        commit_hash: read_git_head_short_hash(&project_path),
        is_repository: true,
        raw_output: join_git_command_output(&stdout, &stderr),
        repository_root: read_git_repository_root(&project_path),
    })
}

#[tauri::command]
fn git_stage_all(request: GitStatusRequest) -> Result<GitStageAllResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(GitStageAllResponse {
            is_repository: false,
            raw_output: String::new(),
            repository_root: None,
            staged_count: 0,
        });
    }

    let stage_output = run_git_command(&project_path, &["add", "--all", "--", "."])?;
    let stdout = String::from_utf8_lossy(&stage_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&stage_output.stderr).to_string();
    if !stage_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitStageAllResponse {
        is_repository: true,
        raw_output: join_git_command_output(&stdout, &stderr),
        repository_root: read_git_repository_root(&project_path),
        staged_count: read_git_staged_project_count(&project_path)?,
    })
}

#[tauri::command]
fn git_remote_summary(request: GitStatusRequest) -> Result<GitRemoteSummaryResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(GitRemoteSummaryResponse {
            is_repository: false,
            raw_remotes: String::new(),
            remotes: Vec::new(),
            repository_root: None,
        });
    }

    let remote_output = run_git_command(&project_path, &["remote", "-v"])?;
    let stdout = String::from_utf8_lossy(&remote_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&remote_output.stderr).to_string();
    if !remote_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitRemoteSummaryResponse {
        is_repository: true,
        raw_remotes: stdout.clone(),
        remotes: parse_git_remote_summary(&stdout),
        repository_root: read_git_repository_root(&project_path),
    })
}

#[tauri::command]
fn git_push_current_branch(
    request: GitPushCurrentBranchRequest,
) -> Result<GitPushCurrentBranchResponse, String> {
    let project_path = PathBuf::from(request.project_path);
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    if !project_path.is_dir() {
        return Err(format!(
            "Project path is not a directory: {}",
            project_path.display()
        ));
    }

    if !is_git_repository(&project_path)? {
        return Ok(GitPushCurrentBranchResponse {
            branch_name: None,
            dry_run: request.dry_run.unwrap_or(false),
            is_repository: false,
            raw_output: String::new(),
            remote_name: None,
            repository_root: None,
        });
    }

    let remote_name = request.remote_name.trim();
    if remote_name.is_empty() {
        return Err("Remote name is required.".to_owned());
    }

    if remote_name.starts_with('-') {
        return Err("Remote name cannot start with '-'.".to_owned());
    }

    validate_git_remote_name(&project_path, remote_name)?;
    let branch_name = read_git_current_branch(&project_path)
        .ok_or_else(|| "Push aborted: current Git HEAD is detached.".to_owned())?;

    let mut args = vec!["push"];
    if request.dry_run.unwrap_or(false) {
        args.push("--dry-run");
    }
    args.push(remote_name);
    args.push(&branch_name);

    let push_output = run_git_command(&project_path, &args)?;
    let stdout = String::from_utf8_lossy(&push_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&push_output.stderr).to_string();
    if !push_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitPushCurrentBranchResponse {
        branch_name: Some(branch_name),
        dry_run: request.dry_run.unwrap_or(false),
        is_repository: true,
        raw_output: join_git_command_output(&stdout, &stderr),
        remote_name: Some(remote_name.to_owned()),
        repository_root: read_git_repository_root(&project_path),
    })
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
            git_branch_summary,
            git_checkout_branch,
            git_commit_staged,
            git_create_branch,
            git_diff_summary,
            git_push_current_branch,
            git_remote_summary,
            git_stage_all,
            git_status,
            start_project_file_watcher,
            stop_project_file_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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

fn run_git_command(project_path: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .arg("-C")
        .arg(project_path)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run git command: {error}"))
}

fn run_git_numstat(project_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = run_git_command(project_path, args)?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(stdout)
}

fn empty_git_status_response(is_repository: bool) -> GitStatusResponse {
    GitStatusResponse {
        ahead: 0,
        behind: 0,
        branch: None,
        entries: Vec::new(),
        is_repository,
        raw_status: String::new(),
        repository_root: None,
    }
}

fn empty_git_diff_summary_response(is_repository: bool) -> GitDiffSummaryResponse {
    GitDiffSummaryResponse {
        files: Vec::new(),
        is_repository,
        raw_numstat: String::new(),
    }
}

fn empty_git_branch_summary_response(is_repository: bool) -> GitBranchSummaryResponse {
    GitBranchSummaryResponse {
        branches: Vec::new(),
        current: None,
        is_repository,
        raw_branches: String::new(),
        repository_root: None,
    }
}

fn is_git_repository(project_path: &Path) -> Result<bool, String> {
    let rev_parse_output = run_git_command(project_path, &["rev-parse", "--is-inside-work-tree"])?;
    Ok(rev_parse_output.status.success()
        && String::from_utf8_lossy(&rev_parse_output.stdout).trim() == "true")
}

fn read_git_repository_root(project_path: &Path) -> Option<String> {
    run_git_command(project_path, &["rev-parse", "--show-toplevel"])
        .ok()
        .and_then(|output| {
            if !output.status.success() {
                return None;
            }

            let root = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            if root.is_empty() {
                None
            } else {
                Some(root)
            }
        })
}

fn read_git_current_branch(project_path: &Path) -> Option<String> {
    run_git_command(project_path, &["branch", "--show-current"])
        .ok()
        .and_then(|output| {
            if !output.status.success() {
                return None;
            }

            let branch = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            if branch.is_empty() {
                None
            } else {
                Some(branch)
            }
        })
}

fn git_branch_exists(project_path: &Path, branch_name: &str) -> Result<bool, String> {
    let branch_ref = format!("refs/heads/{branch_name}");
    let output = run_git_command(
        project_path,
        &["show-ref", "--verify", "--quiet", &branch_ref],
    )?;
    Ok(output.status.success())
}

fn validate_git_branch_name(project_path: &Path, branch_name: &str) -> Result<(), String> {
    let output = run_git_command(project_path, &["check-ref-format", "--branch", branch_name])?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        return Ok(());
    }

    let message = if stderr.trim().is_empty() {
        stdout
    } else {
        stderr
    };
    let detail = message.trim();
    if detail.is_empty() {
        Err(format!("Invalid branch name: {branch_name}"))
    } else {
        Err(format!("Invalid branch name: {detail}"))
    }
}

fn validate_git_remote_name(project_path: &Path, remote_name: &str) -> Result<(), String> {
    let output = run_git_command(project_path, &["remote", "get-url", remote_name])?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        return Ok(());
    }

    let message = if stderr.trim().is_empty() {
        stdout
    } else {
        stderr
    };
    let detail = message.trim();
    if detail.is_empty() {
        Err(format!("Remote does not exist: {remote_name}"))
    } else {
        Err(detail.to_owned())
    }
}

fn is_git_worktree_clean(project_path: &Path) -> Result<bool, String> {
    Ok(read_git_porcelain_status(project_path)?.trim().is_empty())
}

fn read_git_porcelain_status(project_path: &Path) -> Result<String, String> {
    let output = run_git_command(
        project_path,
        &["status", "--porcelain=v1", "--untracked-files=all"],
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(stdout)
}

fn read_git_staged_project_count(project_path: &Path) -> Result<u32, String> {
    let output = run_git_command(
        project_path,
        &["diff", "--cached", "--name-only", "--", "."],
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count() as u32)
}

fn has_staged_changes(raw_status: &str) -> bool {
    raw_status.lines().any(|line| {
        let mut characters = line.chars();
        matches!(characters.next(), Some(value) if value != ' ' && value != '?')
    })
}

fn has_unstaged_or_untracked_changes(raw_status: &str) -> bool {
    raw_status.lines().any(|line| {
        if line.starts_with("??") {
            return true;
        }

        let mut characters = line.chars();
        let _index = characters.next();
        matches!(characters.next(), Some(value) if value != ' ')
    })
}

fn read_git_head_short_hash(project_path: &Path) -> Option<String> {
    run_git_command(project_path, &["rev-parse", "--short", "HEAD"])
        .ok()
        .and_then(|output| {
            if !output.status.success() {
                return None;
            }

            let hash = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            if hash.is_empty() {
                None
            } else {
                Some(hash)
            }
        })
}

fn join_git_command_output(stdout: &str, stderr: &str) -> String {
    [stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn join_git_numstat_output(left: &str, right: &str) -> String {
    [left.trim(), right.trim()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_git_branch_summary(raw_branches: &str) -> Vec<GitBranchEntry> {
    raw_branches
        .lines()
        .filter_map(parse_git_branch_summary_line)
        .collect()
}

fn parse_git_branch_summary_line(line: &str) -> Option<GitBranchEntry> {
    let mut parts = line.splitn(3, '\t');
    let head = parts.next()?.trim();
    let name = parts.next()?.trim();
    let upstream = parts
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if name.is_empty() {
        return None;
    }

    Some(GitBranchEntry {
        current: head == "*",
        name: name.to_owned(),
        upstream: upstream.map(str::to_owned),
    })
}

fn parse_git_branch_line(line: &str, response: &mut GitStatusResponse) {
    let head = line
        .split_once("...")
        .map(|(branch, _)| branch)
        .unwrap_or(line);
    let head = head
        .split_once(" [")
        .map(|(branch, _)| branch)
        .unwrap_or(head)
        .trim();
    if !head.is_empty() {
        response.branch = Some(head.to_owned());
    }

    if let Some(metadata) = line
        .split_once('[')
        .and_then(|(_, metadata)| metadata.split_once(']').map(|(metadata, _)| metadata))
    {
        for part in metadata.split(',') {
            let part = part.trim();
            if let Some(value) = part.strip_prefix("ahead ") {
                response.ahead = value.parse::<u32>().unwrap_or(0);
            } else if let Some(value) = part.strip_prefix("behind ") {
                response.behind = value.parse::<u32>().unwrap_or(0);
            }
        }
    }
}

fn parse_git_numstat_summary(raw_numstat: &str) -> Vec<GitDiffFileSummary> {
    let mut files: Vec<GitDiffFileSummary> = Vec::new();

    for line in raw_numstat.lines() {
        let Some(entry) = parse_git_numstat_line(line) else {
            continue;
        };

        if let Some(existing) = files.iter_mut().find(|file| file.path == entry.path) {
            existing.binary = existing.binary || entry.binary;
            existing.deletions += entry.deletions;
            existing.insertions += entry.insertions;
            continue;
        }

        files.push(entry);
    }

    files.sort_by(|left, right| left.path.cmp(&right.path));
    files
}

fn parse_git_numstat_line(line: &str) -> Option<GitDiffFileSummary> {
    let mut parts = line.splitn(3, '\t');
    let insertions = parts.next()?;
    let deletions = parts.next()?;
    let path = parts.next()?.trim();
    if path.is_empty() {
        return None;
    }

    let binary = insertions == "-" || deletions == "-";

    Some(GitDiffFileSummary {
        binary,
        deletions: deletions.parse::<u32>().unwrap_or(0),
        insertions: insertions.parse::<u32>().unwrap_or(0),
        path: path.to_owned(),
    })
}

fn parse_git_remote_summary(raw_remotes: &str) -> Vec<GitRemoteEntry> {
    let mut remotes: Vec<GitRemoteEntry> = Vec::new();

    for line in raw_remotes.lines() {
        let Some((name, url, direction)) = parse_git_remote_summary_line(line) else {
            continue;
        };

        let remote_index = remotes.iter().position(|remote| remote.name == name);
        let remote = if let Some(index) = remote_index {
            &mut remotes[index]
        } else {
            remotes.push(GitRemoteEntry {
                fetch_url: None,
                name: name.clone(),
                push_url: None,
            });
            remotes.last_mut().expect("remote entry was just inserted")
        };

        match direction {
            "fetch" => remote.fetch_url = Some(url),
            "push" => remote.push_url = Some(url),
            _ => {}
        }
    }

    remotes
}

fn parse_git_remote_summary_line(line: &str) -> Option<(String, String, &str)> {
    let mut parts = line.split_whitespace();
    let name = parts.next()?.trim();
    let url = parts.next()?.trim();
    let direction = parts.next()?.trim();
    if name.is_empty() || url.is_empty() {
        return None;
    }

    let direction = direction
        .strip_prefix('(')
        .and_then(|value| value.strip_suffix(')'))
        .unwrap_or(direction);
    if direction != "fetch" && direction != "push" {
        return None;
    }

    Some((name.to_owned(), url.to_owned(), direction))
}

fn parse_git_status_entry(line: &str) -> Option<GitStatusEntry> {
    if line.len() < 4 {
        return None;
    }

    let mut characters = line.chars();
    let index = characters.next()?.to_string();
    let working_tree = characters.next()?.to_string();
    let path = line.get(3..)?.trim();
    if path.is_empty() {
        return None;
    }

    Some(GitStatusEntry {
        index,
        path: path.to_owned(),
        working_tree,
    })
}
