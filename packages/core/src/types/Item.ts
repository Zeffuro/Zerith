export interface ItemManifestEntry {
    name: string;
    description: string;
    imageUrl?: string;
    type?: string;
    [key: string]: any;
}