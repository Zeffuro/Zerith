import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '../..');

export function copyProjectPublicFiles(gameDirectory: string, outDirectory: string): void {
    const walk = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (['.dev_docs', '.git', 'node_modules'].includes(entry.name.toLowerCase())) continue;
            const source = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) throw new Error(`Cannot export symbolic link: ${source}`);
            if (entry.isDirectory()) {
                walk(source);
            } else if (entry.isFile()) {
                const relative = path.relative(gameDirectory, source);
                const output = path.join(outDirectory, relative);
                if (relative === 'index.html' || relative === 'zerith.content.json' || relative.startsWith(`zerith-player${path.sep}`)) {
                    throw new Error(`Project file conflicts with player output: ${relative}`);
                }
                mkdirSync(path.dirname(output), { recursive: true });
                copyFileSync(source, output);
            }
        }
    };
    walk(gameDirectory);
}

function resolveConfiguredPath(configuredPath: string | undefined, fallbackPath: string): string {
    if (!configuredPath) {
        return fallbackPath;
    }

    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(workspaceRoot, configuredPath);
}

export default defineConfig(({ command }) => {
    const gameDirectory = resolveConfiguredPath(
        process.env.ZERITH_GAME_DIR,
        path.resolve(workspaceRoot, 'games/classic-vn-starter'),
    );
    const outDirectory = resolveConfiguredPath(
        process.env.ZERITH_OUT_DIR,
        path.resolve(currentDirectory, 'dist'),
    );

    return {
        appType: 'mpa',
        base: process.env.ZERITH_BASE ?? (command === 'build' ? './' : '/'),
        build: {
            emptyOutDir: true,
            outDir: outDirectory,
        },
        plugins: [{
            apply: 'build',
            name: 'zerith-project-files',
            writeBundle: () => copyProjectPublicFiles(gameDirectory, outDirectory),
        }],
        publicDir: command === 'serve' ? gameDirectory : false,
        root: currentDirectory,
        server: {
            port: 5173,
        },
    };
});
