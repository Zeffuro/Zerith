export interface ItemManifestEntry {
    [key: string]: unknown;
    description: string;
    imageUrl?: string;
    name: string;
    schemaVersion?: 1 | 2;
    type?: string;
}
