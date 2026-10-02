use super::support::{read_git_repository_root, run_git_text_output, validate_git_relative_path};
use std::path::{Path, PathBuf};

pub(super) struct ProjectRepository {
    pub root: PathBuf,
    prefix: String,
}

impl ProjectRepository {
    pub fn resolve(project_path: &Path) -> Result<Self, String> {
        let root = read_git_repository_root(project_path)
            .ok_or_else(|| "Failed to resolve Git repository root.".to_owned())?;
        let root = PathBuf::from(root)
            .canonicalize()
            .map_err(|error| format!("Failed to resolve Git root: {error}"))?;
        let project = project_path
            .canonicalize()
            .map_err(|error| format!("Failed to resolve project path: {error}"))?;
        let prefix = project
            .strip_prefix(&root)
            .map_err(|_| "Project is outside the Git repository.".to_owned())?
            .to_str()
            .ok_or_else(|| "Git project path must be valid UTF-8.".to_owned())?
            .replace('\\', "/");
        Ok(Self { root, prefix })
    }

    pub fn contains(&self, path: &str) -> bool {
        self.prefix.is_empty()
            || path == self.prefix
            || path.starts_with(&format!("{}/", self.prefix))
    }

    pub fn file_pathspec(&self, path: &str) -> Result<String, String> {
        let path = validate_git_relative_path(path)?;
        if !self.contains(&path) {
            return Err("Git file is outside the open project.".to_owned());
        }
        Ok(format!(":(literal){path}"))
    }

    pub fn scope_pathspec(&self) -> String {
        if self.prefix.is_empty() {
            ".".to_owned()
        } else {
            format!(":(literal){}", self.prefix)
        }
    }

    pub fn file_pathspecs(&self, path: &str) -> Result<Vec<String>, String> {
        let mut paths = vec![self.file_pathspec(path)?];
        let raw = super::support::read_git_porcelain_status(&self.root)?;
        if let Some(original) = super::parsers::parse_git_status(&raw)
            .entries
            .into_iter()
            .find(|entry| entry.path == path)
            .and_then(|entry| entry.original_path)
        {
            paths.push(self.file_pathspec(&original)?);
        }
        Ok(paths)
    }

    pub fn reject_staged_siblings(&self) -> Result<(), String> {
        let staged = run_git_text_output(
            &self.root,
            &[
                "diff",
                "--cached",
                "--name-only",
                "-z",
                "--no-renames",
                "--",
            ],
        )?;
        if staged
            .split('\0')
            .filter(|path| !path.is_empty())
            .any(|path| !self.contains(path))
        {
            return Err(
                "Commit aborted: staged changes outside the open project must be unstaged first."
                    .to_owned(),
            );
        }
        Ok(())
    }
}
