import { describe, expect, it } from 'vitest';

import { createSliceHarness } from '../../../test-utils/createSliceHarness';
import {
    type ObserverSnapshot,
    parseDraftObject,
    parseDraftValue,
    snapshotSignature,
    toItemDraftRow,
    toItemPayload,
} from '../stateObserverModel';

describe('stateObserverModel', () => {
    it('parses draft values and rejects invalid JSON', () => {
        expect(parseDraftValue('{"score":42}')).toEqual({ score: 42 });
        expect(parseDraftValue('"ready"')).toBe('ready');
        expect(parseDraftValue('{invalid}')).toBeUndefined();
    });

    it('accepts only JSON objects for item custom data', () => {
        expect(parseDraftObject('{"flag":true}')).toEqual({ flag: true });
        expect(parseDraftObject('[1,2,3]')).toBeUndefined();
        expect(parseDraftObject('"nope"')).toBeUndefined();
    });

    it('creates item draft rows from runtime inventory entries', () => {
        const row = toItemDraftRow(
            {
                description: 'Defense attorney badge',
                id: 'badge',
                imageUrl: '/badge.png',
                name: 'Attorney Badge',
                rarity: 'legendary',
                type: 'evidence',
            },
            'row-1'
        );

        expect(row).toEqual({
            customJson: '{"rarity":"legendary"}',
            description: 'Defense attorney badge',
            id: 'row-1',
            imageUrl: '/badge.png',
            itemId: 'badge',
            name: 'Attorney Badge',
            type: 'evidence',
        });
    });

    it('builds normalized payloads for inventory updates', () => {
        const payload = toItemPayload({
            customJson: '{"rarity":"legendary"}',
            description: 'Description',
            id: 'row-4',
            imageUrl: '  ',
            itemId: 'badge',
            name: 'Attorney Badge',
            type: 'profile',
        });

        expect(payload).toEqual({
            description: 'Description',
            imageUrl: undefined,
            name: 'Attorney Badge',
            rarity: 'legendary',
            type: 'profile',
        });
    });

    it('tracks snapshot signatures with shared slice harness state', () => {
        const harness = createSliceHarness<{ snapshot: ObserverSnapshot }>({
            snapshot: { items: [], state: { score: 1 } },
        });

        const first = snapshotSignature(harness.get().snapshot);
        harness.setState({ snapshot: { items: [], state: { score: 2 } } });
        const second = snapshotSignature(harness.get().snapshot);

        expect(first).not.toBe(second);
    });
});

