// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{
    collections::HashMap, future::Future, io, os::unix::fs::OpenOptionsExt, path::PathBuf,
    time::Duration,
};

use futures_lite::StreamExt;
use zbus::{Connection, Fd, MatchRule, MessageStream, OwnedObjectPath, OwnedVariant, Variant};

pub fn reveal_items_in_dir(paths: &[PathBuf]) -> crate::Result<()> {
    reveal_with_connection(paths, Connection::session(), None, Duration::from_secs(30))
}

fn reveal_with_connection(
    paths: &[PathBuf],
    connection: impl Future<Output = zbus::Result<Connection>> + Send,
    activation_token: Option<&str>,
    timeout: Duration,
) -> crate::Result<()> {
    if paths.is_empty() {
        return Ok(());
    }

    // Keep zbus's blocking runtime outside the caller's async runtime.
    std::thread::scope(|scope| {
        scope
            .spawn(|| {
                zbus::block_on(futures_lite::future::or(
                    async {
                        let connection = connection.await?;
                        match reveal_with_filemanager1(paths, &connection).await {
                            Ok(()) => Ok(()),
                            Err(_) => {
                                reveal_with_open_uri_portal(
                                    &paths[0],
                                    &connection,
                                    activation_token,
                                )
                                .await
                            }
                        }
                    },
                    async {
                        async_io::Timer::after(timeout).await;
                        Err(io::Error::new(io::ErrorKind::TimedOut, "File reveal timed out").into())
                    },
                ))
            })
            .join()
            .unwrap_or_else(|error| std::panic::resume_unwind(error))
    })
}

async fn reveal_with_filemanager1(paths: &[PathBuf], connection: &Connection) -> crate::Result<()> {
    let uris = paths
        .iter()
        .map(|path| {
            url::Url::from_file_path(path).map_err(|_| crate::Error::FailedToConvertPathToFileUrl)
        })
        .collect::<crate::Result<Vec<_>>>()?;
    let uri_strs = uris.iter().map(url::Url::as_str).collect();

    let proxy = FileManager1Proxy::new(connection).await?;
    proxy.show_items(uri_strs, "").await?;
    Ok(())
}

async fn reveal_with_open_uri_portal(
    path: &std::path::Path,
    connection: &Connection,
    activation_token: Option<&str>,
) -> crate::Result<()> {
    let file = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NONBLOCK)
        .open(path)?;
    let mut options = HashMap::new();
    if let Some(token) = activation_token.filter(|token| !token.is_empty()) {
        options.insert("activation_token", Variant::from(token));
    }

    let rule = MatchRule::builder()
        .msg_type(zbus::message::Type::Signal)
        .sender("org.freedesktop.portal.Desktop")
        .interface("org.freedesktop.portal.Request")
        .member("Response")
        .build()?;
    // Subscribe before the method call: the response can arrive before its reply.
    let mut responses = MessageStream::for_match_rule(rule, connection, None).await?;
    let proxy = zbus::Proxy::new(
        connection,
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.OpenURI",
    )
    .await?;
    // The portal reveals the item represented by this FD, not its parent.
    let reply = proxy
        .call_method("OpenDirectory", &("", Fd::from(&file), options))
        .await?;
    let handle: OwnedObjectPath = reply.body().deserialize()?;
    let sender = reply
        .header()
        .sender()
        .map(|sender| sender.as_str().to_owned())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Portal reply has no sender"))?;
    while let Some(response) = responses.next().await {
        let response = response?;
        let header = response.header();
        if header.sender().map(|name| name.as_str()) != Some(sender.as_str())
            || header.path().map(|path| path.as_str()) != Some(handle.as_str())
        {
            continue;
        }
        let (code, _): (u32, HashMap<String, OwnedVariant>) = response.body().deserialize()?;
        return match code {
            0 => Ok(()),
            1 => {
                Err(io::Error::new(io::ErrorKind::Interrupted, "File reveal was cancelled").into())
            }
            _ => Err(io::Error::other("Portal failed to reveal the item").into()),
        };
    }
    Err(io::Error::new(
        io::ErrorKind::UnexpectedEof,
        "Portal response stream closed",
    )
    .into())
}

#[zbus::proxy(
    interface = "org.freedesktop.FileManager1",
    default_service = "org.freedesktop.FileManager1",
    default_path = "/org/freedesktop/FileManager1"
)]
trait FileManager1 {
    fn show_items(&self, uris: Vec<&str>, startup_id: &str) -> zbus::Result<()>;
}
