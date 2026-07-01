import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const editorManifest = await readJson('packages/editor/package.json');
const tauriConfig = await readJson('packages/editor/src-tauri/tauri.conf.json');
const cargoManifest = await readText('packages/editor/src-tauri/Cargo.toml');
const workflowNames = await readdir(path.join(root, '.github/workflows'));

const version = editorManifest.version;
const productName = tauriConfig.productName ?? 'Zerith Editor';
const filePrefix = productName.replaceAll(/\s+/gu, '-');
const editorPackagePreviewWorkflowExists = workflowNames.includes('editor-package-preview.yml');
const hasUpdaterDependency = Boolean(editorManifest.dependencies?.['@tauri-apps/plugin-updater'])
    && cargoManifest.includes('tauri-plugin-updater');
const updaterConfig = tauriConfig.plugins?.updater;
const createsUpdaterArtifacts = tauriConfig.bundle?.createUpdaterArtifacts === true;
const hasUpdaterPubkey = typeof updaterConfig?.pubkey === 'string' && updaterConfig.pubkey.trim().length > 0;
const hasUpdaterEndpoint = Array.isArray(updaterConfig?.endpoints) && updaterConfig.endpoints.length > 0;
const installerUpdatesSupported = hasUpdaterDependency
    && Boolean(updaterConfig)
    && createsUpdaterArtifacts
    && hasUpdaterPubkey
    && hasUpdaterEndpoint;

const artifacts = [
    {
        id: 'windows-nsis-installer',
        installMode: 'installer',
        kind: 'installer',
        platform: 'windows-x64',
        updateMode: 'tauri-static-json',
        updateSupported: installerUpdatesSupported,
        userAction: 'Run the setup executable.',
    },
    {
        id: 'windows-msi-installer',
        installMode: 'installer',
        kind: 'installer',
        platform: 'windows-x64',
        updateMode: 'tauri-static-json',
        updateSupported: installerUpdatesSupported,
        userAction: 'Run the MSI package.',
    },
    {
        id: 'macos-arm64-dmg-installer',
        installMode: 'installer',
        kind: 'installer',
        platform: 'macos-arm64',
        updateMode: 'tauri-static-json',
        updateSupported: installerUpdatesSupported,
        userAction: 'Open the DMG and drag the app into Applications.',
    },
    {
        id: 'macos-x64-dmg-installer',
        installMode: 'installer',
        kind: 'installer',
        platform: 'macos-x64',
        updateMode: 'tauri-static-json',
        updateSupported: installerUpdatesSupported,
        userAction: 'Open the DMG and drag the app into Applications.',
    },
    {
        id: 'linux-appimage',
        installMode: 'portable',
        kind: 'installer',
        platform: 'linux-x64',
        updateMode: 'tauri-static-json',
        updateSupported: installerUpdatesSupported,
        userAction: 'Mark the AppImage executable and run it.',
    },
    {
        id: 'manual-portable-fallback',
        installMode: 'manual-extract',
        kind: 'portable',
        platform: 'manual',
        updateMode: 'manual-replace',
        updateSupported: false,
        userAction: 'Download a portable/manual artifact, place it in a user-chosen folder, and replace it manually for updates.',
    },
];

const contract = {
    artifactNamePattern: `${filePrefix}-${version}-{platform}-{kind}`,
    packagePreview: {
        installerArtifacts: editorPackagePreviewWorkflowExists,
        manualPortableFallback: true,
        portableZip: false,
        workflow: editorPackagePreviewWorkflowExists ? 'editor-package-preview.yml' : undefined,
    },
    artifacts,
    blockedUpdateRequirements: [
        hasUpdaterDependency ? undefined : 'Tauri updater plugin dependency',
        updaterConfig ? undefined : 'Tauri updater configuration',
        createsUpdaterArtifacts ? undefined : 'Updater artifact generation',
        hasUpdaterPubkey ? undefined : 'Signing keys',
        hasUpdaterEndpoint ? undefined : 'Hosted update metadata endpoint',
        editorPackagePreviewWorkflowExists ? undefined : 'Installer packaging checks',
    ].filter(Boolean),
    productName,
    recommendation: 'Publish installer artifacts as the primary path. Treat portable/manual downloads as explicit manual-replace fallbacks; in-app updates are installer-managed.',
    version,
};

if (asJson) {
    console.log(JSON.stringify(contract, undefined, 2));
} else {
    console.log(`${productName} artifact contract (${version})`);
    console.log(`Name pattern: ${contract.artifactNamePattern}`);
    console.log(`Package preview workflow: ${editorPackagePreviewWorkflowExists ? 'editor-package-preview.yml' : 'missing'}`);
    for (const artifact of artifacts) {
        console.log(`- ${artifact.id}: ${artifact.platform} ${artifact.kind}, install=${artifact.installMode}, update=${artifact.updateMode}`);
    }
    console.log(`Recommendation: ${contract.recommendation}`);
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}
