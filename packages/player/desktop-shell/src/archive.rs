use percent_encoding::percent_decode_str;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs::File,
    io::{Read, Seek},
    path::Path,
    sync::Mutex,
};
use tauri::http::{header, Method, Request, Response, StatusCode};
use zip::ZipArchive;

const MAX_ARCHIVE: u64 = 4 * 1024 * 1024 * 1024;
const MAX_FILE: u64 = 1024 * 1024 * 1024;
const MAX_FULL_READ: u64 = 256 * 1024 * 1024;
const MAX_RANGE: u64 = 16 * 1024 * 1024;
const MAX_METADATA: u64 = 64 * 1024;
const CSP: &str = "default-src 'self' data: blob:; script-src 'self' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data: blob:; object-src 'none'; frame-src 'none'; base-uri 'self'";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Metadata {
    pub format_version: u32,
    pub game_id: String,
    pub title: String,
    pub width: u32,
    pub height: u32,
}

impl Metadata {
    fn validate(&self) -> Result<(), String> {
        let parts: Vec<_> = self.game_id.split('.').collect();
        let valid_id = parts.len() == 3
            && parts[0] == "games"
            && (1..=48).contains(&parts[1].len())
            && parts[1]
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
            && parts[2].len() == 13
            && parts[2].starts_with('g')
            && parts[2][1..]
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c));
        if self.format_version != 1 || !valid_id {
            return Err("Game package metadata has an unsupported format or identity".into());
        }
        if self.title.trim().is_empty()
            || self.title.len() > 256
            || self.title.chars().any(char::is_control)
        {
            return Err("Game package title is invalid".into());
        }
        if !(320..=8192).contains(&self.width) || !(240..=8192).contains(&self.height) {
            return Err("Game package window dimensions are invalid".into());
        }
        Ok(())
    }
}

#[derive(Clone, Copy)]
struct Entry {
    index: usize,
    size: u64,
}

pub struct GameArchive {
    pub metadata: Metadata,
    archive: Mutex<ZipArchive<File>>,
    entries: HashMap<String, Entry>,
}

pub fn safe_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 2048
        && !path
            .chars()
            .any(|c| c.is_control() || matches!(c, '\\' | ':' | '%' | '?' | '#'))
        && path
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

fn inspect<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<(Metadata, HashMap<String, Entry>), String> {
    if archive.len() > 100_000 {
        return Err("Game package has too many entries".into());
    }
    let mut entries = HashMap::new();
    let mut names = HashSet::new();
    let mut total = 0u64;
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|e| e.to_string())?;
        let path = file.name().strip_suffix('/').unwrap_or(file.name());
        let kind = file.unix_mode().unwrap_or(0) & 0o170000;
        if !safe_path(path)
            || !names.insert(path.to_lowercase())
            || !matches!(kind, 0 | 0o100000 | 0o040000)
        {
            return Err("Game package contains an unsafe, duplicate or linked entry".into());
        }
        if (kind == 0o040000) != file.is_dir() && kind != 0 {
            return Err("Game package entry type is invalid".into());
        }
        if file.size() > MAX_FILE || file.compressed_size() > MAX_ARCHIVE {
            return Err("Game package entry exceeds the size limit".into());
        }
        total = total
            .checked_add(file.size())
            .ok_or("Game package size overflow")?;
        if total > MAX_ARCHIVE {
            return Err("Game package exceeds the uncompressed size limit".into());
        }
        if !file.is_dir() {
            entries.insert(
                path.to_string(),
                Entry {
                    index,
                    size: file.size(),
                },
            );
        }
    }
    let metadata_entry = entries
        .get("zerith.desktop.json")
        .ok_or("Game package metadata is missing")?;
    if metadata_entry.size > MAX_METADATA {
        return Err("Game package metadata exceeds the size limit".into());
    }
    let mut file = archive
        .by_index(metadata_entry.index)
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.by_ref()
        .take(MAX_METADATA + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    let metadata: Metadata = serde_json::from_slice(&bytes)
        .map_err(|e| format!("Invalid game package metadata: {e}"))?;
    metadata.validate()?;
    let index = entries
        .get("index.html")
        .ok_or("Game package index.html is missing")?;
    if index.size == 0 || index.size > MAX_FULL_READ {
        return Err("Game package index.html has an invalid size".into());
    }
    Ok((metadata, entries))
}

impl GameArchive {
    pub fn open(path: &Path) -> Result<Self, String> {
        let info =
            std::fs::symlink_metadata(path).map_err(|e| format!("Cannot open game.zpack: {e}"))?;
        if !info.is_file() || info.file_type().is_symlink() || info.len() > MAX_ARCHIVE {
            return Err("game.zpack must be a regular archive within the size limit".into());
        }
        let mut file = File::open(path).map_err(|e| e.to_string())?;
        let count = crate::archive_bounds::check_directory(&mut file, info.len())?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid game.zpack: {e}"))?;
        if archive.len() != count {
            return Err("Game package contains duplicate ZIP entries".into());
        }
        let (metadata, entries) = inspect(&mut archive)?;
        let game = Self {
            metadata,
            archive: Mutex::new(archive),
            entries,
        };
        game.read(
            entries_index(&game.entries)?,
            0,
            game.entries["index.html"].size,
        )?;
        Ok(game)
    }

    fn read(&self, entry: Entry, start: u64, length: u64) -> Result<Vec<u8>, String> {
        let mut archive = self
            .archive
            .lock()
            .map_err(|_| "Game package reader is unavailable")?;
        let mut file = archive.by_index(entry.index).map_err(|e| e.to_string())?;
        if start > 0 {
            let skipped = std::io::copy(&mut file.by_ref().take(start), &mut std::io::sink())
                .map_err(|e| e.to_string())?;
            if skipped != start {
                return Err("Game package entry was truncated".into());
            }
        }
        let mut bytes = Vec::with_capacity(length as usize);
        file.by_ref()
            .take(length)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 != length {
            return Err("Game package entry was truncated".into());
        }
        if start + length == entry.size {
            let mut end = [0u8; 1];
            if file.read(&mut end).map_err(|e| e.to_string())? != 0 {
                return Err("Game package entry size changed".into());
            }
        }
        Ok(bytes)
    }

    pub fn respond(&self, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
        if !matches!(*request.method(), Method::GET | Method::HEAD) {
            return error(StatusCode::METHOD_NOT_ALLOWED);
        }
        let uri = request.uri();
        let origin = (uri.scheme_str(), uri.host(), uri.port_u16());
        if !matches!(
            origin,
            (Some("game"), Some("localhost"), None) | (Some("http"), Some("game.localhost"), None)
        ) {
            return error(StatusCode::FORBIDDEN);
        }
        if !matches!(
            uri.authority().map(|authority| authority.as_str()),
            Some("localhost" | "game.localhost")
        ) {
            return error(StatusCode::FORBIDDEN);
        }
        let Ok(decoded) = percent_decode_str(uri.path()).decode_utf8() else {
            return error(StatusCode::BAD_REQUEST);
        };
        let path = decoded.strip_prefix('/').unwrap_or(&decoded);
        let path = if path.is_empty() { "index.html" } else { path };
        if !safe_path(path) {
            return error(StatusCode::BAD_REQUEST);
        }
        let Some(entry) = self.entries.get(path).copied() else {
            return error(StatusCode::NOT_FOUND);
        };
        let range = request.headers().get(header::RANGE);
        let selected = if let Some(range) = range {
            range
                .to_str()
                .ok()
                .and_then(|range| byte_range(range, entry.size))
        } else if entry.size <= MAX_FULL_READ {
            Some((0, entry.size))
        } else {
            None
        };
        let Some((start, length)) = selected else {
            return Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(header::CONTENT_RANGE, format!("bytes */{}", entry.size))
                .body(Vec::new())
                .unwrap();
        };
        let bytes = if request.method() == Method::HEAD {
            Vec::new()
        } else {
            match self.read(entry, start, length) {
                Ok(bytes) => bytes,
                Err(_) => return error(StatusCode::INTERNAL_SERVER_ERROR),
            }
        };
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        let mut response = Response::builder()
            .status(if range.is_some() {
                StatusCode::PARTIAL_CONTENT
            } else {
                StatusCode::OK
            })
            .header(header::CONTENT_TYPE, mime.as_ref())
            .header(header::CONTENT_LENGTH, length)
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CACHE_CONTROL, "no-cache")
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", CSP);
        if range.is_some() {
            response = response.header(
                header::CONTENT_RANGE,
                format!("bytes {start}-{}/{}", start + length - 1, entry.size),
            );
        }
        response.body(bytes).unwrap()
    }
}

fn entries_index(entries: &HashMap<String, Entry>) -> Result<Entry, String> {
    entries
        .get("index.html")
        .copied()
        .ok_or_else(|| "Game package index.html is missing".into())
}

fn error(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(status.as_str().as_bytes().to_vec())
        .unwrap()
}

fn byte_range(header: &str, size: u64) -> Option<(u64, u64)> {
    let range = header.strip_prefix("bytes=")?;
    if size == 0 || range.contains(',') {
        return None;
    }
    let (start, end) = range.split_once('-')?;
    if start.is_empty() {
        let suffix: u64 = end.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let length = suffix.min(size).min(MAX_RANGE);
        return Some((size - length, length));
    }
    let start: u64 = start.parse().ok()?;
    let end = if end.is_empty() {
        size - 1
    } else {
        end.parse::<u64>().ok()?.min(size - 1)
    };
    if start >= size || start > end {
        return None;
    }
    Some((start, (end - start + 1).min(MAX_RANGE)))
}

#[cfg(test)]
#[path = "archive_tests.rs"]
mod tests;
