import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from './components/ConfirmDialog';
import { DockLayoutHost } from './components/layout/DockLayoutHost';
import './App.css';
import { useAutosave } from './hooks/useAutosave';
import { useGlobalEditorShortcuts } from './hooks/useGlobalEditorShortcuts';
import { useLiveScriptValidation } from './hooks/useLiveScriptValidation';
import { useReferenceScanner } from './hooks/useReferenceScanner';
import { useScriptDirtyTracking } from './hooks/useScriptDirtyTracking';
import { setupConsoleInterceptor } from './services/consoleInterceptor';
import { useEditorStore } from './store/useEditorStore';
import { useProjectStore } from './store/useProjectStore';
import { useScriptStore } from './store/useScriptStore';
import { applyTheme } from './theme/applyTheme';
import { getThemeRegistry } from './theme/themeRegistry';

function App() {
    const { themeKey, uiScale } = useEditorStore();
    const rootScript = useScriptStore((state) => state.rootScript);
    const [closePromptOpen, setClosePromptOpen] = useState(false);
    const [closePromptError, setClosePromptError] = useState<string | undefined>();
    const [isClosingWithSave, setIsClosingWithSave] = useState(false);
    const allowCloseBypassReference = useRef(false);
    const isHandlingCloseRequestReference = useRef(false);

    useGlobalEditorShortcuts();
    useLiveScriptValidation(rootScript);
    useAutosave();
    useReferenceScanner();
    useScriptDirtyTracking();

    useEffect(() => {
        return setupConsoleInterceptor();
    }, []);

    useEffect(() => {
        if (!hasTauriInternals()) return;

        const appWindow = getCurrentWindow();
        const { setWindowState, windowState } = useEditorStore.getState();
        const restoredWindowState = sanitizeRestoredWindowState(windowState);

        if (windowState && !restoredWindowState) {
            setWindowState(undefined);
        }

        if (restoredWindowState) {
            void appWindow.setSize(new PhysicalSize(restoredWindowState.width, restoredWindowState.height));
            void appWindow.setPosition(new PhysicalPosition(restoredWindowState.x, restoredWindowState.y));
            if (restoredWindowState.maximized) void appWindow.maximize();
        }

        const saveState = async () => {
            const size = await appWindow.innerSize();
            const pos = await appWindow.outerPosition();
            const max = await appWindow.isMaximized();

            setWindowState({ height: size.height, maximized: max, width: size.width, x: pos.x, y: pos.y });
        };

        const onEvent = () => { void saveState(); };

        const unlistenMove = appWindow.listen('tauri://move', onEvent);
        const unlistenResize = appWindow.listen('tauri://resize', onEvent);
        window.addEventListener('beforeunload', onEvent);

        return () => {
            void unlistenMove.then((f) => f());
            void unlistenResize.then((f) => f());
            window.removeEventListener('beforeunload', onEvent);
        };
    }, []);

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

    const handleCancelClose = useCallback(() => {
        if (isClosingWithSave) return;
        setClosePromptOpen(false);
        setClosePromptError(undefined);
    }, [isClosingWithSave]);

    const handleCloseWithoutSaving = useCallback(async () => {
        if (isClosingWithSave) return;
        await closeWindowNow();
    }, [closeWindowNow, isClosingWithSave]);

    const handleSaveAllAndClose = useCallback(async () => {
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

    useEffect(() => {
        const themes = getThemeRegistry();
        const selected = themes.find((t) => t.key === themeKey) ?? themes.find((t) => t.key === 'classic') ?? themes[0];
        if (selected) applyTheme(selected);
    }, [themeKey]);

    return (
        <div style={{ '--ui-scale': uiScale, inset: 0, overflow: 'hidden', position: 'fixed' } as CSSProperties}>
            <DockLayoutHost />
            <ConfirmDialog
                cancelText="Cancel"
                confirmText={isClosingWithSave ? 'Saving...' : 'Save All'}
                extraActionDanger
                extraActionText="Don't Save"
                message={closePromptMessage}
                onCancel={handleCancelClose}
                onConfirm={() => { void handleSaveAllAndClose(); }}
                onExtraAction={() => { void handleCloseWithoutSaving(); }}
                open={closePromptOpen}
                title="Unsaved changes"
            />
        </div>
    );
}

export default App;

function hasTauriInternals(): boolean {
    const windowObject = globalThis.window as { __TAURI_INTERNALS__?: unknown } | undefined;
    return windowObject?.__TAURI_INTERNALS__ !== undefined;
}

function sanitizeRestoredWindowState(value: ReturnType<typeof useEditorStore.getState>['windowState']) {
    if (!value) return;

    const isFinitePosition = Number.isFinite(value.x) && Number.isFinite(value.y);
    const isFiniteSize = Number.isFinite(value.width) && Number.isFinite(value.height);
    const hasMinimumSize = value.width >= 420 && value.height >= 320;
    if (!isFinitePosition || !isFiniteSize || !hasMinimumSize) return;

    return value;
}

