import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import corePackage from './package.json' with { type: 'json' };

type PackageManifest = {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
};

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const coreManifest: PackageManifest = corePackage;
const externalDependencies = [
    ...Object.keys(coreManifest.dependencies ?? {}),
    ...Object.keys(coreManifest.peerDependencies ?? {}),
];

export default defineConfig({
    build: {
        emptyOutDir: true,
        lib: {
            entry: {
                'handlers/index': path.resolve(currentDirectory, 'src/handlers/index.ts'),
                index: path.resolve(currentDirectory, 'src/index.ts'),
                'schemas/index': path.resolve(currentDirectory, 'src/schemas/index.ts'),
                'types/index': path.resolve(currentDirectory, 'src/types/index.ts'),
                'utils/Backlog': path.resolve(currentDirectory, 'src/utils/Backlog.ts'),
                'utils/Localization': path.resolve(currentDirectory, 'src/utils/Localization.ts'),
                'utils/StoryGraph': path.resolve(currentDirectory, 'src/utils/StoryGraph.ts'),
            },
            fileName: (_format, entryName) => `${entryName}.js`,
            formats: ['es'],
        },
        outDir: 'dist',
        rollupOptions: {
            external: externalDependencies,
        },
        sourcemap: true,
    },
});
