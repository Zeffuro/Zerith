import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';

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
    const [isClosingWithSave, setIsClosingWithSave] = useState(false);
    const allowCloseBypassReference = useRef(false);
    const isHandlingCloseRequestReference = useRef(false);

    const closeWindowNow = useCallback(async () => {
        allowCloseBypassReference.current = true;
        const appWindow = getCurrentWindow();

        try {
            await appWindow.close();
        } catch (error: unknown) {
            try {
                await appWindow.destroy();
            } catch (destroyError: unknown) {
                allowCloseBypassReference.current = false;
                const closeMessage = error instanceof Error ? error.message : String(error);
                const destroyMessage = destroyError instanceof Error ? destroyError.message : String(destroyError);
                setClosePromptError(`Close failed: ${closeMessage}. Destroy failed: ${destroyMessage}`);
                setClosePromptOpen(true);
            }
        }
    }, []);

    useEffect(() => {
        if (!hasTauriInternals()) return;

        const appWindow = getCurrentWindow();
        const unlistenCloseRequested = appWindow.onCloseRequested((event) => {
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

            setClosePromptError(undefined);
            setClosePromptOpen(true);
        });

        return () => {
            void unlistenCloseRequested.then((f) => f());
        };
    }, [closeWindowNow]);

    useEffect(() => {
        if (closePromptOpen) return;
        isHandlingCloseRequestReference.current = false;
    }, [closePromptOpen]);

    const closePromptMessage = useMemo(() => {
        const baseMessage = 'You have unsaved changes. Save before closing?';
        if (!closePromptError) return baseMessage;
        return `${baseMessage}\n\n${closePromptError}`;
    }, [closePromptError]);

    const onCancelClose = useCallback(() => {
        if (isClosingWithSave) return;
        setClosePromptOpen(false);
        setClosePromptError(undefined);
    }, [isClosingWithSave]);

    const onCloseWithoutSaving = useCallback(async () => {
        if (isClosingWithSave) return;
        await closeWindowNow();
    }, [closeWindowNow, isClosingWithSave]);

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

            await closeWindowNow();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setClosePromptError(`Save All failed: ${message}`);
        } finally {
            setIsClosingWithSave(false);
        }
    }, [closeWindowNow, isClosingWithSave]);

    return {
        closePromptMessage,
        closePromptOpen,
        isClosingWithSave,
        onCancelClose,
        onCloseWithoutSaving,
        onSaveAllAndClose,
    };
}

function hasTauriInternals(): boolean {
    const windowObject = globalThis.window as { __TAURI_INTERNALS__?: unknown } | undefined;
    return windowObject?.__TAURI_INTERNALS__ !== undefined;
}

