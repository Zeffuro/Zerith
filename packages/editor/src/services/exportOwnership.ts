export type ExportOwnership = () => boolean;

export function assertExportCurrent(isCurrent: ExportOwnership): void {
    if (!isCurrent()) throw new Error('Export cancelled because the project or export dialog changed.');
}
