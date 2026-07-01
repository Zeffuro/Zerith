import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const requested = process.argv.slice(2).find((argument) => !argument.startsWith('--'));

if (!requested) {
    printUsage();
    process.exit(1);
}

const editorPackagePath = 'packages/editor/package.json';
const tauriConfigPath = 'packages/editor/src-tauri/tauri.conf.json';
const cargoManifestPath = 'packages/editor/src-tauri/Cargo.toml';
const cargoLockPath = 'packages/editor/src-tauri/Cargo.lock';

const editorPackage = await readJson(editorPackagePath);
const tauriConfig = await readJson(tauriConfigPath);
const cargoManifest = await readText(cargoManifestPath);
const cargoLock = await readText(cargoLockPath);

const currentVersion = editorPackage.version;
const nextVersion = resolveNextVersion(currentVersion, requested);

editorPackage.version = nextVersion;
tauriConfig.version = nextVersion;

const nextCargoManifest = replaceCargoPackageVersion(cargoManifest, nextVersion, cargoManifestPath);
const nextCargoLock = replaceCargoPackageVersion(cargoLock, nextVersion, cargoLockPath);

const writes = [
    [editorPackagePath, `${JSON.stringify(editorPackage, undefined, 2)}\n`],
    [tauriConfigPath, `${JSON.stringify(tauriConfig, undefined, 2)}\n`],
    [cargoManifestPath, nextCargoManifest],
    [cargoLockPath, nextCargoLock],
];

if (!dryRun) {
    for (const [relativePath, content] of writes) {
        await writeFile(path.join(root, relativePath), content, 'utf8');
    }
}

console.log(`${dryRun ? 'Would bump' : 'Bumped'} Zerith Editor from ${currentVersion} to ${nextVersion}.`);
console.log(`Release tag: editor-v${nextVersion}`);

function bumpVersion(version, part) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
    if (!match) {
        throw new Error(`Cannot ${part}-bump non-stable SemVer version: ${version}`);
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);

    if (part === 'major') return `${major + 1}.0.0`;
    if (part === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

function printUsage() {
    console.error('Usage: npm run version:editor -- <patch|minor|major|x.y.z> [--dry-run]');
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}

function replaceCargoPackageVersion(text, version, relativePath) {
    const pattern = /(\[{1,2}package\]{1,2}\r?\nname = "editor"\r?\nversion = ")[^"]+(")/u;
    const next = text.replace(pattern, `$1${version}$2`);
    if (next === text && !text.includes(`version = "${version}"`)) {
        throw new Error(`Could not update editor package version in ${relativePath}`);
    }

    return next;
}

function resolveNextVersion(currentVersion, requested_) {
    if (['major', 'minor', 'patch'].includes(requested_)) {
        return bumpVersion(currentVersion, requested_);
    }

    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(requested_)) {
        throw new Error(`Invalid version or bump type: ${requested_}`);
    }

    return requested_;
}
