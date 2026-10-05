use super::*;
use std::io::{Cursor, Write};
use zip::{write::SimpleFileOptions, ZipWriter};

fn metadata() -> Vec<u8> {
    br#"{"formatVersion":1,"gameId":"games.fixture.g123456789abc","title":"Fixture","width":1280,"height":720}"#.to_vec()
}

fn packed(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    for (name, bytes) in entries {
        writer
            .start_file(
                *name,
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .unwrap();
        writer.write_all(bytes).unwrap();
    }
    writer.finish().unwrap().into_inner()
}

fn open(bytes: &[u8]) -> Result<GameArchive, String> {
    let mut file = tempfile::NamedTempFile::new().unwrap();
    file.write_all(bytes).unwrap();
    GameArchive::open(file.path())
}

#[test]
fn archive_validates_metadata_and_entry_point() {
    let bytes = metadata();
    assert!(open(&packed(&[
        ("zerith.desktop.json", &bytes),
        ("index.html", b"<html></html>")
    ]))
    .is_ok());
    assert!(open(&packed(&[("index.html", b"<html></html>")])).is_err());
    assert!(open(&packed(&[("zerith.desktop.json", &bytes)])).is_err());
    assert!(open(&packed(&[
        ("zerith.desktop.json", &bytes),
        ("index.html", b"")
    ]))
    .is_err());
    assert!(open(&packed(&[
        ("zerith.desktop.json", b"{}"),
        ("index.html", b"html")
    ]))
    .is_err());
    let oversized = vec![b' '; MAX_METADATA as usize + 1];
    assert!(open(&packed(&[
        ("zerith.desktop.json", &oversized),
        ("index.html", b"html")
    ]))
    .is_err());
}

#[test]
fn archive_rejects_traversal_and_ambiguous_names() {
    let bytes = metadata();
    for name in [
        "../secret",
        "/secret",
        "a/../secret",
        "a//b",
        "a\\b",
        "C:secret",
        "%2e%2e/secret",
        "a/./b",
        "bad?name",
    ] {
        assert!(
            open(&packed(&[
                ("zerith.desktop.json", &bytes),
                ("index.html", b"html"),
                (name, b"secret")
            ]))
            .is_err(),
            "{name}"
        );
    }
    assert!(open(&packed(&[
        ("zerith.desktop.json", &bytes),
        ("index.html", b"html"),
        ("INDEX.HTML", b"other")
    ]))
    .is_err());
}

#[test]
fn archive_rejects_symbolic_links() {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    writer
        .start_file("zerith.desktop.json", SimpleFileOptions::default())
        .unwrap();
    writer.write_all(&metadata()).unwrap();
    writer
        .start_file("index.html", SimpleFileOptions::default())
        .unwrap();
    writer.write_all(b"html").unwrap();
    writer
        .add_symlink("linked", "/etc/passwd", SimpleFileOptions::default())
        .unwrap();
    assert!(open(&writer.finish().unwrap().into_inner()).is_err());
}

#[test]
fn metadata_rejects_invalid_identity_dimensions_and_title() {
    let valid: Metadata = serde_json::from_slice(&metadata()).unwrap();
    for game_id in [
        "../escape",
        "games.a.g123456789abz",
        "games..g123456789abc",
        "games.fixture.g123",
    ] {
        let mut value = valid.clone();
        value.game_id = game_id.into();
        assert!(value.validate().is_err());
    }
    let mut value = valid.clone();
    value.width = 0;
    assert!(value.validate().is_err());
    value = valid.clone();
    value.height = 8193;
    assert!(value.validate().is_err());
    value = valid.clone();
    value.title = "bad\nname".into();
    assert!(value.validate().is_err());
    value = valid;
    value.format_version = 2;
    assert!(value.validate().is_err());
}

#[test]
fn protocol_serves_mime_head_and_actual_audio_ranges() {
    let game = open(&packed(&[
        ("zerith.desktop.json", &metadata()),
        ("index.html", b"html"),
        ("audio/track.ogg", b"0123456789"),
    ]))
    .unwrap();
    let response = game.respond(
        Request::builder()
            .uri("game://localhost/audio/track.ogg")
            .header(header::RANGE, "bytes=2-5")
            .body(Vec::new())
            .unwrap(),
    );
    assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(response.headers()[header::CONTENT_RANGE], "bytes 2-5/10");
    assert_eq!(response.headers()[header::CONTENT_TYPE], "audio/ogg");
    assert_eq!(response.body(), b"2345");
    let response = game.respond(
        Request::builder()
            .method(Method::HEAD)
            .uri("http://game.localhost/audio/track.ogg")
            .body(Vec::new())
            .unwrap(),
    );
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CONTENT_LENGTH], "10");
    assert!(response.body().is_empty());
    for (uri, status) in [
        ("game://localhost/%2e%2e/secret", StatusCode::BAD_REQUEST),
        (
            "game://localhost/%252e%252e/secret",
            StatusCode::BAD_REQUEST,
        ),
        ("game://localhost/missing", StatusCode::NOT_FOUND),
        ("game://elsewhere/index.html", StatusCode::FORBIDDEN),
    ] {
        assert_eq!(
            game.respond(Request::builder().uri(uri).body(Vec::new()).unwrap())
                .status(),
            status
        );
    }
    let response = game.respond(
        Request::builder()
            .uri("game://localhost/audio/track.ogg")
            .header(header::RANGE, "bytes=99-")
            .body(Vec::new())
            .unwrap(),
    );
    assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
    assert_eq!(response.headers()[header::CONTENT_RANGE], "bytes */10");
}

#[test]
fn byte_ranges_are_bounded_and_reject_invalid_values() {
    assert_eq!(byte_range("bytes=0-", 100), Some((0, 100)));
    assert_eq!(byte_range("bytes=2-200", 100), Some((2, 98)));
    assert_eq!(byte_range("bytes=-5", 100), Some((95, 5)));
    assert_eq!(byte_range("bytes=0-", MAX_FILE), Some((0, MAX_RANGE)));
    for header in [
        "bytes=-0",
        "bytes=1-0",
        "bytes=100-",
        "bytes=0-1,2-3",
        "items=0-1",
        "bytes=18446744073709551616-",
    ] {
        assert_eq!(byte_range(header, 100), None, "{header}");
    }
    assert_eq!(byte_range("bytes=0-", 0), None);
}

#[test]
fn corrupt_entry_point_is_rejected_before_opening_a_window() {
    let mut bytes = packed(&[
        ("zerith.desktop.json", &metadata()),
        ("index.html", b"unique-entry-point"),
    ]);
    let offset = bytes
        .windows(18)
        .position(|value| value == b"unique-entry-point")
        .unwrap();
    bytes[offset] ^= 1;
    assert!(open(&bytes).is_err());
}

#[test]
fn archive_size_limits_reject_large_declared_entries() {
    let mut bytes = packed(&[
        ("zerith.desktop.json", &metadata()),
        ("index.html", b"html"),
        ("large.bin", b"x"),
    ]);
    let offset = bytes
        .windows(4)
        .enumerate()
        .find_map(|(offset, value)| {
            (value == b"PK\x01\x02" && bytes.get(offset + 46..offset + 55) == Some(b"large.bin"))
                .then_some(offset)
        })
        .unwrap();
    bytes[offset + 24..offset + 28].copy_from_slice(&(MAX_FILE as u32 + 1).to_le_bytes());
    assert!(open(&bytes).err().unwrap().contains("size limit"));
}

#[test]
fn directory_limits_are_checked_before_zip_entry_allocation() {
    let mut bytes = packed(&[
        ("zerith.desktop.json", &metadata()),
        ("index.html", b"html"),
    ]);
    let offset = bytes.len() - 22;
    bytes[offset + 12..offset + 16].copy_from_slice(&(257u32 * 1024 * 1024).to_le_bytes());
    assert!(open(&bytes).err().unwrap().contains("directory exceeds"));
    assert!(open(b"PK\x05\x06").is_err());
}

#[test]
fn exact_duplicate_entries_are_rejected_before_zip_name_deduplication() {
    let mut bytes = packed(&[
        ("zerith.desktop.json", &metadata()),
        ("index.html", b"html"),
        ("index.HTML", b"duplicate"),
    ]);
    for offset in 0..bytes.len() - 9 {
        if &bytes[offset..offset + 10] == b"index.HTML" {
            bytes[offset..offset + 10].copy_from_slice(b"index.html");
        }
    }
    assert!(open(&bytes)
        .err()
        .unwrap()
        .contains("duplicate ZIP entries"));
}
