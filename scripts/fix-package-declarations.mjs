import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targetDirectory = process.argv[2];

if (!targetDirectory) {
    console.error('Usage: node scripts/fix-package-declarations.mjs <dist-directory>');
    process.exit(1);
}

const absoluteTargetDirectory = path.resolve(root, targetDirectory);
const declarationFiles = await collectDeclarationFiles(absoluteTargetDirectory);

for (const filePath of declarationFiles) {
    const original = await readFile(filePath, 'utf8');
    const next = original
        .replaceAll(/(\bfrom\s+['"])(\.{1,2}\/[^'"]+)(['"])/gu, (_match, prefix, specifier, suffix) => (
            `${prefix}${resolveDeclarationSpecifier(filePath, specifier)}${suffix}`
        ))
        .replaceAll(/(\bimport\(['"])(\.{1,2}\/?[^'"]*)(['"]\))/gu, (_match, prefix, specifier, suffix) => (
            `${prefix}${resolveDeclarationSpecifier(filePath, specifier)}${suffix}`
        ));

    if (next !== original) {
        await writeFile(filePath, next);
    }
}

console.log(`Fixed declaration import specifiers in ${declarationFiles.length} files.`);

async function collectDeclarationFiles(directory) {
    const output = [];
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
        const childPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            output.push(...await collectDeclarationFiles(childPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.d.ts')) {
            output.push(childPath);
        }
    }

    return output;
}

function hasKnownExtension(specifier) {
    return /\.[cm]?[jt]sx?$/u.test(specifier) || /\.json$/u.test(specifier);
}

function resolveDeclarationSpecifier(filePath, specifier) {
    if (!specifier.startsWith('.') || hasKnownExtension(specifier)) return specifier;

    const basePath = path.resolve(path.dirname(filePath), specifier);
    if (fileExistsSync(`${basePath}.d.ts`)) return `${specifier}.js`;
    if (fileExistsSync(path.join(basePath, 'index.d.ts'))) return `${specifier.replace(/\/?$/u, '/')}index.js`;

    return specifier;
}

function fileExistsSync(filePath) {
    return existsSync(filePath);
}
