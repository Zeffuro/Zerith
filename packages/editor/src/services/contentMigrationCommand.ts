import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import {
    applyContentMigrationPreview,
    type ApplyContentMigrationPreviewResult,
    type ContentMigrationPreviewResult,
    previewContentMigration,
} from './contentMigrationPreview';
import { confirmEditorAction } from './editorDialogs';

export type ContentMigrationCommandConfirm = (message: string) => boolean | Promise<boolean>;

export type ContentMigrationCommandDependencies = {
    applyPreview: typeof applyContentMigrationPreview;
    confirm: ContentMigrationCommandConfirm;
    log: typeof executeConsoleMessageAction;
    preview: typeof previewContentMigration;
};

export type ContentMigrationCommandResult =
    | {
        application: ApplyContentMigrationPreviewResult;
        preview: ContentMigrationPreviewResult;
        status: 'applied' | 'conflicted';
    }
    | { preview: ContentMigrationPreviewResult; status: 'cancelled' | 'no-changes' }
    | { status: 'no-project' };

export type ContentMigrationCommandStatusTone = 'info' | 'success' | 'warning';

const defaultDependencies: ContentMigrationCommandDependencies = {
    applyPreview: applyContentMigrationPreview,
    confirm: (message) => confirmEditorAction({
        cancelText: 'Skip',
        confirmText: 'Migrate',
        message,
        title: 'Migrate Content Schema',
    }),
    log: executeConsoleMessageAction,
    preview: previewContentMigration,
};

export async function executeContentMigrationCommand(
    projectPath: string | undefined,
    dependencies: ContentMigrationCommandDependencies = defaultDependencies,
): Promise<ContentMigrationCommandResult> {
    if (!projectPath) {
        dependencies.log('editor', 'warn', 'Content migration requires an open project.');
        return { status: 'no-project' };
    }

    const preview = await dependencies.preview(projectPath);
    if (preview.changes.length === 0) {
        dependencies.log('editor', 'info', 'Content migration preview found no changes.');
        return { preview, status: 'no-changes' };
    }

    dependencies.log(
        'editor',
        'info',
        `Content migration preview found ${preview.changes.length} file(s):`,
        ...preview.changes.map((change) => change.path),
    );

    const accepted = await dependencies.confirm(toConfirmationMessage(preview));
    if (!accepted) {
        dependencies.log('editor', 'info', 'Content migration cancelled.');
        return { preview, status: 'cancelled' };
    }

    const application = await dependencies.applyPreview(preview);
    if (application.conflicts.length > 0) {
        dependencies.log(
            'editor',
            'warn',
            `Content migration wrote ${application.written.length} file(s), but ${application.conflicts.length} file(s) changed after preview:`,
            ...application.conflicts.map((change) => change.path),
        );
        return { application, preview, status: 'conflicted' };
    }

    dependencies.log('editor', 'info', `Content migration applied ${application.written.length} file(s).`);
    return { application, preview, status: 'applied' };
}

export function formatContentMigrationCommandStatus(result: ContentMigrationCommandResult): string {
    switch (result.status) {
        case 'applied': {
            return `Content migration applied ${result.application.written.length} file(s).`;
        }
        case 'cancelled': {
            return 'Content migration cancelled.';
        }
        case 'conflicted': {
            return `Content migration wrote ${result.application.written.length} file(s), but ${result.application.conflicts.length} file(s) changed after preview.`;
        }
        case 'no-changes': {
            return 'Content migration checked the project and found no changes.';
        }
        case 'no-project': {
            return 'Content migration requires an open project.';
        }
    }
}

export function getContentMigrationCommandStatusTone(result: ContentMigrationCommandResult): ContentMigrationCommandStatusTone {
    switch (result.status) {
        case 'applied': {
            return 'success';
        }
        case 'cancelled':
        case 'no-changes':
        case 'no-project': {
            return 'info';
        }
        case 'conflicted': {
            return 'warning';
        }
    }
}

function toConfirmationMessage(preview: ContentMigrationPreviewResult): string {
    const fileList = preview.changes
        .map((change) => `- ${change.path}`)
        .join('\n');

    return [
        `Migrate ${preview.changes.length} content file(s) to the current schema?`,
        '',
        fileList,
    ].join('\n');
}
