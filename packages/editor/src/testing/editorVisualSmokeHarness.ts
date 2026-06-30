import { DOCK_PANELS, type DockPanelId } from '../components/layout/dock/dockPanelIds';
import { useEditorStore } from '../store/useEditorStore';

export type EditorVisualSmokeHarness = {
    announceOperationStatus: (message: string) => void;
    closeCommandPalette: () => void;
    closeExportGameModal: () => void;
    closeNewProjectModal: () => void;
    closeSettingsModal: () => void;
    openCommandPalette: () => void;
    openExportGameModal: () => void;
    openNewProjectModal: () => void;
    openSettingsModal: () => void;
    resetEditorChrome: () => void;
    selectDockPanel: (panelId: DockPanelId) => void;
};

type VisualSmokeGlobal = {
    __ZERITH_EDITOR_VISUAL_SMOKE__?: EditorVisualSmokeHarness;
} & typeof globalThis;

export function installEditorVisualSmokeHarness(): () => void {
    if (import.meta.env.MODE !== 'visual-smoke') return () => {};

    const visualSmokeGlobal = globalThis as VisualSmokeGlobal;
    visualSmokeGlobal.__ZERITH_EDITOR_VISUAL_SMOKE__ = {
        announceOperationStatus: (message) => {
            useEditorStore.getState().announceOperationStatus(message);
        },
        closeCommandPalette: () => {
            useEditorStore.getState().closeCommandPalette();
        },
        closeExportGameModal: () => {
            useEditorStore.getState().closeExportGameModal();
        },
        closeNewProjectModal: () => {
            useEditorStore.getState().closeNewProjectModal();
        },
        closeSettingsModal: () => {
            useEditorStore.getState().closeSettingsModal();
        },
        openCommandPalette: () => {
            useEditorStore.getState().openCommandPalette();
        },
        openExportGameModal: () => {
            useEditorStore.getState().openExportGameModal();
        },
        openNewProjectModal: () => {
            useEditorStore.getState().openNewProjectModal();
        },
        openSettingsModal: () => {
            useEditorStore.getState().openSettingsModal();
        },
        resetEditorChrome: () => {
            const store = useEditorStore.getState();
            store.closeCommandPalette();
            store.closeExportGameModal();
            store.closeGlobalSearchPopup();
            store.closeNewProjectModal();
            store.closeSettingsModal();
            store.clearOperationStatus();
            store.setUiScale(1);
        },
        selectDockPanel: (panelId) => {
            if (!Object.values(DOCK_PANELS).includes(panelId)) return;
            globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: panelId }));
        },
    };

    return () => {
        delete visualSmokeGlobal.__ZERITH_EDITOR_VISUAL_SMOKE__;
    };
}
