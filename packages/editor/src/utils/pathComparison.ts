import { isTauriRuntime } from '../services/runtime/runtimeEnvironment';

export function normalizePathForComparison(path: string, native = isTauriRuntime()): string {
    const slashed = path.replaceAll('\\', '/');
    const trimmed = slashed.replace(/\/+$/u, '');
    const normalized = /^[a-z]:\/+$/iu.test(slashed) ? `${trimmed}/` : trimmed || (slashed.startsWith('/') ? '/' : '');
    const windowsPath = /^(?:[a-z]:\/|\/\/)/iu.test(normalized);
    return native && windowsPath ? normalized.toLowerCase() : normalized;
}
