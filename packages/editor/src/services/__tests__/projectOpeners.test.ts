import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ executeProjectOpenAction: vi.fn() }));
vi.mock('../../store/actions/projectOpenActions', () => mocks);

import { applyMacrosFile } from '../projectOpeners';

describe('visual macro loading', () => {
    beforeEach(() => vi.clearAllMocks());

    it('keeps reserved array metadata out of editable macro entries', () => {
        const greeting = [{ text: 'Greeting', type: 'dialogue' }];
        applyMacrosFile('/macros.json', {
            $custom: { owner: 'author' },
            $schema: 'zerith/macros',
            $tags: [{ text: 'Reserved metadata', type: 'dialogue' }],
            greeting,
        });
        expect(mocks.executeProjectOpenAction).toHaveBeenCalledWith({
            action: 'applyMacrosFile',
            entries: [{ commands: greeting, name: 'greeting' }],
            path: '/macros.json',
        });
    });
});
