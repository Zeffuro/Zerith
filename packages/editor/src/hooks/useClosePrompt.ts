import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';
import { closeEditorWindow, onEditorWindowCloseRequested } from '../services/runtime/windowControls';
import { closeProject } from '../store/actions/projectOpenActions';
import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';

type CloseIntent = 'project' | 'window';

type UseClosePromptResult = {
    closePromptMessage: string;
    closePromptOpen: boolean;
    isClosingWithSave: boolean;
    onCancelClose: () => void;
    onCloseWithoutSaving: () => Promise<void>;
    onSaveAllAndClose: () => Promise<void>;
};

export function useClosePrompt(): UseClosePromptResult {
    const [closePromptOpen, setClosePromptOpen] = useState(false);
    const [closePromptError, setClosePromptError] = useState<string | undefined>();
    const [closeIntent, setCloseIntent] = useState<CloseIntent>('window');
    const [isClosingWithSave, setIsClosingWithSave] = useState(false);
    const allowCloseBypassReference = useRef(false);
    const isHandlingCloseRequestReference = useRef(false);

    const closeWindowNow = useCallback(async () => {
        allowCloseBypassReference.current = true;

        try {
            await closeEditorWindow();
        } catch (error: unknown) {
            allowCloseBypassReference.current = false;
            const closeMessage = error instanceof Error ? error.message : String(error);
            setClosePromptError(closeMessage);
            setClosePromptOpen(true);
        }
    }, []);

    useEffect(() => {
        if (!isTauriRuntime()) return;

        const unlistenCloseRequested = onEditorWindowCloseRequested((event) => {
            if (allowCloseBypassReference.current) return;

            // Intercept once and decide explicitly so normal close still works.
            event.preventDefault();
            if (isHandlingCloseRequestReference.current) return;
            isHandlingCloseRequestReference.current = true;

            const dirtyCount = useProjectStore.getState().dirtyFiles.size;
            if (dirtyCount === 0) {
                void closeWindowNow();
                return;
            }

            setCloseIntent('window');
            setClosePromptError(undefined);
            setClosePromptOpen(true);
        });

        return () => {
            void unlistenCloseRequested.then((f) => f());
        };
    }, [closeWindowNow]);

    useEffect(() => {
        if (isTauriRuntime()) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (useProjectStore.getState().dirtyFiles.size === 0) return;
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        if (closePromptOpen) return;
        isHandlingCloseRequestReference.current = false;
    }, [closePromptOpen]);

    const clearProjectCloseRequest = useEditorStore((state) => state.clearProjectCloseRequest);
    const isProjectCloseRequested = useEditorStore((state) => state.isProjectCloseRequested);

    useEffect(() => {
        if (!isProjectCloseRequested) return;

        clearProjectCloseRequest();

        const dirtyCount = useProjectStore.getState().dirtyFiles.size;
        if (dirtyCount === 0) {
            closeProject();
            return;
        }

        setCloseIntent('project');
        setClosePromptError(undefined);
        setClosePromptOpen(true);
    }, [clearProjectCloseRequest, isProjectCloseRequested]);

    const closePromptMessage = useMemo(() => {
        const baseMessage = closeIntent === 'project'
            ? 'You have unsaved changes. Save before closing the project?'
            : 'You have unsaved changes. Save before closing?';
        if (!closePromptError) return baseMessage;
        return `${baseMessage}\n\n${closePromptError}`;
    }, [closeIntent, closePromptError]);

    const onCancelClose = useCallback(() => {
        if (isClosingWithSave) return;
        setClosePromptOpen(false);
        setClosePromptError(undefined);
        setCloseIntent('window');
    }, [isClosingWithSave]);

    const onCloseWithoutSaving = useCallback(async () => {
        if (isClosingWithSave) return;

        if (closeIntent === 'project') {
            closeProject();
            setClosePromptOpen(false);
            setClosePromptError(undefined);
            setCloseIntent('window');
            return;
        }

        await closeWindowNow();
    }, [closeIntent, closeWindowNow, isClosingWithSave]);

    const onSaveAllAndClose = useCallback(async () => {
        if (isClosingWithSave) return;

        setClosePromptError(undefined);
        setIsClosingWithSave(true);
        useEditorStore.getState().markManualSave();

        try {
            const saveResult = await useProjectStore.getState().saveAllDirtyFiles();
            const remainingDirty = useProjectStore.getState().dirtyFiles.size;
            if (saveResult.failed.length > 0 || remainingDirty > 0) {
                const failedCount = saveResult.failed.length;
                const unresolvedCount = Math.max(remainingDirty, failedCount);
                setClosePromptError(`Could not save ${unresolvedCount} file(s). Fix errors or choose Don't Save.`);
                return;
            }

            if (closeIntent === 'project') {
                closeProject();
                setClosePromptOpen(false);
                setClosePromptError(undefined);
                setCloseIntent('window');
                return;
            }

            await closeWindowNow();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setClosePromptError(`Save All failed: ${message}`);
        } finally {
            setIsClosingWithSave(false);
        }
    }, [closeIntent, closeWindowNow, isClosingWithSave]);

    return {
        closePromptMessage,
        closePromptOpen,
        isClosingWithSave,
        onCancelClose,
        onCloseWithoutSaving,
        onSaveAllAndClose,
    };
}


