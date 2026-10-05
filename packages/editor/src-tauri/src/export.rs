#[path = "export_sources.rs"]
mod sources;

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use zip::write::SimpleFileOptions;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportGameRequest {
    base: Option<String>,
    files: Vec<ExportArtifactFile>,
    pub(crate) game_path: String,
    pub(crate) out_dir: Option<String>,
    pub(crate) zip: Option<bool>,
    pub(crate) zip_file: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ExportArtifactFile {
    path: String,
    bytes: Option<Vec<u8>>,
    #[serde(rename = "sourcePath")]
    source_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportGameResponse {
    out_directory: String,
    zip_path: Option<String>,
    stderr: String,
    stdout: String,
}

#[tauri::command]
pub(crate) async fn export_game(request: ExportGameRequest) -> Result<ExportGameResponse, String> {
    tauri::async_runtime::spawn_blocking(move || write_export(request))
        .await
        .map_err(|error| format!("Export task failed: {error}"))?
}

#[tauri::command]
pub(crate) async fn hash_export_sources(
    game_path: String,
    paths: Vec<String>,
) -> Result<std::collections::BTreeMap<String, sources::SourceHash>, String> {
    tauri::async_runtime::spawn_blocking(move || sources::hash_sources(&game_path, &paths))
        .await
        .map_err(|error| format!("Export hashing task failed: {error}"))?
}

pub(crate) fn write_export(request: ExportGameRequest) -> Result<ExportGameResponse, String> {
    validate_artifacts(&request.files)?;
    let game = Path::new(&request.game_path);
    if !game.is_absolute() {
        return Err("Export project path must be absolute.".to_owned());
    }
    let game = fs::canonicalize(game).map_err(|error| format!("Cannot open project: {error}"))?;
    if !game.join("game.json").is_file() {
        return Err("Export project must contain game.json.".to_owned());
    }
    for artifact in &request.files {
        if let Some(source) = &artifact.source_path {
            sources::open_source(&game, &artifact.path, Some(source))?;
        }
    }
    let parent = game.parent().ok_or("Project has no parent directory.")?;
    let game_name = game.file_name().ok_or("Project has no directory name.")?;
    let default_output = PathBuf::from("dist").join(game_name);
    let out = destination_path(parent, request.out_dir.as_deref(), &default_output)?;
    let archive = if request.zip.unwrap_or(false) {
        let default_zip = PathBuf::from(format!("{}.zip", out.display()));
        Some(destination_path(
            parent,
            request.zip_file.as_deref(),
            &default_zip,
        )?)
    } else {
        None
    };
    ensure_destination(&out, &game)?;
    if let Some(path) = &archive {
        ensure_destination(path, &game)?;
        if path.starts_with(&out) || out.starts_with(path) {
            return Err("ZIP and directory destinations must not overlap.".to_owned());
        }
    }

    fs::create_dir_all(out.parent().ok_or("Output has no parent directory.")?)
        .map_err(|error| format!("Cannot create export parent directory: {error}"))?;
    if let Some(path) = &archive {
        fs::create_dir_all(path.parent().ok_or("ZIP has no parent directory.")?)
            .map_err(|error| format!("Cannot create ZIP parent directory: {error}"))?;
    }
    fs::create_dir(&out)
        .map_err(|error| format!("Cannot reserve new export directory: {error}"))?;
    let result = write_artifacts(&game, &out, archive.as_deref(), &request.files);
    if let Err(error) = result {
        return Err(format!(
            "Export failed: {error}. Partial output remains at {}; choose a new destination to retry.",
            out.display()
        ));
    }
    let out_directory = out.to_string_lossy().into_owned();
    let zip_path = archive.map(|path| path.to_string_lossy().into_owned());
    let mut stdout = format!(
        "Built game from {} to {} (base: {})\nIncluded {} artifact files.\n",
        game.display(),
        out_directory,
        request.base.as_deref().unwrap_or("./"),
        request.files.len()
    );
    if let Some(path) = &zip_path {
        stdout.push_str(&format!("Created zip archive at {path}\n"));
    }
    Ok(ExportGameResponse {
        out_directory,
        zip_path,
        stderr: String::new(),
        stdout,
    })
}

fn write_artifacts(
    game: &Path,
    out: &Path,
    archive: Option<&Path>,
    files: &[ExportArtifactFile],
) -> Result<(), String> {
    let mut zip = archive
        .map(|path| {
            OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map(zip::ZipWriter::new)
                .map_err(|error| format!("Cannot reserve new ZIP: {error}"))
        })
        .transpose()?;
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for artifact in files {
        let path = out.join(&artifact.path);
        fs::create_dir_all(path.parent().ok_or("Artifact has no parent directory.")?)
            .map_err(|error| format!("Cannot create artifact directory: {error}"))?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|error| format!("Cannot create {}: {error}", artifact.path))?;
        if let Some(zip) = zip.as_mut() {
            zip.start_file(&artifact.path, options)
                .map_err(|error| format!("Cannot add ZIP entry: {error}"))?;
        }
        if let Some(bytes) = &artifact.bytes {
            file.write_all(bytes).map_err(|error| error.to_string())?;
            if let Some(zip) = zip.as_mut() {
                zip.write_all(bytes).map_err(|error| error.to_string())?;
            }
        } else if let Some(source) = &artifact.source_path {
            let mut input = sources::open_source(game, &artifact.path, Some(source))?;
            let mut buffer = [0_u8; 64 * 1024];
            loop {
                let count = input.read(&mut buffer).map_err(|error| error.to_string())?;
                if count == 0 {
                    break;
                }
                file.write_all(&buffer[..count])
                    .map_err(|error| error.to_string())?;
                if let Some(zip) = zip.as_mut() {
                    zip.write_all(&buffer[..count])
                        .map_err(|error| error.to_string())?;
                }
            }
        }
        file.sync_all()
            .map_err(|error| format!("Cannot flush artifact: {error}"))?;
    }
    if let Some(zip) = zip {
        let file: File = zip
            .finish()
            .map_err(|error| format!("Cannot finish ZIP: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Cannot flush ZIP: {error}"))?;
    }
    Ok(())
}

fn validate_artifacts(files: &[ExportArtifactFile]) -> Result<(), String> {
    let mut paths = HashSet::new();
    for file in files {
        if file.bytes.is_some() == file.source_path.is_some() {
            return Err(format!(
                "Artifact must contain either bytes or a source path: {}",
                file.path
            ));
        }
        validate_relative_path(&file.path)?;
        let normalized = file.path.to_lowercase();
        if !paths.insert(normalized) {
            return Err(format!("Duplicate artifact path: {}", file.path));
        }
    }
    for path in &paths {
        for (offset, _) in path.match_indices('/') {
            if paths.contains(&path[..offset]) {
                return Err(format!("Artifact file/directory conflict: {path}"));
            }
        }
    }
    for required in ["index.html", "game.json", "zerith.content.json"] {
        if !files.iter().any(|file| file.path == required) {
            return Err(format!("Export is missing required artifact: {required}"));
        }
    }
    Ok(())
}

fn validate_relative_path(path: &str) -> Result<(), String> {
    if path.is_empty() || path.contains('\\') {
        return Err(format!("Invalid relative artifact path: {}", path));
    }
    for segment in path.split('/') {
        let stem = segment.split('.').next().unwrap_or("").to_ascii_uppercase();
        let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || (stem.len() == 4
                && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && matches!(stem.as_bytes()[3], b'1'..=b'9'));
        if segment.is_empty()
            || matches!(
                segment.to_ascii_lowercase().as_str(),
                "." | ".." | ".dev_docs" | ".git" | "node_modules"
            )
            || segment.ends_with(['.', ' '])
            || segment
                .chars()
                .any(|c| c.is_control() || "<>:\"|?*".contains(c))
            || reserved
        {
            return Err(format!("Invalid relative artifact path: {}", path));
        }
    }
    Ok(())
}

pub(crate) fn destination_path(
    parent: &Path,
    value: Option<&str>,
    default: &Path,
) -> Result<PathBuf, String> {
    let path = value
        .filter(|value| !value.trim().is_empty())
        .map_or(default, Path::new);
    let joined = if path.is_absolute() {
        path.to_path_buf()
    } else {
        parent.join(path)
    };
    let mut normalized = PathBuf::new();
    for component in joined.components() {
        match component {
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err("Export destination escapes the filesystem root.".to_owned());
                }
            }
            Component::CurDir => {}
            other => normalized.push(other),
        }
    }
    if !normalized.is_absolute() {
        return Err("Export destination must resolve to an absolute path.".to_owned());
    }
    Ok(normalized)
}

pub(crate) fn ensure_destination(path: &Path, game: &Path) -> Result<(), String> {
    let mut missing = Vec::new();
    let mut ancestor = path;
    loop {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err(format!(
                        "Export destination contains a symbolic link: {}",
                        ancestor.display()
                    ));
                }
                if ancestor == path {
                    return Err(format!(
                        "Export destination already exists: {}. Choose a new destination.",
                        path.display()
                    ));
                }
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                missing.push(ancestor.file_name().ok_or("Invalid export destination.")?);
                ancestor = ancestor
                    .parent()
                    .ok_or("Destination has no existing parent.")?;
            }
            Err(error) => return Err(format!("Cannot inspect export destination: {error}")),
        }
    }
    for parent in ancestor.ancestors() {
        if fs::symlink_metadata(parent)
            .map_err(|error| error.to_string())?
            .file_type()
            .is_symlink()
        {
            return Err(format!(
                "Export destination contains a symbolic link: {}",
                parent.display()
            ));
        }
    }
    let mut resolved = fs::canonicalize(ancestor).map_err(|error| error.to_string())?;
    for segment in missing.iter().rev() {
        resolved.push(segment);
    }
    if resolved.starts_with(game) || game.starts_with(&resolved) {
        return Err("Export destination must be outside the project directory.".to_owned());
    }
    Ok(())
}

#[cfg(test)]
#[path = "export_tests.rs"]
mod tests;
