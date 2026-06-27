import type { EditorPluginLoadResult } from '../../plugins/pluginDiscovery';

export type InstalledPluginLoadSummary = {
    message: string;
    registeredCount: number;
    rejectedCount: number;
    tone: 'error' | 'muted' | 'success' | 'warning';
};

export function createInstalledPluginLoadSummary(result: EditorPluginLoadResult): InstalledPluginLoadSummary {
    const registeredCount = result.registered.length;
    const rejectedCount = result.rejected.length;

    if (registeredCount === 0 && rejectedCount === 0) {
        return {
            message: 'No installed plugin packages found.',
            registeredCount,
            rejectedCount,
            tone: 'muted',
        };
    }

    if (rejectedCount === 0) {
        return {
            message: `Loaded ${registeredCount} plugin package${registeredCount === 1 ? '' : 's'}.`,
            registeredCount,
            rejectedCount,
            tone: 'success',
        };
    }

    if (registeredCount === 0) {
        return {
            message: `Blocked ${rejectedCount} plugin package${rejectedCount === 1 ? '' : 's'}.`,
            registeredCount,
            rejectedCount,
            tone: 'error',
        };
    }

    return {
        message: `Loaded ${registeredCount} plugin package${registeredCount === 1 ? '' : 's'}; blocked ${rejectedCount}.`,
        registeredCount,
        rejectedCount,
        tone: 'warning',
    };
}
