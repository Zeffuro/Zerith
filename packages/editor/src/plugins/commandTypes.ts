import { SchemaRegistry } from 'core/schemas';
import { BuiltInCommandTypes } from 'core/types';

import type { EditorCommandType, NonMacroEditorCommandType } from './types';

const MACRO_HEADER_TYPE = 'macro_header';

const registeredEditorCommandTypes = new Set<string>(BuiltInCommandTypes);

export function getRegisteredEditorCommandTypes(): EditorCommandType[] {
    return [...new Set([
        ...BuiltInCommandTypes,
        ...SchemaRegistry.getTypes(),
        ...registeredEditorCommandTypes,
        MACRO_HEADER_TYPE,
    ])] as EditorCommandType[];
}

export function getRegisteredNonMacroEditorCommandTypes(): NonMacroEditorCommandType[] {
    return getRegisteredEditorCommandTypes()
        .filter(isRegisteredNonMacroEditorCommandType);
}

export function isRegisteredEditorCommandType(type: string): type is EditorCommandType {
    return type === MACRO_HEADER_TYPE || isRegisteredNonMacroEditorCommandType(type);
}

export function isRegisteredNonMacroEditorCommandType(type: string): type is NonMacroEditorCommandType {
    return type !== MACRO_HEADER_TYPE
        && (registeredEditorCommandTypes.has(type) || SchemaRegistry.get(type) !== undefined);
}

export function registerEditorCommandType(type: string): NonMacroEditorCommandType {
    const normalizedType = type.trim();
    if (normalizedType.length === 0) {
        throw new TypeError('Command plugin type cannot be empty.');
    }

    if (normalizedType === MACRO_HEADER_TYPE) {
        throw new TypeError('macro_header is reserved for editor macro roots.');
    }

    registeredEditorCommandTypes.add(normalizedType);
    return normalizedType;
}
