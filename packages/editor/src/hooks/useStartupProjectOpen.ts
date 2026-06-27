import { useEffect } from 'react';

import { openInitialProjectEntry } from '../components/tools/commandPaletteModel';
import { openProjectEntry } from '../services/openProjectEntry';
import {
    clearStartupProjectManifestPath,
    getStartupProjectManifestPath,
} from '../services/runtime/windowControls';
import { executeOpenProjectInCurrentWindow } from '../store/actions/projectOpenActions';
import { useProjectStore } from '../store/storeBootstrap';

export function useStartupProjectOpen(): void {
    useEffect(() => {
        const manifestPath = getStartupProjectManifestPath();
        if (!manifestPath) return;

        clearStartupProjectManifestPath();

        let disposed = false;
        void (async () => {
            try {
                const result = await executeOpenProjectInCurrentWindow(manifestPath, {
                    allowNewWindow: false,
                    prompt: false,
                });

                if (disposed || result.status !== 'opened-current') return;

                const { expandToPath, manifest, projectPath } = useProjectStore.getState();
                await openInitialProjectEntry({
                    expandToPath,
                    manifest,
                    openProjectEntry,
                    projectPath,
                });
            } catch (error) {
                console.error('Failed to open startup project:', error);
            }
        })();

        return () => {
            disposed = true;
        };
    }, []);
}
