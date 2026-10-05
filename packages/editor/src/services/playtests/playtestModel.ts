import type { Serializable } from '@zeffuro/zerith-core';

export type PlaytestDocument = { scenarios: PlaytestScenario[]; version: 1 };

export type PlaytestScenario = {
    choices: number[];
    expectedScene?: string;
    expectedState: Record<string, Serializable>;
    id: string;
    index: number;
    inventory: string[];
    locale?: string;
    name: string;
    scene: string;
    state: Record<string, Serializable>;
};

export function checkPlaytestResult(scenario: PlaytestScenario, scene: string, state: Record<string, Serializable>): string[] {
    const failures: string[] = [];
    if (scenario.expectedScene && scenario.expectedScene !== scene) failures.push(`Expected scene ${scenario.expectedScene}, reached ${scene}.`);
    for (const [key, expected] of Object.entries(scenario.expectedState)) {
        if (!equalJson(expected, state[key])) failures.push(`Variable ${key} does not match the expected value.`);
    }
    if (!scenario.expectedScene && Object.keys(scenario.expectedState).length === 0) failures.push('Add an expected scene or variable before checking results.');
    return failures;
}

export function parsePlaytestDocument(text: string): PlaytestDocument {
    if (text.length > 1_000_000) throw new Error('Playtest file is too large.');
    const document: unknown = JSON.parse(text);
    if (!isRecord(document) || document.version !== 1 || !Array.isArray(document.scenarios) || document.scenarios.length > 64) {
        throw new Error('Invalid playtest file.');
    }
    const scenarios = document.scenarios.map(value => parsePlaytestScenario(value));
    if (new Set(scenarios.map(scenario => scenario.id)).size !== scenarios.length) throw new Error('Duplicate playtest ID.');
    return { scenarios, version: 1 };
}

export function parsePlaytestScenario(value: unknown): PlaytestScenario {
    if (!isRecord(value) || !isName(value.id) || !isName(value.name) || !isName(value.scene)
        || !Number.isSafeInteger(value.index) || Number(value.index) < 0
        || !Array.isArray(value.inventory) || value.inventory.length > 256 || !value.inventory.every(isName)
        || new Set(value.inventory).size !== value.inventory.length
        || !Array.isArray(value.choices) || value.choices.length > 512 || !value.choices.every(index => Number.isSafeInteger(index) && Number(index) >= 0)
        || (value.locale !== undefined && !isName(value.locale)) || (value.expectedScene !== undefined && !isName(value.expectedScene))) {
        throw new Error('Invalid playtest scenario.');
    }
    return {
        choices: value.choices as number[],
        expectedScene: value.expectedScene,
        expectedState: parsePlaytestState(value.expectedState),
        id: value.id,
        index: Number(value.index),
        inventory: value.inventory,
        locale: value.locale,
        name: value.name,
        scene: value.scene,
        state: parsePlaytestState(value.state),
    };
}

export function parsePlaytestState(value: unknown): Record<string, Serializable> {
    if (!isRecord(value) || !isSerializable(value, 0)) throw new Error('Variables must be a JSON object with ordinary keys.');
    return structuredClone(value) as Record<string, Serializable>;
}

function equalJson(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equalJson(value, right[index]));
    if (!isRecord(left) || !isRecord(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equalJson(left[key], right[key]));
}

function isName(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSerializable(value: unknown, depth: number): boolean {
    if (depth > 32) return false;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(child => isSerializable(child, depth + 1));
    return isRecord(value) && Object.entries(value).every(([key, child]) => !['__proto__', 'constructor', 'prototype'].includes(key) && isSerializable(child, depth + 1));
}
