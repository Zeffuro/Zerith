import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

for (const crate of ['glib', 'tauri-plugin-opener']) {
    const root = `vendor/${crate}`;
    const provenance = JSON.parse(read(`${root}/UPSTREAM.json`));
    for (const [file, original] of Object.entries(provenance.upstreamFiles)) {
        let bytes = readFileSync(`${root}/${file}`);
        if (crate === 'glib' && file === 'src/variant_iter.rs') {
            const source = bytes.toString('utf8');
            assert.equal(source.split('let mut p: *mut libc::c_char').length, 2);
            assert.equal(source.split('&mut p,').length, 2);
            bytes = source.replace('let mut p: *mut libc::c_char', 'let p: *mut libc::c_char')
                .replace('&mut p,', '&p,');
        }
        assert.equal(hash(bytes), provenance.localPatches?.[file] ?? original, `${root}/${file}`);
    }
    console.log(`${crate} ${provenance.version}: upstream files and scoped patches verified`);
}

for (const manifest of ['packages/editor/src-tauri', 'packages/player/desktop-shell']) {
    assert.match(read(`${manifest}/Cargo.toml`), /glib = \{ path = "\.\.\/\.\.\/\.\.\/vendor\/glib" \}/u);
    const glib = read(`${manifest}/Cargo.lock`).split('[[package]]')
        .find((block) => /^name = "glib"$/mu.test(block));
    assert.ok(glib, `${manifest}: GLib lock entry`);
    assert.doesNotMatch(glib, /^source = /mu, `${manifest}: use the patched local GLib`);
}
const editorLock = read('packages/editor/src-tauri/Cargo.lock');
assert.match(read('packages/editor/src-tauri/Cargo.toml'), /tauri-plugin-opener = \{ path = "\.\.\/\.\.\/\.\.\/vendor\/tauri-plugin-opener" \}/u);
for (const retired of ['zbus_names', 'zvariant', 'zvariant_derive']) {
    assert.ok(!editorLock.includes(`name = "${retired}"`), `${retired} must stay out of the editor lock`);
}
const opener = editorLock.split('[[package]]').find((block) => /^name = "tauri-plugin-opener"$/mu.test(block));
assert.ok(opener);
assert.doesNotMatch(opener, /^source = /mu, 'use the maintained local opener');
console.log('Both native manifests select the patches; retired DBus crates are absent.');
