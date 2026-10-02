use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

#[derive(Debug, Serialize)]
pub(crate) struct SourceHash {
    hash: String,
    size: u64,
}

pub(super) fn open_source(
    game: &Path,
    relative: &str,
    supplied: Option<&str>,
) -> Result<File, String> {
    super::validate_relative_path(relative)?;
    let expected = game.join(relative);
    let mut component = game.to_path_buf();
    for segment in relative.split('/') {
        component.push(segment);
        let metadata = fs::symlink_metadata(&component)
            .map_err(|error| format!("Cannot inspect export source {relative}: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "Export source contains a symbolic link: {relative}"
            ));
        }
    }
    let expected = fs::canonicalize(&expected).map_err(|error| error.to_string())?;
    if !expected.starts_with(game) {
        return Err(format!("Export source is outside the project: {relative}"));
    }
    if let Some(source) = supplied {
        let source = Path::new(source);
        if !source.is_absolute()
            || fs::canonicalize(source).map_err(|error| error.to_string())? != expected
        {
            return Err(format!(
                "Export source must match its project-relative artifact path: {relative}"
            ));
        }
    }
    let file =
        File::open(&expected).map_err(|error| format!("Cannot read export source: {error}"))?;
    if !file
        .metadata()
        .map_err(|error| error.to_string())?
        .is_file()
    {
        return Err(format!("Export source must be a regular file: {relative}"));
    }
    Ok(file)
}

pub(super) fn hash_sources(
    game_path: &str,
    paths: &[String],
) -> Result<BTreeMap<String, SourceHash>, String> {
    let game = Path::new(game_path);
    if !game.is_absolute() {
        return Err("Export project path must be absolute.".to_owned());
    }
    let game = fs::canonicalize(game).map_err(|error| error.to_string())?;
    if !game.join("game.json").is_file() {
        return Err("Export project must contain game.json.".to_owned());
    }
    let mut hashes = BTreeMap::new();
    let mut buffer = [0_u8; 64 * 1024];
    for path in paths {
        super::validate_relative_path(path)?;
        if hashes.contains_key(path) {
            continue;
        }
        match fs::symlink_metadata(game.join(path)) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error.to_string()),
            Ok(_) => {}
        }
        let mut input = open_source(&game, path, None)?;
        let mut hash = Sha256::new();
        let mut size = 0;
        loop {
            let count = input.read(&mut buffer).map_err(|error| error.to_string())?;
            if count == 0 {
                break;
            }
            hash.update(&buffer[..count]);
            size += count as u64;
        }
        hashes.insert(
            path.clone(),
            SourceHash {
                hash: format!("{:x}", hash.finalize()),
                size,
            },
        );
    }
    Ok(hashes)
}
