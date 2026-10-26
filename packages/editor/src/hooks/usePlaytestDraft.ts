import { useEffect, useRef, useState } from 'react';

import type { PlaytestDraft, PlaytestDraftLease } from '../services/playtests/playtestDraft';
import type { PlaytestScenario } from '../services/playtests/playtestModel';

import { PlaytestDraftController } from '../services/playtests/playtestDraft';
import { useProjectStore } from '../store/storeBootstrap';

export function usePlaytestDraft(path: string | undefined, generation: number) {
    const [, render] = useState(0);
    const reference = useRef({ controller: new PlaytestDraftController(), generation, path });
    if (reference.current.path !== path || reference.current.generation !== generation) reference.current = { controller: new PlaytestDraftController(), generation, path };
    const controller = reference.current.controller;
    const isCurrent = () => reference.current.controller === controller && useProjectStore.getState().projectPath === path && useProjectStore.getState().projectGeneration === generation;
    const publish = () => { render(value => value + 1); };

    useEffect(() => {
        controller.activate();
        return () => { controller.retire(); };
    }, [controller]);

    return {
        capture: () => controller.capture(),
        clear: () => { controller.clear(); publish(); },
        completeDelete: (lease: PlaytestDraftLease) => { if (isCurrent() && controller.completeDelete(lease)) publish(); },
        completeSave: (lease: PlaytestDraftLease, scenario: PlaytestScenario) => { if (isCurrent() && controller.completeSave(lease, scenario)) publish(); },
        draft: controller.value,
        edit: (patch: Partial<PlaytestDraft>) => { controller.edit(patch); publish(); },
        isActive: (lease: PlaytestDraftLease) => isCurrent() && controller.isActive(lease),
        owns: (lease: PlaytestDraftLease) => isCurrent() && controller.owns(lease),
        select: (scenario: PlaytestScenario) => { controller.select(scenario); publish(); },
    };
}
