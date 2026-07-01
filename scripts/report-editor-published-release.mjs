import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const versionArgument = readCliValue('--version');

const editorManifest = await readJson('packages/editor/package.json');
const version = versionArgument ?? editorManifest.version;
const tagName = `editor-v${version}`;
const releaseApiUrl = `https://api.github.com/repos/Zeffuro/Zerith/releases/tags/${tagName}`;
const latestJsonUrl = 'https://github.com/Zeffuro/Zerith/releases/latest/download/latest.json';

const release = await fetchJsonOrUndefined(releaseApiUrl);
const latestJson = await fetchJsonOrUndefined(latestJsonUrl);
const assets = Array.isArray(release?.assets) ? release.assets : [];
const assetNames = assets
    .map((asset) => typeof asset?.name === 'string' ? asset.name : undefined)
    .filter(Boolean);
const missingAssets = getMissingAssets(assetNames);
const missingPlatforms = getMissingLatestJsonPlatforms(latestJson);

const checks = [
    {
        detail: 'The current editor artifact version should have a published GitHub Release with the expected editor-v tag.',
        id: 'githubRelease',
        label: 'GitHub release',
        status: release?.tag_name === tagName ? 'ready' : 'blocked',
        summary: release?.tag_name === tagName
            ? `${tagName} exists on GitHub Releases.`
            : `${tagName} is not published on GitHub Releases.`,
    },
    {
        detail: 'Release assets should be published, not left as a draft or prerelease artifact set.',
        id: 'publishedState',
        label: 'Published state',
        status: release && !release.draft && !release.prerelease ? 'ready' : 'blocked',
        summary: release && !release.draft && !release.prerelease
            ? 'Release is published and marked stable.'
            : 'Release is draft, prerelease, or unavailable.',
    },
    {
        detail: 'Release notes feed the in-editor Release Notes panel and updater prompt notes.',
        id: 'releaseNotes',
        label: 'Release notes',
        status: hasText(release?.body) && hasText(latestJson?.notes) ? 'ready' : 'blocked',
        summary: hasText(release?.body) && hasText(latestJson?.notes)
            ? 'Release body and latest.json notes are present.'
            : 'Release body or latest.json notes are missing.',
    },
    {
        detail: 'The release should include the installer and signed updater assets needed by the supported desktop update path.',
        id: 'releaseAssets',
        label: 'Release assets',
        status: missingAssets.length === 0 ? 'ready' : 'blocked',
        summary: missingAssets.length === 0
            ? `${assetNames.length} release assets include the expected installer/updater set.`
            : `Missing expected assets: ${missingAssets.join(', ')}.`,
    },
    {
        detail: 'The latest.json asset should be reachable through the configured GitHub Releases endpoint and match the local editor version.',
        id: 'latestJson',
        label: 'latest.json',
        status: latestJson?.version === version ? 'ready' : 'blocked',
        summary: latestJson?.version === version
            ? `latest.json points to editor ${version}.`
            : `latest.json does not point to editor ${version}.`,
    },
    {
        detail: 'The updater manifest should include signed platform entries for Windows, macOS arm64/x64, and Linux x64.',
        id: 'updaterPlatforms',
        label: 'Updater platforms',
        status: missingPlatforms.length === 0 ? 'ready' : 'blocked',
        summary: missingPlatforms.length === 0
            ? 'latest.json has signed platform entries for the supported installer update path.'
            : `latest.json is missing platform entries: ${missingPlatforms.join(', ')}.`,
    },
];

const ready = countByStatus(checks, 'ready');
const blocked = countByStatus(checks, 'blocked');
const report = {
    blocked,
    checks,
    latestJson: latestJson
        ? {
            endpoint: latestJsonUrl,
            platforms: latestJson.platforms ? Object.keys(latestJson.platforms) : [],
            version: latestJson.version,
        }
        : undefined,
    ready,
    release: release
        ? {
            assetCount: assetNames.length,
            htmlUrl: release.html_url,
            name: release.name,
            publishedAt: release.published_at,
            tagName: release.tag_name,
        }
        : undefined,
    status: blocked > 0 ? 'blocked' : 'ready',
    version,
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Editor published release: ${report.status} (${ready} ready / ${blocked} blocked)`);
    console.log(`Release tag: ${tagName}`);
    if (report.release?.htmlUrl) console.log(`Release URL: ${report.release.htmlUrl}`);
    for (const check of checks) {
        console.log(`- ${check.label}: ${check.status} - ${check.summary}`);
    }
}

function countByStatus(checks_, status) {
    return checks_.filter((check) => check.status === status).length;
}

async function fetchJsonOrUndefined(url) {
    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'ZerithReleaseCheck',
            },
        });
        if (!response.ok) return undefined;
        return response.json();
    } catch {
        return undefined;
    }
}

function getMissingAssets(assetNames_) {
    return [
        ['latest.json', /^latest\.json$/u],
        ['Windows NSIS installer', /_x64-setup\.exe$/u],
        ['Windows NSIS signature', /_x64-setup\.exe\.sig$/u],
        ['Windows MSI installer', /_x64_en-US\.msi$/u],
        ['Windows MSI signature', /_x64_en-US\.msi\.sig$/u],
        ['macOS arm64 DMG', /_aarch64\.dmg$/u],
        ['macOS arm64 updater archive', /_aarch64\.app\.tar\.gz$/u],
        ['macOS arm64 updater signature', /_aarch64\.app\.tar\.gz\.sig$/u],
        ['macOS x64 DMG', /_x64\.dmg$/u],
        ['macOS x64 updater archive', /_x64\.app\.tar\.gz$/u],
        ['macOS x64 updater signature', /_x64\.app\.tar\.gz\.sig$/u],
        ['Linux AppImage', /_amd64\.AppImage$/u],
        ['Linux AppImage signature', /_amd64\.AppImage\.sig$/u],
        ['Linux deb', /_amd64\.deb$/u],
        ['Linux deb signature', /_amd64\.deb\.sig$/u],
        ['Linux rpm', /\.x86_64\.rpm$/u],
        ['Linux rpm signature', /\.x86_64\.rpm\.sig$/u],
    ]
        .filter(([, pattern]) => !assetNames_.some((name) => pattern.test(name)))
        .map(([label]) => label);
}

function getMissingLatestJsonPlatforms(latestJson_) {
    const platforms = latestJson_?.platforms;
    if (!platforms || typeof platforms !== 'object' || Array.isArray(platforms)) {
        return ['windows-x86_64', 'darwin-aarch64', 'darwin-x86_64', 'linux-x86_64'];
    }

    return ['windows-x86_64', 'darwin-aarch64', 'darwin-x86_64', 'linux-x86_64']
        .filter((platform) => {
            const entry = platforms[platform];
            return !entry || !hasText(entry.signature) || !hasText(entry.url);
        });
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function readCliValue(name) {
    const index = process.argv.indexOf(name);
    if (index === -1) return undefined;
    return process.argv[index + 1];
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}
