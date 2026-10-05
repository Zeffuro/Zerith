import type { PlaytestDocument } from './playtestModel';

import { fsJoin, fsMkdir, fsReadTextFile, fsWriteTextFile } from '../fs';
import { parsePlaytestDocument } from './playtestModel';

export async function readPlaytests(projectPath: string): Promise<{ document: PlaytestDocument; text?: string }> {
    const path = await fsJoin(projectPath, '.zerith/playtests.json');
    try {
        const text = await fsReadTextFile(path);
        return { document: parsePlaytestDocument(text), text };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!(error instanceof DOMException && error.name === 'NotFoundError') && !/cannot find|no such file|not found|os error 2/iu.test(message)) throw error;
        return { document: { scenarios: [], version: 1 } };
    }
}

export async function writePlaytests(projectPath: string, document: PlaytestDocument, previousText?: string): Promise<string> {
    const text = `${JSON.stringify(parsePlaytestDocument(JSON.stringify(document)), undefined, 2)}\n`;
    await fsMkdir(await fsJoin(projectPath, '.zerith'));
    await fsWriteTextFile(await fsJoin(projectPath, '.zerith/playtests.json'), text, previousText === undefined ? { createOnly: true } : { expectedContent: previousText });
    return text;
}
