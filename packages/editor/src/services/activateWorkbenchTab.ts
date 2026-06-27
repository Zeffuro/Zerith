import { useWorkbenchStore } from '../store/useWorkbenchStore';
import { fsReadTextFile } from './fs';
import {
    applyAssetSelection,
    applyMacrosFile,
    applyScriptFile,
    looksLikeMacrosObject,
    looksLikeSceneFile,
} from './projectOpeners';

const FILE_BACKED_TAB_KINDS = new Set<string>(['engineConfig', 'json', 'manifest', 'text']);
const SHEET_TAB_KINDS = new Set<string>(['audiosheet', 'spritesheet']);

export async function activateWorkbenchTab(tabId: string) {
    const ws = useWorkbenchStore.getState();
    const tab = ws.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    ws.setActiveTab(tabId);

    if (tab.kind === 'asset') {
        if (tab.assetPath) applyAssetSelection(tab.assetPath);
        return;
    }

    if (tab.kind === 'script' || tab.kind === 'macros') {
        const text = await fsReadTextFile(tab.path);
        const data: unknown = JSON.parse(text);

        if (looksLikeSceneFile(data)) {
            applyScriptFile(tab.path, data);
            return;
        }
        if (looksLikeMacrosObject(data)) {
            applyMacrosFile(tab.path, data);
            return;
        }

        return;
    }

    if (SHEET_TAB_KINDS.has(tab.kind)) {
        if (tab.dirty && tab.textContent !== undefined) return;
        const text = await fsReadTextFile(tab.path);
        ws.updateTabContent(tab.id, text, { markDirty: false });
        return;
    }

    if (FILE_BACKED_TAB_KINDS.has(tab.kind)) {
        if (tab.dirty && tab.textContent !== undefined) return;
        const text = await fsReadTextFile(tab.path);
        ws.updateTabContent(tab.id, text, { markDirty: false });
    }
}
