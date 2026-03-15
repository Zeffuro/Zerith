import { describe, expect, it } from 'vitest';

import {
    buildConflictActionSequence,
    buildEffectiveKeymapRows,
    buildKeymapConflictEntries,
    filterKeymapBindings,
    filterKeymapRows,
    normalizeShortcutToken,
    resolveAllKeymapConflicts,
    resolveConflictsForAction,
    setKeymapOverride,
    stepConflictAction,
} from '../keymapModel';

describe('keymapModel', () => {
    it('normalizes shortcut tokens', () => {
        expect(normalizeShortcutToken('  K  ')).toBe('k');
        expect(normalizeShortcutToken('Ctrl + Shift + K')).toBe('mod+shift+k');
        expect(normalizeShortcutToken('')).toBeUndefined();
        expect(normalizeShortcutToken('   ')).toBeUndefined();
    });

    it('sets and removes action overrides', () => {
        const withSave = setKeymapOverride({}, 'save', ' K ');
        expect(withSave).toEqual({ save: 'k' });

        const withoutSave = setKeymapOverride(withSave, 'save', '   ');
        expect(withoutSave).toEqual({});
    });

    it('preserves unrelated overrides', () => {
        const overrides = { saveAll: 's' };
        const next = setKeymapOverride(overrides, 'save', 'k');

        expect(next).toEqual({ save: 'k', saveAll: 's' });
    });

    it('filters keymap rows by action label and effective shortcut', () => {
        const bindings = [
            { action: 'save', defaultShortcut: 'mod+s', key: 's' },
            { action: 'openGlobalSearchFind', defaultShortcut: 'mod+shift+f', key: 'f' },
        ] as const;

        const byLabel = filterKeymapBindings(bindings, {}, 'search find');
        expect(byLabel).toEqual([bindings[1]]);

        const byOverride = filterKeymapBindings(bindings, { save: 'mod+k' }, 'mod+k');
        expect(byOverride).toEqual([bindings[0]]);
    });

    it('builds effective rows with conflict metadata', () => {
        const rows = buildEffectiveKeymapRows(
            [
                { action: 'save', defaultShortcut: 'mod+s', key: 's' },
                { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
            ],
            { save: 'mod+k', saveAll: 'mod+k' },
        );

        expect(rows[0]?.conflictsWith).toEqual(['saveAll']);
        expect(rows[1]?.conflictsWith).toEqual(['save']);
        expect(rows[0]?.isCustomized).toBe(true);
    });

    it('detects conflicts between a customized row and another row default shortcut', () => {
        const rows = buildEffectiveKeymapRows(
            [
                { action: 'save', defaultShortcut: 'mod+s', key: 's' },
                { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
            ],
            { saveAll: 'mod+s' },
        );

        const conflicts = buildKeymapConflictEntries(rows);
        expect(conflicts).toEqual([{ actions: ['save', 'saveAll'], shortcut: 'mod+s' }]);
    });

    it('filters rows by query and customized-only toggle', () => {
        const rows = buildEffectiveKeymapRows(
            [
                { action: 'save', defaultShortcut: 'mod+s', key: 's' },
                { action: 'openGlobalSearchFind', defaultShortcut: 'mod+shift+f', key: 'f' },
            ],
            { save: 'mod+k' },
        );

        const customized = filterKeymapRows(rows, '', true);
        expect(customized.map((row) => row.action)).toEqual(['save']);

        const searched = filterKeymapRows(rows, 'search find', false);
        expect(searched.map((row) => row.action)).toEqual(['openGlobalSearchFind']);
    });

    it('resolves conflicts by clearing conflicting overrides except the selected action', () => {
        const bindings = [
            { action: 'save', defaultShortcut: 'mod+s', key: 's' },
            { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
            { action: 'openGlobalSearchFind', defaultShortcut: 'mod+shift+f', key: 'f' },
        ] as const;

        const next = resolveConflictsForAction(
            bindings,
            { openGlobalSearchFind: 'mod+shift+f', save: 'mod+k', saveAll: 'mod+k' },
            'save',
        );

        expect(next).toEqual({
            openGlobalSearchFind: 'mod+shift+f',
            save: 'mod+k',
        });
    });

    it('resolves conflicts by clearing only customized conflicting rows when one row is at default', () => {
        const bindings = [
            { action: 'save', defaultShortcut: 'mod+s', key: 's' },
            { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
        ] as const;

        const next = resolveConflictsForAction(
            bindings,
            { save: 'mod+shift+s' },
            'saveAll',
        );

        expect(next).toEqual({});
    });

    it('recalculates conflict state after restoring one row back to default', () => {
        const bindings = [
            { action: 'save', defaultShortcut: 'mod+s', key: 's' },
            { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
        ] as const;

        const withConflict = { save: 'mod+k', saveAll: 'mod+k' };
        const restoredSaveAll = setKeymapOverride(withConflict, 'saveAll', '');
        const rows = buildEffectiveKeymapRows(bindings, restoredSaveAll);

        expect(restoredSaveAll).toEqual({ save: 'mod+k' });
        expect(rows.every((row) => row.conflictsWith.length === 0)).toBe(true);
    });

    it('resolves all conflicts by keeping the first action per shortcut', () => {
        const bindings = [
            { action: 'save', defaultShortcut: 'mod+s', key: 's' },
            { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
            { action: 'openGlobalSearchFind', defaultShortcut: 'mod+shift+f', key: 'f' },
            { action: 'openGlobalSearchReplace', defaultShortcut: 'mod+shift+g', key: 'g' },
        ] as const;

        const next = resolveAllKeymapConflicts(
            bindings,
            {
                openGlobalSearchFind: 'mod+k',
                openGlobalSearchReplace: 'mod+k',
                save: 'mod+k',
                saveAll: 'mod+k',
            },
        );

        expect(next).toEqual({
            save: 'mod+k',
        });
    });

    it('does not mutate overrides when resolving all conflicts', () => {
        const bindings = [
            { action: 'save', defaultShortcut: 'mod+s', key: 's' },
            { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
        ] as const;
        const overrides = { save: 'mod+k', saveAll: 'mod+k' };

        const next = resolveAllKeymapConflicts(bindings, overrides);

        expect(next).toEqual({ save: 'mod+k' });
        expect(overrides).toEqual({ save: 'mod+k', saveAll: 'mod+k' });
    });

    it('returns a cloned override map when conflict resolution is unnecessary', () => {
        const bindings = [
            { action: 'save', defaultShortcut: 'mod+s', key: 's' },
            { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
        ] as const;
        const overrides = { save: 'mod+k' };

        const next = resolveConflictsForAction(bindings, overrides, 'saveAll');

        expect(next).toEqual(overrides);
        expect(next).not.toBe(overrides);
    });

    it('builds conflict action sequence in row order and steps with wrap-around', () => {
        const rows = buildEffectiveKeymapRows(
            [
                { action: 'save', defaultShortcut: 'mod+s', key: 's' },
                { action: 'saveAll', defaultShortcut: 'mod+shift+s', key: 's' },
                { action: 'openGlobalSearchFind', defaultShortcut: 'mod+shift+f', key: 'f' },
            ],
            { save: 'mod+k', saveAll: 'mod+k' },
        );

        const sequence = buildConflictActionSequence(rows);
        expect(sequence).toEqual(['save', 'saveAll']);
        expect(stepConflictAction(sequence, undefined, 'next')).toBe('save');
        expect(stepConflictAction(sequence, undefined, 'previous')).toBe('saveAll');
        expect(stepConflictAction(sequence, 'save', 'next')).toBe('saveAll');
        expect(stepConflictAction(sequence, 'saveAll', 'next')).toBe('save');
        expect(stepConflictAction(sequence, 'save', 'previous')).toBe('saveAll');
        expect(stepConflictAction(sequence, 'redo', 'next')).toBe('save');
    });
});
