export function getDefaultContentForNewFile(name: string): string {
    return name.toLowerCase().endsWith('.json') ? '[]\n' : '';
}
