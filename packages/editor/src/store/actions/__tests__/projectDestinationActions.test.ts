import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewProjectOptions } from '../../../services/createNewProject';
import type { SaveProjectAsOptions } from '../../../services/saveProjectAs';

import './projectOpenActions.test-utilities';
import { createAndOpenNewProject, saveAndOpenProjectAs } from '../projectDestinationActions';
import { resetProjectOpenMocks, serviceMocks, storeMocks } from './projectOpenActions.test-utilities';

const output = { initialEntryPath: '/copy/scenes/intro.json', manifestPath: '/copy/game.json', projectPath: '/copy' };
const mocks = vi.hoisted(() => ({
    copy: vi.fn<(path: string, options: SaveProjectAsOptions) => Promise<unknown>>(),
    create: vi.fn<(options: NewProjectOptions) => Promise<unknown>>(),
}));
vi.mock('../../../services/createNewProject', () => ({ createNewProject: mocks.create }));
vi.mock('../../../services/saveProjectAs', () => ({ saveProjectAs: mocks.copy }));

function create() {
    return createAndOpenNewProject({ author: '', directory: '/copy', name: 'Copy' });
}

describe('project destination actions', () => {
    beforeEach(() => {
        resetProjectOpenMocks();
        storeMocks.projectState.projectPath = '/current';
        mocks.create.mockReset().mockResolvedValue(output);
        mocks.copy.mockReset().mockImplementation(async (_path, options) => {
            await options.beforeCopy?.();
            return output;
        });
    });


    it('cancels New Project before saving, creating or opening anything', async () => {
        serviceMocks.confirmEditorAction.mockResolvedValueOnce(false);
        expect(await create()).toBeUndefined();
        expect(mocks.create).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
    });

    it('cancels Save As before source saving or opening', async () => {
        mocks.copy.mockImplementationOnce(() => Promise.resolve());
        expect(await saveAndOpenProjectAs()).toBeUndefined();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
    });

    it.each(['create', 'copy'] as const)('stops %s after failed or skipped source save', async kind => {
        storeMocks.projectState.saveAllDirtyFiles.mockResolvedValueOnce({ failed: ['intro.json'], saved: [], skipped: ['config.json'] });
        await expect(kind === 'create' ? create() : saveAndOpenProjectAs()).rejects.toThrow('Source save did not complete');
        expect(mocks.create).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
    });

    it.each(['create', 'copy'] as const)('stops %s when same project is reopened while saving', async kind => {
        storeMocks.projectState.saveAllDirtyFiles.mockImplementationOnce(() => {
            storeMocks.projectState.projectGeneration += 1;
            return Promise.resolve({ failed: [], saved: [], skipped: [] });
        });
        await expect(kind === 'create' ? create() : saveAndOpenProjectAs()).rejects.toThrow('changed');
        expect(mocks.create).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
    });

    it('stops a stale New Project confirmation before source save', async () => {
        serviceMocks.confirmEditorAction.mockImplementationOnce(() => {
            storeMocks.projectState.projectGeneration += 1;
            return Promise.resolve(true);
        });
        await expect(create()).rejects.toThrow('changed');
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('keeps edits that arrive during copying and does not open stale copy', async () => {
        mocks.copy.mockImplementationOnce(async (_path, options) => {
            await options.beforeCopy?.();
            storeMocks.projectState.dirtyFiles.add('/current/intro.json');
            expect(options.isCurrent?.()).toBe(false);
            return output;
        });
        await expect(saveAndOpenProjectAs()).rejects.toThrow('Project output remains at /copy');
        expect(storeMocks.projectState.dirtyFiles.has('/current/intro.json')).toBe(true);
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
    });

    it('reports completed output and preserves current project after open failure', async () => {
        serviceMocks.stageProject.mockRejectedValueOnce(new Error('Invalid manifest'));
        await expect(create()).rejects.toThrow('Project created at /copy');
        expect(storeMocks.projectState.projectPath).toBe('/current');
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
    });

    it('carries cancellation ownership into deferred project open', async () => {
        let current = true;
        serviceMocks.stageProject.mockImplementationOnce(() => {
            current = false;
            return Promise.resolve({ files: [], manifestData: { title: 'Prepared' }, manifestPath: '/copy/game.json', projectRoot: '/copy' });
        });
        await expect(createAndOpenNewProject({ author: '', directory: '/copy', isCurrent: () => current, name: 'Copy' })).rejects.toThrow('could not be opened');
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
    });
});
