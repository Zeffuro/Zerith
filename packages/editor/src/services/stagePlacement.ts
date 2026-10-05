import type { SpriteCommand } from '@zeffuro/zerith-core';

import type { EditorNode } from '../types/EditorNode';
import type { ScriptPath } from '../utils/scriptPathUtilities';

import { getAtPath } from '../utils/scriptPathUtilities';

export type StageTransform = { scaleX: number; scaleY: number; x: number; y: number; zIndex: number };

export function findPlacementTarget(script: EditorNode[], id: string, lastIndex: number, selected?: ScriptPath): ScriptPath | undefined {
    if (selected) {
        const node = getAtPath<EditorNode>(script, selected);
        if (isPlacementCommand(node, id)) return selected;
    }
    for (let index = Math.min(lastIndex, script.length - 1); index >= 0; index--) {
        if (isPlacementCommand(script[index], id)) return [index];
        if (script[index].type === 'call' || script[index].type === 'choice') return;
    }
    return undefined;
}

export function isPlacementCommand(node: EditorNode | undefined, id: string): node is SpriteCommand {
    return node?.type === 'sprite' && 'id' in node && node.id === id && 'action' in node && (node.action === 'show' || node.action === 'move');
}

export function ownsPlacementPath(before: EditorNode[], after: EditorNode[], path: ScriptPath): boolean {
    const original = getAtPath<EditorNode>(before, path);
    const current = getAtPath<EditorNode>(after, path);
    if (!original || !current) return false;
    if (original === current) return true;
    return !containsReference(after, original) && !containsReference(before, current);
}

export function placementFromCommand(command: SpriteCommand, baseline: StageTransform, width: number, height: number, defaultFlip = false): StageTransform {
    let scaleX = command.scaleX ?? baseline.scaleX;
    const flip = command.flip ?? (command.action === 'show' ? defaultFlip : undefined);
    if (flip === true) scaleX = -Math.abs(scaleX);
    else if (command.action === 'move' && command.flip === false) scaleX = Math.abs(scaleX);
    return {
        scaleX,
        scaleY: command.scaleY ?? baseline.scaleY,
        x: command.x ?? (command.xRatio === undefined ? baseline.x : command.xRatio * width),
        y: command.y ?? (command.yRatio === undefined ? baseline.y : command.yRatio * height),
        zIndex: command.zIndex ?? baseline.zIndex,
    };
}

export function placementInsertionIndex(script: EditorNode[], lastIndex: number): number {
    const index = Math.max(0, Math.min(lastIndex, script.length - 1));
    const command = script[index];
    return command?.type === 'dialogue' || command?.type === 'choice' ? index : Math.min(script.length, index + 1);
}

export function snappedPosition(x: number, y: number, width: number, height: number, grid: number): { x: number; y: number } {
    const snap = (value: number, maximum: number) => Math.max(0, Math.min(maximum, grid > 0 ? Math.round(value / grid) * grid : Math.round(value)));
    return { x: snap(x, width), y: snap(y, height) };
}

function containsReference(root: unknown, target: object): boolean {
    const pending = [root];
    const seen = new Set<object>();
    while (pending.length > 0) {
        const value = pending.pop();
        if (value === target) return true;
        if (!value || typeof value !== 'object' || seen.has(value)) continue;
        seen.add(value);
        pending.push(...Object.values(value as Record<string, unknown>));
    }
    return false;
}
