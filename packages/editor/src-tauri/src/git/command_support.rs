use super::support::{read_git_repository_root, run_git_text_output};
use std::path::{Path, PathBuf};

pub(super) fn validate_project_path(project_path: &str) -> Result<PathBuf, String> {
    let project_path = PathBuf::from(project_path);
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

    Ok(project_path)
}

pub(super) fn join_git_file_diff_output(staged: &str, unstaged: &str) -> String {
    let mut sections = Vec::new();

    if !staged.trim().is_empty() {
        sections.push(format!("--- staged diff ---\n{}", staged.trim_end()));
    }

    if !unstaged.trim().is_empty() {
        sections.push(format!("--- unstaged diff ---\n{}", unstaged.trim_end()));
    }

    sections.join("\n\n")
}

pub(super) fn synthesize_untracked_file_diff(
    project_path: &Path,
    path: &str,
) -> Result<Option<String>, String> {
    let untracked = run_git_text_output(
        project_path,
        &["ls-files", "--others", "--exclude-standard", "--", path],
    )?;
    if !untracked.lines().any(|line| line.trim() == path) {
        return Ok(None);
    }

    let repository_root = read_git_repository_root(project_path)
        .map(PathBuf::from)
        .unwrap_or_else(|| project_path.to_path_buf());
    let file_path = repository_root.join(path);
    if !file_path.is_file() {
        return Ok(None);
    }

    let bytes = std::fs::read(&file_path).map_err(|error| {
        format!(
            "Failed to read untracked file '{}': {error}",
            file_path.display()
        )
    })?;
    if bytes.contains(&0) {
        return Ok(Some(format!("Binary file {path} is untracked.")));
    }

    let text = String::from_utf8(bytes)
        .map_err(|_| format!("Untracked file is not valid UTF-8 text: {path}"))?
        .replace("\r\n", "\n");
    let line_count = if text.is_empty() {
        0
    } else {
        text.lines().count()
    };
    let mut diff = format!(
        "diff --git a/{path} b/{path}\nnew file mode 100644\n--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{line_count} @@\n"
    );

    for line in text.lines() {
        diff.push('+');
        diff.push_str(line);
        diff.push('\n');
    }

    if !text.is_empty() && !text.ends_with('\n') {
        diff.push_str("\\ No newline at end of file\n");
    }

    Ok(Some(diff))
}
