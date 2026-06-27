import { describe, expect, it, vi } from 'vitest';

import {
    createMissingCallMacro,
    resolveMissingCallMacroPlan,
} from '../timelineGraphMacroCreation';

describe('timelineGraphMacroCreation', () => {
    it('plans file-backed missing macro target creation', () => {
        expect(resolveMissingCallMacroPlan({
            macroName: ' setup_scene ',
            manifest: { macros: 'data/macros.json' },
            projectPath: '/project',
        })).toEqual({
            macroName: 'setup_scene',
            macrosDirectory: '/project/data',
            macrosPath: '/project/data/macros.json',
            status: 'ready',
        });

        expect(resolveMissingCallMacroPlan({
            macroName: 'setup_scene',
            manifest: { macros: { known: [] } },
            projectPath: '/project',
        })).toEqual({
            message: 'Macro call target creation requires a file-backed manifest macros path.',
            status: 'blocked',
        });
    });

    it('creates a no-op macro stub in the manifest-backed macros file', async () => {
        const mkdir = vi.fn(() => Promise.resolve());
        const openProjectEntry = vi.fn(() => Promise.resolve());
        const readTextFile = vi.fn(() => Promise.resolve(JSON.stringify({
            known: [{ duration: 100, type: 'wait' }],
        })));
        const reloadManifest = vi.fn(() => Promise.resolve());
        const writeTextFile = vi.fn<(_path: string, _content: string) => Promise<void>>(() => Promise.resolve());

        await expect(createMissingCallMacro({
            macroName: 'setup_scene',
            manifest: { macros: 'data/macros.json' },
            projectPath: '/project',
        }, {
            mkdir,
            openProjectEntry,
            readTextFile,
            reloadManifest,
            writeTextFile,
        })).resolves.toEqual({
            macroName: 'setup_scene',
            macrosPath: '/project/data/macros.json',
            status: 'created',
        });

        expect(mkdir).toHaveBeenCalledWith('/project/data', true);
        expect(writeTextFile).toHaveBeenCalledWith(
            '/project/data/macros.json',
            expect.stringContaining('"setup_scene"'),
        );
        expect(writeTextFile.mock.calls[0]?.[1]).toContain('"type": "label"');
        expect(reloadManifest).toHaveBeenCalledTimes(1);
        expect(openProjectEntry).toHaveBeenCalledWith('/project/data/macros.json', 'macros.json', { forceView: 'timeline' });
    });

    it('opens existing macro bundles without rewriting them', async () => {
        const openProjectEntry = vi.fn(() => Promise.resolve());
        const writeTextFile = vi.fn<(_path: string, _content: string) => Promise<void>>(() => Promise.resolve());

        await expect(createMissingCallMacro({
            macroName: 'known',
            manifest: { macros: 'data/macros.json' },
            projectPath: '/project',
        }, {
            openProjectEntry,
            readTextFile: vi.fn(() => Promise.resolve(JSON.stringify({ known: [] }))),
            writeTextFile,
        })).resolves.toEqual({
            macroName: 'known',
            macrosPath: '/project/data/macros.json',
            status: 'exists',
        });

        expect(writeTextFile).not.toHaveBeenCalled();
        expect(openProjectEntry).toHaveBeenCalledWith('/project/data/macros.json', 'macros.json', { forceView: 'timeline' });
    });

    it('blocks creation when the macros file is dirty', async () => {
        await expect(createMissingCallMacro({
            dirtyFiles: new Set(['/project/data/macros.json']),
            macroName: 'setup_scene',
            manifest: { macros: 'data/macros.json' },
            projectPath: '/project',
        })).resolves.toEqual({
            message: 'Save the macros file before creating macro call targets.',
            status: 'blocked',
        });
    });
});
