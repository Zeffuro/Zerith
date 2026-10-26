#![cfg(unix)]

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Zbus(#[from] zbus::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("Failed to convert path to file:// url")]
    FailedToConvertPathToFileUrl,
}

type Result<T> = std::result::Result<T, Error>;

pub mod reveal {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../src/reveal_item_in_dir/unix.rs"
    ));

    #[cfg(test)]
    mod tests {
        include!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../src/reveal_item_in_dir/unix_tests.rs"
        ));
    }
}
