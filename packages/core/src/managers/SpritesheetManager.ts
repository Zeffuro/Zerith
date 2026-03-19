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

    public destroy() {
        this.clear();
        this.loading.clear();
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
        const atlasData = this.toPixiAtlasData(await response.json());

        const atlasDirectory = config.atlasUrl.slice(0, Math.max(0, config.atlasUrl.lastIndexOf('/') + 1));
        const imageName = this.resolveImageName(atlasData);
        if (!imageName) {
            throw new Error(`Spritesheet descriptor is missing image source: ${config.atlasUrl}`);
        }
        const imagePath = this.isAbsoluteImagePath(imageName) ? imageName : atlasDirectory + imageName;

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

    private toPixiAtlasData(rawData: unknown): SpritesheetData {
        if (!isRecord(rawData)) {
            throw new Error('Spritesheet descriptor must be a JSON object.');
        }

        const frames = rawData.frames;
        if (!isRecord(frames)) {
            return rawData as unknown as SpritesheetData;
        }

        const normalizedFrames: Record<string, unknown> = {};
        let requiresNormalization = false;

        for (const [frameName, frameValue] of Object.entries(frames)) {
            if (!isRecord(frameValue)) {
                normalizedFrames[frameName] = frameValue;
                continue;
            }

            // Canonical descriptors store atlas frames as {x,y,w,h}; Pixi expects nested `frame` bounds.
            const hasRect = typeof frameValue.x === 'number'
                && typeof frameValue.y === 'number'
                && typeof frameValue.w === 'number'
                && typeof frameValue.h === 'number';

            if (!hasRect || isRecord(frameValue.frame)) {
                normalizedFrames[frameName] = frameValue;
                continue;
            }

            requiresNormalization = true;
            normalizedFrames[frameName] = {
                anchor: buildAnchor(frameValue),
                frame: {
                    h: frameValue.h,
                    w: frameValue.w,
                    x: frameValue.x,
                    y: frameValue.y,
                },
                rotated: false,
                sourceSize: {
                    h: frameValue.h,
                    w: frameValue.w,
                },
                spriteSourceSize: {
                    h: frameValue.h,
                    w: frameValue.w,
                    x: 0,
                    y: 0,
                },
                trimmed: false,
            };
        }

        if (!requiresNormalization) {
            return rawData as unknown as SpritesheetData;
        }

        return {
            ...rawData,
            frames: normalizedFrames,
        } as SpritesheetData;
    }

    private resolveImageName(atlasData: SpritesheetData): string | undefined {
        const candidate = atlasData as SpritesheetData & {
            meta?: SpritesheetData['meta'] & { image?: unknown };
            source?: unknown;
        };

        if (typeof candidate.meta?.image === 'string' && candidate.meta.image.length > 0) {
            return candidate.meta.image;
        }

        if (typeof candidate.source === 'string' && candidate.source.length > 0) {
            return candidate.source;
        }

        return undefined;
    }

    private isAbsoluteImagePath(path: string): boolean {
        return path.startsWith('/')
            || /^[a-zA-Z]+:\/\//.test(path)
            || /^[a-zA-Z]:[\\/]/.test(path);
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

function buildAnchor(frame: Record<string, unknown>): { x?: number; y?: number } | undefined {
    const anchorX = typeof frame.anchorX === 'number' ? frame.anchorX : undefined;
    const anchorY = typeof frame.anchorY === 'number' ? frame.anchorY : undefined;

    if (anchorX === undefined && anchorY === undefined) {
        return undefined;
    }

    return {
        x: anchorX,
        y: anchorY,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
