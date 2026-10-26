import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ProjectValidationReport } from '../services/projectValidationReport';
import type { ProjectValidationSession } from '../services/projectValidationRun';

import { matchesProjectValidationSession, runSavedProjectValidation } from '../services/projectValidationRun';
import { useProjectStore } from '../store/storeBootstrap';

export type ValidationRunState = 'error' | 'idle' | 'issues' | 'ok' | 'running';
type ValidationState = {
    errorMessage?: string;
    report?: ProjectValidationReport;
    runState: ValidationRunState;
    session: ProjectValidationSession;
};

export function useProjectValidation() {
    const projectPath = useProjectStore(state => state.projectPath);
    const projectGeneration = useProjectStore(state => state.projectGeneration);
    const session = useMemo(() => ({ projectGeneration, projectPath }), [projectGeneration, projectPath]);
    const lifetime = useRef({ active: false, sequence: 0 });
    const sequence = useRef(0);
    const [state, setState] = useState<ValidationState>({ runState: 'idle', session });

    useEffect(() => {
        const owner = lifetime.current;
        owner.active = true;
        owner.sequence++;
        return () => {
            owner.active = false;
            owner.sequence++;
        };
    }, [session]);

    const runValidation = useCallback(async () => {
        if (!projectPath || !lifetime.current.active || !matchesProjectValidationSession(useProjectStore.getState(), session)) return;
        const request = ++sequence.current;
        const lease = lifetime.current.sequence;
        const isActive = () => lifetime.current.active && lifetime.current.sequence === lease && sequence.current === request && matchesProjectValidationSession(useProjectStore.getState(), session);
        setState({ runState: 'running', session });
        const result = await runSavedProjectValidation(session, isActive);
        if (!isActive()) return;
        switch (result.status) {
        case 'cancelled': {
            setState({ errorMessage: result.message, runState: 'error', session });
            break;
        }
        case 'failed': {
            setState({ errorMessage: result.error instanceof Error ? result.error.message : String(result.error), runState: 'error', session });
            break;
        }
        case 'issues':
        case 'ok': {
            setState({ report: result.report, runState: result.status, session });
            break;
        }
        default: {
            setState({ runState: 'idle', session });
        }
        }
    }, [projectPath, session]);

    const current: ValidationState = matchesProjectValidationSession(state.session, session) ? state : { runState: 'idle', session };
    return { ...current, projectGeneration, projectPath, runValidation };
}
