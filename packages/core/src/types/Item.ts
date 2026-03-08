export interface ItemManifestEntry {
    [key: string]: unknown;
    description: string;
    imageUrl?: string;
    name: string;
    type?: string;
}