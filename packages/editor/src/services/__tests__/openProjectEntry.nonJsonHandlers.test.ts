import { beforeEach, describe, expect, it } from 'vitest';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
    setOpenProjectEntryState,
} from '../../test-utils/registerOpenProjectEntryMocks';
import { openAssetEntry, openTextEntry, openUnknownEntry } from '../openProjectEntry/index';

const openProjectEntryMocks = getOpenProjectEntryMocks();

describe('openProjectEntry nonJsonHandlers', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('opens an asset tab using project-relative asset selection', () => {
        setOpenProjectEntryState({ projectPath: '/project' });

        openAssetEntry('/project/assets/bg/courtroom.png');

        expect(openProjectEntryMocks.applyAssetSelection).toHaveBeenCalledWith('/assets/bg/courtroom.png');
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                assetPath: '/assets/bg/courtroom.png',
                id: 'asset:/project/assets/bg/courtroom.png',
                kind: 'asset',
                path: '/project/assets/bg/courtroom.png',
                title: 'courtroom.png',
            },
        });
    });

    it('opens a text tab with file content', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('notes');

        await openTextEntry('/project/notes.txt');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'text:/project/notes.txt',
                kind: 'text',
                path: '/project/notes.txt',
                textContent: 'notes',
                title: 'notes.txt',
            },
        });
    });

    it('opens unknown tabs and logs a warning', () => {
        openUnknownEntry('/project/data.bin');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'unknown:/project/data.bin',
                kind: 'unknown',
                path: '/project/data.bin',
                title: 'data.bin',
            },
        });
        expect(openProjectEntryMocks.executeConsoleMessageAction).toHaveBeenCalledWith(
            'editor',
            'warn',
            'No handler for file type yet:',
            '/project/data.bin',
        );
    });
});

