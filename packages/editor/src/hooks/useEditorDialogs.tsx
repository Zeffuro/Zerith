import type { ReactNode } from 'react';

import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import {
    type EditorConfirmDialogRequest,
    type ProjectOpenTargetChoice,
    type ProjectOpenTargetDialogRequest,
    registerEditorDialogHandlers,
} from '../services/editorDialogs';

type ActiveDialog =
    | {
        kind: 'confirm';
        request: EditorConfirmDialogRequest;
        resolve: (value: boolean) => void;
    }
    | {
        kind: 'project-open-target';
        request: ProjectOpenTargetDialogRequest;
        resolve: (value: ProjectOpenTargetChoice) => void;
    };

export function useEditorDialogs(): ReactNode {
    const [activeDialog, setActiveDialog] = useState<ActiveDialog>();

    useEffect(() => registerEditorDialogHandlers({
        chooseProjectOpenTarget: (request) => new Promise((resolve) => {
            setActiveDialog({ kind: 'project-open-target', request, resolve });
        }),
        confirm: (request) => new Promise((resolve) => {
            setActiveDialog({ kind: 'confirm', request, resolve });
        }),
    }), []);

    const settleConfirm = useCallback((value: boolean) => {
        if (activeDialog?.kind === 'confirm') activeDialog.resolve(value);
        setActiveDialog(undefined);
    }, [activeDialog]);

    const settleProjectOpenTarget = useCallback((value: ProjectOpenTargetChoice) => {
        if (activeDialog?.kind === 'project-open-target') activeDialog.resolve(value);
        setActiveDialog(undefined);
    }, [activeDialog]);

    if (activeDialog?.kind === 'confirm') {
        return (
            <ConfirmDialog
                cancelText={activeDialog.request.cancelText ?? 'Cancel'}
                confirmText={activeDialog.request.confirmText ?? 'Confirm'}
                message={activeDialog.request.message}
                onCancel={() => settleConfirm(false)}
                onConfirm={() => settleConfirm(true)}
                open
                title={activeDialog.request.title ?? 'Confirm'}
                zIndex={7000}
            />
        );
    }

    if (activeDialog?.kind === 'project-open-target') {
        return (
            <ConfirmDialog
                cancelText="Cancel"
                confirmText="This Window"
                extraActionText="New Window"
                message={formatProjectOpenTargetMessage(activeDialog.request)}
                onCancel={() => settleProjectOpenTarget('cancel')}
                onConfirm={() => settleProjectOpenTarget('current')}
                onExtraAction={() => settleProjectOpenTarget('new-window')}
                open
                title="Open Project"
                zIndex={7000}
            />
        );
    }

    return undefined;
}

function formatProjectOpenTargetMessage(request: ProjectOpenTargetDialogRequest): string {
    const dirtyLine = request.dirtyCount > 0
        ? `${request.dirtyCount} unsaved file${request.dirtyCount === 1 ? '' : 's'} will be saved first if you open in this window.`
        : 'Opening in this window will close the current project tabs.';

    return [
        'Choose where to open this project:',
        '',
        request.nextProjectPath,
        '',
        dirtyLine,
    ].join('\n');
}
