import { useEffect, useRef, useState } from 'react';

import type { PlaytestScenario } from '../services/playtests/playtestModel';

import { readPlaytests, writePlaytests } from '../services/playtests/playtestStorage';
import { useProjectStore } from '../store/storeBootstrap';

type Library = { projectPath: string; scenarios: PlaytestScenario[]; session: number; text?: string };

export function usePlaytestLibrary(projectPath: string | undefined) {
    const generation = useProjectStore(state => state.projectGeneration);
    const [library, setLibrary] = useState<Library | undefined>();
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const currentProject = useRef({ generation, path: projectPath, session: 0 });
    const writing = useRef(false);
    if (currentProject.current.path !== projectPath || currentProject.current.generation !== generation) currentProject.current = { generation, path: projectPath, session: currentProject.current.session + 1 };
    const session = currentProject.current.session;
    const isCurrent = () => currentProject.current.session === session && useProjectStore.getState().projectGeneration === generation && useProjectStore.getState().projectPath === projectPath;

    useEffect(() => {
        let cancelled = false;
        setLibrary(undefined);
        setMessage('');
        if (projectPath) {
            void readPlaytests(projectPath).then(({ document, text }) => {
                if (!cancelled && currentProject.current.session === session) setLibrary({ projectPath, scenarios: document.scenarios, session, text });
            }).catch((error: unknown) => {
                if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
            });
        }
        return () => { cancelled = true; };
    }, [projectPath, session]);

    const save = async (scenarios: PlaytestScenario[]) => {
        if (!library || library.session !== currentProject.current.session || writing.current) return false;
        writing.current = true;
        setBusy(true);
        try {
            const text = await writePlaytests(library.projectPath, { scenarios, version: 1 }, library.text);
            if (isCurrent()) {
                setLibrary({ ...library, scenarios, text });
                setMessage('Playtests saved.');
            }
            return isCurrent();
        } catch (error) {
            if (isCurrent()) setMessage(error instanceof Error ? error.message : String(error));
            return false;
        } finally {
            writing.current = false;
            setBusy(false);
        }
    };

    return { busy, isCurrent, message, ready: library !== undefined && library.session === session, save, scenarios: library?.session === session ? library.scenarios : [] };
}
