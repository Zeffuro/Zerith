import type { ComponentType } from 'react';

import { Gamepad2 } from 'lucide-react';

import type { CommandPlugin, EditorCommandType, PluginInspectorProperties } from '../types';

import { toRecordOrUndefined } from '../../utils/typeGuards';

export type CommandPluginOverrides = Partial<Record<EditorCommandType, Partial<CommandPlugin>>>;

export const FALLBACK_ICON = (size: number) => <Gamepad2 color="#94a3b8" size={size} />;

export const titleCase = (value: string) => value.replaceAll('_', ' ').replaceAll(/\b\w/g, (char) => char.toUpperCase());

export const asRecord = toRecordOrUndefined;

export function asInspector<TProperties>(
    component: ComponentType<TProperties>
): ComponentType<PluginInspectorProperties> {
    return component as unknown as ComponentType<PluginInspectorProperties>;
}

export function readArray<T = unknown>(node: unknown, key: string): T[] {
    const value = asRecord(node)?.[key];
    return Array.isArray(value) ? (value as T[]) : [];
}

export function readNumber(node: unknown, key: string, fallback: number): number {
    const value = asRecord(node)?.[key];
    return typeof value === 'number' ? value : fallback;
}

export function readString(node: unknown, key: string, fallback = ''): string {
    const value = asRecord(node)?.[key];
    return typeof value === 'string' ? value : fallback;
}

