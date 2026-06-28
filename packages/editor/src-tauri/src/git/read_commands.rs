use super::command_support::{
    join_git_file_diff_output, synthesize_untracked_file_diff, validate_project_path,
};
use super::support::*;
use super::types::*;

pub(crate) fn git_status(request: GitStatusRequest) -> Result<GitStatusResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

    if !is_git_repository(&project_path)? {
        return Ok(empty_git_status_response(false));
    }

    let repository_root = read_git_repository_root(&project_path);
    let status_output = run_git_command(
        &project_path,
        &[
            "status",
            "--porcelain=v1",
            "--branch",
            "--untracked-files=all",
        ],
    )?;
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

pub(crate) fn git_diff_summary(
    request: GitStatusRequest,
) -> Result<GitDiffSummaryResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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

pub(crate) fn git_diff_file(request: GitDiffFileRequest) -> Result<GitDiffFileResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;
    let path = validate_git_relative_path(&request.path)?;

    if !is_git_repository(&project_path)? {
        return Ok(GitDiffFileResponse {
            is_repository: false,
            path,
            raw_diff: String::new(),
            repository_root: None,
        });
    }

    let staged = run_git_text_output(
        &project_path,
        &["diff", "--cached", "--no-ext-diff", "--", &path],
    )?;
    let unstaged = run_git_text_output(&project_path, &["diff", "--no-ext-diff", "--", &path])?;
    let raw_diff = join_git_file_diff_output(&staged, &unstaged);
    let raw_diff = if raw_diff.trim().is_empty() {
        synthesize_untracked_file_diff(&project_path, &path)?.unwrap_or(raw_diff)
    } else {
        raw_diff
    };

    Ok(GitDiffFileResponse {
        is_repository: true,
        path,
        raw_diff,
        repository_root: read_git_repository_root(&project_path),
    })
}

pub(crate) fn git_branch_summary(
    request: GitStatusRequest,
) -> Result<GitBranchSummaryResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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

pub(crate) fn git_remote_summary(
    request: GitStatusRequest,
) -> Result<GitRemoteSummaryResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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
