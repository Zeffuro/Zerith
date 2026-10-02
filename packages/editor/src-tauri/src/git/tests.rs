use super::{
    parsers, read_commands, repository::ProjectRepository, support, types::*, write_commands,
};
use std::path::{Path, PathBuf};
use tempfile::TempDir;

struct RepositoryFixture {
    _directory: TempDir,
    root: PathBuf,
    project: PathBuf,
}

impl RepositoryFixture {
    fn new() -> Self {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().to_path_buf();
        let project = root.join("nested project");
        std::fs::create_dir(&project).unwrap();
        git(&root, &["init"]);
        git(&root, &["config", "user.email", "test@example.invalid"]);
        git(&root, &["config", "user.name", "Native Test"]);
        std::fs::write(project.join("story.json"), "before\n").unwrap();
        std::fs::write(root.join("sibling.txt"), "before\n").unwrap();
        git(&root, &["add", "--all"]);
        git(&root, &["commit", "-m", "fixture"]);
        Self {
            _directory: directory,
            root,
            project,
        }
    }

    fn request(&self) -> GitStatusRequest {
        GitStatusRequest {
            project_path: self.project.to_string_lossy().into_owned(),
        }
    }

    fn file_request(&self, path: &str) -> GitFileActionRequest {
        GitFileActionRequest {
            path: path.to_owned(),
            project_path: self.project.to_string_lossy().into_owned(),
        }
    }
}

fn git(root: &Path, args: &[&str]) -> String {
    let output = support::run_git_command(root, args).unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

#[test]
fn nested_project_staging_diff_and_unstage_never_target_siblings() {
    let fixture = RepositoryFixture::new();
    std::fs::write(fixture.project.join("story.json"), "after\n").unwrap();
    std::fs::write(fixture.root.join("sibling.txt"), "after\n").unwrap();
    let status = read_commands::git_status(fixture.request()).unwrap();
    assert_eq!(status.entries.len(), 1);
    assert_eq!(status.entries[0].path, "nested project/story.json");
    let diff = read_commands::git_diff_file(GitDiffFileRequest {
        project_path: fixture.project.to_string_lossy().into_owned(),
        path: status.entries[0].path.clone(),
    })
    .unwrap();
    assert!(diff.raw_diff.contains("+after"));
    let staged =
        write_commands::git_stage_file(fixture.file_request(&status.entries[0].path)).unwrap();
    assert_eq!(staged.staged_count, 1);
    assert_eq!(
        git(&fixture.root, &["diff", "--cached", "--name-only", "-z"]),
        "nested project/story.json\0"
    );
    write_commands::git_unstage_file(fixture.file_request(&status.entries[0].path)).unwrap();
    assert!(git(&fixture.root, &["diff", "--cached", "--name-only"]).is_empty());
    assert!(write_commands::git_stage_file(fixture.file_request("sibling.txt")).is_err());
    write_commands::git_stage_all(fixture.request()).unwrap();
    assert_eq!(
        git(&fixture.root, &["diff", "--cached", "--name-only", "-z"]),
        "nested project/story.json\0"
    );
}

#[test]
fn commit_refuses_pre_staged_siblings() {
    let fixture = RepositoryFixture::new();
    std::fs::write(fixture.root.join("sibling.txt"), "after\n").unwrap();
    git(&fixture.root, &["add", "sibling.txt"]);
    let before = git(&fixture.root, &["rev-parse", "HEAD"]);
    let result = write_commands::git_commit_staged(GitCommitStagedRequest {
        project_path: fixture.project.to_string_lossy().into_owned(),
        message: "must not commit sibling".to_owned(),
        description: None,
    });
    assert!(result.unwrap_err().contains("outside the open project"));
    assert_eq!(before, git(&fixture.root, &["rev-parse", "HEAD"]));
}

#[test]
fn real_git_preserves_unusual_names_and_literal_pathspecs() {
    let fixture = RepositoryFixture::new();
    let names = vec![
        "space name.txt",
        "日本語.txt",
        "literal[1].txt",
        " leading.txt",
    ];
    #[cfg(not(windows))]
    let names = {
        let mut names = names;
        names.extend([
            "quote\".txt",
            "trailing.txt ",
            "tab\tline\n.txt",
            "back\\slash.txt",
        ]);
        names
    };
    for name in names {
        std::fs::write(fixture.project.join(name), "hello\n").unwrap();
        let path = format!("nested project/{name}");
        let status = read_commands::git_status(fixture.request()).unwrap();
        assert!(status.entries.iter().any(|entry| entry.path == path));
        let diff = read_commands::git_diff_file(GitDiffFileRequest {
            project_path: fixture.project.to_string_lossy().into_owned(),
            path: path.clone(),
        })
        .unwrap();
        assert!(diff.raw_diff.contains("+hello"));
        write_commands::git_stage_file(fixture.file_request(&path)).unwrap();
        let summary = read_commands::git_diff_summary(fixture.request()).unwrap();
        assert!(summary.files.iter().any(|file| file.path == path));
        write_commands::git_unstage_file(fixture.file_request(&path)).unwrap();
    }
}

#[test]
fn rename_records_keep_both_paths_and_unstage_both_sides() {
    let fixture = RepositoryFixture::new();
    let destination = "nested project/new 名.txt";
    git(
        &fixture.root,
        &["mv", "nested project/story.json", destination],
    );
    let status = read_commands::git_status(fixture.request()).unwrap();
    assert_eq!(status.entries[0].path, destination);
    assert_eq!(
        status.entries[0].original_path.as_deref(),
        Some("nested project/story.json")
    );
    let summary = read_commands::git_diff_summary(fixture.request()).unwrap();
    assert_eq!(
        summary.files[0].original_path.as_deref(),
        Some("nested project/story.json")
    );
    write_commands::git_unstage_file(fixture.file_request(destination)).unwrap();
    assert!(git(&fixture.root, &["diff", "--cached", "--name-only"]).is_empty());
    write_commands::git_stage_all(fixture.request()).unwrap();
    std::fs::remove_file(fixture.project.join("new 名.txt")).unwrap();
    write_commands::git_stage_all(fixture.request()).unwrap();
    assert_eq!(
        git(&fixture.root, &["diff", "--cached", "--name-status"]),
        "D\tnested project/story.json\n"
    );
}

#[test]
fn scope_is_component_based_and_rejects_traversal() {
    let fixture = RepositoryFixture::new();
    let repository = ProjectRepository::resolve(&fixture.project).unwrap();
    assert!(repository
        .file_pathspec("nested project/story.json")
        .is_ok());
    for path in [
        "nested project-other/story.json",
        "../sibling.txt",
        "/absolute",
        ":(glob)*",
        "sibling.txt",
    ] {
        assert!(repository.file_pathspec(path).is_err(), "{path}");
    }
}

#[test]
fn nul_parsers_preserve_whitespace_and_rename_newlines() {
    let status = parsers::parse_git_status("## main\0R  new\nname \0 old\tname\0?? space \0");
    assert_eq!(status.entries[0].path, "new\nname ");
    assert_eq!(
        status.entries[0].original_path.as_deref(),
        Some(" old\tname")
    );
    assert_eq!(status.entries[1].path, "space ");
    let summary =
        parsers::parse_git_numstat_summary("1\t2\t\0 old\tname\0new\nname \0-\t-\tbinary \0");
    assert_eq!(summary.len(), 2);
    assert!(summary.iter().any(
        |file| file.path == "new\nname " && file.original_path.as_deref() == Some(" old\tname")
    ));
}
