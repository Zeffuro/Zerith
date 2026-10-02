import type { BrowserDirectoryHandle } from './browserFsAdapter';
import type { BrowserProjectHandleStorage, BrowserStoredProject } from './browserProjectHandleStorage';

export type BrowserRecentProject = Omit<BrowserStoredProject, 'handle'>;

type Mounts = {
    get: (path: string) => BrowserDirectoryHandle | undefined;
    mount: (handle: BrowserDirectoryHandle, path: string) => void;
    mounted: () => Iterable<[string, BrowserDirectoryHandle]>;
};

export function createBrowserProjectRegistry(storage: BrowserProjectHandleStorage, mounts: Mounts) {
    let projects: BrowserStoredProject[] = [];
    let snapshot: BrowserRecentProject[] = [];
    let loading: Promise<void> | undefined;
    let pending = Promise.resolve();
    const listeners = new Set<() => void>();

    function publish(next: BrowserStoredProject[]) {
        projects = next;
        snapshot = next.map(({ lastOpened, name, path }) => ({ lastOpened, name, path }));
        for (const listener of listeners) listener();
    }

    function ready(): Promise<void> {
        loading ??= storage.load().then(loaded => {
            publish(loaded.toSorted((a, b) => b.lastOpened - a.lastOpened).slice(0, 12));
        });
        return loading;
    }

    function update(change: () => BrowserStoredProject[] | Promise<BrowserStoredProject[]>): Promise<void> {
        const operation = pending.then(async () => {
            await ready();
            const next = await change();
            await storage.replace(next);
            publish(next);
        });
        pending = operation.catch(() => {});
        return operation;
    }

    async function mount(handle: BrowserDirectoryHandle, path: string) {
        const existing = mounts.get(path);
        if (existing && await sameDirectory(handle, existing)) return;
        mounts.mount(handle, path);
    }

    return {
        clear: () => update(() => []),
        getSnapshot: () => snapshot,
        mountPicked: async (handle: BrowserDirectoryHandle): Promise<string> => {
            for (const [path, mounted] of mounts.mounted()) {
                if (await sameDirectory(handle, mounted)) return path;
            }
            // A failed recent-project store must not prevent opening a picked folder.
            await ready().catch(() => {});
            for (const project of projects) {
                if (await sameDirectory(handle, project.handle)) {
                    await mount(handle, mountedRootPath(project.path));
                    return mountedRootPath(project.path);
                }
                try {
                    if (await sameDirectory(handle, await projectDirectory(project.handle, project.path))) {
                        await mount(project.handle, mountedRootPath(project.path));
                        return project.path.slice(0, -'/game.json'.length);
                    }
                } catch {
                    // Inaccessible handles do not establish directory identity.
                }
            }
            const name = handle.name.replaceAll(/[^\w.-]+/gu, '-').replaceAll(/^-|-$/gu, '') || 'project';
            const path = `/${name}-${globalThis.crypto.randomUUID()}`;
            mounts.mount(handle, path);
            return path;
        },
        ready,
        remember: (manifestPath: string): Promise<void> => {
            const rootPath = mountedRootPath(manifestPath);
            const handle = manifestPath.endsWith('/game.json') ? mounts.get(rootPath) : undefined;
            if (!handle) return Promise.resolve();
            return update(async () => {
                const directory = await projectDirectory(handle, manifestPath);
                const matches: BrowserStoredProject[] = [];
                for (const project of projects) {
                    try {
                        if (await sameDirectory(directory, await projectDirectory(project.handle, project.path))) {
                            matches.push(project);
                        }
                    } catch {
                        // Preserve records whose directory identity cannot be checked.
                    }
                }
                const existing = matches[0];
                return [
                    {
                        handle: existing?.handle ?? handle,
                        lastOpened: Date.now(),
                        name: await projectName(directory),
                        path: existing?.path ?? manifestPath,
                    },
                    ...projects.filter(project => project.path !== manifestPath && !matches.includes(project)),
                ].slice(0, 12);
            });
        },
        restore: async (manifestPath: string): Promise<boolean> => {
            const project = projects.find(entry => entry.path === manifestPath);
            if (!project) throw new Error('This recent project is unavailable. Open its folder again.');
            try {
                // Start before any other await so the click retains user activation.
                if (project.handle.requestPermission
                    && await project.handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                    throw new Error('Folder access was denied. Your current project is still open.');
                }
                await validateBrowserProject(await projectDirectory(project.handle, manifestPath));
                await mount(project.handle, mountedRootPath(manifestPath));
                return true;
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return false;
                throw error;
            }
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
}

export async function validateBrowserProject(handle: BrowserDirectoryHandle): Promise<void> {
    const fileHandle = await handle.getFileHandle('game.json');
    const file = await fileHandle.getFile();
    const parsed: unknown = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('Project game.json must contain a JSON object.');
    }
    for await (const entry of handle.entries()) void entry;
}

function mountedRootPath(path: string): string {
    return `/${path.split('/').find(Boolean) ?? ''}`;
}

async function projectDirectory(handle: BrowserDirectoryHandle, manifestPath: string): Promise<BrowserDirectoryHandle> {
    let directory = handle;
    for (const name of manifestPath.split('/').filter(Boolean).slice(1, -1)) {
        if (name === '.' || name === '..') throw new Error('Project paths cannot contain traversal segments.');
        directory = await directory.getDirectoryHandle(name);
    }
    return directory;
}

async function projectName(directory: BrowserDirectoryHandle): Promise<string> {
    try {
        const fileHandle = await directory.getFileHandle('game.json');
        const file = await fileHandle.getFile();
        const manifest: unknown = JSON.parse(await file.text());
        if (manifest && typeof manifest === 'object' && 'title' in manifest
            && typeof manifest.title === 'string' && manifest.title.trim()) return manifest.title.trim();
    } catch {
        // Naming must not prevent remembering an otherwise usable folder.
    }
    return directory.name;
}

async function sameDirectory(a: BrowserDirectoryHandle, b: BrowserDirectoryHandle): Promise<boolean> {
    if (a === b) return true;
    try {
        return await a.isSameEntry?.(b) ?? false;
    } catch {
        return false;
    }
}
