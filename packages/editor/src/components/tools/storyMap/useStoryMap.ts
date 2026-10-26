import { useEffect, useMemo, useState } from 'react';

import type { StoryMapFiles } from '../../../services/storyMap/storyMapProject';
import type { ProjectState } from '../../../store/project/types';
import type { WorkbenchTab } from '../../../store/workbench/types';

import { readStoryMapFiles } from '../../../services/storyMap/storyMapFiles';
import { prepareStoryMap } from '../../../services/storyMap/storyMapProject';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';

export function useStoryMap(project: ProjectState, tabs: WorkbenchTab[]) {
    const { macros, manifest, projectGeneration, projectPath, scenePaths, scenes, treeRevision } = project;
    const request = useMemo(() => {
        const data = { macros, manifest, projectPath, scenePaths, scenes };
        return { data, initial: prepareStoryMap(data, tabs), projectGeneration, tabs, treeRevision };
    }, [macros, manifest, projectGeneration, projectPath, scenePaths, scenes, tabs, treeRevision]);
    const [resolved, setResolved] = useState<{ files: StoryMapFiles; request: typeof request }>();
    useEffect(() => {
        let retired = false;
        if (request.initial.pending.length > 0) {
            void readStoryMapFiles(request.initial.pending).then(files => {
                const current = useProjectStore.getState();
                if (retired || current.projectPath !== projectPath || current.projectGeneration !== projectGeneration
                    || current.manifest !== manifest || current.scenes !== scenes || current.macros !== macros
                    || current.scenePaths !== scenePaths || current.treeRevision !== treeRevision
                    || useWorkbenchStore.getState().tabs !== tabs) return;
                setResolved({ files, request });
            });
        }
        return () => { retired = true; };
    }, [request, macros, manifest, projectGeneration, projectPath, scenePaths, scenes, tabs, treeRevision]);
    return useMemo(() => resolved?.request === request
        ? prepareStoryMap(request.data, request.tabs, resolved.files).map
        : request.initial.map, [request, resolved]);
}
