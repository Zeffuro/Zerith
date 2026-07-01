import type { ScriptPath } from '../utils/scriptPathUtilities';

import { DOCK_PANELS, type DockPanelId } from '../components/layout/dock/dockPanelIds';
import { registerEditorPlugin } from '../plugins/commandPlugins';
import { type BrowserDirectoryHandle, type BrowserEntryHandle, type BrowserFileHandle, browserFsAdapter, type BrowserWritableFileStream } from '../services/fs/browserFsAdapter';
import { openLocalizationWorkbenchTab } from '../services/localizationWorkbench';
import { openProjectEntry } from '../services/openProjectEntry';
import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';
import { useWorkbenchStore } from '../store/useWorkbenchStore';

export type EditorVisualSmokeHarness = {
    announceOperationStatus: (message: string) => void;
    closeCommandPalette: () => void;
    closeExportGameModal: () => void;
    closeNewProjectModal: () => void;
    closeSettingsModal: () => void;
    openCommandPalette: () => void;
    openExportGameModal: () => void;
    openLocalizationWorkbench: () => void;
    openNewProjectModal: () => void;
    openProjectFixture: (fixture: VisualSmokeProjectFixture) => Promise<void>;
    openSettingsModal: () => void;
    playPreviewFrom: (index: number) => void;
    registerVisualSmokePlugin: () => void;
    resetEditorChrome: () => void;
    selectDockPanel: (panelId: DockPanelId) => void;
    stopPreview: () => void;
};

export type VisualSmokeProjectFixture = {
    entryPath: string;
    files: Record<string, string>;
    rootName: string;
    selectedPath?: ScriptPath;
};

type VisualSmokeGlobal = {
    __ZERITH_EDITOR_VISUAL_SMOKE__?: EditorVisualSmokeHarness;
} & typeof globalThis;

class MemoryDirectoryHandle implements BrowserDirectoryHandle {
    readonly children = new Map<string, BrowserEntryHandle>();
    readonly kind = 'directory' as const;

    constructor(readonly name: string) {}

    entries(): AsyncIterable<[string, BrowserEntryHandle]> {
        return toAsyncIterable(this.children);
    }

    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<BrowserDirectoryHandle> {
        const existing = this.children.get(name);
        if (existing?.kind === 'directory') return Promise.resolve(existing);
        if (existing) return Promise.reject(new Error(`${name} is a file.`));
        if (!options?.create) return Promise.reject(new Error(`Directory not found: ${name}`));

        const directory = new MemoryDirectoryHandle(name);
        this.children.set(name, directory);
        return Promise.resolve(directory);
    }

    getFileHandle(name: string, options?: { create?: boolean }): Promise<BrowserFileHandle> {
        const existing = this.children.get(name);
        if (existing?.kind === 'file') return Promise.resolve(existing);
        if (existing) return Promise.reject(new Error(`${name} is a directory.`));
        if (!options?.create) return Promise.reject(new Error(`File not found: ${name}`));

        const file = new MemoryFileHandle(name, '');
        this.children.set(name, file);
        return Promise.resolve(file);
    }

    removeEntry(name: string): Promise<void> {
        this.children.delete(name);
        return Promise.resolve();
    }
}

class MemoryFileHandle implements BrowserFileHandle {
    readonly kind = 'file' as const;

    constructor(readonly name: string, private content: string) {}

    createWritable(): Promise<BrowserWritableFileStream> {
        return Promise.resolve({
            close: () => Promise.resolve(),
            write: async (data) => {
                this.content = await normalizeWritableText(data);
            },
        });
    }

    getFile(): Promise<File> {
        return Promise.resolve(new File([this.content], this.name, { type: 'application/json' }));
    }
}

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
        openLocalizationWorkbench: () => {
            openLocalizationWorkbenchTab();
        },
        openNewProjectModal: () => {
            useEditorStore.getState().openNewProjectModal();
        },
        openProjectFixture: async (fixture) => {
            const root = createMemoryDirectoryFixture(fixture.rootName, fixture.files);
            const projectPath = browserFsAdapter.mountDirectory(root);
            const entryPath = fixture.entryPath.replaceAll('\\', '/').replace(/^\/+/u, '');
            const fullEntryPath = `${projectPath}/${entryPath}`;

            await useProjectStore.getState().openProjectFromManifest(`${projectPath}/game.json`);
            await openProjectEntry(fullEntryPath, basename(entryPath), { forceView: 'timeline' });

            if (fixture.selectedPath) {
                const editor = useEditorStore.getState();
                editor.setSelectedNodePaths([fixture.selectedPath]);
                editor.setSelectionAnchorPath(fixture.selectedPath);
            }
        },
        openSettingsModal: () => {
            useEditorStore.getState().openSettingsModal();
        },
        playPreviewFrom: (index) => {
            useEditorStore.getState().triggerPlayFrom(index);
        },
        registerVisualSmokePlugin: () => {
            registerEditorPlugin({
                commands: [{
                    label: 'Visual Smoke Signal',
                    type: 'visual_smoke_signal',
                }],
                manifest: {
                    capabilities: ['commands'],
                    id: 'visual.smoke.plugin',
                    name: 'Visual Smoke Plugin',
                    pluginApiVersion: 1,
                    version: '1.0.0',
                },
            }, { source: 'visual-smoke-memory' });
        },
        resetEditorChrome: () => {
            const store = useEditorStore.getState();
            store.closeCommandPalette();
            store.closeExportGameModal();
            store.closeGlobalSearchPopup();
            store.closeNewProjectModal();
            store.closeSettingsModal();
            store.clearOperationStatus();
            store.clearSelection();
            store.setUiScale(1);
            useWorkbenchStore.getState().clearTabs();
            useProjectStore.getState().setProject(undefined, []);
            browserFsAdapter.clearMountedDirectories();
        },
        selectDockPanel: (panelId) => {
            if (!Object.values(DOCK_PANELS).includes(panelId)) return;
            globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: panelId }));
        },
        stopPreview: () => {
            useEditorStore.getState().triggerStop();
        },
    };

    return () => {
        delete visualSmokeGlobal.__ZERITH_EDITOR_VISUAL_SMOKE__;
    };
}

function addMemoryFile(root: MemoryDirectoryHandle, relativePath: string, content: string): void {
    const segments = relativePath.replaceAll('\\', '/').split('/').filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) return;

    let current = root;
    for (const segment of segments) {
        let child = current.children.get(segment);
        if (!child) {
            child = new MemoryDirectoryHandle(segment);
            current.children.set(segment, child);
        }
        if (!(child instanceof MemoryDirectoryHandle)) throw new Error(`${segment} is a file.`);
        current = child;
    }

    current.children.set(fileName, new MemoryFileHandle(fileName, content));
}

function basename(path: string): string {
    return path.split(/[\\/]/u).pop() || path;
}

function createMemoryDirectoryFixture(rootName: string, files: Record<string, string>): BrowserDirectoryHandle {
    const root = new MemoryDirectoryHandle(rootName);
    for (const [relativePath, content] of Object.entries(files)) {
        addMemoryFile(root, relativePath, content);
    }
    return root;
}

async function normalizeWritableText(data: ArrayBuffer | Blob | string | Uint8Array): Promise<string> {
    if (typeof data === 'string') return data;
    if (data instanceof Blob) return data.text();
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    return new TextDecoder().decode(bytes);
}

function toAsyncIterable<T>(values: Iterable<T>): AsyncIterable<T> {
    return {
        [Symbol.asyncIterator]: () => {
            const iterator = values[Symbol.iterator]();
            return {
                next: () => Promise.resolve(iterator.next()),
            };
        },
    };
}
