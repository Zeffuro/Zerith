import { useCallback } from 'react';

import type { WorkbenchTab } from '../../../store/useWorkbenchStore';

import { saveLocalizationFileDraft } from '../../../services/localizationDrafts';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { canonicalPathForComparison } from '../../../utils/pathComparison';

export function useLocalizationJsonDraft(tab: undefined | WorkbenchTab, fileJson: boolean) {
    const projectPath = useProjectStore(state => state.projectPath);
    const generation = useProjectStore(state => state.projectGeneration);
    const localePaths = useProjectStore(state => state.localePaths);
    const locales = useProjectStore(state => state.locales);
    const locale = fileJson && tab ? Object.keys(locales).find(locale => canonicalPathForComparison(localePaths[locale]
        ?? `${projectPath?.replaceAll(/[\\/]+$/gu, '')}/game.json`) === canonicalPathForComparison(tab.path)) : undefined;
    const shared = locale !== undefined;
    const isCurrent = useCallback(() => {
        const state = useProjectStore.getState();
        return state.projectPath === projectPath && state.projectGeneration === generation;
    }, [generation, projectPath]);
    const setContent = useCallback((text: string) => {
        if (!tab || !isCurrent()) return;
        const current = useWorkbenchStore.getState().tabs.find(entry => entry.id === tab.id && entry.path === tab.path);
        if (!current || current.textContent === text) return;
        useWorkbenchStore.getState().updateTabContent(current.id, text, { markDirty: text !== current.savedTextContent });
    }, [isCurrent, tab]);
    const save = useCallback(async () => {
        if (!isCurrent() || !tab || locale === undefined || !useWorkbenchStore.getState().tabs.some(entry => entry.id === tab.id && entry.path === tab.path)) {
            throw new Error('Localization editor changed while saving. Review the current draft.');
        }
        await saveLocalizationFileDraft(tab.path);
    }, [isCurrent, locale, tab]);
    return { isCurrent, save, setContent, shared };
}
