type BuildCommandPaletteIsRunningArguments = {
    playTrigger: number;
    stopTrigger: number;
};

export function buildCommandPaletteIsRunning({
    playTrigger,
    stopTrigger,
}: BuildCommandPaletteIsRunningArguments): boolean {
    return playTrigger > stopTrigger;
}

