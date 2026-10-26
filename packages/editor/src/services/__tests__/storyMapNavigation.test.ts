import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOpenProjectEntryMocks, resetOpenProjectEntryMocks } from '../../test-utils/registerOpenProjectEntryMocks';
import { openJsonEntry } from '../openProjectEntry';

const mocks = getOpenProjectEntryMocks();
vi.mock('../../store/actions/projectOpenActions', () => ({ executeProjectOpenAction: vi.fn() }));

describe('story map source routing hints', () => {
    beforeEach(async () => {
        resetOpenProjectEntryMocks();
        const real = await vi.importActual<typeof import('../projectOpeners')>('../projectOpeners');
        mocks.looksLikeMacrosObject.mockImplementation(real.looksLikeMacrosObject);
        mocks.looksLikeSceneFile.mockImplementation(real.looksLikeSceneFile);
    });

    it('opens a newly referenced scene envelope without schema as a script', async () => {
        const scene = { commands: [{ duration: 1, type: 'wait' }] };
        mocks.fsReadTextFile.mockResolvedValue(JSON.stringify(scene));
        await openJsonEntry('/project/new.json', { forceView: 'timeline', jsonHintKind: 'script', jsonSelectionPath: ['commands', 0] });
        expect(mocks.applyScriptFile).toHaveBeenCalledWith('/project/new.json', scene);
        expect(mocks.applyMacrosFile).not.toHaveBeenCalled();
        expect(mocks.executeWorkbenchOpenAction.mock.calls.at(-1)).toEqual([{ action: 'openTab', tab: {
            id: 'script:/project/new.json', jsonSelectionPath: ['commands', 0], kind: 'script', path: '/project/new.json',
            preferredView: 'timeline', savedTextContent: JSON.stringify(scene), title: 'new.json',
        } }]);
    });

    it('uses the explicit hint for blank newly referenced macros', async () => {
        mocks.fsReadTextFile.mockResolvedValue('');
        await openJsonEntry('/project/new-macros.json', { forceView: 'json', jsonHintKind: 'macros' });
        expect(mocks.applyMacrosFile).toHaveBeenCalledWith('/project/new-macros.json', {});
        expect(mocks.applyScriptFile).not.toHaveBeenCalled();
    });
});
