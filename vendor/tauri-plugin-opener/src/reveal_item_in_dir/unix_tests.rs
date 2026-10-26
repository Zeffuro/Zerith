use super::*;
use std::{
    fs::File,
    io::{BufRead, BufReader},
    os::{fd::AsFd, unix::fs::MetadataExt},
    process::{Child, Command, Stdio},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

#[derive(Debug, PartialEq)]
enum Call {
    FileManager(Vec<String>, String),
    Portal {
        parent: String,
        device: u64,
        inode: u64,
        directory: bool,
        activation_token: Option<String>,
    },
}

struct FileManager {
    calls: Arc<Mutex<Vec<Call>>>,
    fail: bool,
}

#[zbus::interface(name = "org.freedesktop.FileManager1")]
impl FileManager {
    fn show_items(&self, uris: Vec<String>, startup_id: String) -> zbus::fdo::Result<()> {
        self.calls
            .lock()
            .unwrap()
            .push(Call::FileManager(uris, startup_id));
        if self.fail {
            Err(zbus::fdo::Error::Failed("file manager unavailable".into()))
        } else {
            Ok(())
        }
    }
}

struct Portal {
    calls: Arc<Mutex<Vec<Call>>>,
    behavior: PortalBehavior,
    address: String,
    response_worker: Arc<Mutex<Option<std::thread::JoinHandle<()>>>>,
    client_alive: Arc<AtomicBool>,
}

#[derive(Clone, Copy)]
enum PortalBehavior {
    Early(u32),
    Delayed,
    Unsupported,
    NoResponse,
    NoMethodReply,
    ForeignSender,
    WrongPath,
    Malformed,
}

const REQUEST_PATH: &str = "/org/freedesktop/portal/desktop/request/test/reveal";

async fn emit_response(connection: &Connection, destination: &str, path: &str, code: u32) {
    connection
        .emit_signal(
            Some(destination),
            path,
            "org.freedesktop.portal.Request",
            "Response",
            &(code, HashMap::<String, zbus::OwnedVariant>::new()),
        )
        .await
        .unwrap();
}

#[zbus::interface(name = "org.freedesktop.portal.OpenURI")]
impl Portal {
    async fn open_directory(
        &self,
        parent: String,
        fd: Fd<'_>,
        options: HashMap<String, zbus::OwnedVariant>,
        #[zbus(connection)] connection: &Connection,
        #[zbus(header)] header: zbus::message::Header<'_>,
    ) -> zbus::fdo::Result<OwnedObjectPath> {
        let file = File::from(fd.as_fd().try_clone_to_owned().unwrap());
        let metadata = file.metadata().unwrap();
        let activation_token = options
            .get("activation_token")
            .map(|token| <&str>::try_from(token).unwrap().to_owned());
        self.calls.lock().unwrap().push(Call::Portal {
            parent,
            device: metadata.dev(),
            inode: metadata.ino(),
            directory: metadata.is_dir(),
            activation_token,
        });
        let destination = header.sender().unwrap().as_str().to_owned();
        match self.behavior {
            PortalBehavior::Unsupported => {
                return Err(zbus::fdo::Error::NotSupported("portal unsupported".into()));
            }
            PortalBehavior::Early(code) => {
                emit_response(connection, &destination, REQUEST_PATH, code).await;
            }
            PortalBehavior::ForeignSender => {
                let foreign = zbus::connection::Builder::address(self.address.as_str())
                    .build()
                    .await
                    .unwrap();
                emit_response(&foreign, &destination, REQUEST_PATH, 0).await;
                emit_response(connection, &destination, REQUEST_PATH, 1).await;
            }
            PortalBehavior::WrongPath => {
                emit_response(connection, &destination, "/wrong/request", 0).await;
                emit_response(connection, &destination, REQUEST_PATH, 1).await;
            }
            PortalBehavior::Delayed => {
                let connection = connection.clone();
                let client_alive = self.client_alive.clone();
                *self.response_worker.lock().unwrap() = Some(std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(50));
                    zbus::block_on(async {
                        let bus = zbus::Proxy::new(
                            &connection,
                            "org.freedesktop.DBus",
                            "/org/freedesktop/DBus",
                            "org.freedesktop.DBus",
                        )
                        .await
                        .unwrap();
                        let alive: bool = bus
                            .call("NameHasOwner", &(destination.as_str(),))
                            .await
                            .unwrap();
                        client_alive.store(alive, Ordering::SeqCst);
                        emit_response(&connection, &destination, REQUEST_PATH, 0).await;
                    });
                }));
            }
            PortalBehavior::NoResponse => {}
            PortalBehavior::NoMethodReply => {
                async_io::Timer::after(Duration::from_secs(5)).await;
            }
            PortalBehavior::Malformed => {
                connection
                    .emit_signal(
                        Some(destination.as_str()),
                        REQUEST_PATH,
                        "org.freedesktop.portal.Request",
                        "Response",
                        &"invalid response body",
                    )
                    .await
                    .unwrap();
            }
        }
        Ok(OwnedObjectPath::try_from(REQUEST_PATH).unwrap())
    }
}

struct PrivateBus {
    process: Child,
    address: String,
}

impl PrivateBus {
    fn start() -> Self {
        let mut process = Command::new("dbus-daemon")
            .args(["--session", "--nofork", "--print-address=1"])
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("private-bus tests require dbus-daemon");
        let mut address = String::new();
        BufReader::new(process.stdout.take().unwrap())
            .read_line(&mut address)
            .unwrap();
        assert!(
            address.starts_with("unix:"),
            "unexpected private bus address"
        );
        Self {
            process,
            address: address.trim().to_owned(),
        }
    }
}

impl Drop for PrivateBus {
    fn drop(&mut self) {
        let _ = self.process.kill();
        let _ = self.process.wait();
    }
}

struct Fixture {
    _bus: PrivateBus,
    _service: Connection,
    calls: Arc<Mutex<Vec<Call>>>,
    response_worker: Arc<Mutex<Option<std::thread::JoinHandle<()>>>>,
    client_alive: Arc<AtomicBool>,
}

impl Fixture {
    fn new(file_manager_fails: bool, portal_fails: bool) -> Self {
        Self::with_behavior(
            file_manager_fails,
            if portal_fails {
                PortalBehavior::Unsupported
            } else {
                PortalBehavior::Early(0)
            },
        )
    }

    fn with_behavior(file_manager_fails: bool, behavior: PortalBehavior) -> Self {
        let bus = PrivateBus::start();
        let calls = Arc::new(Mutex::new(Vec::new()));
        let response_worker = Arc::new(Mutex::new(None));
        let client_alive = Arc::new(AtomicBool::new(false));
        let service = zbus::block_on(
            zbus::connection::Builder::address(bus.address.as_str())
                .name("org.freedesktop.FileManager1")
                .name("org.freedesktop.portal.Desktop")
                .serve_at(
                    "/org/freedesktop/FileManager1",
                    FileManager {
                        calls: calls.clone(),
                        fail: file_manager_fails,
                    },
                )
                .serve_at(
                    "/org/freedesktop/portal/desktop",
                    Portal {
                        calls: calls.clone(),
                        behavior,
                        address: bus.address.clone(),
                        response_worker: response_worker.clone(),
                        client_alive: client_alive.clone(),
                    },
                )
                .build(),
        )
        .unwrap();
        Self {
            _bus: bus,
            _service: service,
            calls,
            response_worker,
            client_alive,
        }
    }

    fn reveal(&self, paths: &[PathBuf], token: Option<&str>) -> crate::Result<()> {
        reveal_with_connection(
            paths,
            zbus::connection::Builder::address(self._bus.address.as_str())
                .method_timeout(Duration::from_secs(2))
                .build(),
            token,
            Duration::from_secs(2),
        )
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        if let Some(worker) = self.response_worker.lock().unwrap().take() {
            worker.join().unwrap();
        }
    }
}

#[test]
fn file_manager_is_preferred_and_receives_encoded_paths_in_order() {
    let fixture = Fixture::new(false, true);
    let directory = tempfile::tempdir().unwrap();
    let paths = [
        directory.path().join("a space.txt"),
        directory.path().join("日本語#?.txt"),
    ];
    for path in &paths {
        std::fs::write(path, "unchanged").unwrap();
    }
    fixture.reveal(&paths, None).unwrap();
    assert_eq!(
        *fixture.calls.lock().unwrap(),
        vec![Call::FileManager(
            paths
                .iter()
                .map(|path| url::Url::from_file_path(path).unwrap().to_string())
                .collect(),
            String::new(),
        )]
    );
}

#[test]
fn portal_fallback_sends_original_item_fd_and_activation_token() {
    let fixture = Fixture::new(true, false);
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("original item.txt");
    std::fs::write(&path, "unchanged").unwrap();
    let metadata = path.metadata().unwrap();
    fixture.reveal(&[path], Some("test-activation")).unwrap();
    assert_eq!(
        fixture.calls.lock().unwrap()[1],
        Call::Portal {
            parent: String::new(),
            device: metadata.dev(),
            inode: metadata.ino(),
            directory: false,
            activation_token: Some("test-activation".into()),
        }
    );
}

#[test]
fn portal_fallback_accepts_directories_and_omits_empty_activation_tokens() {
    let fixture = Fixture::new(true, false);
    let directory = tempfile::tempdir().unwrap();
    let metadata = directory.path().metadata().unwrap();
    fixture
        .reveal(&[directory.path().to_owned()], Some(""))
        .unwrap();
    assert_eq!(
        fixture.calls.lock().unwrap()[1],
        Call::Portal {
            parent: String::new(),
            device: metadata.dev(),
            inode: metadata.ino(),
            directory: true,
            activation_token: None,
        }
    );
}

#[test]
fn multi_item_portal_fallback_reveals_only_the_first_item() {
    let fixture = Fixture::new(true, false);
    let directory = tempfile::tempdir().unwrap();
    let paths = [
        directory.path().join("first.txt"),
        directory.path().join("second.txt"),
    ];
    for path in &paths {
        std::fs::write(path, "unchanged").unwrap();
    }
    let first = paths[0].metadata().unwrap();
    fixture.reveal(&paths, None).unwrap();
    let calls = fixture.calls.lock().unwrap();
    assert_eq!(calls.len(), 2);
    assert_eq!(
        calls[0],
        Call::FileManager(
            paths
                .iter()
                .map(|path| url::Url::from_file_path(path).unwrap().to_string())
                .collect(),
            String::new(),
        )
    );
    assert_eq!(
        calls[1],
        Call::Portal {
            parent: String::new(),
            device: first.dev(),
            inode: first.ino(),
            directory: false,
            activation_token: None,
        }
    );
}

#[test]
fn malformed_response_for_matching_sender_and_request_is_rejected() {
    let fixture = Fixture::with_behavior(true, PortalBehavior::Malformed);
    let directory = tempfile::tempdir().unwrap();
    let error = fixture
        .reveal(&[directory.path().to_owned()], None)
        .unwrap_err();
    assert!(matches!(error, crate::Error::Zbus(_)));
}

#[test]
fn unsupported_portal_is_reported_to_the_caller() {
    let fixture = Fixture::new(true, true);
    let directory = tempfile::tempdir().unwrap();
    let error = fixture
        .reveal(&[directory.path().to_owned()], None)
        .unwrap_err();
    assert!(error.to_string().contains("portal unsupported"));
    assert_eq!(fixture.calls.lock().unwrap().len(), 2);
}

#[test]
fn missing_item_is_reported_before_a_portal_method_call() {
    let fixture = Fixture::new(true, false);
    let directory = tempfile::tempdir().unwrap();
    let error = fixture
        .reveal(&[directory.path().join("missing")], None)
        .unwrap_err();
    assert!(matches!(error, crate::Error::Io(_)));
    assert_eq!(fixture.calls.lock().unwrap().len(), 1);
}

#[test]
fn reveal_from_a_tokio_task_keeps_zbus_outside_the_callers_runtime() {
    let fixture = Fixture::new(false, true);
    let directory = tempfile::tempdir().unwrap();
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap();
    runtime.block_on(async {
        fixture
            .reveal(&[directory.path().to_owned()], None)
            .unwrap();
    });
    assert_eq!(fixture.calls.lock().unwrap().len(), 1);
}

#[test]
fn empty_paths_do_not_connect_to_a_bus() {
    reveal_with_connection(
        &[],
        async { panic!("empty request must not connect") },
        None,
        Duration::from_secs(1),
    )
    .unwrap();
}

#[test]
fn unavailable_private_bus_is_reported() {
    let directory = tempfile::tempdir().unwrap();
    let address = format!("unix:path={}/missing.socket", directory.path().display());
    let error = reveal_with_connection(
        &[directory.path().to_owned()],
        zbus::connection::Builder::address(address.as_str()).build(),
        None,
        Duration::from_secs(1),
    )
    .unwrap_err();
    assert!(matches!(error, crate::Error::Zbus(_)));
}

#[test]
fn portal_response_before_method_reply_is_not_lost() {
    let fixture = Fixture::with_behavior(true, PortalBehavior::Early(0));
    let directory = tempfile::tempdir().unwrap();
    fixture
        .reveal(&[directory.path().to_owned()], None)
        .unwrap();
    assert_eq!(fixture.calls.lock().unwrap().len(), 2);
}

#[test]
fn connection_remains_alive_until_delayed_portal_completion() {
    let fixture = Fixture::with_behavior(true, PortalBehavior::Delayed);
    let directory = tempfile::tempdir().unwrap();
    fixture
        .reveal(&[directory.path().to_owned()], None)
        .unwrap();
    assert!(fixture.client_alive.load(Ordering::SeqCst));
}

#[test]
fn portal_cancellation_failure_and_unrelated_responses_are_rejected() {
    for behavior in [
        PortalBehavior::Early(1),
        PortalBehavior::Early(2),
        PortalBehavior::ForeignSender,
        PortalBehavior::WrongPath,
    ] {
        let fixture = Fixture::with_behavior(true, behavior);
        let directory = tempfile::tempdir().unwrap();
        let error = fixture
            .reveal(&[directory.path().to_owned()], None)
            .unwrap_err();
        let crate::Error::Io(error) = error else {
            panic!("expected portal response error")
        };
        assert_eq!(
            error.kind(),
            if matches!(behavior, PortalBehavior::Early(2)) {
                std::io::ErrorKind::Other
            } else {
                std::io::ErrorKind::Interrupted
            }
        );
    }
}

#[test]
fn portal_method_and_response_waits_have_a_deadline() {
    for behavior in [PortalBehavior::NoMethodReply, PortalBehavior::NoResponse] {
        let fixture = Fixture::with_behavior(true, behavior);
        let directory = tempfile::tempdir().unwrap();
        let started = std::time::Instant::now();
        let error = reveal_with_connection(
            &[directory.path().to_owned()],
            zbus::connection::Builder::address(fixture._bus.address.as_str()).build(),
            None,
            Duration::from_millis(100),
        )
        .unwrap_err();
        let crate::Error::Io(error) = error else {
            panic!("expected timeout")
        };
        assert_eq!(error.kind(), std::io::ErrorKind::TimedOut);
        assert!(started.elapsed() < Duration::from_secs(2));
    }
}

#[test]
fn stalled_bus_connection_has_a_deadline() {
    let error = reveal_with_connection(
        &[PathBuf::from("/unused")],
        std::future::pending(),
        None,
        Duration::from_millis(25),
    )
    .unwrap_err();
    let crate::Error::Io(error) = error else {
        panic!("expected timeout")
    };
    assert_eq!(error.kind(), std::io::ErrorKind::TimedOut);
}

#[test]
fn fifo_item_is_opened_without_waiting_for_a_writer() {
    let fixture = Fixture::with_behavior(true, PortalBehavior::Early(0));
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("named pipe");
    let name = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()).unwrap();
    assert_eq!(unsafe { libc::mkfifo(name.as_ptr(), 0o600) }, 0);
    fixture.reveal(&[path.clone()], None).unwrap();
    let metadata = path.metadata().unwrap();
    let calls = fixture.calls.lock().unwrap();
    let Call::Portal { device, inode, .. } = calls[1] else {
        panic!("expected portal call")
    };
    assert_eq!((device, inode), (metadata.dev(), metadata.ino()));
}
