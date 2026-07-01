import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rootManifest = await readJson('package.json');
const coreManifest = await readJson('packages/core/package.json');
const editorManifest = await readJson('packages/editor/package.json');
const playerManifest = await readJson('packages/player/package.json');
const tauriConfig = await readJson('packages/editor/src-tauri/tauri.conf.json');
const cargoManifest = await readText('packages/editor/src-tauri/Cargo.toml');
const ciWorkflow = await readText('.github/workflows/ci.yml');
const workflowNames = await readdir(path.join(root, '.github/workflows'));
const hasEditorUpdaterDependency = Boolean(editorManifest.dependencies?.['@tauri-apps/plugin-updater'])
    || cargoManifest.includes('tauri-plugin-updater');
const hasEditorUpdaterConfig = Boolean(tauriConfig.plugins?.updater);
const createsEditorUpdaterArtifacts = tauriConfig.bundle?.createUpdaterArtifacts === true
    || tauriConfig.bundle?.createUpdaterArtifacts === 'v1Compatible';
const releaseWorkflowExists = workflowNames.some((name) => /release/iu.test(name));
const editorPackagePreviewWorkflowExists = workflowNames.includes('editor-package-preview.yml');
const editorArtifactContractExists = await fileExists('scripts/report-editor-artifacts.mjs');
const editorUpdaterReportExists = await fileExists('scripts/report-editor-updater-readiness.mjs');
const versionPolicyExists = await fileExists('scripts/report-version-policy.mjs');
const cargoVersion = readCargoField(cargoManifest, 'version');
const editorVersionAligned = editorManifest.version === tauriConfig.version && editorManifest.version === cargoVersion;
const hasEditorUpdateClient = await sourceTreeIncludes('packages/editor/src', '@tauri-apps/plugin-updater');
const hasEditorReleaseNotesSurface = await sourceTreeIncludes('packages/editor/src', 'loadEditorReleaseNotes')
    && await sourceTreeIncludes('packages/editor/src', 'isReleaseNotesModalOpen');
const hasPrivateWorkspaceArtifactPolicy = arePackagesPrivate(rootManifest, coreManifest, editorManifest, playerManifest)
    && versionPolicyExists;
const remainingUpdaterReleaseNeeds = getRemainingUpdaterReleaseNeeds();

const requirements = [
    {
        detail: 'Root package metadata includes description, MIT license metadata, repository URL, and project keywords.',
        id: 'sourceMetadata',
        label: 'Source metadata',
        status: hasSourceMetadata(rootManifest) ? 'ready' : 'blocked',
        summary: hasSourceMetadata(rootManifest)
            ? 'Root source metadata is present.'
            : 'Root source metadata is incomplete.',
    },
    {
        detail: 'CI runs fixture policy, public-readiness, lint, Vitest, CI-safe Playwright smoke, build, export parity, and exported runtime smoke for approved fixtures.',
        id: 'ciReleaseGate',
        label: 'CI release gate',
        status: hasCiReleaseGate(ciWorkflow) ? 'ready' : 'blocked',
        summary: hasCiReleaseGate(ciWorkflow)
            ? 'Main CI covers the current source and export confidence gates.'
            : 'Main CI is missing one or more source/export confidence gates.',
    },
    {
        detail: 'The deploy workflow builds the first-party example-game Pages artifact and runs exported runtime smoke before upload.',
        id: 'pagesExampleGate',
        label: 'Pages example gate',
        status: workflowNames.includes('deploy-example-game.yml') ? 'ready' : 'blocked',
        summary: workflowNames.includes('deploy-example-game.yml')
            ? 'The example-game deploy path has a checked workflow.'
            : 'The example-game deploy workflow is missing.',
    },
    {
        detail: getEditorDistributionUpdateDetail(),
        id: 'editorDistributionUpdates',
        label: 'Editor distribution and updates',
        status: hasEditorDistributionUpdatePath() ? 'ready' : 'blocked',
        summary: hasEditorDistributionUpdatePath()
            ? 'Editor installer and update artifacts have a source-defined release path.'
            : 'Editor installer/zip/update behavior needs an explicit release path.',
    },
    {
        detail: 'The editor should expose release notes from the same GitHub Releases source that carries release assets and updater metadata, rather than requiring a separate hand-maintained changelog file.',
        id: 'editorReleaseNotes',
        label: 'Editor release notes',
        status: hasEditorReleaseNotesSurface ? 'ready' : 'blocked',
        summary: hasEditorReleaseNotesSurface
            ? 'The editor has an in-app GitHub Release notes surface.'
            : 'The editor has no in-app release notes or changelog surface.',
    },
    {
        detail: 'The editor release channel is GitHub editor artifacts. Keeping the workspace packages private is a release-policy guard that prevents accidental npm publication until a separate scoped package product exists.',
        id: 'packagePublicationPolicy',
        label: 'Package publication policy',
        status: hasPrivateWorkspaceArtifactPolicy ? 'ready' : 'blocked',
        summary: hasPrivateWorkspaceArtifactPolicy
            ? 'Npm package publication is intentionally disabled for editor artifact releases.'
            : 'Package publication policy is not explicit enough for release readiness.',
    },
    {
        detail: versionPolicyExists
            ? 'The source version policy defines editor artifact releases from the editor app version and keeps private core/player package versions internal.'
            : 'Package versions are still placeholder/internal values and no source policy defines how they map to tags or artifacts.',
        id: 'versionPolicy',
        label: 'Version policy',
        status: hasVersionPolicy() ? 'ready' : 'blocked',
        summary: hasVersionPolicy()
            ? 'Editor artifact versioning has a source-defined policy.'
            : 'Release versioning needs an explicit policy before automation.',
    },
    {
        detail: releaseWorkflowExists
            ? 'A manual draft GitHub Release workflow exists for editor installer artifacts.'
            : (editorPackagePreviewWorkflowExists
                ? 'A manual editor package-preview workflow exists for workflow artifacts, but no GitHub Release publishing workflow is present yet.'
                : 'No GitHub release workflow is present. Add one only after artifact ownership, versioning, and support expectations are explicit.'),
        id: 'releaseWorkflow',
        label: 'Release workflow',
        status: releaseWorkflowExists
            ? 'ready'
            : (editorPackagePreviewWorkflowExists ? 'limited' : 'blocked'),
        summary: releaseWorkflowExists
            ? 'A release workflow exists.'
            : (editorPackagePreviewWorkflowExists
                ? 'Manual package preview exists, but GitHub Release publishing is absent.'
                : 'Release automation remains intentionally absent.'),
    },
];

const ready = countByStatus(requirements, 'ready');
const limited = countByStatus(requirements, 'limited');
const blocked = countByStatus(requirements, 'blocked');
const report = {
    blocked,
    limited,
    ready,
    requirements,
    status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Release readiness: ${report.status} (${ready} ready / ${limited} limited / ${blocked} blocked)`);
    for (const requirement of report.requirements) {
        console.log(`- ${requirement.label}: ${requirement.status} - ${requirement.summary}`);
    }
}

function arePackagesPrivate(...manifests) {
    return manifests.every((manifest) => manifest.private === true);
}

function countByStatus(requirements_, status) {
    return requirements_.filter((requirement) => requirement.status === status).length;
}

function hasCiReleaseGate(workflow) {
    return [
        'npm run test:fixture-policy',
        'npm run test:public-readiness',
        'npm run lint',
        'npm test',
        'npm run test:visual:ci',
        'npm run build',
        'npm run export:parity-smoke -- --game=games/example-game',
        'npm run export:parity-smoke -- --game=games/classic-vn-starter',
        'npm run test:runtime-smoke -- --game=games/example-game',
        'npm run test:runtime-smoke -- --game=games/classic-vn-starter',
    ].every((needle) => workflow.includes(needle));
}

function hasSourceMetadata(manifest) {
    return typeof manifest.description === 'string'
        && manifest.description.length > 0
        && manifest.license === 'MIT'
        && manifest.repository?.url === 'git+ssh://git@github.com/Zeffuro/Zerith.git'
        && Array.isArray(manifest.keywords)
        && manifest.keywords.length >= 5;
}

function hasEditorDistributionUpdatePath() {
    return tauriConfig.productName === 'Zerith Editor'
        && tauriConfig.bundle?.active === true
        && editorArtifactContractExists
        && hasEditorUpdaterDependency
        && hasEditorUpdaterConfig
        && createsEditorUpdaterArtifacts
        && hasEditorUpdateClient
        && releaseWorkflowExists;
}

function getRemainingUpdaterReleaseNeeds() {
    const needs = [];
    if (!hasEditorUpdaterDependency) needs.push('updater plugin');
    if (!hasEditorUpdaterConfig) needs.push('updater config');
    if (!createsEditorUpdaterArtifacts) needs.push('updater artifacts');
    if (!tauriConfig.plugins?.updater?.pubkey) needs.push('signing keys');
    if (!tauriConfig.plugins?.updater?.endpoints?.length) needs.push('hosted update metadata');
    if (!hasEditorUpdateClient) needs.push('editor update client');
    if (!releaseWorkflowExists) needs.push('release workflow output');
    return needs.join(', ');
}

function getEditorDistributionUpdateDetail() {
    if (!editorArtifactContractExists) {
        return 'Editor distribution needs named installer artifacts, an optional manual zip contract, updater plugin/config/artifacts, signing keys, and hosted update metadata before users can reliably install and update releases.';
    }

    const checklist = editorUpdaterReportExists ? ' and updater readiness checklist' : '';
    if (!remainingUpdaterReleaseNeeds) {
        return `Editor distribution has a source-defined installer/portable zip artifact contract${checklist}. Remaining confidence comes from running the release workflow and testing an installed older build against a newer GitHub Release.`;
    }

    return `Editor distribution has a source-defined installer/portable zip artifact contract${checklist}, but still needs ${remainingUpdaterReleaseNeeds} before users can reliably install and update releases.`;
}

async function fileExists(relativePath) {
    try {
        await access(path.join(root, relativePath));
        return true;
    } catch {
        return false;
    }
}

function hasVersionPolicy() {
    return versionPolicyExists && editorVersionAligned;
}

function readCargoField(text, fieldName) {
    return new RegExp(`^${fieldName}\\s*=\\s*"(?<value>[^"]+)"`, 'mu').exec(text)?.groups?.value;
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}

async function sourceTreeIncludes(relativePath, needle) {
    const entries = await readdir(path.join(root, relativePath), { withFileTypes: true });

    for (const entry of entries) {
        const childRelativePath = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
            if (await sourceTreeIncludes(childRelativePath, needle)) return true;
            continue;
        }

        if (!/\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) continue;
        if ((await readText(childRelativePath)).includes(needle)) return true;
    }

    return false;
}
