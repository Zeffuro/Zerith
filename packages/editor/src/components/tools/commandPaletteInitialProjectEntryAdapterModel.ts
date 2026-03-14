import { openInitialProjectEntry } from './commandPaletteProjectEntry';

type BuildCommandPaletteInitialProjectEntryHandlerArguments = {
    getProjectState: GetProjectState;
    openProjectEntryService: OpenProjectEntry;
};

type GetProjectState = () => {
    expandToPath: (path: string) => void;
    manifest: { scenes?: Record<string, unknown>; startScene?: string } | undefined;
    projectPath: string | undefined;
};

type OpenProjectEntry = (path: string, name: string) => Promise<void>;

export function buildCommandPaletteInitialProjectEntryHandler({
    getProjectState,
    openProjectEntryService,
}: BuildCommandPaletteInitialProjectEntryHandlerArguments): () => Promise<void> {
    return async () => {
        const { expandToPath, manifest, projectPath } = getProjectState();

        await openInitialProjectEntry({
            expandToPath,
            manifest,
            openProjectEntry: async (path, name) => {
                await openProjectEntryService(path, name);
            },
            projectPath,
        });
    };
}

