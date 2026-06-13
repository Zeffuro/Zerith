const CANONICAL_DESCRIPTOR_SUFFIX = '.sheet.json';

export function detectDescriptorType(data: unknown): 'audiosheet' | 'spritesheet' | 'unknown' {
    if (typeof data !== 'object' || data === null) {
        return 'unknown';
    }

    const candidate = data as Record<string, unknown>;
    const hasSource = typeof candidate.source === 'string';

    if (!hasSource) {
        return 'unknown';
    }

    if (typeof candidate.format === 'string') {
        return 'spritesheet';
    }

    if (typeof candidate.cues === 'object' && candidate.cues !== null) {
        return 'audiosheet';
    }

    return 'unknown';
}

export function getAssetPathFromDescriptor(descriptorPath: string): string {
    if (descriptorPath.endsWith(CANONICAL_DESCRIPTOR_SUFFIX)) {
        return descriptorPath.slice(0, -CANONICAL_DESCRIPTOR_SUFFIX.length);
    }

    return descriptorPath;
}

export function getSheetDescriptorCandidatePaths(assetPath: string): string[] {
    const basePath = stripTrailingExtension(assetPath);
    return [`${basePath}${CANONICAL_DESCRIPTOR_SUFFIX}`];
}

export function getSheetDescriptorPath(assetPath: string): string {
    return `${stripTrailingExtension(assetPath)}${CANONICAL_DESCRIPTOR_SUFFIX}`;
}

export function isSheetDescriptor(filename: string): boolean {
    return filename.endsWith(CANONICAL_DESCRIPTOR_SUFFIX);
}

function stripTrailingExtension(path: string): string {
    const slashIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const dotIndex = path.lastIndexOf('.');

    if (dotIndex === -1 || dotIndex <= slashIndex) {
        return path;
    }

    return path.slice(0, dotIndex);
}


