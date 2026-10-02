use super::*;
use std::io::Read;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_TEST: AtomicU64 = AtomicU64::new(0);

struct Fixture {
    root: PathBuf,
    game: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let id = NEXT_TEST.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!("zerith-export-{}-{id}", std::process::id()));
        let temp = fs::canonicalize(std::env::temp_dir()).unwrap();
        let root = temp.join(format!("zerith-export-{}-{id}", std::process::id()));
        fs::create_dir(&root).unwrap();
        let game = root.join("ゲーム source with spaces");
        fs::create_dir(&game).unwrap();
        fs::write(game.join("game.json"), b"{}").unwrap();
        Self { root, game }
    }

    fn request(&self) -> ExportGameRequest {
        ExportGameRequest {
            base: Some("./".to_owned()),
            files: vec![
                artifact("index.html", b"<html>player</html>"),
                artifact("game.json", b"{}"),
                artifact("zerith.content.json", b"{}"),
                artifact("assets/日本語 music.bin", &[0, 128, 255]),
            ],
            game_path: self.game.to_string_lossy().into_owned(),
            out_dir: Some("exports/ゲーム with spaces".to_owned()),
            zip: Some(true),
            zip_file: Some("exports/日本語 archive.zip".to_owned()),
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let temp = fs::canonicalize(std::env::temp_dir()).unwrap();
        assert!(self.root.parent() == Some(temp.as_path()));
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn artifact(path: &str, bytes: &[u8]) -> ExportArtifactFile {
    ExportArtifactFile {
        path: path.to_owned(),
        bytes: Some(bytes.to_vec()),
        source_path: None,
    }
}

#[test]
fn writes_unicode_directory_and_playable_zip_independent_of_process_directory() {
    let fixture = Fixture::new();
    let result = write_export(fixture.request()).unwrap();
    let out = fs::canonicalize(&fixture.root)
        .unwrap()
        .join("exports/ゲーム with spaces");
    assert_eq!(PathBuf::from(result.out_directory), out);
    assert_eq!(
        fs::read(out.join("assets/日本語 music.bin")).unwrap(),
        [0, 128, 255]
    );
    let zip_path = result.zip_path.unwrap();
    let mut zip = zip::ZipArchive::new(File::open(zip_path).unwrap()).unwrap();
    assert_eq!(zip.len(), 4);
    let mut player = String::new();
    zip.by_name("index.html")
        .unwrap()
        .read_to_string(&mut player)
        .unwrap();
    assert_eq!(player, "<html>player</html>");
    let mut binary = Vec::new();
    zip.by_name("assets/日本語 music.bin")
        .unwrap()
        .read_to_end(&mut binary)
        .unwrap();
    assert_eq!(binary, [0, 128, 255]);
}

#[test]
fn refuses_existing_outputs_without_removing_or_overwriting_files() {
    let fixture = Fixture::new();
    let result = write_export(fixture.request()).unwrap();
    let unrelated = Path::new(&result.out_directory).join("keep.txt");
    fs::write(&unrelated, b"keep").unwrap();
    assert!(write_export(fixture.request())
        .unwrap_err()
        .contains("already exists"));
    assert_eq!(fs::read(unrelated).unwrap(), b"keep");
    let mut request = fixture.request();
    request.out_dir = Some("other-output".to_owned());
    assert!(write_export(request)
        .unwrap_err()
        .contains("already exists"));
    assert!(!fixture.root.join("other-output").exists());
}

#[test]
fn validates_all_artifact_paths_before_creating_outputs() {
    let fixture = Fixture::new();
    for bad_path in [
        "../escape",
        "/absolute",
        "C:/escape",
        "assets\\escape",
        "x//y",
        "x/./y",
        "CON.txt",
        "x. ",
        "a\nfile",
    ] {
        let mut request = fixture.request();
        request.files.push(artifact(bad_path, b"bad"));
        assert!(
            write_export(request)
                .unwrap_err()
                .contains("Invalid relative"),
            "{bad_path}"
        );
    }
    for conflict in ["INDEX.html", "assets", "assets/日本語 music.bin"] {
        let mut request = fixture.request();
        request.files.push(artifact(conflict, b"bad"));
        assert!(write_export(request).is_err(), "{conflict}");
    }
    assert!(!fixture.root.join("exports").exists());
}

#[test]
fn rejects_project_overlap_and_zip_overlap() {
    let fixture = Fixture::new();
    let mut request = fixture.request();
    request.out_dir = Some(fixture.game.join("output").to_string_lossy().into_owned());
    assert!(write_export(request)
        .unwrap_err()
        .contains("outside the project"));
    let mut request = fixture.request();
    request.zip_file = Some("exports/ゲーム with spaces/archive.zip".to_owned());
    assert!(write_export(request)
        .unwrap_err()
        .contains("must not overlap"));
    assert!(!fixture.root.join("exports").exists());
}

#[test]
fn rejects_missing_required_artifacts_and_relative_project_paths() {
    let fixture = Fixture::new();
    let mut request = fixture.request();
    request.files.retain(|file| file.path != "game.json");
    assert!(write_export(request)
        .unwrap_err()
        .contains("missing required artifact"));
    let mut request = fixture.request();
    request.game_path = "relative-project".to_owned();
    assert!(write_export(request)
        .unwrap_err()
        .contains("must be absolute"));
}

#[cfg(unix)]
#[test]
fn rejects_destination_symlink_ancestors() {
    let fixture = Fixture::new();
    std::os::unix::fs::symlink(&fixture.game, fixture.root.join("linked")).unwrap();
    let mut request = fixture.request();
    request.out_dir = Some("linked/export".to_owned());
    assert!(write_export(request).unwrap_err().contains("symbolic link"));
    assert!(!fixture.game.join("export").exists());
}

#[test]
fn streams_project_file_bytes_identically_to_directory_zip_and_cache_hash() {
    let fixture = Fixture::new();
    let bytes = vec![0x81; 8 * 1024 * 1024];
    let source = fixture.game.join("large source ü.bin");
    fs::write(&source, &bytes).unwrap();
    let mut request = fixture.request();
    request.files.push(ExportArtifactFile {
        path: "large source ü.bin".to_owned(),
        bytes: None,
        source_path: Some(source.to_string_lossy().into_owned()),
    });
    let hashes = sources::hash_sources(
        &request.game_path,
        &[
            "large source ü.bin".to_owned(),
            "optional-missing.bin".to_owned(),
        ],
    )
    .unwrap();
    assert_eq!(hashes.len(), 1);
    let hash = serde_json::to_value(&hashes["large source ü.bin"]).unwrap();
    assert_eq!(hash["size"].as_u64().unwrap(), bytes.len() as u64);
    use sha2::{Digest, Sha256};
    assert_eq!(
        hash["hash"].as_str().unwrap(),
        format!("{:x}", Sha256::digest(&bytes))
    );
    let result = write_export(request).unwrap();
    assert_eq!(
        fs::read(Path::new(&result.out_directory).join("large source ü.bin")).unwrap(),
        bytes
    );
    let mut archive = zip::ZipArchive::new(File::open(result.zip_path.unwrap()).unwrap()).unwrap();
    let mut exported = Vec::new();
    archive
        .by_name("large source ü.bin")
        .unwrap()
        .read_to_end(&mut exported)
        .unwrap();
    assert_eq!(exported, bytes);
}

#[test]
fn rejects_external_mismatched_and_private_source_references_before_writing() {
    let fixture = Fixture::new();
    let outside = fixture.root.join("outside.bin");
    fs::write(&outside, b"secret").unwrap();
    fs::write(fixture.game.join("public.bin"), b"public").unwrap();
    for source in [
        outside.to_string_lossy().into_owned(),
        "relative.bin".to_owned(),
    ] {
        let mut request = fixture.request();
        request.files.push(ExportArtifactFile {
            path: "public.bin".to_owned(),
            bytes: None,
            source_path: Some(source),
        });
        assert!(write_export(request).is_err());
    }
    fs::create_dir(fixture.game.join(".dev_docs")).unwrap();
    let private = fixture.game.join(".dev_docs/private.bin");
    fs::write(&private, b"secret").unwrap();
    let mut request = fixture.request();
    request.files.push(ExportArtifactFile {
        path: ".dev_docs/private.bin".to_owned(),
        bytes: None,
        source_path: Some(private.to_string_lossy().into_owned()),
    });
    assert!(write_export(request)
        .unwrap_err()
        .contains("Invalid relative"));
    assert!(sources::hash_sources(
        &fixture.game.to_string_lossy(),
        &[".dev_docs/private.bin".to_owned()]
    )
    .is_err());
    assert!(!fixture.root.join("exports").exists());
}

#[cfg(unix)]
#[test]
fn rejects_symlink_files_and_directories_during_copy_and_hashing() {
    let fixture = Fixture::new();
    let outside = fixture.root.join("secret");
    fs::create_dir(&outside).unwrap();
    fs::write(outside.join("data.bin"), b"secret").unwrap();
    std::os::unix::fs::symlink(outside.join("data.bin"), fixture.game.join("link.bin")).unwrap();
    std::os::unix::fs::symlink(&outside, fixture.game.join("linked-dir")).unwrap();
    for path in ["link.bin", "linked-dir/data.bin"] {
        let mut request = fixture.request();
        request.files.push(ExportArtifactFile {
            path: path.to_owned(),
            bytes: None,
            source_path: Some(fixture.game.join(path).to_string_lossy().into_owned()),
        });
        assert!(write_export(request).unwrap_err().contains("symbolic link"));
        assert!(
            sources::hash_sources(&fixture.game.to_string_lossy(), &[path.to_owned()])
                .unwrap_err()
                .contains("symbolic link")
        );
    }
    assert!(!fixture.root.join("exports").exists());
}
