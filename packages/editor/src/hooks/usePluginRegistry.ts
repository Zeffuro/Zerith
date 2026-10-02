import { useSyncExternalStore } from 'react';

import { getPluginRegistryRevision, subscribePluginRegistry } from '../plugins/pluginRegistryEvents';

export function usePluginRegistry(): number {
    return useSyncExternalStore(subscribePluginRegistry, getPluginRegistryRevision);
}
