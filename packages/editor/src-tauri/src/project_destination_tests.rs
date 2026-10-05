use super::*;
use std::sync::{Arc, Barrier};

struct Fixture {
    _temp: tempfile::TempDir,
    root: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        Self { _temp: temp, root }
    }

    fn path(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }
}

#[test]
fn new_destination_finishes_without_removing_project_files() {
    let fixture = Fixture::new();
    let output = fixture.path("new-project");
    let reserved = reserve_destination(&output, None).unwrap();
    assert_eq!(reserved, output);
    assert!(reserved.join(RESERVATION_FILE).is_file());
    fs::write(reserved.join("game.json"), "project").unwrap();
    finish_destination(&reserved).unwrap();
    assert!(!reserved.join(RESERVATION_FILE).exists());
    assert_eq!(
        fs::read_to_string(reserved.join("game.json")).unwrap(),
        "project"
    );
    assert!(finish_destination(&reserved).is_err());
}

#[test]
fn existing_empty_destination_is_reserved_exclusively() {
    let fixture = Fixture::new();
    let output = fixture.path("empty");
    fs::create_dir(&output).unwrap();
    let reserved = reserve_destination(&output, None).unwrap();
    let marker = fs::read(reserved.join(RESERVATION_FILE)).unwrap();
    assert!(reserve_destination(&output, None).is_err());
    assert_eq!(fs::read(reserved.join(RESERVATION_FILE)).unwrap(), marker);
    finish_destination(&reserved).unwrap();
    assert_eq!(fs::read_dir(output).unwrap().count(), 0);
}

#[test]
fn nonempty_destination_rejects_without_changes() {
    let fixture = Fixture::new();
    let output = fixture.path("collision");
    fs::create_dir(&output).unwrap();
    fs::write(output.join("keep.txt"), "original").unwrap();
    assert!(reserve_destination(&output, None).is_err());
    assert_eq!(
        fs::read_to_string(output.join("keep.txt")).unwrap(),
        "original"
    );
    assert_eq!(fs::read_dir(output).unwrap().count(), 1);
}

#[test]
fn roots_relative_paths_files_and_missing_parents_reject_without_creation() {
    let fixture = Fixture::new();
    let root = fixture.root.ancestors().last().unwrap();
    assert!(reserve_destination(root, None).is_err());
    assert!(reserve_destination(Path::new("relative-project"), None).is_err());
    let file = fixture.path("file");
    fs::write(&file, "keep").unwrap();
    assert!(reserve_destination(&file, None).is_err());
    assert_eq!(fs::read_to_string(file).unwrap(), "keep");
    let missing = fixture.path("missing");
    assert!(reserve_destination(&missing.join("output"), None).is_err());
    assert!(!missing.exists());
}

#[test]
fn any_existing_project_ancestor_blocks_new_and_empty_outputs() {
    let fixture = Fixture::new();
    let project = fixture.path("unrelated-project");
    fs::create_dir(&project).unwrap();
    fs::write(project.join("game.json"), "original").unwrap();
    let nested = project.join("nested");
    fs::create_dir(&nested).unwrap();
    let empty = nested.join("empty");
    fs::create_dir(&empty).unwrap();
    assert!(reserve_destination(&empty, None).is_err());
    assert_eq!(fs::read_dir(&empty).unwrap().count(), 0);
    let new = nested.join("new");
    assert!(reserve_destination(&new, None).is_err());
    assert!(!new.exists());
    assert_eq!(
        fs::read_to_string(project.join("game.json")).unwrap(),
        "original"
    );
}

#[test]
fn source_overlap_rejects_equal_descendant_and_ancestor() {
    let fixture = Fixture::new();
    let ancestor = fixture.path("parent");
    fs::create_dir(&ancestor).unwrap();
    let source = ancestor.join("source");
    fs::create_dir(&source).unwrap();
    assert!(reserve_destination(&source, Some(&source)).is_err());
    assert_eq!(fs::read_dir(&source).unwrap().count(), 0);
    let descendant = source.join("output");
    assert!(reserve_destination(&descendant, Some(&source)).is_err());
    assert!(!descendant.exists());
    assert!(reserve_destination(&ancestor, Some(&source)).is_err());
    assert_eq!(fs::read_dir(&ancestor).unwrap().count(), 1);
    let sibling = fixture.path("sibling");
    let reserved = reserve_destination(&sibling, Some(&source)).unwrap();
    finish_destination(&reserved).unwrap();
}

#[test]
fn aliases_and_invalid_source_do_not_mutate_destination() {
    let fixture = Fixture::new();
    let output = fixture.path("output");
    fs::create_dir(&output).unwrap();
    let alias = fixture.root.join(".").join("output");
    assert!(reserve_destination(&alias, Some(&output)).is_err());
    assert!(reserve_destination(&output, Some(&fixture.path("missing-source"))).is_err());
    let file_source = fixture.path("source-file");
    fs::write(&file_source, "original").unwrap();
    assert!(reserve_destination(&output, Some(&file_source)).is_err());
    let parent_alias = PathBuf::from(display_path(&fixture.root))
        .join("output")
        .join("..")
        .join("new");
    assert!(reserve_destination(&parent_alias, None).is_err());
    assert_eq!(fs::read_dir(&output).unwrap().count(), 0);
    assert!(!fixture.path("new").exists());
}

#[test]
fn failed_or_foreign_marker_is_preserved() {
    let fixture = Fixture::new();
    let output = fixture.path("foreign");
    fs::create_dir(&output).unwrap();
    let marker = output.join(RESERVATION_FILE);
    fs::write(&marker, "foreign").unwrap();
    assert!(reserve_destination(&output, None).is_err());
    assert!(finish_destination(&output).is_err());
    assert_eq!(fs::read_to_string(marker).unwrap(), "foreign");
    let reserved = reserve_destination(&fixture.path("owned"), None).unwrap();
    fs::write(reserved.join("partial.txt"), "partial").unwrap();
    fs::write(reserved.join(RESERVATION_FILE), "replacement").unwrap();
    assert!(finish_destination(&reserved).is_err());
    assert_eq!(
        fs::read_to_string(reserved.join(RESERVATION_FILE)).unwrap(),
        "replacement"
    );
    assert_eq!(
        fs::read_to_string(reserved.join("partial.txt")).unwrap(),
        "partial"
    );
    RESERVATIONS.lock().unwrap().remove(&reserved);
}

#[test]
fn concurrent_reservations_have_one_winner_for_new_and_empty_directories() {
    for existing in [false, true] {
        let fixture = Fixture::new();
        let output = fixture.path("concurrent");
        if existing {
            fs::create_dir(&output).unwrap();
        }
        let barrier = Arc::new(Barrier::new(2));
        let threads: Vec<_> = (0..2)
            .map(|_| {
                let path = output.clone();
                let barrier = Arc::clone(&barrier);
                std::thread::spawn(move || {
                    barrier.wait();
                    reserve_destination(&path, None)
                })
            })
            .collect();
        let results: Vec<_> = threads
            .into_iter()
            .map(|thread| thread.join().unwrap())
            .collect();
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(fs::read_dir(&output).unwrap().count(), 1);
        finish_destination(&output).unwrap();
    }
}

#[test]
fn collision_after_reservation_keeps_partial_output_and_reports_its_path() {
    let fixture = Fixture::new();
    let output = fixture.path("raced-output");
    let error = reserve_destination_with(&output, None, |path| {
        fs::write(path.join("external.txt"), "external").unwrap();
    })
    .unwrap_err();
    assert!(error.contains("Partial output remains at"));
    assert!(error.contains(&display_path(&output)));
    assert!(output.join(RESERVATION_FILE).is_file());
    assert_eq!(
        fs::read_to_string(output.join("external.txt")).unwrap(),
        "external"
    );
    assert!(finish_destination(&output).is_err());
    let replaced = fixture.path("replaced-marker");
    let error = reserve_destination_with(&replaced, None, |path| {
        fs::write(path.join(RESERVATION_FILE), "foreign").unwrap();
    })
    .unwrap_err();
    assert!(error.contains("reservation marker changed"));
    assert!(error.contains(&display_path(&replaced)));
    assert_eq!(
        fs::read_to_string(replaced.join(RESERVATION_FILE)).unwrap(),
        "foreign"
    );
    assert!(finish_destination(&replaced).is_err());
}

#[cfg(unix)]
#[test]
fn symlink_outputs_ancestors_and_sources_reject() {
    use std::os::unix::fs::symlink;
    assert_link_rejection(|target, link| symlink(target, link).unwrap());
}

#[cfg(windows)]
#[test]
fn junction_outputs_ancestors_and_sources_reject() {
    assert_link_rejection(|target, link| {
        let output = std::process::Command::new("cmd")
            .args(["/d", "/c", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    });
}

fn assert_link_rejection(create_link: impl Fn(&Path, &Path)) {
    let fixture = Fixture::new();
    let target = fixture.path("target");
    fs::create_dir(&target).unwrap();
    let link = fixture.path("link");
    create_link(&target, &link);
    assert!(reserve_destination(&link, None).is_err());
    assert!(reserve_destination(&link.join("output"), None).is_err());
    let sibling = fixture.path("sibling");
    assert!(reserve_destination(&sibling, Some(&link)).is_err());
    assert!(!sibling.exists());
    assert_eq!(fs::read_dir(target).unwrap().count(), 0);
}

#[cfg(windows)]
#[test]
fn windows_filename_aliases_and_case_aliases_reject_without_mutation() {
    let fixture = Fixture::new();
    let source = fixture.path("Source");
    fs::create_dir(&source).unwrap();
    assert!(reserve_destination(&fixture.path("SOURCE"), Some(&source)).is_err());
    for name in ["Source.", "Source ", "Source:stream"] {
        assert!(reserve_destination(&fixture.path(name), None).is_err());
    }
    assert_eq!(fs::read_dir(source).unwrap().count(), 0);
    assert_eq!(display_path(Path::new(r"\\?\C:\output")), r"C:\output");
    assert_eq!(
        display_path(Path::new(r"\\?\UNC\server\share\output")),
        r"\\server\share\output"
    );
}
