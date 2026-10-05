import { describe, expect, it, vi } from 'vitest';

import type { DialogueCommand } from '../../handlers/DialogueHandler';

import { createFlowManagerHarness, flushAsync } from '../../test-utils/flowManagerHarness';
import { waitCommand } from '../../test-utils/scriptBuilders';
import { createDefaultSystemState } from '../../types';
import { SaveManager } from '../SaveManager';

async function settle() {
    for (let index = 0; index < 8; index++) await flushAsync();
}

describe('dialogue save points', () => {
    it.each([false, true])('saves and reopens the active line when autoNext is %s', async (autoNext) => {
        const dialogue: DialogueCommand = { speaker: 'Narrator', text: 'Current line.', type: 'dialogue' };
        const context = createFlowManagerHarness([waitCommand(), waitCommand(), dialogue, waitCommand()]);
        let finish!: () => void;
        const pending = new Promise<void>(resolve => { finish = resolve; });
        let system = createDefaultSystemState();
        const execute = vi.fn((command: DialogueCommand) => {
            system.dialogue = { speaker: command.speaker, text: command.text };
            return Promise.resolve();
        }).mockImplementationOnce(command => {
            system.dialogue = { speaker: command.speaker, text: command.text };
            return pending;
        });
        const handler = { autoNext, execute, type: 'dialogue' as const };
        context.flow.registerHandler(handler);
        const storage = new Map<string, string>();
        const saves = new SaveManager({
            getCurrentSceneName: () => context.scenes.currentSceneName,
            getLastSavePoint: () => context.flow.lastSavePoint,
            getStateSnapshot: () => ({}),
            getSystemSnapshot: () => system,
            logInfo: vi.fn(),
            logWarn: vi.fn(),
            serializeItems: () => [],
        }, {
            getItem: key => storage.get(key),
            removeItem: key => { storage.delete(key); },
            setItem: (key, value) => { storage.set(key, value); },
        });
        context.flow.start();
        await settle();
        expect(context.execute).toHaveBeenCalledTimes(2);
        expect(execute).toHaveBeenCalledTimes(1);
        const release = context.flow.acquireSuspension();
        saves.save(1);
        const saved = await saves.load(1);
        expect(saved?.index).toBe(2);
        expect(saved?.system.dialogue).toEqual({ speaker: 'Narrator', text: 'Current line.' });
        if (!saved) throw new Error('Expected a readable save.');

        context.flow.stop();
        system = saved.system;
        context.scenes.currentIndex = saved.index;
        handler.autoNext = false;
        context.flow.start();
        finish();
        release();
        await settle();
        expect(execute).toHaveBeenCalledTimes(2);
        expect(execute).toHaveBeenLastCalledWith(dialogue);
        expect(context.execute).toHaveBeenCalledTimes(2);
        expect(context.scenes.currentIndex).toBe(3);
        context.flow.destroy();
    });
});
