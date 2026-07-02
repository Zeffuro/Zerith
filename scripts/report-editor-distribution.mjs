import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const editorManifest = await readJson('packages/editor/package.json');
const tauriConfig = await readJson('packages/editor/src-tauri/tauri.conf.json');
const cargoManifest = await readText('packages/editor/src-tauri/Cargo.toml');
const workflowNames = await readdir(path.join(root, '.github/workflows'));
const artifactContractExists = await fileExists('scripts/report-editor-artifacts.mjs');
const updaterReportExists = await fileExists('scripts/report-editor-updater.mjs');
const editorReleaseWorkflow = workflowNames.includes('editor-release.yml')
    ? await readText('.github/workflows/editor-release.yml')
    : '';

const cargoVersion = readCargoField(cargoManifest, 'version');
const cargoDescription = readCargoField(cargoManifest, 'description');
const cargoAuthors = readCargoArrayField(cargoManifest, 'authors');
const hasUpdaterDependency = editorManifest.dependencies?.['@tauri-apps/plugin-updater']
    || cargoManifest.includes('tauri-plugin-updater');
const updaterConfig = tauriConfig.plugins?.updater;
const createsUpdaterArtifacts = tauriConfig.bundle?.createUpdaterArtifacts === true
    || tauriConfig.bundle?.createUpdaterArtifacts === 'v1Compatible';
const releaseWorkflowExists = workflowNames.some((name) => /release/iu.test(name));
const editorPackagePreviewWorkflowExists = workflowNames.includes('editor-package-preview.yml');
const editorBundleTargetsAll = tauriConfig.bundle?.active === true && tauriConfig.bundle?.targets === 'all';
const hasEditorUpdateClient = await sourceTreeIncludes('packages/editor/src', '@tauri-apps/plugin-updater');
const hasUnsignedDownloadVerification = editorReleaseWorkflow.includes('create-editor-release-checksums.mjs')
    && editorReleaseWorkflow.includes('SHA256SUMS')
    && editorReleaseWorkflow.includes('OS trust signing/notarization is not configured yet');

const requirements = [
    {
        detail: 'The Tauri bundle product name and Rust package metadata should identify the shipped app as Zerith Editor, not as a template app.',
        id: 'editorBundleIdentity',
        label: 'Editor bundle identity',
        status: hasEditorBundleIdentity() ? 'ready' : 'blocked',
        summary: hasEditorBundleIdentity()
            ? 'Editor bundle metadata is branded for release artifacts.'
            : 'Editor bundle metadata still has missing or template values.',
    },
    {
        detail: 'The editor package, Tauri config, and Cargo manifest should agree on the same app version before installer artifacts are uploaded.',
        id: 'versionAlignment',
        label: 'Version alignment',
        status: editorManifest.version === tauriConfig.version && editorManifest.version === cargoVersion
            ? 'ready'
            : 'blocked',
        summary: editorManifest.version === tauriConfig.version && editorManifest.version === cargoVersion
            ? `Editor version is aligned at ${editorManifest.version}.`
            : 'Editor package, Tauri config, and Cargo versions are not aligned.',
    },
    {
        detail: 'Tauri bundle generation is enabled and targets all platform defaults. Windows installers still need a Windows build host for MSI/NSIS output.',
        id: 'installerArtifacts',
        label: 'Installer artifacts',
        status: editorBundleTargetsAll && editorPackagePreviewWorkflowExists
            ? 'ready'
            : (editorBundleTargetsAll ? 'limited' : 'blocked'),
        summary: editorBundleTargetsAll && editorPackagePreviewWorkflowExists
            ? 'Installer bundling is configured and covered by a manual package-preview workflow.'
            : (editorBundleTargetsAll
                ? 'Installer bundling is configured, but workflow artifact output is not defined.'
                : 'Installer bundling is not configured.'),
    },
    {
        detail: 'Portable/manual downloads are a useful fallback for users who avoid installers. The source artifact contract defines them as manual-replace artifacts rather than installer-managed apps.',
        id: 'manualPortableArtifact',
        label: 'Manual portable artifact policy',
        status: artifactContractExists ? 'ready' : 'blocked',
        summary: artifactContractExists
            ? 'Portable/manual distribution has an explicit manual-replace contract.'
            : 'Editor portable/manual distribution needs an explicit artifact contract.',
    },
    {
        detail: 'Tauri updater support needs the JS/Rust updater plugin, updater configuration, generated updater artifacts, signing keys, and hosted endpoints.',
        id: 'updaterIntegration',
        label: 'Updater integration',
        status: hasUpdaterDependency && updaterConfig && createsUpdaterArtifacts ? 'ready' : 'blocked',
        summary: hasUpdaterDependency && updaterConfig && createsUpdaterArtifacts
            ? 'Updater plugin, config, and artifact generation are present.'
            : (updaterReportExists
                ? 'Updater support is not configured yet; the updater report tracks the remaining prerequisites.'
                : 'Updater support is not configured yet.'),
    },
    {
        detail: 'Installer-based updates need signed updater artifacts and an endpoint such as a latest.json release manifest. Those should be added only after the release channel is chosen.',
        id: 'installerUpdateChannel',
        label: 'Installer update channel',
        status: updaterConfig?.pubkey && updaterConfig?.endpoints?.length > 0 ? 'ready' : 'blocked',
        summary: updaterConfig?.pubkey && updaterConfig?.endpoints?.length > 0
            ? 'Installer update signing and endpoints are configured.'
            : 'Installer updates need signing keys and hosted update metadata.',
    },
    {
        detail: 'The editor needs a check/download/install flow that calls the Tauri updater guest API before users can update from inside the app.',
        id: 'editorUpdateClient',
        label: 'Editor update client',
        status: hasEditorUpdateClient ? 'ready' : 'blocked',
        summary: hasEditorUpdateClient
            ? 'Editor source calls the updater guest API.'
            : 'Editor update check/install UI or service is missing.',
    },
    {
        detail: 'Portable/manual downloads can be released beside installers, but the supported update path is manual replacement. In-app updates are installer-managed.',
        id: 'portableUpdatePolicy',
        label: 'Portable update policy',
        status: 'ready',
        summary: 'Portable/manual releases are supported as manual-replace artifacts; in-app updates remain installer-managed.',
    },
    {
        detail: 'Paid OS trust signing/notarization is not configured. Release automation should disclose that and publish SHA256 checksums so manual installer downloads have an independent verification path.',
        id: 'unsignedDownloadVerification',
        label: 'Unsigned download verification',
        status: hasUnsignedDownloadVerification ? 'ready' : 'blocked',
        summary: hasUnsignedDownloadVerification
            ? 'Release workflow discloses unsigned OS trust status and uploads SHA256 checksum assets.'
            : 'Unsigned releases need checksum assets and an explicit release-note disclosure.',
    },
    {
        detail: 'A release workflow publishes signed artifacts to GitHub Releases. The manual package-preview workflow only proves bundle output and uploads workflow artifacts for inspection.',
        id: 'editorReleaseWorkflow',
        label: 'Editor release workflow',
        status: releaseWorkflowExists
            ? 'ready'
            : (editorPackagePreviewWorkflowExists ? 'limited' : 'blocked'),
        summary: releaseWorkflowExists
            ? 'A release workflow exists.'
            : (editorPackagePreviewWorkflowExists
                ? 'Manual package preview exists, but GitHub Release publishing is not configured.'
                : 'Editor release artifact automation remains absent.'),
    },
];

const ready = countByStatus(requirements, 'ready');
const limited = countByStatus(requirements, 'limited');
const blocked = countByStatus(requirements, 'blocked');
const report = {
    blocked,
    limited,
    ready,
    recommendation: 'Ship installer artifacts as the primary path and portable/manual downloads as explicit manual-replace fallbacks. In-app updates are wired for installer-managed desktop builds. Until paid OS trust signing is configured, publish SHA256 checksums beside manual downloads.',
    requirements,
    status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Editor distribution checks: ${report.status} (${ready} ready / ${limited} limited / ${blocked} blocked)`);
    for (const requirement of report.requirements) {
        console.log(`- ${requirement.label}: ${requirement.status} - ${requirement.summary}`);
    }
    console.log(`Recommendation: ${report.recommendation}`);
}

function countByStatus(requirements_, status) {
    return requirements_.filter((requirement) => requirement.status === status).length;
}

function hasEditorBundleIdentity() {
    return tauriConfig.productName === 'Zerith Editor'
        && cargoDescription === 'Zerith desktop authoring editor'
        && cargoAuthors.includes('Zeffuro');
}

async function fileExists(relativePath) {
    try {
        await access(path.join(root, relativePath));
        return true;
    } catch {
        return false;
    }
}

function readCargoArrayField(text, fieldName) {
    const match = new RegExp(`^${fieldName}\\s*=\\s*\\[(?<values>[^\\]]*)\\]`, 'mu').exec(text);
    if (!match?.groups?.values) return [];

    return match.groups.values
        .split(',')
        .map((value) => value.trim().replace(/^"|"$/gu, ''))
        .filter(Boolean);
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
