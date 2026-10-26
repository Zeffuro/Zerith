import type { SpritesheetData } from 'pixi.js';

import { ImageSource, Spritesheet, Texture } from 'pixi.js';

import type { AssetResolver } from '../Engine';
import type { SpritesheetConfig } from '../types';

import { applyChromaKey } from '../utils/ChromaKey';

type PendingSheet = { abort: AbortController; cancel: () => void; promise: Promise<Spritesheet> };

export class SpritesheetManager {
    private destroyed = false;
    private loading = new Map<string, PendingSheet>();
    private readonly ownedSheets = new Set<Spritesheet>();
    private sheets: Map<string, Spritesheet> = new Map();

    public clear() {
        this.sheets.clear();
    }

    public destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const pending of this.loading.values()) {
            pending.cancel();
            pending.abort.abort();
        }
        for (const sheet of this.ownedSheets) sheet.destroy(true);
        this.ownedSheets.clear();
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

    public load(config: SpritesheetConfig): Promise<Spritesheet> {
        if (this.destroyed) return Promise.reject(new Error('Spritesheet manager is destroyed.'));
        const key = config.atlasUrl;

        const existing = this.sheets.get(key);
        if (existing) return Promise.resolve(existing);

        const pending = this.loading.get(key);
        if (pending) return pending.promise;

        let resolveLoad!: (sheet: Spritesheet) => void;
        let rejectLoad!: (error: unknown) => void;
        const load = {
            abort: new AbortController(),
            cancel: () => rejectLoad(new Error('Spritesheet manager was destroyed while loading.')),
            promise: new Promise<Spritesheet>((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; }),
        };
        this.loading.set(key, load);
        const completion = this.doLoad(config, load.abort.signal).then(sheet => {
            if (this.destroyed) {
                sheet.destroy(true);
                throw new Error('Spritesheet manager was destroyed while loading.');
            }
            this.ownedSheets.add(sheet);
            this.sheets.set(key, sheet);
            return sheet;
        }).finally(() => {
            if (this.loading.get(key) === load) this.loading.delete(key);
        });
        void completion.then(resolveLoad, rejectLoad);
        return load.promise;
    }

    public setResolver(resolver: AssetResolver) {
        this.resolver = resolver;
    }

    private assertActive(signal: AbortSignal) {
        if (this.destroyed || signal.aborted) throw new Error('Spritesheet manager was destroyed while loading.');
    }

    private async doLoad(config: SpritesheetConfig, signal: AbortSignal): Promise<Spritesheet> {
        const resolvedAtlasUrl = await this.resolve(config.atlasUrl);
        this.assertActive(signal);
        const response = await fetch(resolvedAtlasUrl, { signal });
        this.assertActive(signal);
        if (!response.ok) {
            throw new Error(`Failed to fetch spritesheet atlas: ${config.atlasUrl} (${response.status})`);
        }
        const atlasData = this.toPixiAtlasData(await response.json());
        this.assertActive(signal);

        const atlasDirectory = config.atlasUrl.slice(0, Math.max(0, config.atlasUrl.lastIndexOf('/') + 1));
        const imageName = this.resolveImageName(atlasData);
        if (!imageName) {
            throw new Error(`Spritesheet descriptor is missing image source: ${config.atlasUrl}`);
        }
        const imagePath = this.isAbsoluteImagePath(imageName) ? imageName : atlasDirectory + imageName;

        const imageUrl = await this.resolve(imagePath);
        this.assertActive(signal);
        const img = await this.loadImage(imageUrl, signal);
        this.assertActive(signal);
        let source: ImageSource | undefined;
        let texture: Texture | undefined;
        let sheet: Spritesheet | undefined;
        try {
            const resource = config.chromaKey ? applyChromaKey(img, config.chromaKey, config.chromaTolerance ?? 30) : img;
            source = new ImageSource({ resource });
            texture = new Texture({ source });
            sheet = new Spritesheet(texture, atlasData);
            // Pixi's parse batches still need their textures until the promise settles.
            await sheet.parse();
            this.assertActive(signal);
            return sheet;
        } catch (error) {
            if (sheet) sheet.destroy(true);
            else if (texture) texture.destroy(true);
            else source?.destroy();
            throw error;
        }
    }

    private isAbsoluteImagePath(path: string): boolean {
        return path.startsWith('/')
            || /^[a-zA-Z]+:\/\//.test(path)
            || /^[a-zA-Z]:[\\/]/.test(path);
    }

    private loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const cleanup = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                signal.removeEventListener('abort', onAbort);
            };
            const onLoad = () => { cleanup(); resolve(img); };
            const onError = () => { cleanup(); reject(new Error(`Failed to load image: ${url}`)); };
            const onAbort = () => {
                cleanup();
                img.src = '';
                reject(new Error('Spritesheet manager was destroyed while loading.'));
            };
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) { onAbort(); return; }
            img.src = url;
        });
    }

    private async resolve(url: string): Promise<string> {
        return this.resolver(url);
    }

    private resolveImageName(atlasData: SpritesheetData): string | undefined {
        const candidate = atlasData as {
            meta?: { image?: unknown } & SpritesheetData['meta'];
            source?: unknown;
        } & SpritesheetData;

        if (typeof candidate.meta?.image === 'string' && candidate.meta.image.length > 0) {
            return candidate.meta.image;
        }

        if (typeof candidate.source === 'string' && candidate.source.length > 0) {
            return candidate.source;
        }

        return undefined;
    }

    private resolver: AssetResolver = (url) => url;

    private toPixiAtlasData(rawData: unknown): SpritesheetData {
        if (!isRecord(rawData)) {
            throw new Error('Spritesheet descriptor must be a JSON object.');
        }

        const frames = rawData.frames;
        if (!isRecord(frames)) {
            throw new Error('Spritesheet frames must be a JSON object.');
        }
        if (rawData.animations !== undefined && (!isRecord(rawData.animations)
            || Object.entries(rawData.animations).some(([name, animation]) => name === '__proto__'
                || !Array.isArray(animation)
                || animation.some(frameName => typeof frameName !== 'string' || frameName === '__proto__')))) {
            throw new Error('Spritesheet animations must contain safe names and string frame arrays.');
        }

        const normalizedFrames: Record<string, unknown> = {};
        let requiresNormalization = false;

        for (const [frameName, frameValue] of Object.entries(frames)) {
            if (frameName === '__proto__') throw new Error('Spritesheet frame names must not contain __proto__.');
            if (!isRecord(frameValue)) {
                throw new Error(`Spritesheet frame '${frameName}' must be a JSON object.`);
            }

            const nestedFrame = frameValue.frame;
            validateFrameBounds(frameName, 'frame', nestedFrame === undefined ? frameValue : nestedFrame, ['x', 'y', 'w', 'h']);
            if (frameValue.sourceSize !== undefined) validateFrameBounds(frameName, 'sourceSize', frameValue.sourceSize, ['w', 'h']);
            if (frameValue.spriteSourceSize !== undefined) validateFrameBounds(frameName, 'spriteSourceSize', frameValue.spriteSourceSize, ['x', 'y', 'w', 'h']);
            if (nestedFrame !== undefined) {
                normalizedFrames[frameName] = frameValue;
                continue;
            }

            // Canonical descriptors store atlas frames as {x,y,w,h}; Pixi expects nested `frame` bounds.
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

function validateFrameBounds(frameName: string, field: string, value: unknown, dimensions: string[]) {
    if (!isRecord(value) || dimensions.some(dimension => typeof value[dimension] !== 'number' || !Number.isFinite(value[dimension]))) {
        throw new Error(`Spritesheet frame '${frameName}' ${field} must contain finite numeric bounds.`);
    }
}
