import { fsFinishProjectDestination, fsReserveProjectDestination } from './fs';

export type ProjectDestinationOptions = {
    isCurrent?: () => boolean;
    sourcePath?: string;
};

export function assertProjectDestinationCurrent(options: ProjectDestinationOptions): void {
    if (options.isCurrent && !options.isCurrent()) {
        throw new Error('The project or request changed. Start again.');
    }
}

export async function withProjectDestination<T>(
    path: string,
    options: ProjectDestinationOptions,
    write: (reservedPath: string, check: () => void) => Promise<T>,
): Promise<T> {
    const check = () => assertProjectDestinationCurrent(options);
    check();
    const reservedPath = await fsReserveProjectDestination(path, options.sourcePath);
    try {
        check();
        const result = await write(reservedPath, check);
        check();
        await fsFinishProjectDestination(reservedPath);
        check();
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message
            : (error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error));
        throw new Error(`${message} Partial project output remains at ${reservedPath}. Choose another empty folder or inspect this folder before retrying.`, { cause: error });
    }
}
