import { parseSceneFile, validateScript } from '@zeffuro/zerith-core/schemas';

import type { GlobalSearchProjectData, GlobalSearchReplacementFile } from './contracts';

import { isRecord } from '../../utils/typeGuards';
import { serializeMacroEntries, serializeSceneCommands } from '../visualWorkbenchContent';
import { toReplacementFilePayload } from './replacementFiles';

export function replacementModelText(file: GlobalSearchReplacementFile, project: GlobalSearchProjectData): string | undefined {
    return toReplacementFilePayload(file.filePath, project.characters, project.items, project.macros, project.scenes, project)?.content;
}

export function replacementSourceContent(file: GlobalSearchReplacementFile, source: string, modelText: string): string {
    const data: unknown = JSON.parse(source);
    const model: unknown = JSON.parse(modelText);
    const normalized = file.kind === 'scene' ? parseSceneFile(data).commands
        : (file.kind === 'macro' && isRecord(data)
            ? Object.fromEntries(Object.entries(data).filter(([key]) => !key.startsWith('$')).map(([key, value]) => {
                if (!Array.isArray(value)) throw new TypeError('Macros must contain command arrays.');
                return [key, validateScript(value)];
            }))
            : data);
    if (canonicalJson(normalized) !== canonicalJson(model)) {
        throw new Error('Source changed since search. Reopen the file and search again.');
    }
    if (file.kind === 'scene') return serializeSceneCommands(JSON.parse(file.content) as GlobalSearchProjectData['scenes'][string], source);
    if (file.kind === 'macro') {
        const macros = JSON.parse(file.content) as GlobalSearchProjectData['macros'];
        return serializeMacroEntries(Object.entries(macros).map(([name, commands]) => ({ commands, name })), source);
    }
    return file.content;
}

function canonicalJson(value: unknown): string {
    return JSON.stringify(value, (_, entry: unknown) => isRecord(entry)
        ? Object.fromEntries(Object.entries(entry).toSorted(([a], [b]) => a.localeCompare(b)))
        : entry);
}
