use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportGameRequest {
    base: Option<String>,
    game_path: String,
    out_dir: Option<String>,
    zip: Option<bool>,
    zip_file: Option<String>,
}

#[derive(Debug, Serialize)]
struct ExportGameResponse {
    stderr: String,
    stdout: String,
}

fn find_workspace_root(start: &Path) -> Option<PathBuf> {
    for candidate in start.ancestors() {
        let package_manifest = candidate.join("package.json");
        let build_script = candidate
            .join("packages")
            .join("player")
            .join("scripts")
            .join("build-game.mjs");

        if package_manifest.exists() && build_script.exists() {
            return Some(candidate.to_path_buf());
        }
    }

    None
}

fn npm_executable() -> OsString {
    if cfg!(target_os = "windows") {
        OsString::from("npm.cmd")
    } else {
        OsString::from("npm")
    }
}

#[tauri::command]
fn export_game(request: ExportGameRequest) -> Result<ExportGameResponse, String> {
    let current_dir = std::env::current_dir().map_err(|error| format!("Failed to read current directory: {error}"))?;
    let workspace_root = find_workspace_root(&current_dir).ok_or_else(|| {
        format!(
            "Failed to locate workspace root from {}",
            current_dir.display()
        )
    })?;

    let mut args: Vec<String> = vec![
        "run".to_owned(),
        "build:game".to_owned(),
        "--".to_owned(),
        "--game".to_owned(),
        request.game_path,
    ];

    if let Some(out_dir) = request.out_dir {
        args.push("--outDir".to_owned());
        args.push(out_dir);
    }

    if request.zip.unwrap_or(false) {
        args.push("--zip".to_owned());
    }

    if let Some(zip_file) = request.zip_file {
        args.push("--zipFile".to_owned());
        args.push(zip_file);
    }

    if let Some(base) = request.base {
        args.push("--base".to_owned());
        args.push(base);
    }

    let output = Command::new(npm_executable())
        .args(&args)
        .current_dir(&workspace_root)
        .output()
        .map_err(|error| format!("Failed to run export command: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let combined = if stderr.trim().is_empty() {
            stdout.clone()
        } else if stdout.trim().is_empty() {
            stderr.clone()
        } else {
            format!("{stderr}\n{stdout}")
        };
        return Err(combined.trim().to_owned());
    }

    Ok(ExportGameResponse { stderr, stdout })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![export_game])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
