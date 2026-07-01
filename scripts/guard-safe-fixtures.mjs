import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const FORBIDDEN_REFERENCES = ['games/test-game', 'test-game'];
const SCAN_TARGETS = ['packages', 'games', 'package.json', 'README.md', '.github'];
const TEXT_EXTENSIONS = new Set([
    '.css',
    '.html',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.rs',
    '.svg',
    '.toml',
    '.ts',
    '.tsx',
    '.txt',
    '.yaml',
    '.yml',
]);

const root = process.cwd();
const findings = [];

for (const target of SCAN_TARGETS) {
    await scanPath(path.join(root, target));
}

if (findings.length > 0) {
    console.error('Unsafe fixture references found. Use games/classic-vn-starter or games/example-game instead.');
    for (const finding of findings) {
        console.error(`${finding.relativePath}:${finding.lineNumber}: ${finding.reference}`);
    }
    process.exitCode = 1;
} else {
    console.log('Safe fixture guard passed: no prohibited sample references found.');
}

async function scanPath(absolutePath) {
    let entry;
    try {
        entry = await stat(absolutePath);
    } catch {
        return;
    }

    if (entry.isDirectory()) {
        const children = await readdir(absolutePath);
        await Promise.all(children.map((child) => scanPath(path.join(absolutePath, child))));
        return;
    }

    if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(absolutePath))) {
        return;
    }

    const text = await readFile(absolutePath, 'utf8');
    const lines = text.split(/\r?\n/u);
    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, '/');

    for (const [index, line] of lines.entries()) {
        for (const reference of FORBIDDEN_REFERENCES) {
            if (line.includes(reference)) {
                findings.push({
                    lineNumber: index + 1,
                    reference,
                    relativePath,
                });
            }
        }
    }
}
