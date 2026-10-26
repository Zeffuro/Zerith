import { useLayoutEffect, useRef, useState } from 'react';

import type { WorkbenchTab } from '../store/workbench/types';

import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';
import { useWorkbenchStore } from '../store/useWorkbenchStore';

type ExportOutcome = { message: string };
type ExportScope = { tabId?: string; watchSelectedAsset?: boolean };
type ExportState = { exportingTarget?: string; isExporting: boolean; message?: string };

export function useAudioExport(sourceKey: string, { tabId, watchSelectedAsset = false }: ExportScope = {}) {
    const owner = useRef({ active: false, busy: false, sequence: 0, sourceKey });
    const [state, setState] = useState<ExportState>({ isExporting: false });
    const session = useProjectStore.getState();
    const selectedAsset = useEditorStore.getState().selectedAssetPath;
    const tab = tabId ? useWorkbenchStore.getState().tabs.find(entry => entry.id === tabId) : undefined;

    const retire = () => {
        owner.current.sequence++;
        owner.current.busy = false;
        setState({ isExporting: false });
    };

    useLayoutEffect(() => {
        const lifetime = owner.current;
        if (lifetime.sourceKey !== sourceKey) {
            lifetime.sequence++;
            const wasBusy = lifetime.busy;
            lifetime.busy = false;
            lifetime.sourceKey = sourceKey;
            if (wasBusy) setState({ isExporting: false });
        }
    }, [sourceKey]);

    useLayoutEffect(() => {
        const lifetime = owner.current;
        lifetime.active = true;
        const invalidate = () => {
            lifetime.sequence++;
            lifetime.busy = false;
            setState({ isExporting: false });
        };
        const unsubscribeProject = useProjectStore.subscribe((current, previous) => {
            if (current.projectPath !== previous.projectPath || current.projectGeneration !== previous.projectGeneration) invalidate();
        });
        const unsubscribeEditor = useEditorStore.subscribe((current, previous) => {
            if (watchSelectedAsset && current.selectedAssetPath !== previous.selectedAssetPath) invalidate();
        });
        const unsubscribeWorkbench = useWorkbenchStore.subscribe((current, previous) => {
            if (!tabId) return;
            const currentTab = current.tabs.find(entry => entry.id === tabId);
            const previousTab = previous.tabs.find(entry => entry.id === tabId);
            if (current.activeTabId !== previous.activeTabId || currentTab !== previousTab) invalidate();
        });
        return () => {
            unsubscribeProject(); unsubscribeEditor(); unsubscribeWorkbench();
            lifetime.active = false;
            lifetime.busy = false;
            lifetime.sequence++;
        };
    }, [tabId, watchSelectedAsset]);

    const runExport = async <T extends ExportOutcome>(
        target: string,
        operation: (projectPath: string, isCurrent: () => boolean) => Promise<T>,
        onSuccess?: (result: T) => void,
    ): Promise<void> => {
        const lifetime = owner.current;
        const { projectGeneration, projectPath } = session;
        const matchesSession = () => {
            const current = useProjectStore.getState();
            return current.projectPath === projectPath && current.projectGeneration === projectGeneration;
        };
        if (!lifetime.active || lifetime.busy || !projectPath || lifetime.sourceKey !== sourceKey || !matchesSession() || !matchesAudioSource(tabId, tab, watchSelectedAsset, selectedAsset)) return;
        const request = ++lifetime.sequence;
        const isCurrent = () => lifetime.active && lifetime.sequence === request && lifetime.sourceKey === sourceKey && matchesSession() && matchesAudioSource(tabId, tab, watchSelectedAsset, selectedAsset);
        lifetime.busy = true;
        setState({ exportingTarget: target, isExporting: true });
        try {
            const result = await operation(projectPath, isCurrent);
            if (!isCurrent()) return;
            lifetime.busy = false;
            setState({ isExporting: false, message: result.message });
            onSuccess?.(result);
        } catch (error) {
            if (isCurrent()) setState({ exportingTarget: target, isExporting: true, message: error instanceof Error ? error.message : String(error) });
        } finally {
            if (isCurrent()) {
                lifetime.busy = false;
                setState(current => ({ ...current, exportingTarget: undefined, isExporting: false }));
            }
        }
    };

    return { ...state, retire, runExport };
}

function matchesAudioSource(tabId: string | undefined, tab: undefined | WorkbenchTab, watchSelectedAsset: boolean, selectedAsset: string | undefined) {
    return (!watchSelectedAsset || useEditorStore.getState().selectedAssetPath === selectedAsset)
        && (!tabId || useWorkbenchStore.getState().activeTabId === tabId
            && useWorkbenchStore.getState().tabs.find(entry => entry.id === tabId) === tab);
}
