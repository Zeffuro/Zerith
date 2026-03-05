import { Spritesheet, Texture, ImageSource, type SpritesheetData } from 'pixi.js';
import { applyChromaKey } from '../utils/ChromaKey';
import type { SpritesheetConfig } from '../types';

export class SpritesheetManager {
    private sheets: Map<string, Spritesheet> = new Map();
    private loading: Map<string, Promise<Spritesheet>> = new Map();

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

    private async doLoad(config: SpritesheetConfig): Promise<Spritesheet> {
        const response = await fetch(config.atlasUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch spritesheet atlas: ${config.atlasUrl} (${response.status})`);
        }
        const atlasData: SpritesheetData = await response.json();

        const atlasDir = config.atlasUrl.substring(0, config.atlasUrl.lastIndexOf('/') + 1);
        const imageName = atlasData.meta?.image ?? '';
        const imagePath = imageName.startsWith('/') ? imageName : atlasDir + imageName;

        const img = await this.loadImage(imagePath);

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

    public clear() {
        this.sheets.clear();
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }
}