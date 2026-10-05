use crate::export::{destination_path, ensure_destination, write_export, ExportGameRequest};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;
use zip::write::SimpleFileOptions;

const METADATA_NAME: &str = "zerith.desktop.json";
const RUNTIME_VERSION: &str = "0.1.0";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopExportResponse {
    out_directory: String,
    executable_path: String,
    stderr: String,
    stdout: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeManifest {
    format_version: u32,
    platform: String,
    arch: String,
    executable: String,
    sha256: String,
    runtime_version: String,
}

struct DesktopRuntime {
    executable: String,
    bytes: Vec<u8>,
}

#[tauri::command]
pub(crate) async fn export_desktop_game(
    app: tauri::AppHandle,
    request: ExportGameRequest,
) -> Result<DesktopExportResponse, String> {
    let runtime = runtime_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || package_game(request, &runtime))
        .await
        .map_err(|error| format!("Desktop export task failed: {error}"))?
}

fn platform() -> &'static str {
    match std::env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    }
}

fn architecture() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "x86" => "ia32",
        other => other,
    }
}

fn runtime_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let target = format!("{}-{}", platform(), architecture());
    let bundled = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Prebuilt player missing. Reinstall the editor: {error}"))?
        .join("desktop-runtime")
        .join(&target);
    #[cfg(debug_assertions)]
    if !bundled.exists() {
        return Ok(Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../player/desktop-runtime")
            .join(target));
    }
    Ok(bundled)
}

fn validate_runtime(directory: &Path) -> Result<DesktopRuntime, String> {
    let result = (|| {
        let manifest_path = directory.join("runtime.json");
        if fs::metadata(&manifest_path)
            .map_err(|error| error.to_string())?
            .len()
            > 64 * 1024
        {
            return Err("Runtime manifest is too large".to_owned());
        }
        let manifest: RuntimeManifest =
            serde_json::from_slice(&fs::read(manifest_path).map_err(|error| error.to_string())?)
                .map_err(|error| format!("Invalid runtime manifest: {error}"))?;
        let executable = if cfg!(windows) {
            "game-player.exe"
        } else {
            "game-player"
        };
        if manifest.format_version != 1
            || manifest.platform != platform()
            || manifest.arch != architecture()
            || manifest.executable != executable
            || manifest.runtime_version != RUNTIME_VERSION
            || manifest.sha256.len() != 64
            || !manifest
                .sha256
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(
                "Runtime manifest does not match this platform and architecture".to_owned(),
            );
        }
        let source = directory.join(executable);
        if !fs::symlink_metadata(&source)
            .map_err(|error| error.to_string())?
            .file_type()
            .is_file()
        {
            return Err("Runtime executable must be a regular file".to_owned());
        }
        let bytes = fs::read(source).map_err(|error| error.to_string())?;
        if bytes.is_empty() || format!("{:x}", Sha256::digest(&bytes)) != manifest.sha256 {
            return Err("Runtime executable checksum does not match".to_owned());
        }
        Ok(DesktopRuntime {
            executable: executable.to_owned(),
            bytes,
        })
    })();
    result.map_err(|error: String| {
        format!(
            "Prebuilt player missing or invalid. Reinstall the editor.\n{}: {error}",
            directory.display()
        )
    })
}

fn package_game(
    mut request: ExportGameRequest,
    runtime_directory: &Path,
) -> Result<DesktopExportResponse, String> {
    if !Path::new(&request.game_path).is_absolute() {
        return Err("Desktop project path must be absolute".to_owned());
    }
    let game = fs::canonicalize(&request.game_path)
        .map_err(|error| format!("Cannot open project: {error}"))?;
    let manifest: Value = serde_json::from_slice(
        &fs::read(game.join("game.json")).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Cannot read game manifest: {error}"))?;
    let config_path = game.join("engine.config.json");
    let config = if config_path.exists() {
        serde_json::from_slice(&fs::read(config_path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Cannot read engine configuration: {error}"))?
    } else {
        json!({})
    };
    let metadata = desktop_metadata(&manifest, &config)?;
    let parent = game.parent().ok_or("Project has no parent directory")?;
    let default = PathBuf::from("dist").join(format!(
        "{}-desktop",
        game.file_name()
            .ok_or("Project has no name")?
            .to_string_lossy()
    ));
    let out = destination_path(parent, request.out_dir.as_deref(), &default)?;
    ensure_destination(&out, &game)?;
    let runtime = validate_runtime(runtime_directory)?;
    fs::create_dir_all(out.parent().ok_or("Desktop output has no parent")?)
        .map_err(|error| error.to_string())?;
    fs::create_dir(&out).map_err(|error| format!("Cannot reserve desktop output: {error}"))?;
    let result = (|| {
        request.out_dir = Some(out.join("web").to_string_lossy().into_owned());
        request.zip = Some(false);
        request.zip_file = None;
        write_export(request)?;
        write_payload(&out, &metadata)?;
        let executable = out.join(&runtime.executable);
        write_new(&executable, &runtime.bytes)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))
                .map_err(|error| error.to_string())?;
        }
        Ok(DesktopExportResponse {
            out_directory: out.to_string_lossy().into_owned(),
            executable_path: executable.to_string_lossy().into_owned(),
            stderr: String::new(),
            stdout: format!("Desktop game packaged at {}\nGame data: {}\nThe web folder is an optional diagnostic export. Distribute the player and game.zpack together.\n", executable.display(), out.join("game.zpack").display()),
        })
    })();
    result.map_err(|error: String| {
        format!(
            "{error}\nPartial output remains at {}. Choose a new destination to retry",
            out.display()
        )
    })
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(bytes)
        .and_then(|()| file.sync_all())
        .map_err(|error| error.to_string())
}

fn metadata_text(
    value: Option<&Value>,
    fallback: Option<&str>,
    field: &str,
) -> Result<String, String> {
    let text = value.and_then(Value::as_str).unwrap_or("").trim();
    if text.is_empty() {
        if let Some(fallback) = fallback {
            return Ok(fallback.to_owned());
        }
    }
    if text.is_empty() || text.len() > 256 || text.chars().any(char::is_control) {
        return Err(format!(
            "Desktop {field} must contain 1 to 256 UTF-8 bytes without control characters"
        ));
    }
    Ok(text.to_owned())
}

fn desktop_metadata(manifest: &Value, config: &Value) -> Result<Value, String> {
    let title = metadata_text(manifest.get("title"), Some("Game"), "title")?;
    let seed = if manifest.get("id").is_some() {
        metadata_text(manifest.get("id"), None, "game id")?
    } else {
        title.clone()
    };
    let mut slug = String::new();
    for character in seed.to_ascii_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug = slug
        .trim_matches('-')
        .chars()
        .take(48)
        .filter(|character| *character != '-')
        .collect::<String>();
    let slug = if slug.is_empty() { "game" } else { &slug };
    let digest = format!("{:x}", Sha256::digest(seed.as_bytes()));
    let dimension = |key: &str, fallback: u64, minimum: u64| {
        config
            .get("display")
            .and_then(|display| display.get(key))
            .and_then(Value::as_f64)
            .filter(|value| value.fract() == 0.0 && *value >= minimum as f64 && *value <= 8192.0)
            .map(|value| value as u64)
            .unwrap_or(fallback)
    };
    Ok(
        json!({ "formatVersion": 1, "gameId": format!("games.{}.g{}", slug, &digest[..12]),
        "title": title, "width": dimension("width", 1280, 320), "height": dimension("height", 720, 240) }),
    )
}

fn collect_payload(
    root: &Path,
    current: &Path,
    paths: &mut Vec<(String, PathBuf)>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(current)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        let lower = relative.to_ascii_lowercase();
        if relative.len() > 2048
            || relative
                .chars()
                .any(|character| character.is_control() || "\\:%?#".contains(character))
            || lower.split('/').any(|segment| {
                segment.is_empty()
                    || matches!(segment, "." | ".." | ".dev_docs" | ".git" | "node_modules")
            })
        {
            return Err(format!("Unsafe desktop payload path: {relative}"));
        }
        if lower == METADATA_NAME || lower.starts_with(&format!("{METADATA_NAME}/")) {
            return Err(format!("Desktop metadata path is reserved: {relative}"));
        }
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        if kind.is_dir() {
            collect_payload(root, &path, paths)?;
        } else if kind.is_file() {
            paths.push((relative, path));
        } else {
            return Err(format!("Desktop payload is not a regular file: {relative}"));
        }
    }
    Ok(())
}

fn write_payload(out: &Path, metadata: &Value) -> Result<(), String> {
    let web = out.join("web");
    let mut paths = Vec::new();
    collect_payload(&web, &web, &mut paths)?;
    paths.sort_by(|left, right| left.0.cmp(&right.0));
    let metadata_bytes = serde_json::to_vec_pretty(metadata).map_err(|error| error.to_string())?;
    let mut total = metadata_bytes.len() as u64;
    for (_, path) in &paths {
        let size = fs::metadata(path).map_err(|error| error.to_string())?.len();
        if size > 1024 * 1024 * 1024 {
            return Err("Desktop payload file exceeds 1 GiB".to_owned());
        }
        total += size;
    }
    if paths.len() >= 100_000 || total > 4 * 1024 * 1024 * 1024 {
        return Err("Desktop payload exceeds 100000 files or 4 GiB".to_owned());
    }
    let archive = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(out.join("game.zpack"))
        .map_err(|error| error.to_string())?;
    let mut zip = zip::ZipWriter::new(archive);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .last_modified_time(zip::DateTime::default())
        .unix_permissions(0o644);
    for (name, path) in paths {
        zip.start_file(name, options)
            .map_err(|error| error.to_string())?;
        std::io::copy(
            &mut fs::File::open(path).map_err(|error| error.to_string())?,
            &mut zip,
        )
        .map_err(|error| error.to_string())?;
    }
    zip.start_file(METADATA_NAME, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(&metadata_bytes)
        .map_err(|error| error.to_string())?;
    let file = zip.finish().map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    if file.metadata().map_err(|error| error.to_string())?.len() > 4 * 1024 * 1024 * 1024 {
        return Err("Desktop archive exceeds 4 GiB".to_owned());
    }
    Ok(())
}

#[cfg(test)]
#[path = "desktop_export_tests.rs"]
mod tests;
