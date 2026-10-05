import { useEffect, useRef, useState } from 'react';

import type { GlobalSearchMatch, GlobalSearchProjectData, GlobalSearchTextOptions } from '../../services/globalSearch';
import type { ReplacementPlan } from '../../services/globalSearch/applyReplacement';

import { replaceProjectContent } from '../../services/globalSearch';
import { applySearchReplacement, prepareSearchReplacement, replacementStatus } from '../../services/globalSearch/applyReplacement';
import { useProjectStore } from '../../store/storeBootstrap';

export function useSearchReplacement({ matches, projectData, query, replacement, textOptions }: {
    matches: GlobalSearchMatch[];
    projectData: GlobalSearchProjectData;
    query: string;
    replacement: string;
    textOptions: GlobalSearchTextOptions;
}) {
    const [pending, setPending] = useState<ReplacementPlan>();
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<string>();
    const sequence = useRef(0);
    const locked = useRef(false);
    const inputs = useRef('');
    inputs.current = JSON.stringify([query, replacement, textOptions]);
    const invalidate = () => {
        sequence.current += 1;
        setPending(undefined);
        setBusy(false);
        setStatus(undefined);
    };
    useEffect(() => {
        const unsubscribe = useProjectStore.subscribe((state, previous) => {
            if (state.projectPath !== previous.projectPath || state.projectGeneration !== previous.projectGeneration) {
                sequence.current += 1;
                setPending(undefined);
                setBusy(false);
                setStatus(undefined);
            }
        });
        return () => { sequence.current += 1; unsubscribe(); };
    }, []);

    const begin = async (targets: GlobalSearchMatch[], confirm: boolean) => {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setStatus(undefined);
        const request = ++sequence.current;
        const currentInputs = inputs.current;
        const { projectGeneration, projectPath } = useProjectStore.getState();
        const ownsSession = () => sequence.current === request && useProjectStore.getState().projectGeneration === projectGeneration
            && useProjectStore.getState().projectPath === projectPath;
        const isCurrent = () => ownsSession() && currentInputs === inputs.current;
        try {
            const files = replaceProjectContent(query, replacement, targets, projectData, textOptions);
            const plan = await prepareSearchReplacement(files, projectData, isCurrent);
            if (!isCurrent()) return;
            if (files.length === 0) setStatus('No changes were applied.');
            else if (confirm) setPending(plan);
            else {
                const result = await applySearchReplacement(plan);
                if (ownsSession()) setStatus(replacementStatus(result));
            }
        } catch (error) {
            if (ownsSession()) setStatus(error instanceof Error ? error.message : String(error));
        } finally {
            locked.current = false;
            if (sequence.current === request) setBusy(false);
        }
    };
    const confirm = async () => {
        if (!pending || locked.current) return;
        const plan = pending;
        const request = sequence.current;
        const { projectGeneration, projectPath } = useProjectStore.getState();
        locked.current = true;
        setPending(undefined);
        setBusy(true);
        try {
            const result = await applySearchReplacement(plan);
            if (sequence.current === request && useProjectStore.getState().projectGeneration === projectGeneration
                && useProjectStore.getState().projectPath === projectPath) setStatus(replacementStatus(result));
        } finally {
            locked.current = false;
            if (sequence.current === request) setBusy(false);
        }
    };
    return {
        busy,
        cancel: invalidate,
        confirm,
        invalidate,
        pending,
        replaceAll: () => begin(matches.filter(match => match.replaceable), true),
        replaceOne: (match: GlobalSearchMatch) => begin([match], false),
        status,
    };
}
