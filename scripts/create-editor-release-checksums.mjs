import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputPath = readCliValue('--out') ?? '.release-checksums/SHA256SUMS.txt';
const bundleRoot = readCliValue('--bundleDir') ?? 'packages/editor/src-tauri/target';
const releaseTag = readCliValue('--release-tag');
const releaseAssets = releaseTag ? await readReleaseAssets(releaseTag) : undefined;

const files = (await findReleaseArtifactFiles(path.join(root, bundleRoot)))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));

if (files.length === 0) {
    throw new Error(`No release artifact files found under ${bundleRoot}`);
}

const lines = [];
for (const file of files) {
    const hash = await sha256(file);
    const matches = releaseAssets?.filter((asset) => asset.digest === `sha256:${hash}` && asset.state === 'uploaded');
    if (matches && (matches.length !== 1 || !isSafeAssetName(matches[0].name))) {
        throw new Error(`Expected one uploaded release asset matching ${path.basename(file)}.`);
    }
    lines.push(`${hash}  ${matches?.[0].name ?? path.basename(file)}`);
}

const absoluteOutputPath = path.join(root, outputPath);
await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
await writeFile(absoluteOutputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${files.length} checksums to ${outputPath}`);

function isSafeAssetName(name) {
    return typeof name === 'string' && name.length > 0 && name !== '.' && name !== '..'
        && name === path.basename(name) && !/[\\/\u0000-\u001F\u007F]/u.test(name);
}

async function readReleaseAssets(tag) {
    const repository = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (!repository || !token) throw new Error('Release asset naming requires GITHUB_REPOSITORY and GITHUB_TOKEN.');
    for (let page = 1; ; page += 1) {
        const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
        if (!response.ok) throw new Error(`Release asset lookup failed (${response.status}).`);
        const releases = await response.json();
        if (!Array.isArray(releases)) throw new Error('Invalid release list response.');
        const release = releases.find((entry) => entry.tag_name === tag);
        if (release) {
            if (!Array.isArray(release.assets)) throw new Error('Invalid release asset response.');
            return release.assets;
        }
        if (releases.length < 100) throw new Error(`Release ${tag} was not found.`);
    }
}

async function findReleaseArtifactFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files_ = [];

    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files_.push(...await findReleaseArtifactFiles(absolutePath));
            continue;
        }

        if (entry.isFile() && isReleaseArtifactFile(absolutePath)) {
            files_.push(absolutePath);
        }
    }

    return files_;
}

function isReleaseArtifactFile(filePath) {
    const normalized = filePath.replaceAll(path.sep, '/');
    if (!normalized.includes('/bundle/')) return false;

    const name = path.basename(filePath);
    return /\.(?:AppImage|deb|dmg|exe|msi|rpm|sig|zip)$/u.test(name)
        || /\.app\.tar\.gz$/u.test(name);
}

function readCliValue(name) {
    const index = process.argv.indexOf(name);
    if (index === -1) return undefined;
    return process.argv[index + 1];
}

async function sha256(filePath) {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error(`Cannot checksum non-file path: ${filePath}`);

    const hash = createHash('sha256');
    await new Promise((resolve, reject) => {
        createReadStream(filePath)
            .on('data', (chunk) => hash.update(chunk))
            .on('error', reject)
            .on('end', resolve);
    });
    return hash.digest('hex');
}
