import type { MockInstance } from 'vitest';

import { ImageSource, Spritesheet, Texture } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpritesheetManager } from '../SpritesheetManager';

class FakeImage extends EventTarget {
    public crossOrigin = '';
    public height = 64;
    public width = 64;
    public get src() { return this.url; }

    public set src(value: string) {
        this.url = value;
        if (value && autoImages) queueMicrotask(() => this.dispatchEvent(new Event('load')));
    }

    private url = '';
    constructor() {
        super();
        images.push(this);
    }
}

const descriptor = {
    frames: { idle: { anchorX: 0.5, h: 16, w: 32, x: 0, y: 0 } },
    meta: { image: 'characters.png', scale: '1' },
};
const uncoercible = JSON.parse('{"toString":null,"valueOf":null}') as Record<string, unknown>;
let images: FakeImage[];
let autoImages: boolean;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let sheetDestroy: MockInstance<Spritesheet['destroy']>;
let sourceDestroy: MockInstance<ImageSource['destroy']>;
let textureDestroy: MockInstance<Texture['destroy']>;

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, reject, resolve };
}

async function flush() {
    for (let index = 0; index < 20; index++) await Promise.resolve();
}

function response(data: unknown = descriptor): Response {
    return { json: () => Promise.resolve(data), ok: true, status: 200 } as Response;
}

describe('SpritesheetManager ownership', () => {
    beforeEach(() => {
        images = [];
        autoImages = true;
        fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response());
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('Image', FakeImage);
        sheetDestroy = vi.spyOn(Spritesheet.prototype, 'destroy');
        sourceDestroy = vi.spyOn(ImageSource.prototype, 'destroy');
        textureDestroy = vi.spyOn(Texture.prototype, 'destroy');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('deduplicates loads, preserves normalized frames and disposes real Pixi resources once', async () => {
        const manager = new SpritesheetManager();
        const resolve = vi.fn((url: string) => `resolved:${url}`);
        manager.setResolver(resolve);
        const pending = manager.load({ atlasUrl: 'characters/atlas.json' });
        expect(manager.load({ atlasUrl: 'characters/atlas.json' })).toBe(pending);
        const sheet = await pending;
        const frame = manager.getFrame('characters/atlas.json', 'idle')!;
        const source = sheet.textureSource;
        expect(resolve.mock.calls).toEqual([['characters/atlas.json'], ['characters/characters.png']]);
        expect(manager.has('characters/atlas.json')).toBe(true);
        expect(manager.getFrameNames('characters/atlas.json')).toEqual(['idle']);
        expect(frame.frame.width).toBe(32);
        expect(frame.defaultAnchor?.x).toBe(0.5);
        expect(await manager.load({ atlasUrl: 'characters/atlas.json' })).toBe(sheet);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        manager.destroy();
        manager.destroy();
        expect(sheetDestroy).toHaveBeenCalledExactlyOnceWith(true);
        expect(sourceDestroy).toHaveBeenCalledTimes(1);
        expect(textureDestroy).toHaveBeenCalledTimes(2);
        expect(source.destroyed).toBe(true);
        expect(frame.destroyed).toBe(true);
        expect(manager.getFrameNames('characters/atlas.json')).toEqual([]);
        expect(manager.getFrame('characters/atlas.json', 'idle')).toBeUndefined();
        await expect(manager.load({ atlasUrl: 'characters/atlas.json' })).rejects.toThrow('destroyed');
    });

    it('clear evicts lookups while retaining live frame references until manager destruction', async () => {
        const manager = new SpritesheetManager();
        const first = await manager.load({ atlasUrl: 'atlas.json' });
        const frame = first.textures.idle;
        manager.clear();
        expect(manager.has('atlas.json')).toBe(false);
        expect(frame.destroyed).toBe(false);
        const second = await manager.load({ atlasUrl: 'atlas.json' });
        expect(second).not.toBe(first);
        expect(first.textureSource.destroyed).toBe(false);
        manager.destroy();
        expect(sheetDestroy).toHaveBeenCalledTimes(2);
        expect(sourceDestroy).toHaveBeenCalledTimes(2);
        expect(textureDestroy).toHaveBeenCalledTimes(4);
    });

    it('preserves nested Pixi frames and absolute image sources', async () => {
        fetchMock.mockResolvedValueOnce(response({
            frames: { idle: { frame: { h: 16, w: 32, x: 2, y: 3 }, trimmed: false } },
            meta: { scale: '1' },
            source: 'https://example.com/characters.png',
        }));
        const manager = new SpritesheetManager();
        const resolve = vi.fn((url: string) => url);
        manager.setResolver(resolve);
        await manager.load({ atlasUrl: 'atlas.json' });
        expect(resolve.mock.calls).toEqual([['atlas.json'], ['https://example.com/characters.png']]);
        expect(manager.getFrame('atlas.json', 'idle')?.frame).toMatchObject({ height: 16, width: 32, x: 2, y: 3 });
        manager.destroy();
    });

    it('owns and disposes the chroma-key canvas source', async () => {
        const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
        const context = { drawImage: vi.fn(), getImageData: () => ({ data: pixels }), putImageData: vi.fn() };
        const canvas = { getContext: () => context, height: 0, width: 0 };
        vi.stubGlobal('document', { createElement: () => canvas });
        const manager = new SpritesheetManager();
        const sheet = await manager.load({ atlasUrl: 'atlas.json', chromaKey: '#ff0000' });
        const source = sheet.textureSource;
        expect(source.resource).toBe(canvas);
        expect(context.drawImage).toHaveBeenCalledWith(images[0], 0, 0);
        expect(pixels).toEqual(new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 255]));
        manager.destroy();
        expect(source.destroyed).toBe(true);
        expect(sourceDestroy).toHaveBeenCalledTimes(1);
        expect(textureDestroy).toHaveBeenCalledTimes(2);
    });

    it('preserves valid nested source sizes, trimmed offsets and string animations', async () => {
        fetchMock.mockResolvedValueOnce(response({
            ...descriptor,
            animations: { walk: ['idle'] },
            frames: { idle: {
                frame: { h: 16, w: 32, x: 2, y: 3 },
                sourceSize: { h: 64, w: 64 },
                spriteSourceSize: { h: 16, w: 32, x: 1, y: 2 },
                trimmed: true,
            } },
        }));
        const manager = new SpritesheetManager();
        const sheet = await manager.load({ atlasUrl: 'atlas.json' });
        const frame = sheet.textures.idle;
        expect(frame.orig).toMatchObject({ height: 64, width: 64 });
        expect(frame.trim).toMatchObject({ height: 16, width: 32, x: 1, y: 2 });
        expect(sheet.animations.walk).toEqual([frame]);
        manager.destroy();
    });

    it.each(['atlas.json', 'different.json'])('isolates resources across manager instances (%s)', async secondUrl => {
        const first = new SpritesheetManager();
        const second = new SpritesheetManager();
        const oldSheet = await first.load({ atlasUrl: 'atlas.json' });
        const newSheet = await second.load({ atlasUrl: secondUrl });
        const oldFrame = oldSheet.textures.idle;
        const newFrame = newSheet.textures.idle;
        expect(oldSheet.textureSource).not.toBe(newSheet.textureSource);
        first.destroy();
        expect(oldFrame.destroyed).toBe(true);
        expect(newFrame.destroyed).toBe(false);
        expect(second.getFrame(secondUrl, 'idle')).toBe(newFrame);
        expect(newSheet.textureSource.destroyed).toBe(false);
        second.destroy();
        expect(sheetDestroy).toHaveBeenCalledTimes(2);
        expect(sourceDestroy).toHaveBeenCalledTimes(2);
    });

    it.each(['atlas', 'image'])('rejects destruction during the %s resolver and ignores its late result', async stage => {
        const resolved = deferred<string>();
        const manager = new SpritesheetManager();
        manager.setResolver(url => (url.endsWith('.json') === (stage === 'atlas')) ? resolved.promise : url);
        const pending = manager.load({ atlasUrl: 'atlas.json' });
        const rejected = expect(pending).rejects.toThrow('destroyed');
        await flush();
        manager.destroy();
        await rejected;
        resolved.resolve('late.png');
        await flush();
        expect(images).toHaveLength(0);
        expect(sheetDestroy).not.toHaveBeenCalled();
        expect(manager.has('atlas.json')).toBe(false);
    });

    it.each(['success', 'failure'])('aborts pending atlas fetch and ignores late %s', async outcome => {
        const fetched = deferred<Response>();
        fetchMock.mockReturnValueOnce(fetched.promise);
        const first = new SpritesheetManager();
        const pending = first.load({ atlasUrl: 'atlas.json' });
        const rejected = expect(pending).rejects.toThrow('destroyed');
        await flush();
        const options = fetchMock.mock.calls[0][1] as RequestInit;
        first.destroy();
        await rejected;
        expect(options.signal?.aborted).toBe(true);
        const second = new SpritesheetManager();
        const newSheet = await second.load({ atlasUrl: 'atlas.json' });
        if (outcome === 'success') fetched.resolve(response());
        else fetched.reject(new Error('Old fetch failed'));
        await flush();
        expect(first.has('atlas.json')).toBe(false);
        expect(second.getFrame('atlas.json', 'idle')).toBe(newSheet.textures.idle);
        expect(sourceDestroy).not.toHaveBeenCalled();
        expect(images).toHaveLength(1);
        second.destroy();
    });

    it('ignores a late descriptor body after destroy', async () => {
        const body = deferred<unknown>();
        fetchMock.mockResolvedValueOnce({ ...response(), json: () => body.promise });
        const manager = new SpritesheetManager();
        const pending = manager.load({ atlasUrl: 'atlas.json' });
        const rejected = expect(pending).rejects.toThrow('destroyed');
        await flush();
        manager.destroy();
        await rejected;
        body.resolve(descriptor);
        await flush();
        expect(images).toHaveLength(0);
        expect(manager.has('atlas.json')).toBe(false);
    });

    it('detaches pending image callbacks on cancellation and cannot allocate from late image events', async () => {
        autoImages = false;
        const remove = vi.spyOn(FakeImage.prototype, 'removeEventListener');
        const manager = new SpritesheetManager();
        const pending = manager.load({ atlasUrl: 'atlas.json' });
        const rejected = expect(pending).rejects.toThrow('destroyed');
        await flush();
        expect(images).toHaveLength(1);
        manager.destroy();
        await rejected;
        expect(images[0].src).toBe('');
        expect(remove.mock.calls.map(([type]) => type)).toEqual(['load', 'error']);
        images[0].dispatchEvent(new Event('load'));
        images[0].dispatchEvent(new Event('error'));
        await flush();
        expect(manager.has('atlas.json')).toBe(false);
        expect(sourceDestroy).not.toHaveBeenCalled();
    });

    it('keeps real Pixi parse batches alive until they settle, then disposes the cancelled sheet', async () => {
        vi.useFakeTimers();
        const frames = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`frame${index}`, { h: 1, w: 1, x: 0, y: 0 }]));
        fetchMock.mockResolvedValueOnce(response({ ...descriptor, animations: { walk: ['frame0', 'frame1000'] }, frames }));
        const parse = vi.spyOn(Spritesheet.prototype, 'parse');
        const first = new SpritesheetManager();
        const pending = first.load({ atlasUrl: 'atlas.json' });
        const rejected = expect(pending).rejects.toThrow('destroyed');
        await flush();
        const sheet = parse.mock.contexts[0] as Spritesheet;
        expect(Object.keys(sheet.textures)).toHaveLength(1000);
        const frame = sheet.textures.frame0;
        const source = sheet.textureSource;
        first.destroy();
        await rejected;
        expect(frame.destroyed).toBe(false);
        expect(source.destroyed).toBe(false);
        const second = new SpritesheetManager();
        const successor = await second.load({ atlasUrl: 'atlas.json' });
        await vi.runAllTimersAsync();
        expect(first.has('atlas.json')).toBe(false);
        expect(frame.destroyed).toBe(true);
        expect(source.destroyed).toBe(true);
        expect(sheetDestroy).toHaveBeenCalledTimes(1);
        expect(sourceDestroy).toHaveBeenCalledTimes(1);
        expect(textureDestroy).toHaveBeenCalledTimes(1002);
        expect(successor.textures.idle.destroyed).toBe(false);
        second.destroy();
    });

    it('disposes partial frame textures, base texture and source after parse rejection and retries', async () => {
        const parse = vi.spyOn(Spritesheet.prototype, 'parse');
        parse.mockImplementationOnce(() => {
            const sheet = parse.mock.contexts.at(-1) as Spritesheet;
            sheet.parseSync();
            return Promise.reject(new Error('Parse failure'));
        });
        const manager = new SpritesheetManager();
        await expect(manager.load({ atlasUrl: 'atlas.json' })).rejects.toThrow('Parse failure');
        expect(manager.has('atlas.json')).toBe(false);
        expect(sheetDestroy).toHaveBeenCalledTimes(1);
        expect(sourceDestroy).toHaveBeenCalledTimes(1);
        expect(textureDestroy).toHaveBeenCalledTimes(2);
        await manager.load({ atlasUrl: 'atlas.json' });
        expect(manager.has('atlas.json')).toBe(true);
        manager.destroy();
        expect(sheetDestroy).toHaveBeenCalledTimes(2);
        expect(sourceDestroy).toHaveBeenCalledTimes(2);
    });

    it.each(['frame', 'animation'])('rejects malformed %s data before Pixi can throw in an asynchronous batch', async kind => {
        const frames: Record<string, unknown> = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`frame${index}`, descriptor.frames.idle]));
        if (kind === 'frame') frames.frame1000 = undefined;
        fetchMock.mockResolvedValueOnce(response({ ...descriptor, animations: kind === 'animation' ? { walk: undefined } : {}, frames }));
        const parse = vi.spyOn(Spritesheet.prototype, 'parse');
        const manager = new SpritesheetManager();
        await expect(manager.load({ atlasUrl: 'atlas.json' })).rejects.toThrow(kind);
        expect(images).toHaveLength(0);
        expect(parse).not.toHaveBeenCalled();
        expect(manager.has('atlas.json')).toBe(false);
    });

    it.each([
        ['frame', 'x'], ['frame', 'y'], ['frame', 'w'], ['frame', 'h'],
        ['sourceSize', 'w'], ['sourceSize', 'h'],
        ['spriteSourceSize', 'x'], ['spriteSourceSize', 'y'], ['spriteSourceSize', 'w'], ['spriteSourceSize', 'h'],
    ])('rejects an uncoercible %s.%s in frame 1000 before allocating Pixi resources', async (field, dimension) => {
        const frames: Record<string, unknown> = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`frame${index}`, descriptor.frames.idle]));
        const bounds = Object.fromEntries<unknown>([['h', 1], ['w', 1], ['x', 0], ['y', 0], [dimension, uncoercible]]);
        frames.frame1000 = Object.fromEntries<unknown>([['frame', { h: 1, w: 1, x: 0, y: 0 }], [field, bounds]]);
        fetchMock.mockResolvedValueOnce(response({ ...descriptor, frames }));
        const parse = vi.spyOn(Spritesheet.prototype, 'parse');
        const manager = new SpritesheetManager();
        await expect(manager.load({ atlasUrl: 'atlas.json' })).rejects.toThrow(`frame 'frame1000' ${field}`);
        expect(images).toHaveLength(0);
        expect(parse).not.toHaveBeenCalled();
        expect(sourceDestroy).not.toHaveBeenCalled();
        expect(manager.has('atlas.json')).toBe(false);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '2', undefined])('rejects non-finite or nonnumeric canonical and nested bounds (%s)', async value => {
        const manager = new SpritesheetManager();
        for (const nested of [false, true]) {
            const bounds = { ...descriptor.frames.idle, x: value };
            fetchMock.mockResolvedValueOnce(response({ ...descriptor, frames: { idle: nested ? { frame: bounds } : bounds } }));
            await expect(manager.load({ atlasUrl: 'atlas.json' })).rejects.toThrow('finite numeric');
        }
        expect(images).toHaveLength(0);
    });

    it.each([uncoercible, 3, undefined])('rejects a non-string animation entry after 1001 frames (%s)', async entry => {
        const frames = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`frame${index}`, descriptor.frames.idle]));
        fetchMock.mockResolvedValueOnce(response({ ...descriptor, animations: { walk: ['frame0', entry] }, frames }));
        const parse = vi.spyOn(Spritesheet.prototype, 'parse');
        const manager = new SpritesheetManager();
        await expect(manager.load({ atlasUrl: 'atlas.json' })).rejects.toThrow('string frame arrays');
        expect(images).toHaveLength(0);
        expect(parse).not.toHaveBeenCalled();
        expect(manager.has('atlas.json')).toBe(false);
    });

    it.each(['frame', 'animation', 'reference'])('rejects a JSON-owned __proto__ %s before plain Pixi dictionaries can change prototypes', async kind => {
        const frames = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`frame${index}`, descriptor.frames.idle]));
        const dangerousFrames = JSON.parse('{"__proto__":{"x":0,"y":0,"w":1,"h":1}}') as Record<string, unknown>;
        const dangerousAnimations = JSON.parse('{"__proto__":["frame0"]}') as Record<string, unknown>;
        fetchMock.mockResolvedValueOnce(response({
            ...descriptor,
            animations: kind === 'animation' ? dangerousAnimations : { walk: [kind === 'reference' ? '__proto__' : 'frame0'] },
            frames: kind === 'frame' ? { ...frames, ...dangerousFrames } : frames,
        }));
        const parse = vi.spyOn(Spritesheet.prototype, 'parse');
        const manager = new SpritesheetManager();
        await expect(manager.load({ atlasUrl: 'atlas.json' })).rejects.toThrow(kind === 'frame' ? '__proto__' : 'safe names');
        expect(images).toHaveLength(0);
        expect(parse).not.toHaveBeenCalled();
        expect(sourceDestroy).not.toHaveBeenCalled();
        expect(manager.has('atlas.json')).toBe(false);
        manager.destroy();
    });

    it('disposes base texture and source when the real Pixi sheet constructor fails', async () => {
        fetchMock.mockResolvedValueOnce(response({ frames: descriptor.frames, source: 'characters.png' }));
        const manager = new SpritesheetManager();
        await expect(manager.load({ atlasUrl: 'atlas.json' })).rejects.toThrow();
        expect(sheetDestroy).not.toHaveBeenCalled();
        expect(textureDestroy).toHaveBeenCalledTimes(1);
        expect(sourceDestroy).toHaveBeenCalledTimes(1);
        manager.destroy();
        expect(sourceDestroy).toHaveBeenCalledTimes(1);
    });

    it('cleans up image error callbacks and allows retry', async () => {
        autoImages = false;
        const manager = new SpritesheetManager();
        const pending = manager.load({ atlasUrl: 'atlas.json' });
        const rejected = expect(pending).rejects.toThrow('Failed to load image');
        await flush();
        images[0].dispatchEvent(new Event('error'));
        await rejected;
        autoImages = true;
        await manager.load({ atlasUrl: 'atlas.json' });
        manager.destroy();
        expect(sourceDestroy).toHaveBeenCalledTimes(1);
    });
});
