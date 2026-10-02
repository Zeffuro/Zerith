use super::*;

#[test]
fn atomic_save_replaces_existing_content_and_rejects_stale_snapshot() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("scene ü.json");
    fs::write(&path, "original").unwrap();
    write_atomic_bytes(&path, b"saved", Some("original"), false).unwrap();
    fs::write(&path, "external edit").unwrap();
    let error = write_atomic_bytes(&path, b"lost edit", Some("saved"), false).unwrap_err();
    assert_eq!(error.code, "stale");
    assert_eq!(fs::read_to_string(&path).unwrap(), "external edit");
    assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
}

#[test]
fn failed_save_preserves_original_and_create_only_never_overwrites() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("readonly.json");
    fs::write(&path, "original").unwrap();
    let permissions = fs::metadata(&path).unwrap().permissions();
    let mut readonly = permissions.clone();
    readonly.set_readonly(true);
    fs::set_permissions(&path, readonly).unwrap();
    assert_eq!(
        write_atomic_bytes(&path, b"new", None, false)
            .unwrap_err()
            .code,
        "readOnly"
    );
    assert_eq!(fs::read_to_string(&path).unwrap(), "original");
    fs::set_permissions(&path, permissions).unwrap();
    assert_eq!(
        write_atomic_bytes(&path, b"new", None, true)
            .unwrap_err()
            .code,
        "alreadyExists"
    );
    assert_eq!(fs::read_to_string(&path).unwrap(), "original");
}

#[test]
fn failed_replacement_keeps_directory_contents() {
    let directory = tempfile::tempdir().unwrap();
    let target = directory.path().join("scene.json");
    fs::create_dir(&target).unwrap();
    fs::write(target.join("keep"), "original").unwrap();
    assert_eq!(
        write_atomic_bytes(&target, b"new", None, false)
            .unwrap_err()
            .code,
        "invalidTarget"
    );
    assert_eq!(fs::read_to_string(target.join("keep")).unwrap(), "original");
}

#[test]
fn asset_copy_preserves_bytes_and_existing_collision() {
    let directory = tempfile::tempdir().unwrap();
    let source = directory.path().join("source.bin");
    let target = directory.path().join("target.bin");
    let content = vec![0xA5; 8 * 1024 * 1024];
    fs::write(&source, &content).unwrap();
    copy_file_exclusive(&source, &target).unwrap();
    assert_eq!(fs::read(&target).unwrap(), content);
    fs::write(&source, "replacement").unwrap();
    assert_eq!(
        copy_file_exclusive(&source, &target).unwrap_err().code,
        "alreadyExists"
    );
    assert_eq!(fs::metadata(&target).unwrap().len(), content.len() as u64);
}

#[test]
fn simultaneous_asset_copy_commits_exactly_one_source() {
    let directory = tempfile::tempdir().unwrap();
    let first = directory.path().join("first");
    let second = directory.path().join("second");
    let target = directory.path().join("target");
    fs::write(&first, "first").unwrap();
    fs::write(&second, "second").unwrap();
    let workers: Vec<_> = [first, second]
        .into_iter()
        .map(|source| {
            let target = target.clone();
            std::thread::spawn(move || copy_file_exclusive(&source, &target))
        })
        .collect();
    let results: Vec<_> = workers
        .into_iter()
        .map(|worker| worker.join().unwrap())
        .collect();
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|result| result
                .as_ref()
                .is_err_and(|error| error.code == "alreadyExists"))
            .count(),
        1
    );
    assert!(["first", "second"].contains(&fs::read_to_string(target).unwrap().as_str()));
}

#[cfg(windows)]
#[test]
fn failed_windows_replacement_preserves_original_and_removes_temporary_file() {
    use std::os::windows::fs::OpenOptionsExt;
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("locked.json");
    fs::write(&path, "original").unwrap();
    let _held = fs::OpenOptions::new()
        .read(true)
        .share_mode(0x1 | 0x2)
        .open(&path)
        .unwrap();
    assert!(write_atomic_bytes(&path, b"replacement", Some("original"), false).is_err());
    assert_eq!(fs::read_to_string(&path).unwrap(), "original");
    assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
}
