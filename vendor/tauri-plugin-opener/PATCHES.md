# Local opener maintenance

Base: published `tauri-plugin-opener` 2.7.2, upstream tag
[`opener-v2.7.2`](https://github.com/tauri-apps/plugins-workspace/tree/opener-v2.7.2/plugins/opener).
Crate archive SHA256: `53810be1b4fed22bb6ac3f4cab5a2b80d9391d1af436bda145607532bc0bb219`.
Upstream licenses and `Cargo.toml.orig` are retained unchanged. Registry extraction
metadata and the unused upstream standalone lockfile are omitted.

The Linux/BSD implementation uses maintained zbus 6.1 instead of the retired
standalone zvariant/zbus_names crates. Its synchronous API still runs D-Bus work
on a dedicated thread; Windows, macOS, scopes, opening paths/URLs and command
names retain upstream behavior. The previous default UnixExec/IBus session-bus
address transports remain enabled.

Portal fallback now sends the original item's FD using the OpenDirectory wire
contract and waits for the matching
Request.Response before closing its connection. It subscribes before calling,
checks the actual reply sender and request path, propagates cancellation/failure,
and bounds connection/method/response waits to 30 seconds. Nonblocking item opens
prevent FIFOs from waiting for a writer. An empty reveal request is a no-op.
The internal helper supports an explicit activation token; public entry points
omit inherited process tokens, which can be stale by the time a user reveals a file.

`tests/dbus` includes the production Unix module and runs protocol tests against
fresh private dbus-daemon instances, without using the user's bus or applications:

```sh
cargo test --manifest-path vendor/tauri-plugin-opener/tests/dbus/Cargo.toml
```

These tests require Unix and dbus-daemon. Reuse the repository's configured Cargo
target directory. A passing protocol test does not establish desktop GUI behavior.
The local changes should be removed when a compatible upstream release provides
the maintained dependency and equivalent portal handling.
