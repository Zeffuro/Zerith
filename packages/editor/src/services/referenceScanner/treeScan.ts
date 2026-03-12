import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { ReferenceScannerResult } from '../referenceScanner';

import { isRecord } from '../../utils/typeGuards';
import { scanCommandReferences } from './commandScan';

type ScanCommandFn = (
    command: Record<string, unknown>,
    commandType: string,
    path: ScriptPath,
    filePath: string,
    sceneName: string,
    result: ReferenceScannerResult,
) => void;

export function scanReferenceTree(
    value: unknown,
    path: ScriptPath,
    filePath: string,
    sceneName: string,
    result: ReferenceScannerResult,
    scanCommand: ScanCommandFn = scanCommandReferences,
): void {
    if (Array.isArray(value)) {
        for (const [index, entry] of value.entries()) {
            scanReferenceTree(entry, [...path, index], filePath, sceneName, result, scanCommand);
        }
        return;
    }

    if (!isRecord(value)) return;

    const commandType = typeof value.type === 'string' ? value.type : undefined;
    if (commandType) {
        scanCommand(value, commandType, path, filePath, sceneName, result);
    }

    for (const [key, entry] of Object.entries(value)) {
        scanReferenceTree(entry, [...path, key], filePath, sceneName, result, scanCommand);
    }
}


