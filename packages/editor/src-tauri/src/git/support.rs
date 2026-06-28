use super::types::*;
use std::path::Path;
use std::process::Command;

pub(super) fn run_git_command(
    project_path: &Path,
    args: &[&str],
) -> Result<std::process::Output, String> {
    Command::new("git")
        .arg("-C")
        .arg(project_path)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run git command: {error}"))
}

pub(super) fn run_git_numstat(project_path: &Path, args: &[&str]) -> Result<String, String> {
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

pub(super) fn run_git_text_output(project_path: &Path, args: &[&str]) -> Result<String, String> {
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

pub(super) fn empty_git_status_response(is_repository: bool) -> GitStatusResponse {
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

pub(super) fn empty_git_diff_summary_response(is_repository: bool) -> GitDiffSummaryResponse {
    GitDiffSummaryResponse {
        files: Vec::new(),
        is_repository,
        raw_numstat: String::new(),
    }
}

pub(super) fn empty_git_branch_summary_response(is_repository: bool) -> GitBranchSummaryResponse {
    GitBranchSummaryResponse {
        branches: Vec::new(),
        current: None,
        is_repository,
        raw_branches: String::new(),
        repository_root: None,
    }
}

pub(super) fn is_git_repository(project_path: &Path) -> Result<bool, String> {
    let rev_parse_output = run_git_command(project_path, &["rev-parse", "--is-inside-work-tree"])?;
    Ok(rev_parse_output.status.success()
        && String::from_utf8_lossy(&rev_parse_output.stdout).trim() == "true")
}

pub(super) fn read_git_repository_root(project_path: &Path) -> Option<String> {
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

pub(super) fn read_git_current_branch(project_path: &Path) -> Option<String> {
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

pub(super) fn git_has_head(project_path: &Path) -> Result<bool, String> {
    let output = run_git_command(project_path, &["rev-parse", "--verify", "HEAD"])?;
    Ok(output.status.success())
}

pub(super) fn git_branch_exists(project_path: &Path, branch_name: &str) -> Result<bool, String> {
    let branch_ref = format!("refs/heads/{branch_name}");
    let output = run_git_command(
        project_path,
        &["show-ref", "--verify", "--quiet", &branch_ref],
    )?;
    Ok(output.status.success())
}

pub(super) fn validate_git_branch_name(
    project_path: &Path,
    branch_name: &str,
) -> Result<(), String> {
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

pub(super) fn validate_git_remote_name(
    project_path: &Path,
    remote_name: &str,
) -> Result<(), String> {
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

pub(super) fn validate_git_relative_path(path: &str) -> Result<String, String> {
    let normalized = path.trim().replace('\\', "/");

    if normalized.is_empty() {
        return Err("Git file path is required.".to_owned());
    }

    if normalized.contains('\0') {
        return Err("Git file path cannot contain null bytes.".to_owned());
    }

    if normalized.starts_with('-') {
        return Err("Git file path cannot start with '-'.".to_owned());
    }

    if Path::new(&normalized).is_absolute()
        || normalized
            .as_bytes()
            .get(1)
            .is_some_and(|value| *value == b':')
    {
        return Err("Git file path must be relative to the repository.".to_owned());
    }

    if normalized
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err(
            "Git file path must not contain empty, current, or parent segments.".to_owned(),
        );
    }

    Ok(normalized)
}

pub(super) fn is_git_worktree_clean(project_path: &Path) -> Result<bool, String> {
    Ok(read_git_porcelain_status(project_path)?.trim().is_empty())
}

pub(super) fn read_git_porcelain_status(project_path: &Path) -> Result<String, String> {
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

pub(super) fn read_git_staged_project_count(project_path: &Path) -> Result<u32, String> {
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

pub(super) fn has_staged_changes(raw_status: &str) -> bool {
    raw_status.lines().any(|line| {
        let mut characters = line.chars();
        matches!(characters.next(), Some(value) if value != ' ' && value != '?')
    })
}

pub(super) fn read_git_head_short_hash(project_path: &Path) -> Option<String> {
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

pub(super) fn join_git_command_output(stdout: &str, stderr: &str) -> String {
    [stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

pub(super) fn join_git_numstat_output(left: &str, right: &str) -> String {
    [left.trim(), right.trim()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

pub(super) fn parse_git_branch_summary(raw_branches: &str) -> Vec<GitBranchEntry> {
    raw_branches
        .lines()
        .filter_map(parse_git_branch_summary_line)
        .collect()
}

pub(super) fn parse_git_branch_summary_line(line: &str) -> Option<GitBranchEntry> {
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

pub(super) fn parse_git_branch_line(line: &str, response: &mut GitStatusResponse) {
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

pub(super) fn parse_git_numstat_summary(raw_numstat: &str) -> Vec<GitDiffFileSummary> {
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

pub(super) fn parse_git_numstat_line(line: &str) -> Option<GitDiffFileSummary> {
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

pub(super) fn parse_git_remote_summary(raw_remotes: &str) -> Vec<GitRemoteEntry> {
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

pub(super) fn parse_git_remote_summary_line(line: &str) -> Option<(String, String, &str)> {
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

pub(super) fn parse_git_status_entry(line: &str) -> Option<GitStatusEntry> {
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
