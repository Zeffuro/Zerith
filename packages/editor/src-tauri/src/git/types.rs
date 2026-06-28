use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitStatusRequest {
    pub(super) project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitDiffFileRequest {
    pub(super) path: String,
    pub(super) project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitCreateBranchRequest {
    pub(super) branch_name: String,
    pub(super) project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitCheckoutBranchRequest {
    pub(super) branch_name: String,
    pub(super) project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitCommitStagedRequest {
    pub(super) description: Option<String>,
    pub(super) message: String,
    pub(super) project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitFileActionRequest {
    pub(super) path: String,
    pub(super) project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitPushCurrentBranchRequest {
    pub(super) dry_run: Option<bool>,
    pub(super) project_path: String,
    pub(super) remote_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitStageAllResponse {
    pub(super) is_repository: bool,
    pub(super) raw_output: String,
    pub(super) repository_root: Option<String>,
    pub(super) staged_count: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitFileActionResponse {
    pub(super) is_repository: bool,
    pub(super) path: String,
    pub(super) raw_output: String,
    pub(super) repository_root: Option<String>,
    pub(super) staged_count: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitInitRepositoryResponse {
    pub(super) initialized: bool,
    pub(super) is_repository: bool,
    pub(super) raw_output: String,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitDiffFileResponse {
    pub(super) is_repository: bool,
    pub(super) path: String,
    pub(super) raw_diff: String,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitRemoteEntry {
    pub(super) fetch_url: Option<String>,
    pub(super) name: String,
    pub(super) push_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitRemoteSummaryResponse {
    pub(super) is_repository: bool,
    pub(super) raw_remotes: String,
    pub(super) remotes: Vec<GitRemoteEntry>,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitPushCurrentBranchResponse {
    pub(super) branch_name: Option<String>,
    pub(super) dry_run: bool,
    pub(super) is_repository: bool,
    pub(super) raw_output: String,
    pub(super) remote_name: Option<String>,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitStatusEntry {
    pub(super) index: String,
    pub(super) path: String,
    pub(super) working_tree: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitStatusResponse {
    pub(super) ahead: u32,
    pub(super) behind: u32,
    pub(super) branch: Option<String>,
    pub(super) entries: Vec<GitStatusEntry>,
    pub(super) is_repository: bool,
    pub(super) raw_status: String,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitBranchEntry {
    pub(super) current: bool,
    pub(super) name: String,
    pub(super) upstream: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitBranchSummaryResponse {
    pub(super) branches: Vec<GitBranchEntry>,
    pub(super) current: Option<String>,
    pub(super) is_repository: bool,
    pub(super) raw_branches: String,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitCreateBranchResponse {
    pub(super) branch_name: Option<String>,
    pub(super) is_repository: bool,
    pub(super) raw_output: String,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitCheckoutBranchResponse {
    pub(super) branch_name: Option<String>,
    pub(super) is_repository: bool,
    pub(super) raw_output: String,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitCommitStagedResponse {
    pub(super) commit_hash: Option<String>,
    pub(super) is_repository: bool,
    pub(super) raw_output: String,
    pub(super) repository_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitDiffFileSummary {
    pub(super) binary: bool,
    pub(super) deletions: u32,
    pub(super) insertions: u32,
    pub(super) path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitDiffSummaryResponse {
    pub(super) files: Vec<GitDiffFileSummary>,
    pub(super) is_repository: bool,
    pub(super) raw_numstat: String,
}
