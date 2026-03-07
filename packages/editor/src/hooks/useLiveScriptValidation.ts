import { useEffect } from 'react';
import { ScriptSchema } from 'core';
import { zodIssuesToMap } from '../utils/validation';
import { useEditorStore } from '../store/useEditorStore';

export function useLiveScriptValidation(rootScript: any[]) {
    useEffect(() => {
        const t = setTimeout(() => {
            const result = ScriptSchema.safeParse(rootScript);
            if (result.success) {
                useEditorStore.getState().clearValidationErrors();
            } else {
                useEditorStore.getState().setValidationErrors(zodIssuesToMap(result.error));
            }
        }, 180);

        return () => clearTimeout(t);
    }, [rootScript]);
}