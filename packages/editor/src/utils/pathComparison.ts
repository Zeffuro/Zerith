import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';

export function canonicalPathForComparison(path: string, native = isTauriRuntime()): string {
    const normalized = normalizePathForComparison(path, native);
    const prefix = native && normalized.startsWith('//') ? '//' : (normalized.startsWith('/') ? '/' : '');
    const parts: string[] = [];
    for (const part of normalized.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..' && parts.length > 0 && !parts.at(-1)?.endsWith(':')) parts.pop();
        else if (part !== '..') parts.push(part);
    }
    return `${prefix}${parts.join('/')}`;
}

export function normalizePathForComparison(path: string, native = isTauriRuntime()): string {
    const slashed = path.replaceAll('\\', '/');
    const trimmed = slashed.replace(/\/+$/u, '');
    const normalized = /^[a-z]:\/+$/iu.test(slashed) ? `${trimmed}/` : trimmed || (slashed.startsWith('/') ? '/' : '');
    const windowsPath = /^(?:[a-z]:\/|\/\/)/iu.test(normalized);
    return native && windowsPath ? normalized.toLowerCase() : normalized;
}
