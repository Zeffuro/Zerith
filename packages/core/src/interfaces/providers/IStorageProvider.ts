export interface IStorageProvider {
    getItem(key: string): string | undefined;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
}
