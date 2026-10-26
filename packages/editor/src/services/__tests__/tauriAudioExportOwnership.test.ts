import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioExportRetiredError } from '../audioExportOwnership';
import { tauriFsAdapter } from '../fs/tauriFsAdapter';

const { invoke, mkdir } = vi.hoisted(() => ({ invoke: vi.fn(), mkdir: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/plugin-fs', () => ({ mkdir }));

describe('native audio export dispatch ownership', () => {
    beforeEach(() => { invoke.mockReset(); mkdir.mockReset(); });

    it('prevents retired exclusive dispatch', async () => {
        await expect(tauriFsAdapter.writeBinaryFileExclusive!('F:/project/cue.wav', new Uint8Array([1]), () => false)).rejects.toBeInstanceOf(AudioExportRetiredError);
        expect(invoke).not.toHaveBeenCalled();
    });

    it.each([false, true])('allows invoked bytes to finish but rejects their obsolete completion (failure=%s)', async fail => {
        let current = true;
        let resolve!: () => void;
        let reject!: (error: unknown) => void;
        invoke.mockImplementation(() => new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
        const writing = tauriFsAdapter.writeBinaryFileExclusive!('F:/project/cue.wav', new Uint8Array([1, 2]), () => current);
        const rejected = expect(writing).rejects.toBeInstanceOf(AudioExportRetiredError);
        expect(invoke).toHaveBeenCalledWith('write_binary_file_atomic', { content: [1, 2], createOnly: true, path: 'F:/project/cue.wav' });
        current = false;
        if (fail) reject({ code: 'alreadyExists' });
        else resolve();
        await rejected;
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('rechecks mkdir after lazy filesystem preparation', async () => {
        let checks = 0;
        await expect(tauriFsAdapter.mkdir('F:/project/assets/regions', true, () => ++checks === 1)).rejects.toBeInstanceOf(AudioExportRetiredError);
        expect(mkdir).not.toHaveBeenCalled();
    });

    it('preserves ordinary native write failures while current', async () => {
        const error = { code: 'io', message: 'denied' };
        invoke.mockRejectedValue(error);
        await expect(tauriFsAdapter.writeBinaryFileExclusive!('F:/project/cue.wav', new Uint8Array([1]))).rejects.toBe(error);
    });
});
