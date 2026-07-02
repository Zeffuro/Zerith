import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputPath = readCliValue('--out') ?? '.release-checksums/SHA256SUMS.txt';
const bundleRoot = readCliValue('--bundleDir') ?? 'packages/editor/src-tauri/target';

const files = (await findReleaseArtifactFiles(path.join(root, bundleRoot)))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));

if (files.length === 0) {
    throw new Error(`No release artifact files found under ${bundleRoot}`);
}

const lines = [];
for (const file of files) {
    lines.push(`${await sha256(file)}  ${path.basename(file)}`);
}

const absoluteOutputPath = path.join(root, outputPath);
await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
await writeFile(absoluteOutputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${files.length} checksums to ${outputPath}`);

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
