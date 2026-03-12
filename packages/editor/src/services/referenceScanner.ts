import { SchemaRegistry } from 'core/schemas';
import { z } from 'zod';

import type { ScriptPath } from '../utils/scriptPathUtilities';
import type { GlobalSearchProjectData } from './globalSearch';

import { useProjectStore } from '../store/useProjectStore';

export type InferredVariableType = 'boolean' | 'mixed' | 'number' | 'string' | 'unknown';

export type ReferenceLocation = {
    commandType: string;
    filePath: string;
    path: ScriptPath;
    sceneName: string;
};

export type ReferenceScannerResult = {
    assets: Record<string, ReferenceLocation[]>;
    characters: Record<string, ReferenceLocation[]>;
    variables: Record<string, VariableReferenceStats>;
};

export type VariableReferenceStats = {
    inferredType: InferredVariableType;
    reads: ReferenceLocation[];
    writes: ReferenceLocation[];
};

type CommandFieldHints = {
    assetFields: string[];
    keyFields: string[];
    speakerFields: string[];
};

export function scanReferences(
    projectData: GlobalSearchProjectData = useProjectStore.getState(),
): ReferenceScannerResult {
    const result: ReferenceScannerResult = {
        assets: {},
        characters: {},
        variables: {},
    };

    const { macros, manifest, projectPath, scenes } = projectData;
    if (!projectPath) return result;

    const manifestRecord = toRecord(manifest);
    const sceneSources = toRecord(manifestRecord.scenes);
    for (const [sceneName, script] of Object.entries(scenes)) {
        if (!Array.isArray(script)) continue;

        const filePath = resolveScenePath(projectPath, sceneName, sceneSources);
        if (!filePath) continue;

        scanTree(script, [], filePath, sceneName, result);
    }

    const macrosSource = manifestRecord.macros;
    const macrosFilePath = resolveFilePath(projectPath, typeof macrosSource === 'string' ? macrosSource : undefined);
    const macroNames = Object.keys(macros).toSorted((a, b) => a.localeCompare(b));
    for (const [macroIndex, macroName] of macroNames.entries()) {
        const script = macros[macroName];
        if (!Array.isArray(script)) continue;
        scanTree(script, [macroIndex, 'body'], macrosFilePath, `macro:${macroName}`, result);
    }

    return result;
}

function extractTemplateVariables(value: string): string[] {
    const matches = value.matchAll(/\{([a-zA-Z_]\w*)}/g);
    const names: string[] = [];
    for (const match of matches) {
        const name = match[1];
        if (name) names.push(name);
    }
    return [...new Set(names)];
}

function getCommandFieldHints(commandType: string): CommandFieldHints {
    const schema = SchemaRegistry.get(commandType);
    const objectSchema = schema ? unwrapObjectSchema(schema) : undefined;
    if (!objectSchema) {
        return { assetFields: [], keyFields: [], speakerFields: [] };
    }

    const shape = objectSchema.shape;
    const keys = Object.keys(shape);
    const assetFields = keys.filter((key) => /asset(url)?/i.test(key));
    const keyFields = keys.filter((key) => key === 'key' || key.endsWith('Key'));
    const speakerFields = keys.filter((key) => key === 'speaker');
    return { assetFields, keyFields, speakerFields };
}

function inferVariableTypeFromSet(command: Record<string, unknown>): InferredVariableType {
    const op = typeof command.op === 'string' ? command.op : undefined;
    if (op === 'toggle') return 'boolean';
    if (op === 'add' || op === 'sub') return 'number';

    const value = command.value;
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    return 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeInferredType(
    variables: Record<string, VariableReferenceStats>,
    variableName: string,
    inferredType: InferredVariableType,
): void {
    if (!variables[variableName]) {
        variables[variableName] = { inferredType, reads: [], writes: [] };
        return;
    }

    const current = variables[variableName].inferredType;
    if (current === 'unknown') {
        variables[variableName].inferredType = inferredType;
        return;
    }

    if (inferredType === 'unknown' || current === inferredType) {
        return;
    }

    variables[variableName].inferredType = 'mixed';
}

function pushListReference(
    map: Record<string, ReferenceLocation[]>,
    name: string,
    location: ReferenceLocation,
): void {
    if (!map[name]) {
        map[name] = [];
    }
    map[name].push(location);
}

function pushVariableRead(
    variables: Record<string, VariableReferenceStats>,
    variableName: string,
    location: ReferenceLocation,
): void {
    if (!variables[variableName]) {
        variables[variableName] = { inferredType: 'unknown', reads: [], writes: [] };
    }
    variables[variableName].reads.push(location);
}

function pushVariableWrite(
    variables: Record<string, VariableReferenceStats>,
    variableName: string,
    location: ReferenceLocation,
): void {
    if (!variables[variableName]) {
        variables[variableName] = { inferredType: 'unknown', reads: [], writes: [] };
    }
    variables[variableName].writes.push(location);
}

function resolveFilePath(projectPath: string, manifestPath: string | undefined): string {
    if (!manifestPath) return `${projectPath}/game.json`;
    if (manifestPath.startsWith('/') || manifestPath.startsWith('\\')) {
        return `${projectPath}${manifestPath}`;
    }
    return `${projectPath}/${manifestPath}`;
}

function resolveScenePath(
    projectPath: string,
    sceneName: string,
    sceneSources: Record<string, unknown>,
): string | undefined {
    if (!(sceneName in sceneSources)) return undefined;
    const source = sceneSources[sceneName];

    if (typeof source === 'string') {
        return resolveFilePath(projectPath, source);
    }

    return `${projectPath}/game.json`;
}

function scanCommand(
    command: Record<string, unknown>,
    commandType: string,
    path: ScriptPath,
    filePath: string,
    sceneName: string,
    result: ReferenceScannerResult,
): void {
    const location: ReferenceLocation = { commandType, filePath, path, sceneName };
    const hints = getCommandFieldHints(commandType);

    for (const field of hints.assetFields) {
        const value = command[field];
        if (typeof value === 'string' && value) {
            pushListReference(result.assets, value, location);
        }
    }

    for (const field of hints.speakerFields) {
        const value = command[field];
        if (typeof value === 'string' && value) {
            pushListReference(result.characters, value, location);
        }
    }

    const commandKey = typeof command.key === 'string' ? command.key : undefined;
    if (commandType === 'set' && commandKey) {
        pushVariableWrite(result.variables, commandKey, location);
        mergeInferredType(result.variables, commandKey, inferVariableTypeFromSet(command));
    }

    if (commandType === 'if' || commandType === 'while') {
        if (commandKey) {
            pushVariableRead(result.variables, commandKey, location);
        }

        const allConditions = Array.isArray(command.all) ? command.all : [];
        const anyConditions = Array.isArray(command.any) ? command.any : [];
        for (const condition of allConditions) {
            if (!isRecord(condition)) continue;
            if (typeof condition.key === 'string' && condition.key) {
                pushVariableRead(result.variables, condition.key, location);
            }
            if (typeof condition.source === 'string' && condition.source) {
                pushVariableRead(result.variables, condition.source, location);
            }
        }

        for (const condition of anyConditions) {
            if (!isRecord(condition)) continue;
            if (typeof condition.key === 'string' && condition.key) {
                pushVariableRead(result.variables, condition.key, location);
            }
            if (typeof condition.source === 'string' && condition.source) {
                pushVariableRead(result.variables, condition.source, location);
            }
        }
    }

    if (commandType === 'dialogue' && typeof command.text === 'string') {
        for (const variableName of extractTemplateVariables(command.text)) {
            pushVariableRead(result.variables, variableName, location);
        }
    }

    if (commandType !== 'set') {
        for (const field of hints.keyFields) {
            const value = command[field];
            if (typeof value === 'string' && value) {
                pushVariableRead(result.variables, value, location);
            }
        }
    }
}

function scanTree(
    value: unknown,
    path: ScriptPath,
    filePath: string,
    sceneName: string,
    result: ReferenceScannerResult,
): void {
    if (Array.isArray(value)) {
        for (const [index, entry] of value.entries()) {
            scanTree(entry, [...path, index], filePath, sceneName, result);
        }
        return;
    }

    if (!isRecord(value)) return;

    const commandType = typeof value.type === 'string' ? value.type : undefined;
    if (commandType) {
        scanCommand(value, commandType, path, filePath, sceneName, result);
    }

    for (const [key, entry] of Object.entries(value)) {
        scanTree(entry, [...path, key], filePath, sceneName, result);
    }
}

function toRecord(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) return {};
    return value;
}

function unwrapObjectSchema(
    schema: z.ZodTypeAny,
): undefined | z.ZodObject<z.ZodRawShape> {
    let current = schema;

    while (true) {
        if (current instanceof z.ZodObject) {
            return current;
        }

        if (
            current instanceof z.ZodDefault
            || current instanceof z.ZodOptional
            || current instanceof z.ZodNullable
            || current instanceof z.ZodReadonly
        ) {
            current = current.unwrap() as z.ZodTypeAny;
            continue;
        }

        return undefined;
    }
}

