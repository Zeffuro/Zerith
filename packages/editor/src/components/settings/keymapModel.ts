import type { GlobalShortcutCommand, KeymapDisplayBinding, KeymapOverrides } from '../../services/keymapRegistry';

import { normalizeShortcutChord } from '../../services/shortcutChord';

export type ConflictNavigationDirection = 'next' | 'previous';

export type KeymapConflictEntry = {
    actions: GlobalShortcutCommand[];
    shortcut: string;
};

export type KeymapRow = {
    action: GlobalShortcutCommand;
    conflictsWith: GlobalShortcutCommand[];
    defaultShortcut: string;
    effectiveShortcut: string;
    isCustomized: boolean;
};

export function buildConflictActionSequence(rows: readonly KeymapRow[]): GlobalShortcutCommand[] {
    const actions: GlobalShortcutCommand[] = [];
    const seen = new Set<GlobalShortcutCommand>();

    for (const row of rows) {
        if (row.conflictsWith.length === 0) continue;
        if (seen.has(row.action)) continue;

        seen.add(row.action);
        actions.push(row.action);
    }

    return actions;
}

export function buildEffectiveKeymapRows(
    bindings: readonly KeymapDisplayBinding[],
    overrides: KeymapOverrides,
): KeymapRow[] {
    const rows = bindings.map((binding) => {
        const effectiveShortcut = overrides[binding.action] ?? binding.defaultShortcut;
        return {
            action: binding.action,
            conflictsWith: [],
            defaultShortcut: binding.defaultShortcut,
            effectiveShortcut,
            isCustomized: effectiveShortcut !== binding.defaultShortcut,
        } satisfies KeymapRow;
    });

    const byShortcut = new Map<string, GlobalShortcutCommand[]>();
    for (const row of rows) {
        const actions = byShortcut.get(row.effectiveShortcut) ?? [];
        actions.push(row.action);
        byShortcut.set(row.effectiveShortcut, actions);
    }

    return rows.map((row) => {
        const conflicts = (byShortcut.get(row.effectiveShortcut) ?? []).filter((action) => action !== row.action);
        return {
            ...row,
            conflictsWith: conflicts,
        };
    });
}

export function buildKeymapConflictEntries(rows: readonly KeymapRow[]): KeymapConflictEntry[] {
    const byShortcut = new Map<string, GlobalShortcutCommand[]>();

    for (const row of rows) {
        const actions = byShortcut.get(row.effectiveShortcut) ?? [];
        actions.push(row.action);
        byShortcut.set(row.effectiveShortcut, actions);
    }

    const entries: KeymapConflictEntry[] = [];

    for (const [shortcut, actions] of byShortcut.entries()) {
        if (actions.length <= 1) continue;
        entries.push({ actions, shortcut });
    }

    return entries;
}

export function filterKeymapBindings(
    bindings: readonly KeymapDisplayBinding[],
    overrides: KeymapOverrides,
    rawQuery: string,
): KeymapDisplayBinding[] {
    const query = rawQuery.trim().toLowerCase();
    if (query.length === 0) return [...bindings];

    return bindings.filter((binding) => {
        const effectiveShortcut = overrides[binding.action] ?? binding.defaultShortcut;
        const actionLabel = binding.action.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

        return actionLabel.includes(query)
            || binding.action.toLowerCase().includes(query)
            || binding.defaultShortcut.toLowerCase().includes(query)
            || effectiveShortcut.toLowerCase().includes(query);
    });
}

export function filterKeymapRows(rows: readonly KeymapRow[], rawQuery: string, showCustomizedOnly: boolean): KeymapRow[] {
    const query = rawQuery.trim().toLowerCase();

    return rows.filter((row) => {
        if (showCustomizedOnly && !row.isCustomized) return false;
        if (query.length === 0) return true;

        const actionLabel = row.action.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
        return actionLabel.includes(query)
            || row.action.toLowerCase().includes(query)
            || row.defaultShortcut.toLowerCase().includes(query)
            || row.effectiveShortcut.toLowerCase().includes(query);
    });
}

export function normalizeShortcutToken(rawValue: string): string | undefined {
    return normalizeShortcutChord(rawValue);
}

export function resolveAllKeymapConflicts(
    bindings: readonly KeymapDisplayBinding[],
    overrides: KeymapOverrides,
): KeymapOverrides {
    const rows = buildEffectiveKeymapRows(bindings, overrides);
    const byShortcut = new Map<string, GlobalShortcutCommand[]>();

    for (const row of rows) {
        const actions = byShortcut.get(row.effectiveShortcut) ?? [];
        actions.push(row.action);
        byShortcut.set(row.effectiveShortcut, actions);
    }

    const nextOverrides: KeymapOverrides = { ...overrides };

    for (const actions of byShortcut.values()) {
        if (actions.length <= 1) continue;

        for (const action of actions.slice(1)) {
            if (nextOverrides[action]) {
                delete nextOverrides[action];
            }
        }
    }

    return nextOverrides;
}

export function resolveConflictsForAction(
    bindings: readonly KeymapDisplayBinding[],
    overrides: KeymapOverrides,
    action: GlobalShortcutCommand,
): KeymapOverrides {
    const rows = buildEffectiveKeymapRows(bindings, overrides);
    const target = rows.find((row) => row.action === action);
    if (!target || target.conflictsWith.length === 0) return { ...overrides };

    const nextOverrides: KeymapOverrides = { ...overrides };

    for (const conflictingAction of target.conflictsWith) {
        if (nextOverrides[conflictingAction]) {
            delete nextOverrides[conflictingAction];
        }
    }

    return nextOverrides;
}

export function setKeymapOverride(
    currentOverrides: KeymapOverrides,
    action: GlobalShortcutCommand,
    rawValue: string,
): KeymapOverrides {
    const normalized = normalizeShortcutToken(rawValue);
    const nextOverrides: KeymapOverrides = { ...currentOverrides };

    if (!normalized) {
        delete nextOverrides[action];
        return nextOverrides;
    }

    nextOverrides[action] = normalized;
    return nextOverrides;
}

export function stepConflictAction(
    actions: readonly GlobalShortcutCommand[],
    current: GlobalShortcutCommand | undefined,
    direction: ConflictNavigationDirection,
): GlobalShortcutCommand | undefined {
    if (actions.length === 0) return;

    const currentIndex = current ? actions.indexOf(current) : -1;
    if (currentIndex < 0) {
        return direction === 'previous' ? actions.at(-1) : actions[0];
    }

    const nextIndex = direction === 'previous'
        ? (currentIndex - 1 + actions.length) % actions.length
        : (currentIndex + 1) % actions.length;
    return actions[nextIndex];
}

