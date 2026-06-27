import { Logger } from './Logger';

const logger = new Logger('[Manifest]');

/**
 * Resolves a manifest value that can be either inline data or a file path string.
 * If it's a string, fetches and parses the JSON file.
 * If it's already an object/array, returns it as-is.
 */
export async function resolveManifestValue<T>(value: string | T): Promise<T> {
    if (typeof value === 'string') {
        try {
            const response = await fetch(value);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return (await response.json()) as T;
        } catch (error) {
            logger.error(`Failed to load manifest file: ${value}`, error);
            throw error;
        }
    }
    return value;
}

/**
 * Resolves a scenes map where values can be inline scripts or file paths.
 * Returns the parsed JSON payload for each scene; callers decide whether it is
 * a legacy script array or a versioned scene envelope.
 */
export async function resolveScenes(
    scenes: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const resolved: Record<string, unknown> = {};
    const entries = Object.entries(scenes);

    await Promise.all(
        entries.map(async ([name, value]) => {
            resolved[name] = await resolveManifestValue<unknown>(value);
        })
    );

    return resolved;
}
