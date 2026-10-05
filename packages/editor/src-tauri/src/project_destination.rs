use std::collections::HashMap;
use std::fs::{self, Metadata, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

const RESERVATION_FILE: &str = ".zerith-project-reservation";
static RESERVATIONS: LazyLock<Mutex<HashMap<PathBuf, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static NEXT_RESERVATION: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub(crate) async fn reserve_project_destination(
    path: String,
    source_path: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        reserve_destination(Path::new(&path), source_path.as_deref().map(Path::new))
            .map(|path| display_path(&path))
    })
    .await
    .map_err(|error| format!("Destination reservation task failed: {error}"))?
}

#[tauri::command]
pub(crate) async fn finish_project_destination(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || finish_destination(Path::new(&path)))
        .await
        .map_err(|error| format!("Destination completion task failed: {error}"))?
}

fn reserve_destination(path: &Path, source: Option<&Path>) -> Result<PathBuf, String> {
    reserve_destination_with(path, source, |_| {})
}

fn reserve_destination_with(
    path: &Path,
    source: Option<&Path>,
    after_marker: impl FnOnce(&Path),
) -> Result<PathBuf, String> {
    validate_absolute(path)?;
    reject_links(path)?;
    let parent = path
        .parent()
        .ok_or("Choose a folder below a filesystem root.")?;
    let parent = fs::canonicalize(parent)
        .map_err(|error| format!("Destination parent must already exist: {error}"))?;
    if !parent.is_dir() {
        return Err("Destination parent must be a directory.".to_owned());
    }
    let candidate = parent.join(path.file_name().ok_or("Destination has no folder name.")?);
    reject_links(&candidate)?;
    let existed = match fs::symlink_metadata(&candidate) {
        Ok(metadata) => {
            if is_link(&metadata) || !metadata.is_dir() {
                return Err("Destination must be a new or empty directory.".to_owned());
            }
            ensure_empty(&candidate, false)?;
            true
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => false,
        Err(error) => return Err(format!("Cannot inspect destination: {error}")),
    };
    let candidate = if existed {
        fs::canonicalize(&candidate).map_err(|error| error.to_string())?
    } else {
        candidate
    };
    reject_project_ancestors(&candidate)?;
    if let Some(source) = source {
        validate_absolute(source)?;
        reject_links(source)?;
        let source = fs::canonicalize(source)
            .map_err(|error| format!("Cannot resolve source project: {error}"))?;
        if !source.is_dir() {
            return Err("Source project must be a directory.".to_owned());
        }
        if overlaps(&candidate, &source) {
            return Err("Destination and source project must not overlap.".to_owned());
        }
    }

    let mut changed = false;
    let result = (|| {
        if !existed {
            fs::create_dir(&candidate)
                .map_err(|error| format!("Cannot reserve new destination: {error}"))?;
            changed = true;
        }
        reject_links(&candidate)?;
        reject_project_ancestors(&candidate)?;
        let canonical = fs::canonicalize(&candidate).map_err(|error| error.to_string())?;
        if !same_path(&canonical, &candidate) {
            return Err("Destination changed while it was being reserved.".to_owned());
        }
        ensure_empty(&canonical, false)?;
        let marker = canonical.join(RESERVATION_FILE);
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&marker)
            .map_err(|error| format!("Cannot exclusively reserve destination: {error}"))?;
        changed = true;
        let token = format!(
            "{}:{}:{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|error| error.to_string())?
                .as_nanos(),
            NEXT_RESERVATION.fetch_add(1, Ordering::Relaxed)
        );
        file.write_all(token.as_bytes())
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("Cannot write destination reservation: {error}"))?;
        after_marker(&canonical);
        ensure_empty(&canonical, true)?;
        reject_links(&canonical)?;
        reject_project_ancestors(&canonical)?;
        let metadata = fs::symlink_metadata(&marker).map_err(|error| error.to_string())?;
        if is_link(&metadata) || !metadata.is_file() {
            return Err("Destination reservation marker changed.".to_owned());
        }
        if fs::read_to_string(&marker).map_err(|error| error.to_string())? != token {
            return Err("Destination reservation marker changed.".to_owned());
        }
        RESERVATIONS
            .lock()
            .map_err(|_| "Destination reservation lock failed.")?
            .insert(canonical.clone(), token);
        Ok(canonical)
    })();
    result.map_err(|error| {
        if changed {
            format!(
                "{error} Partial output remains at {}; choose a new destination to retry.",
                display_path(&candidate)
            )
        } else {
            error
        }
    })
}

fn finish_destination(path: &Path) -> Result<(), String> {
    validate_absolute(path)?;
    reject_links(path)?;
    let canonical = fs::canonicalize(path).map_err(|error| error.to_string())?;
    let mut reservations = RESERVATIONS
        .lock()
        .map_err(|_| "Destination reservation lock failed.")?;
    let token = reservations
        .get(&canonical)
        .ok_or("Destination is not reserved by this editor process.")?;
    let marker = canonical.join(RESERVATION_FILE);
    let metadata = fs::symlink_metadata(&marker).map_err(|error| error.to_string())?;
    if is_link(&metadata) || !metadata.is_file() {
        return Err("Destination reservation marker changed.".to_owned());
    }
    let contents = fs::read_to_string(&marker).map_err(|error| error.to_string())?;
    if &contents != token {
        return Err("Destination reservation marker changed.".to_owned());
    }
    // Only this process's successful reservation can release its marker.
    fs::remove_file(marker).map_err(|error| error.to_string())?;
    reservations.remove(&canonical);
    Ok(())
}

fn validate_absolute(path: &Path) -> Result<(), String> {
    if !path.is_absolute() {
        return Err("Destination and source paths must be absolute.".to_owned());
    }
    if path.parent().is_none() || path.file_name().is_none() {
        return Err("Choose a folder below a filesystem root.".to_owned());
    }
    if path.components().any(|part| part == Component::ParentDir) {
        return Err("Project paths must not contain parent-directory aliases.".to_owned());
    }
    #[cfg(windows)]
    for part in path.components() {
        if let Component::Normal(name) = part {
            let name = name.to_string_lossy();
            if name.ends_with(['.', ' ']) || name.contains(':') {
                return Err("Project paths must not contain Windows filename aliases.".to_owned());
            }
        }
    }
    Ok(())
}

fn reject_links(path: &Path) -> Result<(), String> {
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) if is_link(&metadata) => {
                return Err(format!(
                    "Project paths must not use symlinks or reparse points: {}",
                    ancestor.display()
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Cannot inspect project path: {error}")),
        }
    }
    Ok(())
}

fn is_link(metadata: &Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        metadata.file_type().is_symlink()
    }
}

fn reject_project_ancestors(path: &Path) -> Result<(), String> {
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor.join("game.json")) {
            Ok(_) => return Err("Destination must not be inside an existing project.".to_owned()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Cannot inspect destination ancestry: {error}")),
        }
    }
    Ok(())
}

fn ensure_empty(path: &Path, reserved: bool) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !reserved || entry.file_name() != RESERVATION_FILE {
            return Err("Destination must be a new or empty directory.".to_owned());
        }
    }
    Ok(())
}

fn overlaps(left: &Path, right: &Path) -> bool {
    #[cfg(windows)]
    {
        let left = PathBuf::from(left.to_string_lossy().to_lowercase());
        let right = PathBuf::from(right.to_string_lossy().to_lowercase());
        left.starts_with(&right) || right.starts_with(&left)
    }
    #[cfg(not(windows))]
    {
        left.starts_with(right) || right.starts_with(left)
    }
}

fn same_path(left: &Path, right: &Path) -> bool {
    overlaps(left, right) && left.components().count() == right.components().count()
}

fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    #[cfg(windows)]
    {
        if let Some(unc) = text.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{unc}");
        }
        if let Some(local) = text.strip_prefix(r"\\?\") {
            return local.to_owned();
        }
    }
    text.into_owned()
}

#[cfg(test)]
#[path = "project_destination_tests.rs"]
mod tests;
