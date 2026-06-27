import { afterEach, describe, expect, it, vi } from 'vitest';

import { chooseProjectOpenTarget, confirmEditorAction, registerEditorDialogHandlers } from '../editorDialogs';

let unregister: (() => void) | undefined;

describe('editorDialogs', () => {
    afterEach(() => {
        unregister?.();
        unregister = undefined;
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('fails closed without falling through to native confirmation APIs', async () => {
        const confirm = vi.fn(() => true);
        vi.stubGlobal('confirm', confirm);
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const accepted = await confirmEditorAction({
            message: 'Apply migration?',
            title: 'Migrate Content Schema',
        });

        expect(accepted).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
    });

    it('routes confirmation and project-open choices through registered handlers', async () => {
        const confirm = vi.fn(() => Promise.resolve(true));
        const chooseProjectOpenTargetHandler = vi.fn(() => Promise.resolve<'new-window'>('new-window'));
        unregister = registerEditorDialogHandlers({
            chooseProjectOpenTarget: chooseProjectOpenTargetHandler,
            confirm,
        });

        await expect(confirmEditorAction({ message: 'Open here?' })).resolves.toBe(true);
        await expect(chooseProjectOpenTarget({
            dirtyCount: 1,
            nextProjectPath: '/next',
        })).resolves.toBe('new-window');

        expect(confirm).toHaveBeenCalledWith({ message: 'Open here?' });
        expect(chooseProjectOpenTargetHandler).toHaveBeenCalledWith({
            dirtyCount: 1,
            nextProjectPath: '/next',
        });
    });
});
