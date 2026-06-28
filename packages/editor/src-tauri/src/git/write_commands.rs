use super::command_support::validate_project_path;
use super::support::*;
use super::types::*;

pub(crate) fn git_init_repository(
    request: GitStatusRequest,
) -> Result<GitInitRepositoryResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

    if is_git_repository(&project_path)? {
        return Ok(GitInitRepositoryResponse {
            initialized: false,
            is_repository: true,
            raw_output: String::new(),
            repository_root: read_git_repository_root(&project_path),
        });
    }

    let init_output = run_git_command(&project_path, &["init"])?;
    let stdout = String::from_utf8_lossy(&init_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&init_output.stderr).to_string();
    if !init_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitInitRepositoryResponse {
        initialized: true,
        is_repository: true,
        raw_output: join_git_command_output(&stdout, &stderr),
        repository_root: read_git_repository_root(&project_path)
            .or_else(|| Some(project_path.to_string_lossy().to_string())),
    })
}

pub(crate) fn git_create_branch(
    request: GitCreateBranchRequest,
) -> Result<GitCreateBranchResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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

pub(crate) fn git_checkout_branch(
    request: GitCheckoutBranchRequest,
) -> Result<GitCheckoutBranchResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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

pub(crate) fn git_commit_staged(
    request: GitCommitStagedRequest,
) -> Result<GitCommitStagedResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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

    let description = request
        .description
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let mut args = vec!["commit", "-m", message];
    if let Some(description) = description {
        args.push("-m");
        args.push(description);
    }

    let commit_output = run_git_command(&project_path, &args)?;
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

pub(crate) fn git_stage_file(
    request: GitFileActionRequest,
) -> Result<GitFileActionResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;
    let path = validate_git_relative_path(&request.path)?;

    if !is_git_repository(&project_path)? {
        return Ok(GitFileActionResponse {
            is_repository: false,
            path,
            raw_output: String::new(),
            repository_root: None,
            staged_count: 0,
        });
    }

    let stage_output = run_git_command(&project_path, &["add", "--", &path])?;
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

    Ok(GitFileActionResponse {
        is_repository: true,
        path,
        raw_output: join_git_command_output(&stdout, &stderr),
        repository_root: read_git_repository_root(&project_path),
        staged_count: read_git_staged_project_count(&project_path)?,
    })
}

pub(crate) fn git_unstage_file(
    request: GitFileActionRequest,
) -> Result<GitFileActionResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;
    let path = validate_git_relative_path(&request.path)?;

    if !is_git_repository(&project_path)? {
        return Ok(GitFileActionResponse {
            is_repository: false,
            path,
            raw_output: String::new(),
            repository_root: None,
            staged_count: 0,
        });
    }

    let unstage_output = if git_has_head(&project_path)? {
        run_git_command(&project_path, &["restore", "--staged", "--", &path])?
    } else {
        run_git_command(&project_path, &["rm", "--cached", "--", &path])?
    };
    let stdout = String::from_utf8_lossy(&unstage_output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&unstage_output.stderr).to_string();
    if !unstage_output.status.success() {
        let message = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr
        };
        return Err(message.trim().to_owned());
    }

    Ok(GitFileActionResponse {
        is_repository: true,
        path,
        raw_output: join_git_command_output(&stdout, &stderr),
        repository_root: read_git_repository_root(&project_path),
        staged_count: read_git_staged_project_count(&project_path)?,
    })
}

pub(crate) fn git_stage_all(request: GitStatusRequest) -> Result<GitStageAllResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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

pub(crate) fn git_push_current_branch(
    request: GitPushCurrentBranchRequest,
) -> Result<GitPushCurrentBranchResponse, String> {
    let project_path = validate_project_path(&request.project_path)?;

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
