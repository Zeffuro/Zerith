use super::types::*;

#[tauri::command]
pub(crate) fn git_branch_summary(
    request: GitStatusRequest,
) -> Result<GitBranchSummaryResponse, String> {
    super::read_commands::git_branch_summary(request)
}

#[tauri::command]
pub(crate) fn git_diff_file(request: GitDiffFileRequest) -> Result<GitDiffFileResponse, String> {
    super::read_commands::git_diff_file(request)
}

#[tauri::command]
pub(crate) fn git_diff_summary(
    request: GitStatusRequest,
) -> Result<GitDiffSummaryResponse, String> {
    super::read_commands::git_diff_summary(request)
}

#[tauri::command]
pub(crate) fn git_remote_summary(
    request: GitStatusRequest,
) -> Result<GitRemoteSummaryResponse, String> {
    super::read_commands::git_remote_summary(request)
}

#[tauri::command]
pub(crate) fn git_status(request: GitStatusRequest) -> Result<GitStatusResponse, String> {
    super::read_commands::git_status(request)
}

#[tauri::command]
pub(crate) fn git_checkout_branch(
    request: GitCheckoutBranchRequest,
) -> Result<GitCheckoutBranchResponse, String> {
    super::write_commands::git_checkout_branch(request)
}

#[tauri::command]
pub(crate) fn git_commit_staged(
    request: GitCommitStagedRequest,
) -> Result<GitCommitStagedResponse, String> {
    super::write_commands::git_commit_staged(request)
}

#[tauri::command]
pub(crate) fn git_create_branch(
    request: GitCreateBranchRequest,
) -> Result<GitCreateBranchResponse, String> {
    super::write_commands::git_create_branch(request)
}

#[tauri::command]
pub(crate) fn git_init_repository(
    request: GitStatusRequest,
) -> Result<GitInitRepositoryResponse, String> {
    super::write_commands::git_init_repository(request)
}

#[tauri::command]
pub(crate) fn git_push_current_branch(
    request: GitPushCurrentBranchRequest,
) -> Result<GitPushCurrentBranchResponse, String> {
    super::write_commands::git_push_current_branch(request)
}

#[tauri::command]
pub(crate) fn git_stage_all(request: GitStatusRequest) -> Result<GitStageAllResponse, String> {
    super::write_commands::git_stage_all(request)
}

#[tauri::command]
pub(crate) fn git_stage_file(
    request: GitFileActionRequest,
) -> Result<GitFileActionResponse, String> {
    super::write_commands::git_stage_file(request)
}

#[tauri::command]
pub(crate) fn git_unstage_file(
    request: GitFileActionRequest,
) -> Result<GitFileActionResponse, String> {
    super::write_commands::git_unstage_file(request)
}
