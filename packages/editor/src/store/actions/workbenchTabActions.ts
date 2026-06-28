import { activateWorkbenchTab } from '../../services/activateWorkbenchTab';
import { useWorkbenchStore } from '../useWorkbenchStore';

export type ExecuteWorkbenchTabActionOptions =
    | { action: 'activate' | 'close' | 'closeOthers' | 'closeToRight'; tabId: string }
    | { action: 'reorder'; fromId: string; toIndex: number };

export type WorkbenchTabAction = 'activate' | 'close' | 'closeOthers' | 'closeToRight' | 'reorder';

export function executeWorkbenchTabAction(options: ExecuteWorkbenchTabActionOptions): void {
    const state = useWorkbenchStore.getState();

    switch (options.action) {
        case 'activate': {
            void activateWorkbenchTab(options.tabId);
            return;
        }
        case 'close': {
            state.closeTab(options.tabId);
            activateCurrentWorkbenchTab();
            return;
        }
        case 'closeOthers': {
            state.closeOthers(options.tabId);
            activateCurrentWorkbenchTab();
            return;
        }
        case 'closeToRight': {
            state.closeToRight(options.tabId);
            activateCurrentWorkbenchTab();
            return;
        }
        case 'reorder': {
            reorderTabs(options.fromId, options.toIndex);
            return;
        }
    }
}

function activateCurrentWorkbenchTab(): void {
    const activeTabId = useWorkbenchStore.getState().activeTabId;
    if (activeTabId) void activateWorkbenchTab(activeTabId);
}

function reorderTabs(fromId: string, toIndexRaw: number): void {
    useWorkbenchStore.setState((state) => {
        const fromIndex = state.tabs.findIndex((tab) => tab.id === fromId);
        if (fromIndex === -1) return {};

        const list = [...state.tabs];
        const [moved] = list.splice(fromIndex, 1);

        let toIndex = toIndexRaw;
        if (fromIndex < toIndex) toIndex -= 1;
        toIndex = Math.max(0, Math.min(toIndex, list.length));

        list.splice(toIndex, 0, moved);

        return {
            activeTabId: state.activeTabId ?? moved.id,
            tabs: list,
        };
    });
}

