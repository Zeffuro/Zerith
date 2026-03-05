import { Logger } from './Logger';

const logger = new Logger('[Manifest]');

/**
 * Resolves a manifest value that can be either inline data or a file path string.
 * If it's a string, fetches and parses the JSON file.
 * If it's already an object/array, returns it as-is.
 */
export async function resolveManifestValue<T>(value: T | string): Promise<T> {
    if (typeof value === 'string') {
        try {
            const response = await fetch(value);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (err) {
            logger.error(`Failed to load manifest file: ${value}`, err);
            throw err;
        }
    }
    return value as T;
}

/**
 * Resolves a scenes map where values can be inline scripts or file paths.
 * Returns a flat Record<string, Script>.
 */
export async function resolveScenes(
    scenes: Record<string, any>
): Promise<Record<string, any[]>> {
    const resolved: Record<string, any[]> = {};
    const entries = Object.entries(scenes);

    await Promise.all(
        entries.map(async ([name, value]) => {
            resolved[name] = await resolveManifestValue<any[]>(value);
        })
    );

    return resolved;
}