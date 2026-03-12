import { describe, expect, it } from 'vitest';

import {
    getAtPath,
    insertNodeAtPath,
    moveNode,
    removeNodeAtPath,
    setAtPath,
} from '../scriptPathUtilities';

describe('scriptPathUtilities', () => {
    it('getAtPath reads nested object and array values', () => {
        const root = {
            scene: {
                commands: [{ text: 'first' }, { text: 'second' }],
            },
        };

        expect(getAtPath(root, ['scene', 'commands', 1, 'text'])).toBe('second');
        expect(getAtPath(root, ['scene', 'missing'])).toBeUndefined();
    });

    it('setAtPath creates missing object and array containers', () => {
        const next = setAtPath(undefined as unknown, ['macros', 0, 'name'], 'intro');

        expect(next).toEqual({
            macros: [{ name: 'intro' }],
        });
    });

    it('insertNodeAtPath inserts into the target array index', () => {
        const root = {
            commands: [{ id: 'a' }, { id: 'c' }],
        };

        const next = insertNodeAtPath(root.commands, [], 1, { id: 'b' });

        expect(next).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    });

    it('removeNodeAtPath returns the removed node and updated root', () => {
        const root = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

        const [next, removed] = removeNodeAtPath(root, [1]);

        expect(removed).toEqual({ id: 'b' });
        expect(next).toEqual([{ id: 'a' }, { id: 'c' }]);
    });

    it('moveNode adjusts index when moving forward in the same array', () => {
        const root = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

        const next = moveNode(root, [1], [], 3);

        expect(next).toEqual([{ id: 'a' }, { id: 'c' }, { id: 'b' }, { id: 'd' }]);
    });

    it('moveNode supports cross-parent moves for nested arrays', () => {
        const root = [
            { body: [{ id: 'l0' }, { id: 'l1' }] },
            { body: [{ id: 'r0' }] },
        ];

        const next = moveNode(root, [0, 'body', 1], [1, 'body'], 'end');

        expect(next).toEqual([
            { body: [{ id: 'l0' }] },
            { body: [{ id: 'r0' }, { id: 'l1' }] },
        ]);
    });
});

