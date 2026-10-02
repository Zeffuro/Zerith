use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Write};
use std::path::Path;
use std::sync::Mutex;

static WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileWriteError {
    pub(crate) code: &'static str,
    pub(crate) message: String,
}

impl FileWriteError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<io::Error> for FileWriteError {
    fn from(error: io::Error) -> Self {
        let code = if error.kind() == io::ErrorKind::AlreadyExists {
            "alreadyExists"
        } else {
            "io"
        };
        Self::new(code, error.to_string())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextWriteRequest {
    path: String,
    content: String,
    expected_content: Option<String>,
    #[serde(default)]
    create_only: bool,
}

#[tauri::command]
pub(crate) async fn write_text_file_atomic(
    request: TextWriteRequest,
) -> Result<(), FileWriteError> {
    tauri::async_runtime::spawn_blocking(move || {
        write_atomic_bytes(
            Path::new(&request.path),
            request.content.as_bytes(),
            request.expected_content.as_deref(),
            request.create_only,
        )
    })
    .await
    .map_err(|error| FileWriteError::new("task", error.to_string()))?
}

#[tauri::command]
pub(crate) async fn write_binary_file_atomic(
    path: String,
    content: Vec<u8>,
    create_only: bool,
) -> Result<(), FileWriteError> {
    tauri::async_runtime::spawn_blocking(move || {
        write_atomic_bytes(Path::new(&path), &content, None, create_only)
    })
    .await
    .map_err(|error| FileWriteError::new("task", error.to_string()))?
}

#[tauri::command]
pub(crate) async fn copy_asset_file_exclusive(
    source_path: String,
    target_path: String,
) -> Result<(), FileWriteError> {
    tauri::async_runtime::spawn_blocking(move || {
        copy_file_exclusive(Path::new(&source_path), Path::new(&target_path))
    })
    .await
    .map_err(|error| FileWriteError::new("task", error.to_string()))?
}

pub(crate) fn write_atomic_bytes(
    path: &Path,
    bytes: &[u8],
    expected_text: Option<&str>,
    create_only: bool,
) -> Result<(), FileWriteError> {
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| FileWriteError::new("lock", "File write lock failed"))?;
    validate_destination(path, expected_text, create_only)?;
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    temporary.write_all(bytes)?;
    temporary.as_file().sync_all()?;
    if let Ok(metadata) = fs::metadata(path) {
        temporary
            .as_file()
            .set_permissions(metadata.permissions())?;
    }
    // Check again after preparing the replacement so already-observed external edits survive.
    validate_destination(path, expected_text, create_only)?;
    persist(temporary, path, create_only)
}

fn validate_destination(
    path: &Path,
    expected_text: Option<&str>,
    create_only: bool,
) -> Result<(), FileWriteError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if create_only {
                return Err(FileWriteError::new(
                    "alreadyExists",
                    format!("Destination exists: {}", path.display()),
                ));
            }
            if !metadata.is_file() || metadata.file_type().is_symlink() {
                return Err(FileWriteError::new(
                    "invalidTarget",
                    "Save destination must be a regular file",
                ));
            }
            if metadata.permissions().readonly() {
                return Err(FileWriteError::new(
                    "readOnly",
                    "Save destination is read-only",
                ));
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            if expected_text.is_some() {
                return Err(FileWriteError::new(
                    "stale",
                    "File was removed after it was read",
                ));
            }
        }
        Err(error) => return Err(error.into()),
    }
    if let Some(expected) = expected_text {
        if fs::read(path)? != expected.as_bytes() {
            return Err(FileWriteError::new(
                "stale",
                "File changed on disk. Reopen it before saving.",
            ));
        }
    }
    Ok(())
}

fn persist(
    temporary: tempfile::NamedTempFile,
    path: &Path,
    create_only: bool,
) -> Result<(), FileWriteError> {
    let result = if create_only {
        temporary.persist_noclobber(path)
    } else {
        temporary.persist(path)
    };
    result.map(|_| ()).map_err(|error| error.error.into())
}

pub(crate) fn copy_file_exclusive(source: &Path, target: &Path) -> Result<(), FileWriteError> {
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| FileWriteError::new("lock", "File write lock failed"))?;
    validate_destination(target, None, true)?;
    let mut input = fs::File::open(source)?;
    if !input.metadata()?.is_file() {
        return Err(FileWriteError::new(
            "invalidSource",
            "Import source must be a regular file",
        ));
    }
    let parent = target
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    io::copy(&mut input, &mut temporary)?;
    temporary.as_file().sync_all()?;
    persist(temporary, target, true)
}

#[cfg(test)]
#[path = "native_fs_tests.rs"]
mod tests;
