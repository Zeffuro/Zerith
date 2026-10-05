use super::*;
use std::io::Read;

fn fixture_runtime(directory: &Path, overrides: Value) -> PathBuf {
    let runtime = directory.join("runtime");
    fs::create_dir(&runtime).unwrap();
    let executable = if cfg!(windows) {
        "game-player.exe"
    } else {
        "game-player"
    };
    let bytes = b"fixture compiled player bytes";
    fs::write(runtime.join(executable), bytes).unwrap();
    let mut manifest = json!({ "formatVersion": 1, "platform": platform(), "arch": architecture(),
        "executable": executable, "sha256": format!("{:x}", Sha256::digest(bytes)), "runtimeVersion": RUNTIME_VERSION });
    for (key, value) in overrides.as_object().unwrap() {
        manifest[key] = value.clone();
    }
    fs::write(
        runtime.join("runtime.json"),
        serde_json::to_vec(&manifest).unwrap(),
    )
    .unwrap();
    runtime
}

fn fixture_request(directory: &Path, name: &str, extra: Value) -> (ExportGameRequest, PathBuf) {
    let game = directory.join("game");
    if !game.exists() {
        fs::create_dir(&game).unwrap();
        fs::write(game.join("game.json"), "{\"title\":\"Fixture\"}").unwrap();
        fs::write(
            game.join("engine.config.json"),
            "{\"display\":{\"width\":800,\"height\":600}}",
        )
        .unwrap();
    }
    let output = directory.join(name);
    let mut files = json!([
        {"path":"index.html", "bytes": b"<html>player</html>"},
        {"path":"game.json", "bytes": b"{\"title\":\"Fixture\"}"},
        {"path":"zerith.content.json", "bytes": b"{}"},
        {"path":"assets/game.js", "bytes": b"compiled player code"}
    ]);
    if !extra.is_null() {
        files.as_array_mut().unwrap().push(extra);
    }
    (
        serde_json::from_value(json!({ "gamePath":game, "outDir":output, "files":files })).unwrap(),
        output,
    )
}

#[test]
fn identity_and_dimensions_match_the_node_contract() {
    let metadata = desktop_metadata(&json!({ "title": "Classic VN Starter" }), &json!({})).unwrap();
    assert_eq!(metadata["gameId"], "games.classicvnstarter.g16af32adf16f");
    assert_eq!(metadata["width"], 1280);
    assert_eq!(metadata["height"], 720);
    let first = desktop_metadata(
        &json!({ "title":"Shared", "id":"first-game" }),
        &json!({"display":{"width":800,"height":600}}),
    )
    .unwrap();
    let renamed =
        desktop_metadata(&json!({ "title":"Renamed", "id":"first-game" }), &json!({})).unwrap();
    let second =
        desktop_metadata(&json!({ "title":"Shared", "id":"second-game" }), &json!({})).unwrap();
    assert_eq!(first["gameId"], renamed["gameId"]);
    assert_ne!(first["gameId"], second["gameId"]);
    assert_eq!(first["width"], 800);
    assert_eq!(first["height"], 600);
    let float_config: Value =
        serde_json::from_str("{\"display\":{\"width\":800.0,\"height\":600.0}}").unwrap();
    let dimensions = desktop_metadata(&json!({}), &float_config).unwrap();
    assert_eq!(dimensions["width"], 800);
    assert_eq!(dimensions["height"], 600);
    assert!(desktop_metadata(&json!({"id":""}), &json!({})).is_err());
    assert!(desktop_metadata(&json!({"title":"bad\u{0}title"}), &json!({})).is_err());
    assert!(desktop_metadata(&json!({"title":"界".repeat(86)}), &json!({})).is_err());
}

#[test]
fn invalid_runtimes_fail_before_output_reservation() {
    for overrides in [
        json!({"formatVersion":2}),
        json!({"platform":"other"}),
        json!({"arch":"other"}),
        json!({"sha256":"0".repeat(64)}),
        json!({"executable":"../game-player"}),
        json!({"runtimeVersion":"other"}),
    ] {
        let fixture = tempfile::tempdir().unwrap();
        let runtime = fixture_runtime(fixture.path(), overrides);
        let (request, output) = fixture_request(fixture.path(), "output", Value::Null);
        let error = package_game(request, &runtime).err().unwrap();
        assert!(error.contains("Prebuilt player missing or invalid"));
        assert!(!error.contains("Rust"));
        assert!(!output.exists());
    }
    let fixture = tempfile::tempdir().unwrap();
    for runtime in [
        fixture.path().join("absent"),
        fixture_runtime(fixture.path(), json!({})),
    ] {
        if runtime.exists() {
            fs::write(runtime.join("runtime.json"), "{").unwrap();
        }
        let (request, output) = fixture_request(fixture.path(), "missing-output", Value::Null);
        assert!(package_game(request, &runtime)
            .err()
            .unwrap()
            .contains("Reinstall"));
        assert!(!output.exists());
    }
}

#[test]
fn packages_copy_unchanged_binary_and_archive_current_artifacts() {
    let fixture = tempfile::tempdir().unwrap();
    let runtime = fixture_runtime(fixture.path(), json!({}));
    let (request, output) = fixture_request(fixture.path(), "output", Value::Null);
    let response = package_game(request, &runtime).unwrap();
    assert_eq!(
        fs::read(response.executable_path).unwrap(),
        b"fixture compiled player bytes"
    );
    assert!(!output.join("package-source").exists());
    assert!(!output.join("desktop-build.log").exists());
    let mut archive =
        zip::ZipArchive::new(fs::File::open(output.join("game.zpack")).unwrap()).unwrap();
    assert_eq!(archive.len(), 5);
    let mut javascript = String::new();
    archive
        .by_name("assets/game.js")
        .unwrap()
        .read_to_string(&mut javascript)
        .unwrap();
    assert_eq!(javascript, "compiled player code");
    let metadata: Value = serde_json::from_reader(archive.by_name(METADATA_NAME).unwrap()).unwrap();
    assert_eq!(metadata["title"], "Fixture");
    assert_eq!(metadata["width"], 800);
    assert_eq!(metadata["height"], 600);
    let (request, second) = fixture_request(fixture.path(), "second", Value::Null);
    package_game(request, &runtime).unwrap();
    assert_eq!(
        fs::read(output.join("game.zpack")).unwrap(),
        fs::read(second.join("game.zpack")).unwrap()
    );
}

#[test]
fn reserved_metadata_and_duplicate_payloads_are_rejected_without_overwrite() {
    for extra in [
        json!({"path":"ZERITH.DESKTOP.JSON", "bytes":b"preserve"}),
        json!({"path":"assets/game.js", "bytes":b"conflict"}),
        json!({"path":"assets/game.js/nested", "bytes":b"conflict"}),
        json!({"path":"assets/percent%20.txt", "bytes":b"preserve"}),
        json!({"path":"assets/fragment#name.txt", "bytes":b"preserve"}),
    ] {
        let fixture = tempfile::tempdir().unwrap();
        let runtime = fixture_runtime(fixture.path(), json!({}));
        let (request, output) = fixture_request(fixture.path(), "output", extra);
        assert!(package_game(request, &runtime).is_err());
        assert!(!output.join("game.zpack").exists());
        assert!(!output.join("game-player.exe").exists());
        assert!(!output.join("game-player").exists());
    }
}

#[test]
fn existing_desktop_output_and_project_overlap_preserve_files() {
    let fixture = tempfile::tempdir().unwrap();
    let runtime = fixture_runtime(fixture.path(), json!({}));
    let (request, output) = fixture_request(fixture.path(), "output", Value::Null);
    fs::create_dir(&output).unwrap();
    fs::write(output.join("save.json"), "preserve saved progress").unwrap();
    assert!(package_game(request, &runtime)
        .err()
        .unwrap()
        .contains("already exists"));
    assert_eq!(
        fs::read_to_string(output.join("save.json")).unwrap(),
        "preserve saved progress"
    );
    let (mut request, _) = fixture_request(fixture.path(), "unused", Value::Null);
    let overlap = fixture.path().join("game/desktop");
    request.out_dir = Some(overlap.to_string_lossy().into_owned());
    assert!(package_game(request, &runtime)
        .err()
        .unwrap()
        .contains("outside the project"));
    assert!(!overlap.exists());
}
