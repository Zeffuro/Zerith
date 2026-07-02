import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const editorManifest = await readJson('packages/editor/package.json');
const tauriConfig = await readJson('packages/editor/src-tauri/tauri.conf.json');
const cargoManifest = await readText('packages/editor/src-tauri/Cargo.toml');
const tauriLib = await readText('packages/editor/src-tauri/src/lib.rs');
const defaultCapability = await readJson('packages/editor/src-tauri/capabilities/default.json');
const appSource = await readText('packages/editor/src/App.tsx');
const settingsSchema = await readText('packages/editor/src/store/settings/SettingsSchema.ts');
const workflowNames = await readdir(path.join(root, '.github/workflows'));
const hasEditorUpdateClient = await sourceTreeIncludes('packages/editor/src', '@tauri-apps/plugin-updater');
const hasStartupUpdatePrecheck = appSource.includes('useStartupEditorUpdateCheck')
    && settingsSchema.includes('checkForUpdatesOnStartup')
    && await sourceTreeIncludes('packages/editor/src', 'runStartupEditorUpdateCheck');

const preferredEndpoint = 'https://github.com/Zeffuro/Zerith/releases/latest/download/latest.json';
const updaterConfig = tauriConfig.plugins?.updater;
const updaterEndpoints = Array.isArray(updaterConfig?.endpoints) ? updaterConfig.endpoints : [];
const hasJsDependency = Boolean(editorManifest.dependencies?.['@tauri-apps/plugin-updater']);
const hasRustDependency = cargoManifest.includes('tauri-plugin-updater');
const hasProcessJsDependency = Boolean(editorManifest.dependencies?.['@tauri-apps/plugin-process']);
const hasProcessRustDependency = cargoManifest.includes('tauri-plugin-process');
const hasPluginRegistration = tauriLib.includes('tauri_plugin_updater::Builder')
    || tauriLib.includes('tauri_plugin_updater::init');
const hasProcessPluginRegistration = tauriLib.includes('tauri_plugin_process::init');
const permissionIds = defaultCapability.permissions
    .map((permission) => typeof permission === 'string' ? permission : permission.identifier)
    .filter(Boolean);
const hasUpdaterPermission = permissionIds.includes('updater:default')
    || permissionIds.includes('updater:allow-check');
const hasProcessPermission = permissionIds.includes('process:default')
    || permissionIds.includes('process:allow-restart');
const hasDialogConfirmPermission = permissionIds.includes('dialog:allow-confirm')
    || permissionIds.includes('dialog:allow-message');
const createsUpdaterArtifacts = tauriConfig.bundle?.createUpdaterArtifacts === true;
const hasPublicKey = typeof updaterConfig?.pubkey === 'string'
    && updaterConfig.pubkey.trim().length > 0
    && !/CONTENT FROM|PUBLICKEY|TODO|PLACEHOLDER/iu.test(updaterConfig.pubkey);
const hasHttpsEndpoint = updaterEndpoints.some((endpoint) => typeof endpoint === 'string' && endpoint.startsWith('https://'));
const usesPreferredEndpoint = updaterEndpoints.includes(preferredEndpoint);
const packagePreviewWorkflowExists = workflowNames.includes('editor-package-preview.yml');
const releaseWorkflowExists = workflowNames.some((name) => /release/iu.test(name));
const canPublishUpdaterMetadata = releaseWorkflowExists
    && createsUpdaterArtifacts
    && hasPublicKey
    && hasHttpsEndpoint;
const releaseLatestJsonStatus = canPublishUpdaterMetadata
    ? 'ready'
    : (releaseWorkflowExists || packagePreviewWorkflowExists ? 'limited' : 'blocked');
const releaseLatestJsonSummary = getReleaseLatestJsonSummary();

const checks = [
    {
        detail: 'The updater needs both JavaScript guest bindings and the Rust updater plugin dependency before the editor can check or install updates.',
        id: 'updaterDependencies',
        label: 'Updater dependencies',
        status: hasJsDependency && hasRustDependency ? 'ready' : 'blocked',
        summary: hasJsDependency && hasRustDependency
            ? 'JavaScript and Rust updater dependencies are present.'
            : 'Updater JavaScript/Rust dependencies are not installed.',
    },
    {
        detail: 'The desktop runtime must register the updater plugin and expose updater permissions to the main editor window.',
        id: 'runtimeRegistration',
        label: 'Runtime registration',
        status: hasPluginRegistration && hasUpdaterPermission ? 'ready' : 'blocked',
        summary: hasPluginRegistration && hasUpdaterPermission
            ? 'Updater runtime registration and permissions are present.'
            : 'Updater plugin registration or permissions are missing.',
    },
    {
        detail: 'Installed updates need process relaunch support so the editor can restart after download and install.',
        id: 'restartSupport',
        label: 'Restart support',
        status: hasProcessJsDependency && hasProcessRustDependency && hasProcessPluginRegistration && hasProcessPermission
            ? 'ready'
            : 'blocked',
        summary: hasProcessJsDependency && hasProcessRustDependency && hasProcessPluginRegistration && hasProcessPermission
            ? 'Process relaunch dependency, registration, and permission are present.'
            : 'Process relaunch dependency, registration, or permission is missing.',
    },
    {
        detail: 'The update confirmation prompt must be allowed by Tauri ACL so installed builds do not fail with plugin:dialog|confirm before download/install.',
        id: 'updateConfirmationPermission',
        label: 'Update confirmation permission',
        status: hasDialogConfirmPermission ? 'ready' : 'blocked',
        summary: hasDialogConfirmPermission
            ? 'Dialog confirm permission is present for update prompts.'
            : 'Dialog confirm permission is missing from the editor capability.',
    },
    {
        detail: 'Tauri bundle output must include updater artifacts so release workflows can publish signed update bundles beside installers.',
        id: 'updaterArtifacts',
        label: 'Updater artifacts',
        status: createsUpdaterArtifacts ? 'ready' : 'blocked',
        summary: createsUpdaterArtifacts
            ? 'Tauri is configured to create updater artifacts.'
            : 'Tauri updater artifact generation is not enabled.',
    },
    {
        detail: 'Tauri requires a real public key in config and private signing key in release automation. Placeholder keys must not be committed as a release claim.',
        id: 'signingKey',
        label: 'Signing key',
        status: hasPublicKey ? 'ready' : 'blocked',
        summary: hasPublicKey
            ? 'Updater public key is configured.'
            : 'Updater signing key material is not configured.',
    },
    {
        detail: 'Production updater endpoints must be HTTPS. The preferred first release path is a static GitHub Releases latest.json file.',
        id: 'updateEndpoint',
        label: 'Update endpoint',
        status: hasHttpsEndpoint
            ? (usesPreferredEndpoint ? 'ready' : 'limited')
            : 'blocked',
        summary: hasHttpsEndpoint
            ? (usesPreferredEndpoint
                ? 'Updater endpoint uses the preferred GitHub Releases latest.json path.'
                : 'Updater has an HTTPS endpoint, but it is not the preferred GitHub Releases latest.json path.')
            : 'Updater HTTPS endpoint is not configured.',
    },
    {
        detail: 'Update manifests and signed release assets need a GitHub Release publishing workflow plus updater artifact generation, signing, and endpoint configuration.',
        id: 'releaseLatestJson',
        label: 'Release latest.json',
        status: releaseLatestJsonStatus,
        summary: releaseLatestJsonSummary,
    },
    {
        detail: 'The editor needs a user-visible update check/install flow that calls the updater guest API instead of only registering the desktop plugin.',
        id: 'editorUpdateClient',
        label: 'Editor update client',
        status: hasEditorUpdateClient ? 'ready' : 'blocked',
        summary: hasEditorUpdateClient
            ? 'Editor source calls the updater guest API.'
            : 'No editor update check/install UI or service exists yet.',
    },
    {
        detail: 'The editor should check for desktop updates when opened, while letting users disable that startup check in persisted settings.',
        id: 'startupUpdatePrecheck',
        label: 'Startup update precheck',
        status: hasStartupUpdatePrecheck ? 'ready' : 'blocked',
        summary: hasStartupUpdatePrecheck
            ? 'Startup update precheck and persisted toggle are present.'
            : 'Startup update precheck or persisted toggle is missing.',
    },
    {
        detail: 'Portable/manual downloads remain manual-replace artifacts by policy. The supported in-app update path is installer-managed Tauri static JSON updates.',
        id: 'portableUpdatePolicy',
        label: 'Portable update policy',
        status: 'ready',
        summary: 'Portable/manual downloads have an explicit manual-replace update policy.',
    },
];

const ready = countByStatus(checks, 'ready');
const limited = countByStatus(checks, 'limited');
const blocked = countByStatus(checks, 'blocked');
const report = {
    blocked,
    checks,
    limited,
    preferredUpdateModel: {
        endpoint: preferredEndpoint,
        installerUpdatePath: 'tauri-static-json',
        portableZipUpdatePath: 'manual-replace',
        releaseAsset: 'latest.json',
    },
    ready,
    recommendation: 'Use Tauri static JSON updates from GitHub Releases for installer-managed artifacts. Keep portable/manual downloads on the explicit manual-replace path.',
    status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Editor updater readiness: ${report.status} (${ready} ready / ${limited} limited / ${blocked} blocked)`);
    console.log(`Preferred endpoint: ${preferredEndpoint}`);
    for (const check of checks) {
        console.log(`- ${check.label}: ${check.status} - ${check.summary}`);
    }
    console.log(`Recommendation: ${report.recommendation}`);
}

function countByStatus(checks_, status) {
    return checks_.filter((check) => check.status === status).length;
}

function getReleaseLatestJsonSummary() {
    if (canPublishUpdaterMetadata) {
        return 'Release workflow can publish update metadata.';
    }

    if (releaseWorkflowExists) {
        return 'Release workflow exists, but updater artifact generation, signing, or endpoint configuration is incomplete.';
    }

    if (packagePreviewWorkflowExists) {
        return 'Package preview exists, but latest.json publishing is not configured.';
    }

    return 'No release or package-preview workflow exists for updater artifacts.';
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}

async function sourceTreeIncludes(relativePath, needle) {
    const absolutePath = path.join(root, relativePath);
    const entries = await readdir(absolutePath, { withFileTypes: true });

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
