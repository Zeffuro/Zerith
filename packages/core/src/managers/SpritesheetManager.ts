import type { SpritesheetData } from 'pixi.js';

import { ImageSource, Spritesheet, Texture } from 'pixi.js';

import type { AssetResolver } from '../Engine';
import type { SpritesheetConfig } from '../types';

import { applyChromaKey } from '../utils/ChromaKey';

export class SpritesheetManager {
    private loading: Map<string, Promise<Spritesheet>> = new Map();
    private sheets: Map<string, Spritesheet> = new Map();
    public clear() {
        this.sheets.clear();
    }

    public getFrame(atlasUrl: string, frameName: string): Texture | undefined {
        const sheet = this.sheets.get(atlasUrl);
        if (!sheet) return undefined;
        return sheet.textures[frameName];
    }

    public getFrameNames(atlasUrl: string): string[] {
        const sheet = this.sheets.get(atlasUrl);
        if (!sheet) return [];
        return Object.keys(sheet.textures);
    }

    public has(atlasUrl: string): boolean {
        return this.sheets.has(atlasUrl);
    }

    public async load(config: SpritesheetConfig): Promise<Spritesheet> {
        const key = config.atlasUrl;

        const existing = this.sheets.get(key);
        if (existing) return existing;

        const pending = this.loading.get(key);
        if (pending) return pending;

        const promise = this.doLoad(config);
        this.loading.set(key, promise);

        try {
            const sheet = await promise;
            this.sheets.set(key, sheet);
            return sheet;
        } finally {
            this.loading.delete(key);
        }
    }

    public setResolver(resolver: AssetResolver) {
        this.resolver = resolver;
    }

    private async doLoad(config: SpritesheetConfig): Promise<Spritesheet> {
        const resolvedAtlasUrl = this.resolver(config.atlasUrl);
        const response = await fetch(resolvedAtlasUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch spritesheet atlas: ${config.atlasUrl} (${response.status})`);
        }
        const atlasData = (await response.json()) as SpritesheetData;

        const atlasDirectory = config.atlasUrl.slice(0, Math.max(0, config.atlasUrl.lastIndexOf('/') + 1));
        const imageName = atlasData.meta?.image ?? '';
        const imagePath = imageName.startsWith('/') ? imageName : atlasDirectory + imageName;

        const img = await this.loadImage(this.resolver(imagePath));

        let texture: Texture;

        if (config.chromaKey) {
            const canvas = applyChromaKey(img, config.chromaKey, config.chromaTolerance ?? 30);
            const source = new ImageSource({ resource: canvas });
            texture = new Texture({ source });
        } else {
            const source = new ImageSource({ resource: img });
            texture = new Texture({ source });
        }

        const sheet = new Spritesheet(texture, atlasData);
        await sheet.parse();

        return sheet;
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.addEventListener('load', () => resolve(img));
            img.addEventListener('error', () => reject(new Error(`Failed to load image: ${url}`)));
            img.src = url;
        });
    }

    private resolver: AssetResolver = (url) => url;
}