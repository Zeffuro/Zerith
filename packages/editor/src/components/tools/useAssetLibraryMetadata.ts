import { useEffect, useMemo, useState } from 'react';

import { loadAssetLibraryMetadataSnapshot, saveAssetLibraryMetadata } from '../../services/assetLibraryMetadata';
import { refreshReferenceScannerState } from '../../services/referenceScanner';
import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { useProjectStore } from '../../store/storeBootstrap';
import { type AssetMetadataState, createAssetMetadataCoordinator } from './assetMetadataCoordinator';

export function useAssetLibraryMetadata(projectPath: string | undefined, generation: number, inventory: string[]) {
    const [published, setPublished] = useState<{ coordinator: ReturnType<typeof createAssetMetadataCoordinator>; state: AssetMetadataState }>();
    const coordinator = useMemo(() => createAssetMetadataCoordinator({
        load: () => loadAssetLibraryMetadataSnapshot(projectPath!),
        ownsSession: () => Boolean(projectPath)
            && useProjectStore.getState().projectPath === projectPath
            && useProjectStore.getState().projectGeneration === generation,
        publish: state => setPublished({ coordinator, state }),
        refresh: async isCurrent => {
            if (!isCurrent()) return;
            await refreshReferenceScannerState(isCurrent);
        },
        report: (level, message, detail) => executeConsoleMessageAction('editor', level, message, detail),
        save: (metadata, snapshot, isCurrent) => saveAssetLibraryMetadata(projectPath!, metadata, snapshot, undefined, isCurrent),
    }), [generation, projectPath]);

    useEffect(() => {
        coordinator.activate();
        return () => coordinator.deactivate();
    }, [coordinator]);
    useEffect(() => { void coordinator.load(); }, [coordinator, inventory]);

    const state = published?.coordinator === coordinator ? published.state : coordinator.getState();
    return { ...state, coordinator, disabled: !state.ready || state.loading || state.saving };
}
