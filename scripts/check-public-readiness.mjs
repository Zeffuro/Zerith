import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const findings = [];

const rootManifest = await readJson('package.json');
const editorManifest = await readJson('packages/editor/package.json');
const rootReadme = await readText('README.md');
const editorReadme = await readText('packages/editor/README.md');
const licenseText = await readText('LICENSE');

await assertFileExists('.github/assets/editor-preview.png');
await assertFileExists('.github/workflows/editor-package-preview.yml');
await assertFileExists('.github/workflows/editor-release.yml');

assertEquals(
    rootManifest.description,
    'TypeScript visual novel engine, desktop editor, and static player export pipeline.',
    'Root package description must match the compact public README positioning.',
);
assertEquals(rootManifest.license, 'MIT', 'Root package license must match the tracked LICENSE file.');
assertIncludes(licenseText, 'MIT License', 'Tracked LICENSE file must remain MIT.');
assertEquals(
    rootManifest.repository?.url,
    'git+ssh://git@github.com/Zeffuro/Zerith.git',
    'Root package repository URL must match the configured GitHub remote.',
);
for (const keyword of ['game-engine', 'interactive-fiction', 'react', 'tauri', 'typescript', 'visual-novel']) {
    if (!rootManifest.keywords?.includes(keyword)) {
        findings.push(`Root package keywords must include: ${keyword}`);
    }
}

assertIncludes(
    rootReadme,
    '![Zerith editor showing the scene timeline, project explorer, and live preview](.github/assets/editor-preview.png)',
    'Root README must embed the tracked editor preview screenshot.',
);
assertIncludes(rootReadme, 'games/classic-vn-starter', 'Root README must keep the canonical starter fixture visible.');
assertIncludes(rootReadme, 'games/example-game', 'Root README must keep the showcase fixture visible.');

assertNoIncludes(editorReadme, 'Tauri + React + Typescript', 'Editor README must not regress to the stock Tauri template title.');
assertNoIncludes(editorReadme, 'This template', 'Editor README must not regress to stock template copy.');

assertRootScript('dev:player');
assertRootScript('dev:editor');
assertRootScript('build:game');
assertRootScript('build:game:zip');
assertRootScript('build');
assertRootScript('lint');
assertRootScript('report:editor-artifacts');
assertRootScript('report:editor-distribution');
assertRootScript('report:editor-updater');
assertRootScript('report:release-readiness');
assertRootScript('report:version-policy');
assertRootScript('test:fixture-policy');
assertRootScript('version:editor');
assertRootScript('test');
assertEditorScript('dev');
assertEditorScript('build');
assertEditorScript('tauri');

for (const command of [
    'npm run dev:player',
    'npm run dev:editor',
    'npm run lint',
    'npm test',
    'npm run build',
    'npm run test:fixture-policy',
    'npm run build:game -- --game=games/classic-vn-starter',
    'npm run build:game:zip -- --game=games/classic-vn-starter',
]) {
    assertIncludes(rootReadme, command, `Root README must keep command visible: ${command}`);
}

for (const command of [
    'npm run dev:editor',
    'npm run build --workspace=editor',
    'npm run dev',
    'npm run build',
    'npm run tauri -- dev',
]) {
    assertIncludes(editorReadme, command, `Editor README must keep command visible: ${command}`);
}

if (findings.length > 0) {
    console.error('Public readiness check failed.');
    for (const finding of findings) {
        console.error(`- ${finding}`);
    }
    process.exitCode = 1;
} else {
    console.log('Public readiness check passed: README, screenshot, command, and package metadata references are current.');
}

async function assertFileExists(relativePath) {
    try {
        await access(path.join(root, relativePath));
    } catch {
        findings.push(`Missing tracked README asset: ${relativePath}`);
    }
}

function assertEditorScript(name) {
    if (!editorManifest.scripts?.[name]) {
        findings.push(`Missing editor package script: ${name}`);
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        findings.push(`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
    }
}

function assertIncludes(text, needle, message) {
    if (!text.includes(needle)) {
        findings.push(message);
    }
}

function assertNoIncludes(text, needle, message) {
    if (text.includes(needle)) {
        findings.push(message);
    }
}

function assertRootScript(name) {
    if (!rootManifest.scripts?.[name]) {
        findings.push(`Missing root package script: ${name}`);
    }
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
    return readFile(path.join(root, relativePath), 'utf8');
}
