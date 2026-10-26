# GLib 0.18 security backport

This is the published `glib` 0.18.5 crate under its original MIT license.
`UPSTREAM.json` records its archive checksum and original file hashes. Registry
bookkeeping and the unused standalone lockfile are omitted.

`src/variant_iter.rs` applies the upstream two-line fix for
[RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html): the
pointer populated by `g_variant_get_child` is mutable and passed as `&mut p`.
This is the fix in [gtk-rs-core #1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343),
also backported by Debian in `rust-glib-0.18` 0.18.5-7.

The crate version remains 0.18.5 for GTK3 compatibility. A version-only advisory
match is not evidence that this backport is absent; verify the source patch and
optimized iterator regression tests. Do not replace this with a GLib 0.20 override
without migrating the GTK dependency stack.

Run the optimized regression without the crate's unrelated development tools:

```sh
cargo test --manifest-path vendor/glib/tests/security/Cargo.toml --locked --release
```

`npm run test:native-patches` verifies original file hashes and the exact backport.
The remaining `proc-macro-error` notice belongs to the GTK3 macro dependencies;
it is compile-time maintenance debt and is not suppressed by this patch.
