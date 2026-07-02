import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const requested = process.argv.slice(2).find((argument) => !argument.startsWith('--'));

if (!requested) {
    printUsage();
    process.exit(1);
}

const corePackagePath = 'packages/core/package.json';
const playerPackagePath = 'packages/player/package.json';
const lockfilePath = 'package-lock.json';

const corePackage = await readJson(corePackagePath);
const playerPackage = await readJson(playerPackagePath);
const lockfile = await readJson(lockfilePath);

const currentCoreVersion = corePackage.version;
const currentPlayerVersion = playerPackage.version;
const nextVersion = resolveNextVersion(currentCoreVersion, requested);
const nextCoreRange = `^${nextVersion}`;

corePackage.version = nextVersion;
playerPackage.version = nextVersion;
playerPackage.dependencies ??= {};
playerPackage.dependencies[corePackage.name] = nextCoreRange;

updateLockfilePackage(lockfile, 'packages/core', {
    version: nextVersion,
});
updateLockfilePackage(lockfile, 'packages/player', {
    dependencies: {
        ...lockfile.packages?.['packages/player']?.dependencies,
        [corePackage.name]: nextCoreRange,
    },
    version: nextVersion,
});

const writes = [
    [corePackagePath, `${JSON.stringify(corePackage, undefined, 2)}\n`],
    [playerPackagePath, `${JSON.stringify(playerPackage, undefined, 2)}\n`],
    [lockfilePath, `${JSON.stringify(lockfile, undefined, 2)}\n`],
];

if (!dryRun) {
    for (const [relativePath, content] of writes) {
        await writeFile(path.join(root, relativePath), content, 'utf8');
    }
}

console.log(`${dryRun ? 'Would bump' : 'Bumped'} ${corePackage.name} from ${currentCoreVersion} to ${nextVersion}.`);
console.log(`${dryRun ? 'Would bump' : 'Bumped'} ${playerPackage.name} from ${currentPlayerVersion} to ${nextVersion}.`);
console.log(`${playerPackage.name} dependency: ${corePackage.name}@${nextCoreRange}`);
console.log(`Publish order: ${corePackage.name} first, then ${playerPackage.name}.`);

function bumpVersion(version, part) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
    if (!match) {
        throw new Error(`Cannot ${part}-bump non-stable SemVer version: ${version}`);
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);

    if (part === 'major') return `${major + 1}.0.0`;
    if (part === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

function printUsage() {
    console.error('Usage: npm run version:npm -- <patch|minor|major|x.y.z> [--dry-run]');
}

async function readJson(relativePath) {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function resolveNextVersion(currentVersion, requested_) {
    if (['major', 'minor', 'patch'].includes(requested_)) {
        return bumpVersion(currentVersion, requested_);
    }

    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(requested_)) {
        throw new Error(`Invalid version or bump type: ${requested_}`);
    }

    return requested_;
}

function updateLockfilePackage(lockfile_, packagePath, values) {
    if (!lockfile_.packages?.[packagePath]) {
        throw new Error(`Could not find ${packagePath} in ${lockfilePath}.`);
    }

    Object.assign(lockfile_.packages[packagePath], values);
}
