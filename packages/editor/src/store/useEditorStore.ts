import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScriptPath } from '../utils/scriptPathUtils';
import { createDefaultDockLayout, DOCK_LAYOUT_VERSION } from '../layout/defaultDockLayout';

interface EditorState {
    uiScale: number;
    isMuted: boolean;
    windowState: { width: number; height: number; x: number; y: number; maximized: boolean } | null;

    playTrigger: number;
    stopTrigger: number;
    playFromIndex: number | null;
    triggerPlayFrom: (index: number) => void;

    quickCommandTypes: string[];
    setQuickCommandTypes: (types: string[]) => void;
    toggleQuickCommandType: (type: string) => void;
    moveQuickCommandType: (type: string, direction: 'left' | 'right') => void;

    setUiScale: (scale: number) => void;
    toggleMute: () => void;
    setWindowState: (state: EditorState['windowState']) => void;
    triggerPlay: () => void;
    triggerStop: () => void;

    themeKey: string;
    setThemeKey: (key: string) => void;

    clipboardNode: any | null;
    setClipboardNode: (node: any | null) => void;

    validationErrors: Record<string, string[]>;
    setValidationErrors: (errors: Record<string, string[]>) => void;
    clearValidationErrors: () => void;

    selectedNodePaths: ScriptPath[];
    selectionAnchorPath: ScriptPath | null;

    selectedAssetPath: string | null;
    setSelectedAssetPath: (path: string | null) => void;

    setSelectedNodePaths: (paths: ScriptPath[]) => void;
    setSelectionAnchorPath: (path: ScriptPath | null) => void;
    clearSelection: () => void;
    toggleSelectedNodePath: (path: ScriptPath) => void;

    pendingDeleteRequest: null | { paths: ScriptPath[]; source: 'keyboard' | 'click' };
    requestDelete: (paths: ScriptPath[], source?: 'keyboard' | 'click') => void;
    clearDeleteRequest: () => void;

    dockLayoutJson: any;
    dockLayoutVersion: number;
    setDockLayoutJson: (json: any) => void;
    resetDockLayout: () => void;
}

const DEFAULT_QUICK = ['dialogue', 'background', 'sprite', 'choice', 'if', 'while', 'for', 'jump', 'call', 'bgm'];

function normalizeDockState(state: any) {
    const hasValidVersion = state?.dockLayoutVersion === DOCK_LAYOUT_VERSION;
    const hasLayout = !!state?.dockLayoutJson;

    if (hasValidVersion && hasLayout) {
        return {
            dockLayoutJson: state.dockLayoutJson,
            dockLayoutVersion: state.dockLayoutVersion,
        };
    }

    return {
        dockLayoutJson: createDefaultDockLayout(),
        dockLayoutVersion: DOCK_LAYOUT_VERSION,
    };
}

export const useEditorStore = create<EditorState>()(
    persist(
        (set, _) => ({
            uiScale: 1.0,
            isMuted: false,
            windowState: null,
            playTrigger: 0,
            stopTrigger: 0,
            playFromIndex: null,

            quickCommandTypes: DEFAULT_QUICK,

            setQuickCommandTypes: (types) =>
                set({ quickCommandTypes: Array.from(new Set(types.filter(Boolean))) }),

            toggleQuickCommandType: (type) =>
                set((state) => {
                    const has = state.quickCommandTypes.includes(type);
                    return {
                        quickCommandTypes: has
                            ? state.quickCommandTypes.filter((t) => t !== type)
                            : [...state.quickCommandTypes, type],
                    };
                }),

            moveQuickCommandType: (type, direction) =>
                set((state) => {
                    const list = [...state.quickCommandTypes];
                    const idx = list.indexOf(type);
                    if (idx < 0) return {};
                    const nextIdx = direction === 'left' ? idx - 1 : idx + 1;
                    if (nextIdx < 0 || nextIdx >= list.length) return {};
                    [list[idx], list[nextIdx]] = [list[nextIdx], list[idx]];
                    return { quickCommandTypes: list };
                }),

            setUiScale: (scale) => set({ uiScale: scale }),
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            setWindowState: (ws) => set({ windowState: ws }),
            triggerStop: () => set((state) => ({ stopTrigger: state.stopTrigger + 1 })),
            triggerPlayFrom: (index) =>
                set((state) => ({
                    playTrigger: state.playTrigger + 1,
                    playFromIndex: index,
                })),

            triggerPlay: () =>
                set((state) => ({
                    playTrigger: state.playTrigger + 1,
                    playFromIndex: null,
                })),

            themeKey: 'classic',
            setThemeKey: (key) => set({ themeKey: key }),

            clipboardNode: null,
            setClipboardNode: (node) => set({ clipboardNode: node }),

            validationErrors: {},
            setValidationErrors: (errors) => set({ validationErrors: errors }),
            clearValidationErrors: () => set({ validationErrors: {} }),

            selectedNodePaths: [],
            selectionAnchorPath: null,

            setSelectedNodePaths: (paths) =>
                set({
                    selectedNodePaths: Array.from(
                        new Map(paths.map((p) => [p.join('.'), [...p] as ScriptPath])).values()
                    ),
                }),

            setSelectionAnchorPath: (path) =>
                set({ selectionAnchorPath: path ? [...path] as ScriptPath : null }),

            selectedAssetPath: null,
            setSelectedAssetPath: (path) => set({ selectedAssetPath: path }),

            clearSelection: () =>
                set({ selectedNodePaths: [], selectionAnchorPath: null }),

            toggleSelectedNodePath: (path) =>
                set((state) => {
                    const key = path.join('.');
                    const exists = state.selectedNodePaths.some((p) => p.join('.') === key);
                    return {
                        selectedNodePaths: exists
                            ? state.selectedNodePaths.filter((p) => p.join('.') !== key)
                            : [...state.selectedNodePaths, [...path] as ScriptPath],
                    };
                }),

            pendingDeleteRequest: null,
            requestDelete: (paths, source = 'keyboard') => set({ pendingDeleteRequest: { paths, source } }),
            clearDeleteRequest: () => set({ pendingDeleteRequest: null }),

            ...normalizeDockState({}),

            setDockLayoutJson: (json) => set({ dockLayoutJson: json }),
            resetDockLayout: () =>
                set({
                    dockLayoutJson: createDefaultDockLayout(),
                    dockLayoutVersion: DOCK_LAYOUT_VERSION,
                }),
        }),
        {
            name: 'zerith-editor-prefs',
            partialize: (state) => ({
                uiScale: state.uiScale,
                isMuted: state.isMuted,
                windowState: state.windowState,
                quickCommandTypes: state.quickCommandTypes,
                themeKey: state.themeKey,
                dockLayoutJson: state.dockLayoutJson,
                dockLayoutVersion: state.dockLayoutVersion,
            }),
            merge: (persisted: any, current) => {
                const normalized = normalizeDockState(persisted);
                return {
                    ...current,
                    ...persisted,
                    dockLayoutJson: normalized.dockLayoutJson,
                    dockLayoutVersion: normalized.dockLayoutVersion,
                };
            },
        }
    )
);