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
    return descriptorPath.endsWith('.sheet.json')
        ? descriptorPath.slice(0, -'.sheet.json'.length)
        : descriptorPath;
}

export function getSheetDescriptorPath(assetPath: string): string {
    return `${stripTrailingExtension(assetPath)}.sheet.json`;
}

export function isSheetDescriptor(filename: string): boolean {
    return filename.endsWith('.sheet.json');
}

function stripTrailingExtension(path: string): string {
    const slashIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const dotIndex = path.lastIndexOf('.');

    if (dotIndex === -1 || dotIndex <= slashIndex) {
        return path;
    }

    return path.slice(0, dotIndex);
}


