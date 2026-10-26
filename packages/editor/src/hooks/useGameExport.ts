import { useEffect, useRef, useState } from 'react';

import type { ExportGameOptions } from '../services/exportGame';

import { pickBrowserFolderExportTarget } from '../services/browserFolderExport';
import { exportGame } from '../services/exportGame';
import { saveProjectBeforeExport } from '../services/exportPreflight';
import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';
import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';

type ExportState = { isExporting: boolean; statusMessage?: string };

export function useGameExport() {
    const owner = useRef({ active: false, busy: false, sequence: 0 });
    const [state, setState] = useState<ExportState>({ isExporting: false });

    useEffect(() => {
        const lifetime = owner.current;
        lifetime.active = true;
        const retire = (projectChanged: boolean) => {
            const wasBusy = lifetime.busy;
            lifetime.sequence++;
            lifetime.busy = false;
            setState({ isExporting: false, statusMessage: projectChanged && wasBusy ? 'The project changed. Start export again.' : undefined });
        };
        const unsubscribeProject = useProjectStore.subscribe((current, previous) => {
            if (current.projectPath !== previous.projectPath || current.projectGeneration !== previous.projectGeneration) retire(true);
        });
        const unsubscribeEditor = useEditorStore.subscribe((current, previous) => {
            if (current.isExportGameModalOpen !== previous.isExportGameModalOpen) retire(false);
        });
        return () => {
            unsubscribeProject();
            unsubscribeEditor();
            lifetime.active = false;
            lifetime.busy = false;
            lifetime.sequence++;
        };
    }, []);

    const runExport = async (options: ExportGameOptions, browserFolderName?: string) => {
        const lifetime = owner.current;
        const { projectGeneration, projectPath } = useProjectStore.getState();
        if (!lifetime.active || lifetime.busy || !projectPath || !useEditorStore.getState().isExportGameModalOpen) return;
        const request = ++lifetime.sequence;
        const isCurrent = () => {
            const current = useProjectStore.getState();
            return lifetime.active && request === lifetime.sequence && useEditorStore.getState().isExportGameModalOpen
                && current.projectPath === projectPath && current.projectGeneration === projectGeneration;
        };
        const native = isTauriRuntime();
        lifetime.busy = true;
        setState({ isExporting: true, statusMessage: options.profile === 'desktop-tauri' ? 'Packaging desktop game...' : 'Exporting game...' });
        try {
            const browserFolder = !native && browserFolderName !== undefined
                ? await pickBrowserFolderExportTarget(browserFolderName)
                : undefined;
            if (!isCurrent()) return;
            if (!native && browserFolderName !== undefined && !browserFolder) {
                setState({ isExporting: true, statusMessage: 'Export cancelled.' });
                return;
            }
            useEditorStore.getState().markManualSave();
            if (!isCurrent()) return;
            await saveProjectBeforeExport(projectPath, useProjectStore.getState);
            if (!isCurrent()) return;
            console.info('[Export Game] Running export with options:', { ...options, projectPath });
            const result = await exportGame(projectPath, { ...options, browserFolder }, isCurrent);
            if (!isCurrent()) return;
            if (result.stdout.trim().length > 0) console.info('[Export Game] Build output:\n' + result.stdout.trim());
            if (typeof result.stderr === 'string' && result.stderr.trim().length > 0) console.warn('[Export Game] Build warnings:\n' + result.stderr.trim());
            setState({ isExporting: true, statusMessage: native || browserFolder
                ? `Exported to ${result.executablePath ?? result.outDirectory ?? options.outDir}.`
                : 'Export complete. Your browser download is ready.' });
        } catch (error) {
            if (!isCurrent()) return;
            console.error('[Export Game] Export failed:', error);
            setState({ isExporting: true, statusMessage: `Export failed: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            if (isCurrent()) {
                lifetime.busy = false;
                setState(current => ({ ...current, isExporting: false }));
            }
        }
    };

    return { ...state, runExport };
}
