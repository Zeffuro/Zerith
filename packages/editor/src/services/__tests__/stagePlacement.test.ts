import { describe, expect, it } from 'vitest';

import type { EditorNode } from '../../types/EditorNode';

import { moveNode } from '../../utils/scriptPathUtilities';
import { findPlacementTarget, ownsPlacementPath, placementFromCommand, placementInsertionIndex, snappedPosition } from '../stagePlacement';

const baseline = { scaleX: -1, scaleY: 1, x: 640, y: 720, zIndex: 0 };

describe('character placement', () => {
    it('finds the last executed placement command without selecting a later move', () => {
        const script: EditorNode[] = [{ action: 'show', id: 'clerk', type: 'sprite' }, { text: 'Your train is on platform two.', type: 'dialogue' }, { action: 'move', id: 'clerk', type: 'sprite', x: 200 }];
        expect(findPlacementTarget(script, 'clerk', 1)).toEqual([0]);
        expect(findPlacementTarget(script, 'clerk', 2)).toEqual([2]);
        expect(findPlacementTarget(script, 'porter', 2)).toBeUndefined();
    });

    it('allows an explicitly selected nested character command', () => {
        const script: EditorNode[] = [{ options: [{ commands: [{ action: 'show', id: 'clerk', type: 'sprite' }], label: 'Ask about the train' }], type: 'choice' }];
        expect(findPlacementTarget(script, 'clerk', 0, [0, 'options', 0, 'commands', 0])).toEqual([0, 'options', 0, 'commands', 0]);
        expect(findPlacementTarget(script, 'clerk', 0)).toBeUndefined();
    });

    it('does not edit an earlier position that a macro may have replaced', () => {
        const script: EditorNode[] = [{ action: 'show', id: 'clerk', type: 'sprite' }, { name: 'arrange_platform', type: 'call' }, { text: 'The train is late.', type: 'dialogue' }];
        expect(findPlacementTarget(script, 'clerk', 2)).toBeUndefined();
        expect(findPlacementTarget(script, 'clerk', 2, [0])).toEqual([0]);
    });

    it('does not cross a choice that may have placed the character in its branch', () => {
        const script: EditorNode[] = [
            { action: 'show', id: 'clerk', type: 'sprite', x: 200 },
            { options: [{ commands: [{ action: 'move', id: 'clerk', type: 'sprite', x: 800 }], label: 'Board the train' }], type: 'choice' },
            { text: 'The train is leaving.', type: 'dialogue' },
        ];
        expect(findPlacementTarget(script, 'clerk', 1)).toBeUndefined();
        expect(findPlacementTarget(script, 'clerk', 2)).toBeUndefined();
        expect(findPlacementTarget(script, 'clerk', 2, [1, 'options', 0, 'commands', 0])).toEqual([1, 'options', 0, 'commands', 0]);
    });

    it('adds a scene position before the current dialogue and after a completed macro', () => {
        const script: EditorNode[] = [{ name: 'arrange_platform', type: 'call' }, { text: 'The train is late.', type: 'dialogue' }];
        expect(placementInsertionIndex(script, 0)).toBe(1);
        expect(placementInsertionIndex(script, 1)).toBe(1);
        expect(placementInsertionIndex([], 0)).toBe(0);
    });

    it('snaps engine coordinates and keeps anchors within the stage', () => {
        expect(snappedPosition(137, 199, 1280, 720, 16)).toEqual({ x: 144, y: 192 });
        expect(snappedPosition(-40, 1000, 1280, 720, 16)).toEqual({ x: 0, y: 720 });
        expect(snappedPosition(137.3, 199.8, 1280, 720, 0)).toEqual({ x: 137, y: 200 });
    });

    it('restores the original runtime transform when undo removes explicit fields', () => {
        expect(placementFromCommand({ action: 'show', id: 'clerk', type: 'sprite' }, baseline, 1280, 720)).toEqual(baseline);
        expect(placementFromCommand({ action: 'show', id: 'clerk', scaleX: -2, scaleY: 2, type: 'sprite', x: 100, xRatio: 0.5, yRatio: 0.5, zIndex: 3 }, baseline, 1280, 720)).toEqual({ scaleX: -2, scaleY: 2, x: 100, y: 360, zIndex: 3 });
    });

    it('preserves horizontal flip while editing a position', () => {
        expect(placementFromCommand({ action: 'show', flip: true, id: 'clerk', scaleX: 2, type: 'sprite', x: 300 }, baseline, 1280, 720)).toEqual({ ...baseline, scaleX: -2, x: 300 });
        expect(placementFromCommand({ action: 'move', flip: false, id: 'clerk', type: 'sprite', x: 300 }, baseline, 1280, 720)).toEqual({ ...baseline, scaleX: 1, x: 300 });
    });

    it('inherits show flip defaults without applying them to a move', () => {
        expect(placementFromCommand({ action: 'show', id: 'clerk', scaleX: 2, type: 'sprite' }, baseline, 1280, 720, true).scaleX).toBe(-2);
        expect(placementFromCommand({ action: 'show', flip: false, id: 'clerk', scaleX: 2, type: 'sprite' }, baseline, 1280, 720, true).scaleX).toBe(2);
        expect(placementFromCommand({ action: 'move', id: 'clerk', scaleX: 2, type: 'sprite' }, baseline, 1280, 720, true).scaleX).toBe(2);
    });

    it('preserves a negative explicit show scale when flip is disabled', () => {
        expect(placementFromCommand({ action: 'show', flip: false, id: 'clerk', scaleX: -2, type: 'sprite' }, baseline, 1280, 720).scaleX).toBe(-2);
    });

    it('keeps the live fitted scale when moving a ratio-sized character', () => {
        const fitted = { ...baseline, scaleX: -1.8, scaleY: 1.8 };
        expect(placementFromCommand({ action: 'show', fit: 'contain', flip: true, heightRatio: 0.9, id: 'clerk', type: 'sprite', widthRatio: 0.4, x: 500 }, fitted, 1280, 720)).toEqual({ ...fitted, x: 500 });
    });

    it('resolves explicit scale per axis before ratio fitting', () => {
        const fitted = { ...baseline, scaleX: -1.8, scaleY: 1.8 };
        expect(placementFromCommand({ action: 'show', fit: 'stretch', flip: true, heightRatio: 0.9, id: 'clerk', scaleX: 2, type: 'sprite', widthRatio: 0.4 }, fitted, 1280, 720)).toEqual({ ...fitted, scaleX: -2 });
        expect(placementFromCommand({ action: 'show', heightRatio: 0.9, id: 'clerk', scaleY: 2, type: 'sprite' }, fitted, 1280, 720)).toEqual({ ...fitted, scaleY: 2 });
    });

    it('restores fitted scale after undo removes a scale override', () => {
        const fitted = { ...baseline, scaleX: -1.8, scaleY: 1.8 };
        const original = { action: 'show', fit: 'contain', flip: true, heightRatio: 0.9, id: 'clerk', type: 'sprite', widthRatio: 0.4 } as const;
        expect(placementFromCommand({ ...original, heightRatio: undefined, scaleX: -2.5, scaleY: 2.5, widthRatio: undefined }, fitted, 1280, 720)).toEqual({ ...fitted, scaleX: -2.5, scaleY: 2.5 });
        expect(placementFromCommand(original, fitted, 1280, 720)).toEqual(fitted);
    });

    it('rejects a same-character move replacing the selected path after reordering', () => {
        const script: EditorNode[] = [
            { action: 'show', id: 'clerk', type: 'sprite', x: 200 },
            { action: 'move', id: 'clerk', type: 'sprite', x: 800 },
            { action: 'move', id: 'clerk', type: 'sprite', x: 900 },
        ];
        const moved = moveNode(script, [2], [], 0);
        expect(ownsPlacementPath(script, moved, [2])).toBe(false);
        expect(ownsPlacementPath(script, moved, [0])).toBe(false);
    });

    it('keeps ownership across transform edits and their undo and redo snapshots', () => {
        const original: EditorNode[] = [{ action: 'show', id: 'clerk', type: 'sprite', x: 200 }];
        const updated: EditorNode[] = [{ ...original[0], x: 300 }];
        expect(ownsPlacementPath(original, updated, [0])).toBe(true);
        expect(ownsPlacementPath(updated, original, [0])).toBe(true);
        expect(ownsPlacementPath(original, updated, [0])).toBe(true);
    });

    it('rejects insertion shifting the selected command and deletion removing it', () => {
        const original: EditorNode[] = [{ action: 'move', id: 'clerk', type: 'sprite', x: 200 }];
        const inserted: EditorNode[] = [{ action: 'move', id: 'clerk', type: 'sprite', x: 300 }, ...original];
        expect(ownsPlacementPath(original, inserted, [0])).toBe(false);
        expect(ownsPlacementPath(original, [], [0])).toBe(false);
        expect(ownsPlacementPath(original, [...original, { text: 'A new line.', type: 'dialogue' }], [0])).toBe(true);
    });

    it('rejects a selected nested move displaced by a same-character sibling', () => {
        const original: EditorNode[] = [{ options: [{ commands: [
            { action: 'move', id: 'clerk', type: 'sprite', x: 200 },
            { action: 'move', id: 'clerk', type: 'sprite', x: 800 },
        ], label: 'Board the train' }], type: 'choice' }];
        const moved = moveNode(original, [0, 'options', 0, 'commands', 1], [0, 'options', 0, 'commands'], 0);
        expect(ownsPlacementPath(original, moved, [0, 'options', 0, 'commands', 1])).toBe(false);
    });
});
