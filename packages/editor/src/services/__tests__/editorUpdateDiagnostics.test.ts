import { describe, expect, it } from 'vitest';

import { createEditorUpdateDiagnosticsReport, EDITOR_UPDATER_ENDPOINT } from '../editorUpdateDiagnostics';

describe('createEditorUpdateDiagnosticsReport', () => {
    it('formats desktop updater diagnostics for installed-build testing', () => {
        const report = createEditorUpdateDiagnosticsReport({
            checkForUpdatesOnStartup: true,
            currentVersion: '0.1.6',
            runtime: 'desktop',
        });

        expect(report).toContain('Current version: 0.1.6');
        expect(report).toContain('Runtime: desktop');
        expect(report).toContain('Update checks: available through Tauri updater');
        expect(report).toContain(`Updater endpoint: ${EDITOR_UPDATER_ENDPOINT}`);
        expect(report).toContain('publish a newer editor-v* release');
    });

    it('formats browser diagnostics without implying updater support', () => {
        const report = createEditorUpdateDiagnosticsReport({
            checkForUpdatesOnStartup: false,
            currentVersion: '0.1.6',
            runtime: 'browser',
        });

        expect(report).toContain('Runtime: browser');
        expect(report).toContain('Update checks: unavailable in browser runtime');
        expect(report).toContain('Startup check: disabled');
        expect(report).toContain('install a desktop build');
    });
});
