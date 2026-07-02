import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rootManifest = await readJson('package.json');
const coreManifest = await readJson('packages/core/package.json');
const editorManifest = await readJson('packages/editor/package.json');
const playerManifest = await readJson('packages/player/package.json');

const expectedPackageNames = {
    core: 'zerith-core',
    editor: 'zerith-editor',
    player: 'zerith-player',
};
const actualPackageNames = {
    core: coreManifest.name,
    editor: editorManifest.name,
    player: playerManifest.name,
};
const genericPackageNames = new Set(['core', 'editor', 'player']);
const workspaceNamesAreBranded = Object.entries(expectedPackageNames)
    .every(([key, expectedName]) => actualPackageNames[key] === expectedName);
const genericNamesRemoved = Object.values(actualPackageNames)
    .every((name) => !genericPackageNames.has(name));
const internalDependenciesAreBranded = editorManifest.dependencies?.['zerith-core'] === 'file:../core'
    && playerManifest.dependencies?.['zerith-core'] === 'file:../core'
    && !editorManifest.dependencies?.core
    && !playerManifest.dependencies?.core;
const rootIsPrivate = rootManifest.private === true;
const appPackagesArePrivate = editorManifest.private === true
    && playerManifest.private === true;
const coreHasNpmPackageLane = coreManifest.private !== true
    && coreManifest.version !== '0.0.0'
    && coreManifest.publishConfig?.access === 'public'
    && manifestContains(coreManifest, './dist/')
    && manifestContains(coreManifest, '.d.ts')
    && Array.isArray(coreManifest.files)
    && coreManifest.files.includes('dist');
const workspacePublicationPolicyReady = rootIsPrivate
    && appPackagesArePrivate
    && (coreManifest.private === true || coreHasNpmPackageLane);

const checks = [
    {
        detail: 'Workspace package names should be Zerith-specific before any package product exists, so no public lane depends on generic names such as core, player, or editor.',
        id: 'workspacePackageNames',
        label: 'Workspace package names',
        status: workspaceNamesAreBranded ? 'ready' : 'blocked',
        summary: workspaceNamesAreBranded
            ? 'Workspace packages are named zerith-core, zerith-player, and zerith-editor.'
            : `Workspace packages are ${formatPackageNames(actualPackageNames)}.`,
    },
    {
        detail: 'Editor and player should depend on the branded core package name while still using the local workspace path.',
        id: 'internalDependencies',
        label: 'Internal dependencies',
        status: internalDependenciesAreBranded ? 'ready' : 'blocked',
        summary: internalDependenciesAreBranded
            ? 'Editor and player depend on zerith-core through the local workspace path.'
            : 'Editor/player dependencies still reference the old core package name or an unexpected path.',
    },
    {
        detail: 'The root workspace should remain private so npm publish from the monorepo root cannot publish the workspace aggregate by mistake.',
        id: 'rootPublicationGuard',
        label: 'Root publication guard',
        status: rootIsPrivate ? 'ready' : 'blocked',
        summary: rootIsPrivate
            ? 'The monorepo root remains private.'
            : 'The monorepo root is publishable.',
    },
    {
        detail: 'The current user-facing release channel is GitHub editor artifacts. Npm package publishing should stay guarded until a separate package lane has dist output, declarations, tags, provenance, and CI ownership.',
        id: 'workspacePublicationGuard',
        label: 'Workspace publication guard',
        status: workspacePublicationPolicyReady ? 'ready' : 'blocked',
        summary: workspacePublicationPolicyReady
            ? 'Root, editor, and player are guarded; zerith-core is private or on an explicit npm package lane.'
            : 'One or more packages can publish without a defined package lane.',
    },
    {
        detail: 'Generic package names make accidental publication and consumer confusion more likely.',
        id: 'genericNamesRemoved',
        label: 'Generic names removed',
        status: genericNamesRemoved ? 'ready' : 'blocked',
        summary: genericNamesRemoved
            ? 'No workspace package is named core, player, or editor.'
            : 'One or more workspace packages still use a generic package name.',
    },
];

const ready = countByStatus(checks, 'ready');
const limited = countByStatus(checks, 'limited');
const blocked = countByStatus(checks, 'blocked');
const report = {
    blocked,
    checks,
    limited,
    policy: {
        currentReleaseChannel: 'github-editor-artifacts',
        futureNpmLaneNeeds: [
            'built dist output',
            'declaration files',
            'package publish workflow',
            'npm provenance',
            'package support policy',
        ],
        packageNames: expectedPackageNames,
        packagePublication: 'guarded-separate-npm-lane',
    },
    ready,
    status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Package publication readiness: ${report.status} (${ready} ready / ${limited} limited / ${blocked} blocked)`);
    for (const check of checks) {
        console.log(`- ${check.label}: ${check.status} - ${check.summary}`);
    }
}

function countByStatus(checks_, status) {
    return checks_.filter((check) => check.status === status).length;
}

function formatPackageNames(names) {
    return Object.entries(names)
        .map(([key, name]) => `${key}=${name}`)
        .join(', ');
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
