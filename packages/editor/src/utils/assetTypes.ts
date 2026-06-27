export const IMG_EXT = new Set(['.avif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
export const AUDIO_EXT = new Set(['.m4a', '.mp3', '.ogg', '.wav']);
export const FONT_EXT = new Set(['.otf', '.ttf', '.woff', '.woff2']);
export const TEXT_EXT = new Set([
    '.css', '.csv', '.html', '.ini', '.js', '.jsx', '.md',
    '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml'
]);

export function getExtension(path: string): string {
    const index = path.lastIndexOf('.');
    return index === -1 ? '' : path.slice(index).toLowerCase();
}

