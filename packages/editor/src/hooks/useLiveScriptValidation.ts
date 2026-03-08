import { useEffect } from 'react';
import { ScriptSchema } from 'core/schemas';
import { zodIssuesToMap } from '../utils/validation';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';

export function useLiveScriptValidation(rootScript: any[]) {
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

                if (Object.keys(merged).length === 0) useEditorStore.getState().clearValidationErrors();
                else useEditorStore.getState().setValidationErrors(merged);
                return;
            }

            const result = ScriptSchema.safeParse(rootScript);
            if (result.success) useEditorStore.getState().clearValidationErrors();
            else useEditorStore.getState().setValidationErrors(zodIssuesToMap(result.error));
        }, 180);

        return () => clearTimeout(t);
    }, [rootScript, editingAllMacrosFile, macroEntries]);
}