import { ScriptSchema } from '@zeffuro/zerith-core/schemas';
import { useEffect } from 'react';

import type { EditorNode } from '../types/EditorNode';

import { executeValidationResultAction } from '../store/actions/validationActions';
import { useProjectStore } from '../store/storeBootstrap';
import { zodIssuesToMap } from '../utils/validation';

export function useLiveScriptValidation(rootScript: EditorNode[]) {
    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);

    useEffect(() => {
        if (!editingAllMacrosFile) return;

        const t = setTimeout(() => {
            const merged: Record<string, string[]> = {};

            for (const [index, macroEntry] of macroEntries.entries()) {
                const result = ScriptSchema.safeParse(macroEntry?.commands ?? []);
                if (!result.success) {
                    const mm = zodIssuesToMap(result.error);
                    for (const [k, v] of Object.entries(mm)) {
                        merged[`macro.${index}.${k}`] = v;
                    }
                }
            }

            executeValidationResultAction(merged);
        }, 180);

        return () => clearTimeout(t);
    }, [editingAllMacrosFile, macroEntries]);

    useEffect(() => {
        if (editingAllMacrosFile) return;

        const t = setTimeout(() => {
            const result = ScriptSchema.safeParse(rootScript);
            executeValidationResultAction(result.success ? {} : zodIssuesToMap(result.error));
        }, 180);

        return () => clearTimeout(t);
    }, [editingAllMacrosFile, rootScript]);
}