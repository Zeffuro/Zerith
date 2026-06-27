export type EditorConfirmDialogRequest = {
    cancelText?: string;
    confirmText?: string;
    message: string;
    title?: string;
};

export type ProjectOpenTargetChoice = 'cancel' | 'current' | 'new-window';

export type ProjectOpenTargetDialogRequest = {
    currentProjectPath?: string;
    dirtyCount: number;
    nextProjectPath: string;
};

type EditorDialogHandlers = {
    chooseProjectOpenTarget: (request: ProjectOpenTargetDialogRequest) => Promise<ProjectOpenTargetChoice>;
    confirm: (request: EditorConfirmDialogRequest) => Promise<boolean>;
};

let activeHandlers: EditorDialogHandlers | undefined;

export async function chooseProjectOpenTarget(request: ProjectOpenTargetDialogRequest): Promise<ProjectOpenTargetChoice> {
    if (activeHandlers) return activeHandlers.chooseProjectOpenTarget(request);
    return 'current';
}

export async function confirmEditorAction(request: EditorConfirmDialogRequest): Promise<boolean> {
    if (activeHandlers) return activeHandlers.confirm(request);
    console.warn('Editor confirmation requested before dialog handlers were registered:', request.title ?? request.message);
    return false;
}

export function registerEditorDialogHandlers(handlers: EditorDialogHandlers): () => void {
    activeHandlers = handlers;
    return () => {
        if (activeHandlers === handlers) activeHandlers = undefined;
    };
}
