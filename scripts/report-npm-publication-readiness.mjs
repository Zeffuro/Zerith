import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rootManifest = await readJson('package.json');
const coreManifest = await readJson('packages/core/package.json');
const editorManifest = await readJson('packages/editor/package.json');
const playerManifest = await readJson('packages/player/package.json');
const workflowSources = await readWorkflowSources();

const recommendedFirstPackage = 'zerith-core';
const coreIsRecommendedFirstPackage = coreManifest.name === recommendedFirstPackage;
const rootIsPrivate = rootManifest.private === true;
const appPackagesRemainPrivate = editorManifest.private === true && playerManifest.private === true;
const coreHasPublicManifest = coreManifest.private !== true
    && coreManifest.version !== '0.0.0'
    && isNonEmptyString(coreManifest.description)
    && isNonEmptyString(coreManifest.license)
    && coreManifest.repository !== undefined
    && coreManifest.publishConfig?.access === 'public';
const coreHasBuiltEntrypoints = !manifestContainsSourceEntrypoint(coreManifest)
    && manifestContainsDistEntrypoint(coreManifest)
    && manifestContainsTypes(coreManifest);
const coreHasPublishAllowlist = Array.isArray(coreManifest.files)
    && coreManifest.files.includes('dist')
    && coreManifest.files.includes('README.md')
    && coreManifest.files.includes('LICENSE');
const coreHasNoFileDependencies = Object.values(coreManifest.dependencies ?? {})
    .every((version) => typeof version === 'string' && !version.startsWith('file:'));
const hasTrustedPublishingWorkflow = workflowSources.some((source) => (
    /id-token:\s*write/u.test(source)
    && /registry-url:\s*['"]?https:\/\/registry\.npmjs\.org/u.test(source)
    && /\bnpm\s+(?:stage\s+)?publish\b/u.test(source)
));
const hasConsumerInstallSmoke = workflowSources.some((source) => /npm\s+install\s+.*\.tgz/u.test(source))
    || Object.values(rootManifest.scripts ?? {}).some((script) => typeof script === 'string' && /smoke-npm-package\.mjs/u.test(script));

const checks = [
    {
        detail: 'The first npm product should be the runtime/library surface. The desktop editor should stay on GitHub installer artifacts, and the player app should wait for a CLI/library contract.',
        id: 'initialPackageTarget',
        label: 'Initial package target',
        status: coreIsRecommendedFirstPackage && rootIsPrivate && appPackagesRemainPrivate ? 'ready' : 'blocked',
        summary: coreIsRecommendedFirstPackage && rootIsPrivate && appPackagesRemainPrivate
            ? 'Use zerith-core as the first npm package; keep root, editor, and player guarded for now.'
            : 'The first npm package target is unclear or app packages are publishable too early.',
    },
    {
        detail: 'A public npm package needs its own non-placeholder version and package metadata before removing the private guard.',
        id: 'corePublicManifest',
        label: 'Core public manifest',
        status: coreHasPublicManifest ? 'ready' : 'blocked',
        summary: coreHasPublicManifest
            ? 'zerith-core has public package metadata.'
            : 'zerith-core is still private, versioned as 0.0.0, or missing package-level description/license/repository/publishConfig.',
    },
    {
        detail: 'Consumers should install JavaScript and declarations, not source TypeScript entrypoints that depend on the repo build setup.',
        id: 'coreBuildOutput',
        label: 'Core build output',
        status: coreHasBuiltEntrypoints ? 'ready' : 'blocked',
        summary: coreHasBuiltEntrypoints
            ? 'zerith-core entrypoints resolve to built dist files with declarations.'
            : 'zerith-core still exports source .ts files and has no dist/declaration package contract.',
    },
    {
        detail: 'Published tarballs should be small and intentional. Tests, fixtures, editor assets, and raw development files should not leak into the package.',
        id: 'corePackageContents',
        label: 'Core package contents',
        status: coreHasPublishAllowlist ? 'ready' : 'blocked',
        summary: coreHasPublishAllowlist
            ? 'zerith-core has an explicit files allowlist for dist, README, and LICENSE.'
            : 'zerith-core lacks a files allowlist; npm pack currently falls back to broad source inclusion.',
    },
    {
        detail: 'Public packages cannot depend on local workspace file paths. Internal consumers can keep file paths until the published package lane exists.',
        id: 'dependencyPolicy',
        label: 'Dependency policy',
        status: coreHasNoFileDependencies ? 'ready' : 'blocked',
        summary: coreHasNoFileDependencies
            ? 'zerith-core has no file: dependencies.'
            : 'zerith-core has local file: dependencies that cannot publish as-is.',
    },
    {
        detail: 'Use npm trusted publishing with GitHub Actions OIDC instead of long-lived npm tokens once package metadata and dist output are ready.',
        id: 'trustedPublishingWorkflow',
        label: 'Trusted publishing workflow',
        status: hasTrustedPublishingWorkflow ? 'ready' : 'blocked',
        summary: hasTrustedPublishingWorkflow
            ? 'A workflow grants OIDC and runs npm publish/stage publish against npmjs.'
            : 'No npm trusted-publishing workflow exists yet.',
    },
    {
        detail: 'Before publishing, create a disposable consumer project, install the packed tarball, import the public entrypoints, and run a tiny compile/runtime check.',
        id: 'consumerInstallSmoke',
        label: 'Consumer install smoke',
        status: hasConsumerInstallSmoke ? 'ready' : 'blocked',
        summary: hasConsumerInstallSmoke
            ? 'A packed-tarball consumer install smoke exists.'
            : 'No packed-tarball consumer install smoke exists yet.',
    },
    {
        detail: 'Registry availability is an external mutable state. Verify with npm view, then reserve/publish from the intended npm account or org.',
        id: 'registryNameReservation',
        label: 'Registry name reservation',
        status: 'limited',
        summary: 'Verify current npm name availability immediately before the first publish.',
    },
];

const ready = countByStatus(checks, 'ready');
const limited = countByStatus(checks, 'limited');
const blocked = countByStatus(checks, 'blocked');
const report = {
    blocked,
    checks,
    limited,
    npmDocs: {
        provenance: 'https://docs.npmjs.com/generating-provenance-statements/',
        scopedPublicPackages: 'https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/',
        trustedPublishing: 'https://docs.npmjs.com/trusted-publishers/',
        unscopedPublicPackages: 'https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/',
    },
    recommendedFirstPackage,
    ready,
    recommendation: 'Publish zerith-core first after adding dist/declarations, package metadata, files allowlist, consumer install smoke, and a trusted-publishing workflow. Keep zerith-editor on GitHub Releases and keep zerith-player private until it has a CLI/library contract.',
    status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
};

if (asJson) {
    console.log(JSON.stringify(report, undefined, 2));
} else {
    console.log(`Npm publication readiness: ${report.status} (${ready} ready / ${limited} limited / ${blocked} blocked)`);
    console.log(`Recommended first package: ${recommendedFirstPackage}`);
    for (const check of checks) {
        console.log(`- ${check.label}: ${check.status} - ${check.summary}`);
    }
    console.log(`Recommendation: ${report.recommendation}`);
}

function countByStatus(checks_, status) {
    return checks_.filter((check) => check.status === status).length;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function manifestContainsDistEntrypoint(manifest) {
    return manifestValueContains(manifest.main, './dist/')
        || manifestValueContains(manifest.exports, './dist/');
}

function manifestContainsSourceEntrypoint(manifest) {
    return manifestValueContainsSourceEntrypoint(manifest.main)
        || manifestValueContainsSourceEntrypoint(manifest.exports);
}

function manifestContainsTypes(manifest) {
    return isNonEmptyString(manifest.types)
        || manifestValueContains(manifest.exports, '.d.ts');
}

function manifestValueContains(value, needle) {
    if (typeof value === 'string') return value.includes(needle);
    if (Array.isArray(value)) return value.some((entry) => manifestValueContains(entry, needle));
    if (value && typeof value === 'object') {
        return Object.values(value).some((entry) => manifestValueContains(entry, needle));
    }
    return false;
}

function manifestValueContainsSourceEntrypoint(value) {
    if (typeof value === 'string') {
        const pathname = value.split(/[?#]/u)[0];
        return /\.tsx?$/u.test(pathname) && !/\.d\.ts$/u.test(pathname);
    }
    if (Array.isArray(value)) return value.some((entry) => manifestValueContainsSourceEntrypoint(entry));
    if (value && typeof value === 'object') {
        return Object.values(value).some((entry) => manifestValueContainsSourceEntrypoint(entry));
    }
    return false;
}

async function readWorkflowSources() {
    const workflowDir = path.join(root, '.github/workflows');
    const entries = await readdir(workflowDir, { withFileTypes: true });
    const sources = [];

    for (const entry of entries) {
        if (!entry.isFile() || !/\.ya?ml$/u.test(entry.name)) continue;
        sources.push(await readText(path.join('.github/workflows', entry.name)));
    }

    return sources;
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}
