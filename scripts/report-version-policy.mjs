import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rootManifest = await readJson('package.json');
const coreManifest = await readJson('packages/core/package.json');
const editorManifest = await readJson('packages/editor/package.json');
const playerManifest = await readJson('packages/player/package.json');
const tauriConfig = await readJson('packages/editor/src-tauri/tauri.conf.json');
const cargoManifest = await readText('packages/editor/src-tauri/Cargo.toml');
const cargoLock = await readText('packages/editor/src-tauri/Cargo.lock');

const cargoVersion = readCargoField(cargoManifest, 'version');
const cargoLockVersion = readCargoLockEditorVersion(cargoLock);
const editorVersion = editorManifest.version;
const versionAligned = editorVersion === tauriConfig.version && editorVersion === cargoVersion && editorVersion === cargoLockVersion;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const editorVersionIsSemver = semverPattern.test(editorVersion);
const rootAndEditorPackagesArePrivate = rootManifest.private === true
    && editorManifest.private === true;
const coreHasNpmPackageLane = coreManifest.private !== true
    && coreManifest.version !== '0.0.0'
    && coreManifest.publishConfig?.access === 'public'
    && manifestContains(coreManifest, './dist/')
    && manifestContains(coreManifest, '.d.ts');
const playerHasNpmPackageLane = playerManifest.private !== true
    && playerManifest.version !== '0.0.0'
    && playerManifest.publishConfig?.access === 'public'
    && playerManifest.bin?.['zerith-player'] === 'scripts/build-game.mjs'
    && playerManifest.dependencies?.['@zeffuro/zerith-core'] === `^${coreManifest.version}`;
const workspacePublicationPolicyReady = rootAndEditorPackagesArePrivate
    && (coreManifest.private === true || coreHasNpmPackageLane)
    && (playerManifest.private === true || playerHasNpmPackageLane);
const workspacePackageNamesAreBranded = coreManifest.name === '@zeffuro/zerith-core'
    && editorManifest.name === 'zerith-editor'
    && playerManifest.name === '@zeffuro/zerith-player';
const internalRuntimePackagePolicyReady = (playerManifest.version === '0.0.0' || playerHasNpmPackageLane)
    && (coreManifest.version === '0.0.0' || coreHasNpmPackageLane);

const policy = {
    artifactNamePattern: `Zerith-Editor-${editorVersion}-{platform}-{kind}`,
    editorVersion,
    internalPackageVersions: {
        [coreManifest.name]: coreManifest.version,
        [playerManifest.name]: playerManifest.version,
    },
    packagePublication: 'branded-editor-artifacts-plus-core-player-npm-lanes',
    releaseChannel: 'editor-artifacts',
    rootVersion: rootManifest.version ?? null,
    status: versionAligned && editorVersionIsSemver && workspacePublicationPolicyReady && workspacePackageNamesAreBranded
        ? 'ready'
        : 'blocked',
    tagPattern: `editor-v${editorVersion}`,
    versionSource: 'packages/editor/package.json',
};

const checks = [
    {
        id: 'editorSemver',
        label: 'Editor SemVer',
        status: editorVersionIsSemver ? 'ready' : 'blocked',
        summary: editorVersionIsSemver
            ? `Editor version ${editorVersion} is valid SemVer.`
            : `Editor version ${editorVersion} is not valid SemVer.`,
    },
    {
        id: 'editorVersionAlignment',
        label: 'Editor version alignment',
        status: versionAligned ? 'ready' : 'blocked',
        summary: versionAligned
            ? 'Editor package, Tauri config, Cargo manifest, and Cargo lock versions match.'
            : 'Editor package, Tauri config, Cargo manifest, and Cargo lock versions do not match.',
    },
    {
        id: 'workspacePackageNames',
        label: 'Workspace package names',
        status: workspacePackageNamesAreBranded ? 'ready' : 'blocked',
        summary: workspacePackageNamesAreBranded
            ? 'Workspace packages use @zeffuro/zerith-core, @zeffuro/zerith-player, and zerith-editor.'
            : 'Workspace packages do not use the expected Zerith-specific names.',
    },
    {
        id: 'workspacePublicationGuard',
        label: 'Workspace publication guard',
        status: workspacePublicationPolicyReady ? 'ready' : 'blocked',
        summary: workspacePublicationPolicyReady
            ? 'Root and editor remain private; core/player are private or use explicit npm package lanes.'
            : 'Workspace packages are publishable without a matching release lane.',
    },
    {
        id: 'internalRuntimePackages',
        label: 'Internal runtime packages',
        status: internalRuntimePackagePolicyReady ? 'ready' : 'blocked',
        summary: internalRuntimePackagePolicyReady
            ? 'Core and player package versions are internal placeholders or attached to explicit npm lanes.'
            : 'Runtime package versions no longer match the release policy.',
    },
];

const ready = countByStatus(checks, 'ready');
const limited = countByStatus(checks, 'limited');
const blocked = countByStatus(checks, 'blocked');
const report = {
    blocked,
    checks,
    limited,
    policy,
    ready,
    status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Version policy: ${report.status} (${ready} ready / ${limited} limited / ${blocked} blocked)`);
    console.log(`Release channel: ${policy.releaseChannel}`);
    console.log(`Version source: ${policy.versionSource} (${policy.editorVersion})`);
    console.log(`Tag pattern: ${policy.tagPattern}`);
    console.log(`Artifact pattern: ${policy.artifactNamePattern}`);
    for (const check of checks) {
        console.log(`- ${check.label}: ${check.status} - ${check.summary}`);
    }
}

function countByStatus(checks_, status) {
    return checks_.filter((check) => check.status === status).length;
}

function readCargoField(text, fieldName) {
    return new RegExp(`^${fieldName}\\s*=\\s*"(?<value>[^"]+)"`, 'mu').exec(text)?.groups?.value;
}

function readCargoLockEditorVersion(text) {
    return /\[\[package\]\]\r?\nname = "editor"\r?\nversion = "(?<version>[^"]+)"/u.exec(text)?.groups?.version;
}

function manifestContains(manifest, needle) {
    return manifestValueContains(manifest.main, needle)
        || manifestValueContains(manifest.exports, needle)
        || manifestValueContains(manifest.types, needle);
}

function manifestValueContains(value, needle) {
    if (typeof value === 'string') return value.includes(needle);
    if (Array.isArray(value)) return value.some((entry) => manifestValueContains(entry, needle));
    if (value && typeof value === 'object') {
        return Object.values(value).some((entry) => manifestValueContains(entry, needle));
    }
    return false;
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}
