export const EDITOR_UPDATER_ENDPOINT = 'https://github.com/Zeffuro/Zerith/releases/latest/download/latest.json';
export const EDITOR_UPDATE_RELEASE_NOTES_SOURCE = 'GitHub Releases editor-v*';

export type EditorUpdateDiagnosticsInput = {
    checkForUpdatesOnStartup: boolean;
    currentVersion: string;
    runtime: 'browser' | 'desktop';
    updaterEndpoint?: string;
};

export function createEditorUpdateDiagnosticsReport({
    checkForUpdatesOnStartup,
    currentVersion,
    runtime,
    updaterEndpoint = EDITOR_UPDATER_ENDPOINT,
}: EditorUpdateDiagnosticsInput): string {
    const updateChecks = runtime === 'desktop'
        ? 'available through Tauri updater'
        : 'unavailable in browser runtime';
    const nextTestStep = runtime === 'desktop'
        ? 'publish a newer editor-v* release, then run Help > Check for Updates from the installed older build'
        : 'install a desktop build before testing updater install/relaunch';

    return [
        'Editor update diagnostics',
        `Current version: ${currentVersion}`,
        `Runtime: ${runtime}`,
        `Update checks: ${updateChecks}`,
        `Startup check: ${checkForUpdatesOnStartup ? 'enabled' : 'disabled'}`,
        `Updater endpoint: ${updaterEndpoint}`,
        `Release notes source: ${EDITOR_UPDATE_RELEASE_NOTES_SOURCE}`,
        'Portable downloads: manual replacement only',
        `Next update test: ${nextTestStep}`,
    ].join('\n');
}
