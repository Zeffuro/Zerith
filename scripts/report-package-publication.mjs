import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rootManifest = await readJson('package.json');
const coreManifest = await readJson('packages/core/package.json');
const editorManifest = await readJson('packages/editor/package.json');
const playerManifest = await readJson('packages/player/package.json');

const expectedPackageNames = {
    core: '@zeffuro/zerith-core',
    editor: 'zerith-editor',
    player: '@zeffuro/zerith-player',
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
const playerUsesPublishableCoreDependency = playerManifest.dependencies?.['@zeffuro/zerith-core'] === `^${coreManifest.version}`;
const internalDependenciesAreBranded = editorManifest.dependencies?.['@zeffuro/zerith-core'] === 'file:../core'
    && playerUsesPublishableCoreDependency
    && !editorManifest.dependencies?.core
    && !playerManifest.dependencies?.core;
const rootIsPrivate = rootManifest.private === true;
const editorPackageIsPrivate = editorManifest.private === true;
const coreHasNpmPackageLane = coreManifest.private !== true
    && coreManifest.version !== '0.0.0'
    && coreManifest.publishConfig?.access === 'public'
    && manifestContains(coreManifest, './dist/')
    && manifestContains(coreManifest, '.d.ts')
    && Array.isArray(coreManifest.files)
    && coreManifest.files.includes('dist');
const playerHasNpmPackageLane = playerManifest.private !== true
    && playerManifest.version !== '0.0.0'
    && playerManifest.publishConfig?.access === 'public'
    && playerManifest.bin?.['zerith-player'] === 'scripts/build-game.mjs'
    && Array.isArray(playerManifest.files)
    && [
        'index.html',
        'scripts/build-game.mjs',
        'scripts/content-compiler.mjs',
        'src/main.ts',
        'src/runtime/bootstrapConfig.ts',
        'src/runtime/bootstrapPlayer.ts',
        'src/runtime/compiledContentPrefetch.ts',
        'src/runtime/playerAccessibility.ts',
        'vite.config.ts',
        'README.md',
        'LICENSE',
    ]
        .every((entry) => playerManifest.files.includes(entry))
    && playerUsesPublishableCoreDependency;
const workspacePublicationPolicyReady = rootIsPrivate
    && editorPackageIsPrivate
    && (coreManifest.private === true || coreHasNpmPackageLane)
    && (playerManifest.private === true || playerHasNpmPackageLane);

const checks = [
    {
        detail: 'Workspace package names should be Zerith-specific before any package product exists, so no public lane depends on generic names such as core, player, or editor.',
        id: 'workspacePackageNames',
        label: 'Workspace package names',
        status: workspaceNamesAreBranded ? 'ready' : 'blocked',
        summary: workspaceNamesAreBranded
            ? 'Workspace packages are named @zeffuro/zerith-core, @zeffuro/zerith-player, and zerith-editor.'
            : `Workspace packages are ${formatPackageNames(actualPackageNames)}.`,
    },
    {
        detail: 'Editor should depend on the local core workspace. Player should depend on the branded public core version because it is a CLI package candidate.',
        id: 'internalDependencies',
        label: 'Internal dependencies',
        status: internalDependenciesAreBranded ? 'ready' : 'blocked',
        summary: internalDependenciesAreBranded
            ? 'Editor uses the local core workspace; player uses the publishable @zeffuro/zerith-core version range.'
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
        detail: 'The current editor release channel is GitHub artifacts. Npm package publishing is allowed only through explicit core/player lanes with package metadata, provenance, and CI smoke coverage.',
        id: 'workspacePublicationGuard',
        label: 'Workspace publication guard',
        status: workspacePublicationPolicyReady ? 'ready' : 'blocked',
        summary: workspacePublicationPolicyReady
            ? 'Root/editor remain guarded; core/player are private or on explicit npm package lanes.'
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
        packagePublication: 'guarded-core-and-player-npm-lanes',
    },
    ready,
    status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Package publication checks: ${report.status} (${ready} ready / ${limited} limited / ${blocked} blocked)`);
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
