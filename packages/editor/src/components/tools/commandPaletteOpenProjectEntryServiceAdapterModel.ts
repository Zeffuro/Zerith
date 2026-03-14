type BuildCommandPaletteOpenProjectEntryServiceHandlerArguments = {
    openProjectEntryService: (path: string, name: string) => Promise<void>;
};

export function buildCommandPaletteOpenProjectEntryServiceHandler({
    openProjectEntryService,
}: BuildCommandPaletteOpenProjectEntryServiceHandlerArguments): (path: string, name: string) => Promise<void> {
    return async (path, name) => {
        await openProjectEntryService(path, name);
    };
}

