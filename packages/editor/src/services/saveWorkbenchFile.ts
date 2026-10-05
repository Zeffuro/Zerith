import { useWorkbenchStore } from '../store/useWorkbenchStore';
import { fsWriteTextFile } from './fs';

export async function saveWorkbenchTextFile(path: string, content: string, isCurrent?: () => boolean): Promise<void> {
    const checkCurrent = () => {
        if (isCurrent && !isCurrent()) throw new Error('Project changed while saving. The current project was kept.');
    };
    checkCurrent();
    const tab = useWorkbenchStore.getState().tabs.find((entry) => entry.path === path);
    const previousText = tab?.textContent;
    const options = tab?.savedTextContent === undefined ? undefined : { expectedContent: tab.savedTextContent };
    await (isCurrent ? fsWriteTextFile(path, content, options, isCurrent) : fsWriteTextFile(path, content, options));
    checkCurrent();
    if (tab) {
        const current = useWorkbenchStore.getState().tabs.find((entry) => entry.id === tab.id && entry.path === path);
        if (!current || current.savedTextContent !== tab.savedTextContent) throw new Error('File saved, but its editor changed while saving. Review the current edit.');
        useWorkbenchStore.getState().setTabSavedContent(tab.id, content);
        if (current.textContent !== previousText) throw new Error('Earlier revision saved. Newer edits remain unsaved.');
    }
}
