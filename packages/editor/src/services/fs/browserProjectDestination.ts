import type { BrowserDirectoryHandle, BrowserEntryHandle } from './browserFsAdapter';

import { writeBrowserFile } from './browserDirectoryTransfer';

const RESERVATION = '.zerith-project-reservation';

type LocatedDirectory = {
    handle?: BrowserDirectoryHandle;
    name: string;
    parent?: BrowserDirectoryHandle;
    path: string;
    visible: BrowserDirectoryHandle[];
};

export function createBrowserProjectDestination(roots: Map<string, BrowserDirectoryHandle>) {
    let pending = Promise.resolve();
    let sequence = 0;
    const reservations = new Map<string, { handle: BrowserDirectoryHandle; token: string }>();

    function locked<T>(operation: () => Promise<T>): Promise<T> {
        const result = pending.then(operation);
        pending = result.then(() => {}, () => {});
        return result;
    }

    return {
        finish: (path: string) => locked(async () => {
            const normalized = normalizePath(path);
            const reservation = reservations.get(normalized.toLowerCase());
            if (!reservation) throw new Error('This project destination is not reserved by this session.');
            const marker = await reservation.handle.getFileHandle(RESERVATION);
            const file = await marker.getFile();
            if (await file.text() !== reservation.token) {
                throw new Error('Project destination reservation changed. Partial output has been retained.');
            }
            await reservation.handle.removeEntry(RESERVATION);
            reservations.delete(normalized.toLowerCase());
        }),
        reserve: (path: string, sourcePath?: string) => locked(async () => {
            const target = await locateDirectory(path, roots, true);
            if (sourcePath !== undefined) {
                const source = await locateDirectory(sourcePath, roots, false);
                if (overlapsLexically(target.path, source.path)) throw sourceOverlap();
                await rejectSourceOverlap(source.handle!, target);
            }
            await rejectProjectAncestors(target, roots);
            if (target.handle) await assertEmpty(target.handle);

            // Browser handles offer observed-entry checks, not atomic exclusion of external writers.
            let mutationAttempted = !target.handle;
            try {
                const handle = target.handle ?? await target.parent!.getDirectoryHandle(target.name, { create: true });
                await assertEmpty(handle);
                await assertAbsent(handle, RESERVATION);
                mutationAttempted = true;
                const marker = await handle.getFileHandle(RESERVATION, { create: true });
                const token = `zerith-project:${Date.now()}:${++sequence}`;
                reservations.set(target.path.toLowerCase(), { handle, token });
                await writeBrowserFile(marker, token);
                await assertEmpty(handle, RESERVATION);
                return target.path;
            } catch (error) {
                if (!mutationAttempted) throw error;
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Project reservation failed. Partial output may remain at "${target.path}". ${message}`, { cause: error });
            }
        }),
        writeExclusive: (path: string, content: string | Uint8Array) => locked(async () => {
            const normalized = normalizePath(path);
            const split = normalized.lastIndexOf('/');
            const parent = await locateDirectory(normalized.slice(0, split), roots, false);
            const name = normalized.slice(split + 1);
            await assertAbsent(parent.handle!, name);
            const file = await parent.handle!.getFileHandle(name, { create: true });
            await writeBrowserFile(file, content);
        }),
    };
}

async function assertAbsent(handle: BrowserDirectoryHandle, name: string): Promise<void> {
    if (await findEntry(handle, name)) {
        throw Object.assign(new Error('Destination already exists.'), { code: 'alreadyExists' });
    }
}

async function assertEmpty(handle: BrowserDirectoryHandle, allowedName?: string): Promise<void> {
    for await (const [name] of handle.entries()) {
        if (name !== allowedName) throw new Error('Project destination must be a new or empty folder.');
    }
}

async function findEntry(handle: BrowserDirectoryHandle, name: string): Promise<[string, BrowserEntryHandle] | undefined> {
    let match: [string, BrowserEntryHandle] | undefined;
    for await (const entry of handle.entries()) {
        if (entry[0].toLowerCase() !== name.toLowerCase()) continue;
        if (match) throw new Error('Browser folder contains ambiguous entry names.');
        match = entry;
    }
    return match;
}

async function locateDirectory(path: string, roots: Map<string, BrowserDirectoryHandle>, allowMissing: boolean): Promise<LocatedDirectory> {
    const segments = normalizePath(path).slice(1).split('/');
    const mounted = [...roots].filter(([name]) => name.toLowerCase() === segments[0].toLowerCase());
    if (mounted.length !== 1) throw new Error('Browser project destination requires an unambiguous mounted folder.');
    const [rootName, root] = mounted[0];
    const canonical = [rootName];
    const visible = [root];
    let current = root;
    for (let index = 1; index < segments.length; index += 1) {
        const name = segments[index];
        const entry = await findEntry(current, name);
        if (!entry) {
            if (!allowMissing || index !== segments.length - 1) throw new Error('Project destination parent folder must already exist.');
            return { name, parent: current, path: `/${[...canonical, name].join('/')}`, visible };
        }
        if (entry[1].kind !== 'directory') throw new Error('Project destination is occupied by a file.');
        canonical.push(entry[0]);
        current = entry[1];
        visible.push(current);
    }
    return { handle: current, name: canonical.at(-1)!, path: `/${canonical.join('/')}`, visible };
}

function normalizePath(path: string): string {
    if (!path.startsWith('/') || path.includes('\\') || [...path].some(character => {
        const code = character.codePointAt(0)!;
        return code < 32 || code === 127;
    })) {
        throw new Error('Invalid browser project destination path.');
    }
    const segments: string[] = [];
    for (const segment of path.split('/').filter(Boolean)) {
        if (segment === '.') continue;
        if (segment === '..') {
            if (segments.length <= 1) throw new Error('Project destination cannot escape its mounted folder.');
            segments.pop();
        } else {
            if (/[<>:"|?*]/u.test(segment) || /[. ]$/u.test(segment)) {
                throw new Error('Invalid browser project destination path.');
            }
            segments.push(segment);
        }
    }
    if (segments.length === 0) throw new Error('The browser filesystem root cannot be a project destination.');
    return `/${segments.join('/')}`;
}

function overlapsLexically(left: string, right: string): boolean {
    const a = left.toLowerCase();
    const b = right.toLowerCase();
    return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

async function rejectProjectAncestors(target: LocatedDirectory, roots: Map<string, BrowserDirectoryHandle>): Promise<void> {
    const ancestors = new Set(target.visible.slice(0, target.handle ? -1 : undefined));
    const candidate = target.handle ?? target.parent!;
    for (const root of roots.values()) {
        if (root === candidate) {
            if (!target.handle) ancestors.add(root);
            continue;
        }
        if (!root.resolve) throw new Error('Cannot verify mounted browser project ancestry.');
        const relative = await root.resolve(candidate);
        if (relative === null) continue;
        let current = root;
        ancestors.add(current);
        const segments = target.handle ? relative.slice(0, -1) : relative;
        for (const name of segments) {
            current = await current.getDirectoryHandle(name);
            ancestors.add(current);
        }
    }
    for (const ancestor of ancestors) {
        if (await findEntry(ancestor, 'game.json')) {
            throw new Error('Project destination cannot be inside another project folder.');
        }
    }
}

async function rejectSourceOverlap(source: BrowserDirectoryHandle, target: LocatedDirectory): Promise<void> {
    const candidate = target.handle ?? target.parent!;
    if (!source.resolve || !candidate.resolve) throw new Error('Cannot verify browser project destination ancestry.');
    if (await source.isSameEntry?.(candidate) || await source.resolve(candidate) !== null) throw sourceOverlap();
    const relativeSource = await candidate.resolve(source);
    if (relativeSource !== null && (target.handle || relativeSource[0]?.toLowerCase() === target.name.toLowerCase())) {
        throw sourceOverlap();
    }
}

function sourceOverlap(): Error {
    return new Error('Project destination must be outside the source project and cannot contain it.');
}
