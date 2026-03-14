type BuildCommandPaletteSaveHandlersArguments = {
    saveActiveFileFromCurrentScript: () => Promise<unknown>;
    saveAllDirtyFiles: () => Promise<unknown>;
};

export function buildCommandPaletteSaveHandlers({
    saveActiveFileFromCurrentScript,
    saveAllDirtyFiles,
}: BuildCommandPaletteSaveHandlersArguments): {
    saveActiveFileFromCurrentScript: () => Promise<void>;
    saveAllDirtyFiles: () => Promise<void>;
} {
    return {
        saveActiveFileFromCurrentScript: async () => {
            await saveActiveFileFromCurrentScript();
        },
        saveAllDirtyFiles: async () => {
            await saveAllDirtyFiles();
        },
    };
}

