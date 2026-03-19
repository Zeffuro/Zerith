import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type {
    InferredVariableType,
    ReferenceLocation,
    ReferenceScannerResult,
} from './types';

import { isRecord } from '../../utils/typeGuards';
import { normalizeAssetReference } from './assets';
import { getCommandFieldHints } from './schemaHints';
import {
    extractTemplateVariables,
    mergeInferredType,
    pushVariableRead,
    pushVariableWrite,
} from './variables';

export function scanCommandReferences(
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

            const normalizedAssetPath = normalizeAssetReference(value);
            if (normalizedAssetPath) {
                pushListReference(result.assetFiles, normalizedAssetPath, location);
            }
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


