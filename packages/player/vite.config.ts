import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '../..');

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
        base: process.env.ZERITH_BASE ?? (command === 'build' ? './' : '/'),
        build: {
            emptyOutDir: true,
            outDir: outDirectory,
        },
        publicDir: gameDirectory,
        root: currentDirectory,
        server: {
            port: 5173,
        },
    };
});
