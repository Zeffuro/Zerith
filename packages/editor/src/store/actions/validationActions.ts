import { useEditorStore } from '../useEditorStore';

export function executeValidationResultAction(errors: Record<string, string[]>): void {
    const editor = useEditorStore.getState();
    if (Object.keys(errors).length === 0) {
        editor.clearValidationErrors();
    } else {
        editor.setValidationErrors(errors);
    }
}

