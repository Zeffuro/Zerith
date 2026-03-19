import { type CSSProperties, useEffect } from 'react';

import { ConfirmDialog } from './components/ConfirmDialog';
import { SpritesheetAutoSliceDialog } from './components/editors/SpritesheetAutoSliceDialog';
import { ExportGameModal } from './components/export/ExportGameModal';
import { DockLayoutHost } from './components/layout/DockLayoutHost';
import { NewProjectModal } from './components/project/NewProjectModal';
import { SettingsModal } from './components/settings/SettingsModal';
import './App.css';
import { useAutosave } from './hooks/useAutosave';
import { useAutoSliceDialog } from './hooks/useAutoSliceDialog';
import { useClosePrompt } from './hooks/useClosePrompt';
import { useGlobalEditorShortcuts } from './hooks/useGlobalEditorShortcuts';
import { useLiveScriptValidation } from './hooks/useLiveScriptValidation';
import { useProjectFileWatcher } from './hooks/useProjectFileWatcher';
import { useReferenceScanner } from './hooks/useReferenceScanner';
import { useScriptDirtyTracking } from './hooks/useScriptDirtyTracking';
import { useWindowStateRestore } from './hooks/useWindowStateRestore';
import { setupConsoleInterceptor } from './services/consoleInterceptor';
import { useScriptStore } from './store/storeBootstrap';
import { useSettingsStore } from './store/useSettingsStore';
import { applyTheme } from './theme/applyTheme';
import { getThemeRegistry } from './theme/themeRegistry';
import { getSheetDescriptorPath } from './utils/assetDescriptorUtilities';

function App() {
    const customThemes = useSettingsStore((state) => state.customThemes);
    const themeKey = useSettingsStore((state) => state.themeKey);
    const uiScale = useSettingsStore((state) => state.uiScale);
    const rootScript = useScriptStore((state) => state.rootScript);

    const {
        autoSliceImage,
        finalizeAutoSlice,
        handleAutoSliceCreate,
        pendingAutoSlice,
    } = useAutoSliceDialog();
    const {
        closePromptMessage,
        closePromptOpen,
        isClosingWithSave,
        onCancelClose,
        onCloseWithoutSaving,
        onSaveAllAndClose,
    } = useClosePrompt();

    useGlobalEditorShortcuts();
    useLiveScriptValidation(rootScript);
    useAutosave();
    useProjectFileWatcher();
    useReferenceScanner();
    useScriptDirtyTracking();
    useWindowStateRestore();

    useEffect(() => {
        return setupConsoleInterceptor();
    }, []);

    useEffect(() => {
        const themes = getThemeRegistry(customThemes);
        const selected = themes.find((t) => t.key === themeKey) ?? themes.find((t) => t.key === 'classic') ?? themes[0];
        if (selected) applyTheme(selected);
    }, [customThemes, themeKey]);

    return (
        <div style={{ '--ui-scale': uiScale, inset: 0, overflow: 'hidden', position: 'fixed' } as CSSProperties}>
            <DockLayoutHost />
            <SettingsModal />
            <ExportGameModal />
            <NewProjectModal />
            <ConfirmDialog
                cancelText="Cancel"
                confirmText={isClosingWithSave ? 'Saving...' : 'Save All'}
                extraActionDanger
                extraActionText="Don't Save"
                message={closePromptMessage}
                onCancel={onCancelClose}
                onConfirm={() => { void onSaveAllAndClose(); }}
                onExtraAction={() => { void onCloseWithoutSaving(); }}
                open={closePromptOpen}
                title="Unsaved changes"
            />
            {pendingAutoSlice && autoSliceImage ? (
                <SpritesheetAutoSliceDialog
                    image={autoSliceImage}
                    imagePath={pendingAutoSlice.imagePath}
                    onCancel={() => finalizeAutoSlice(false)}
                    onCreate={(descriptor) => {
                        const descriptorPath = getSheetDescriptorPath(pendingAutoSlice.imagePath);
                        const normalizedDescriptor = {
                            ...descriptor,
                            source: pendingAutoSlice.entryName,
                        };
                        const descriptorText = `${JSON.stringify(normalizedDescriptor, undefined, 4)}\n`;
                        void handleAutoSliceCreate(descriptorText, descriptorPath);
                    }}
                    uiScale={uiScale}
                />
            ) : undefined}
        </div>
    );
}

export default App;

