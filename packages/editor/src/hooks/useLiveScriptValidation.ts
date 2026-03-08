import { useEffect } from 'react';
import { ScriptSchema } from 'core/schemas';
import { zodIssuesToMap } from '../utils/validation';
import { useProjectStore } from '../store/useProjectStore';
import type { EditorNode } from '../types/EditorNode';
import { executeValidationResultAction } from '../store/actions/validationActions';

export function useLiveScriptValidation(rootScript: EditorNode[]) {
    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);

    useEffect(() => {
        const t = setTimeout(() => {
            if (editingAllMacrosFile) {
                const merged: Record<string, string[]> = {};

                for (let i = 0; i < macroEntries.length; i++) {
                    const result = ScriptSchema.safeParse(macroEntries[i]?.commands ?? []);
                    if (!result.success) {
                        const mm = zodIssuesToMap(result.error);
                        for (const [k, v] of Object.entries(mm)) {
                            merged[`macro.${i}.${k}`] = v;
                        }
                    }
                }

                executeValidationResultAction(merged);
                return;
            }

            const result = ScriptSchema.safeParse(rootScript);
            executeValidationResultAction(result.success ? {} : zodIssuesToMap(result.error));
        }, 180);

        return () => clearTimeout(t);
    }, [rootScript, editingAllMacrosFile, macroEntries]);
}