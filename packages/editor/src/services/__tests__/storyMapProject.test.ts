import type { GameManifest } from '@zeffuro/zerith-core';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../../store/project/types';
import type { WorkbenchTab } from '../../store/workbench/types';

import { readStoryMapFiles } from '../storyMap/storyMapFiles';
import { prepareStoryMap, storyMapFromProject } from '../storyMap/storyMapProject';

function externalProject() {
    return { ...project(), macros: { previous: [{ to: 'oldMacroTarget', type: 'jump' }] },
        manifest: { macros: '/data/old.json', scenes: { intro: '/scenes/old.json' }, startScene: 'intro' },
        scenePaths: { intro: '/Game/scenes/old.json' }, scenes: { intro: [{ to: 'oldTarget', type: 'jump' }] },
    } as ProjectState;
}

function project() {
    const manifest: GameManifest = { macros: { previous: [] }, scenes: { ending: [], intro: [{ to: 'ending', type: 'jump' }] }, startScene: 'intro' };
    return { macros: manifest.macros, manifest, projectPath: '/Game', scenePaths: {}, scenes: manifest.scenes } as ProjectState;
}

function tab(path: string, value: unknown): WorkbenchTab {
    return { dirty: true, id: path, kind: 'json', path, textContent: JSON.stringify(value), title: path };
}

const invalidValue: unknown = JSON.parse('null');
const fallbackIssue = 'The unsaved manifest cannot be mapped yet. Showing the loaded project version.';

describe('story map project drafts', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('maps unsaved manifest membership, starting scene, inline routes and exact command sources', () => {
        const state = project();
        const before = JSON.stringify(state);
        const draft = tab('/Game/game.json', { macros: { greeting: [{ to: 'intro', type: 'jump' }] }, scenes: {
            draft: { commands: [{ options: [{ commands: [{ name: 'greeting', type: 'call' }], label: 'Hello' }], type: 'choice' }] },
            intro: [{ to: 'draft', type: 'jump' }],
        }, startScene: 'draft' });
        const map = storyMapFromProject(state, [draft]);
        expect(map.startId).toBe('scene:draft');
        expect(map.nodes.map(node => node.id)).toEqual(['scene:draft', 'scene:intro', 'macro:greeting', 'choice:scene:draft:[0]']);
        expect(map.edges.find(edge => edge.type === 'call')?.source).toEqual({ filePath: '/Game/game.json', jsonPath: ['scenes', 'draft', 'commands', 0, 'options', 0, 'commands', 0], scriptPath: undefined });
        expect(map.edges.find(edge => edge.from === 'macro:greeting')?.source?.jsonPath).toEqual(['macros', 'greeting', 0]);
        expect(JSON.stringify(state)).toBe(before);
        expect(draft.dirty).toBe(true);
    });

    it.each(['{}', '{"scenes":{},"macros":{}}'])('clears omitted or empty manifest membership without writing (%s)', textContent => {
        const map = storyMapFromProject(project(), [{ ...tab('/Game/game.json', {}), textContent }]);
        expect(map.nodes).toEqual([]);
        expect(map.edges).toEqual([]);
        expect(map.issues).toEqual([]);
    });

    it.each(['{broken', 'null', '[]', '{"scenes":[]}', '{"macros":42}', '{"startScene":[]}', '{"scenes":null}', '{"macros":null}'])('warns and uses the loaded project on structurally invalid manifest %s', textContent => {
        const state = externalProject();
        const draft = tab('/Game/scenes/old.json', [{ to: 'retainedDraft', type: 'jump' }]);
        const map = storyMapFromProject(state, [{ ...tab('/Game/game.json', {}), textContent }, draft]);
        expect(map.startId).toBe('scene:intro');
        expect(map.edges.some(edge => edge.to === 'scene:retainedDraft')).toBe(true);
        expect(map.issues).toContain(fallbackIssue);
    });

    it('renames a loaded external scene by path and overlays its dirty envelope with accurate sources', () => {
        const state = externalProject();
        const draft = tab('/Game/game.json', { scenes: { renamed: '/scenes/old.json' }, startScene: 'renamed' });
        const clean = prepareStoryMap(state, [draft]);
        expect(clean.pending).toEqual([]);
        expect(clean.map.edges[0]).toMatchObject({ from: 'scene:renamed', to: 'scene:oldTarget' });
        const file = tab('/Game/scenes/old.json', { commands: [{ to: 'dirtyTarget', type: 'jump' }], localeNamespace: 'renamed' });
        const map = storyMapFromProject(state, [draft, file]);
        expect(map.nodes.some(node => node.id === 'scene:intro')).toBe(false);
        expect(map.edges[0]).toMatchObject({ from: 'scene:renamed', source: { filePath: file.path, jsonPath: ['commands', 0], scriptPath: [0] }, to: 'scene:dirtyTarget' });
    });

    it('loads new descriptors once per canonical path and maps both aliases and new macro commands', async () => {
        const draft = tab('/Game/game.json', { macros: 'data/new.json', scenes: { a: '/scenes/new.json', b: 'scenes/./new.json' }, startScene: 'b' });
        const pending = prepareStoryMap(externalProject(), [draft]);
        expect(pending.map.edges).toEqual([]);
        expect(pending.map.nodes.every(node => node.missing)).toBe(true);
        expect(pending.map.nodes.find(node => node.id === 'scene:a')?.source).toEqual({ filePath: '/Game/game.json', jsonPath: ['scenes', 'a'] });
        const read = vi.fn((path: string) => Promise.resolve(path.includes('/scenes/')
            ? JSON.stringify({ commands: [{ name: 'newMacro', type: 'call' }] })
            : JSON.stringify({ $schema: 'macros', newMacro: [{ to: 'a', type: 'jump' }] })));
        const files = await readStoryMapFiles(pending.pending, read);
        expect(read).toHaveBeenCalledTimes(2);
        const map = storyMapFromProject(externalProject(), [draft], files);
        expect(map.nodes.map(node => node.id)).toEqual(['scene:a', 'scene:b', 'macro:newMacro']);
        expect(map.edges.map(edge => edge.to)).toEqual(['macro:newMacro', 'macro:newMacro', 'scene:a']);
        expect(map.edges[0].source?.jsonPath).toEqual(['commands', 0]);
        expect(map.issues).toEqual([]);
    });

    it('uses new external drafts before disk results and never transfers loaded commands to retargeted descriptors', async () => {
        const state = externalProject();
        const manifest = tab('/Game/game.json', { macros: '/data/new.json', scenes: { intro: '/scenes/new.json' } });
        const files = await readStoryMapFiles(['/Game/scenes/new.json', '/Game/data/new.json'], () => Promise.resolve('{}'));
        const scene = tab('/Game/scenes/new.json', [{ name: 'newMacro', type: 'call' }]);
        const macros = tab('/Game/data/new.json', { newMacro: [{ to: 'newTarget', type: 'jump' }] });
        const map = storyMapFromProject(state, [manifest, scene, macros], files);
        expect(map.edges.map(edge => edge.to)).toEqual(['macro:newMacro', 'scene:newTarget']);
        expect(map.nodes.some(node => node.id === 'scene:oldTarget' || node.id === 'macro:previous')).toBe(false);
        expect(prepareStoryMap(state, [manifest, scene, macros]).pending).toEqual([]);
    });

    it.each(['{broken', '[null]', '{}'])('marks invalid retargeted files missing without substituting old commands (%s)', text => {
        const state = externalProject();
        const manifest = tab('/Game/game.json', { macros: '/data/new.json', scenes: { intro: '/scenes/new.json' } });
        const map = storyMapFromProject(state, [manifest, { ...tab('/Game/scenes/new.json', []), textContent: text }, { ...tab('/Game/data/new.json', {}), textContent: text }]);
        expect(map.edges).toEqual([]);
        expect(map.nodes).toEqual([expect.objectContaining({ id: 'scene:intro', missing: true, source: { filePath: '/Game/game.json', jsonPath: ['scenes', 'intro'] } })]);
        expect(map.issues.some(issue => issue.includes('scene intro cannot be mapped'))).toBe(true);
        expect(map.issues.some(issue => issue.includes('macros cannot be mapped'))).toBe(text !== '{}');
    });

    it('retains loaded commands only for invalid dirty files with matching identities', () => {
        const state = externalProject();
        const scene = { ...tab('/Game/scenes/old.json', []), textContent: '{bad' };
        const macros = tab('/Game/data/old.json', { invalid: invalidValue });
        const map = storyMapFromProject(state, [scene, macros]);
        expect(map.edges.map(edge => edge.to)).toEqual(['scene:oldTarget', 'scene:oldMacroTarget']);
        expect(map.issues.filter(issue => issue.includes('loaded version'))).toHaveLength(2);
        expect(scene.textContent).toBe('{bad');
        expect(macros.dirty).toBe(true);
    });

    it('reports failed reads and invalid disk data without leaking loaded route content', async () => {
        const state = externalProject();
        const draft = tab('/Game/game.json', { macros: '/data/new.json', scenes: { intro: '/scenes/new.json' } });
        const read = vi.fn((path: string) => path.includes('/scenes/') ? Promise.reject(new Error('missing fixture')) : Promise.resolve('[]'));
        const files = await readStoryMapFiles(prepareStoryMap(state, [draft]).pending, read);
        const { map, pending } = prepareStoryMap(state, [draft], files);
        expect(pending).toEqual([]);
        expect(map.edges).toEqual([]);
        expect(map.issues.some(issue => issue.includes('missing fixture'))).toBe(true);
        expect(map.issues.some(issue => issue.includes('macros cannot be mapped'))).toBe(true);
    });

    it.each([invalidValue, { commands: [invalidValue] }, [{ options: [{ commands: [invalidValue], label: 'Bad' }], type: 'choice' }]])('omits invalid inline commands safely (%j)', value => {
        const draft = tab('/Game/game.json', { scenes: { broken: value, good: [] }, startScene: 'broken' });
        const map = storyMapFromProject(project(), [draft]);
        expect(map.startId).toBe('scene:broken');
        expect(map.nodes.find(node => node.id === 'scene:broken')?.missing).toBe(true);
        expect(map.edges).toEqual([]);
        expect(map.issues.some(issue => issue.includes('scene broken cannot be mapped'))).toBe(true);
    });

    it('excludes macro metadata and rejects malformed macros instead of silently dropping entries', () => {
        const good = storyMapFromProject(project(), [tab('/Game/game.json', { macros: { $schema: 'metadata', hello: [] } })]);
        expect(good.nodes.map(node => node.id)).toEqual(['macro:hello']);
        const bad = storyMapFromProject(project(), [tab('/Game/game.json', { macros: { hello: [], invalid: invalidValue } })]);
        expect(bad.nodes).toEqual([]);
        expect(bad.issues).toContain('The macros cannot be mapped. No macro routes are shown.');
    });

    it('preserves prototype-like scene and macro names as own entries', () => {
        const textContent = '{"scenes":{"__proto__":[{"type":"call","name":"__proto__"}]},"macros":{"__proto__":[]},"startScene":"__proto__"}';
        const map = storyMapFromProject(project(), [{ ...tab('/Game/game.json', {}), textContent }]);
        expect(map.nodes.map(node => node.id)).toEqual(['scene:__proto__', 'macro:__proto__']);
        expect(map.edges[0].to).toBe('macro:__proto__');
    });

    it.each([false, true])('keeps browser/POSIX case-distinct drafts separate (native: %s)', native => {
        if (native) vi.stubGlobal('__TAURI_INTERNALS__', {});
        const map = storyMapFromProject(project(), [tab('/Game/Game.json', { scenes: { wrong: [] } })]);
        expect(map.startId).toBe('scene:intro');
    });

    it('compares Windows paths using native identity while preserving browser case', () => {
        const state = { ...project(), projectPath: 'F:/Game' };
        const draft = tab(String.raw`f:\game\.\game.json`, { scenes: { right: [] }, startScene: 'right' });
        expect(storyMapFromProject(state, [draft]).startId).toBe('scene:intro');
        vi.stubGlobal('__TAURI_INTERNALS__', {});
        expect(storyMapFromProject(state, [draft]).startId).toBe('scene:right');
    });

    it('retains the first declared scene as implicit start while its descriptor is unresolved', () => {
        const draft = tab('/Game/game.json', { scenes: { first: '/scenes/unresolved.json', second: [] } });
        const map = storyMapFromProject(project(), [draft]);
        expect(map.startId).toBe('scene:first');
        expect(map.nodes.find(node => node.id === 'scene:first')).toMatchObject({ missing: true, reachable: true });
        expect(map.nodes.find(node => node.id === 'scene:second')?.reachable).toBe(false);
    });

    it.each(['commands', 'body', 'onTrue', 'onFalse'])('rejects malformed custom-command %s containers without crashing', key => {
        for (const value of [invalidValue, 'bad', [invalidValue], [{ options: [invalidValue], type: 'custom' }]]) {
            const draft = tab('/Game/game.json', { scenes: { broken: [{ [key]: value, type: 'custom' }] } });
            const map = storyMapFromProject(project(), [draft]);
            expect(map.edges).toEqual([]);
            expect(map.nodes.find(node => node.id === 'scene:broken')?.missing).toBe(true);
            expect(map.issues.some(issue => issue.includes('scene broken cannot be mapped'))).toBe(true);
        }
    });

    it('retains valid custom-command nested paths and reports invalid custom macros', () => {
        const valid = tab('/Game/game.json', { scenes: { custom: [{ commands: [{ to: 'next', type: 'jump' }], type: 'custom' }] } });
        const map = storyMapFromProject(project(), [valid]);
        expect(map.edges[0]).toMatchObject({ source: { jsonPath: ['scenes', 'custom', 0, 'commands', 0] }, to: 'scene:next' });
        const invalid = storyMapFromProject(project(), [tab('/Game/game.json', { macros: { custom: [{ options: [invalidValue], type: 'custom' }] } })]);
        expect(invalid.nodes).toEqual([]);
        expect(invalid.issues.some(issue => issue.includes('macros cannot be mapped'))).toBe(true);
    });

    it('does not use unsafe loaded commands as an invalid-draft fallback', () => {
        const state = externalProject();
        state.scenes = { intro: [{ commands: [invalidValue], type: 'custom' }] };
        const draft = { ...tab('/Game/scenes/old.json', []), textContent: '{bad' };
        const map = storyMapFromProject(state, [draft]);
        expect(map.nodes.find(node => node.id === 'scene:intro')?.missing).toBe(true);
        expect(map.edges.some(edge => edge.from === 'scene:intro')).toBe(false);
    });

    it.each(['scene', 'macro'])('reports excessive custom nesting in a %s without losing valid scenes', kind => {
        const commands = '[{"type":"custom","commands":'.repeat(2500) + '[{"type":"jump","to":"okay"}]' + '}]'.repeat(2500);
        const textContent = kind === 'scene'
            ? `{"scenes":{"deep":${commands},"okay":[]}}`
            : `{"scenes":{"okay":[]},"macros":{"deep":${commands}}}`;
        const map = storyMapFromProject(project(), [{ ...tab('/Game/game.json', {}), textContent }]);
        expect(map.nodes.find(node => node.id === 'scene:okay')?.missing).toBe(false);
        expect(map.edges).toEqual([]);
        expect(map.issues.some(issue => issue.includes('up to 256 nested command levels'))).toBe(true);
    });

    it('maps custom command nesting at the supported boundary', () => {
        const commands = '[{"type":"custom","commands":'.repeat(256) + '[{"type":"jump","to":"okay"}]' + '}]'.repeat(256);
        const textContent = `{"scenes":{"deep":${commands},"okay":[]}}`;
        const map = storyMapFromProject(project(), [{ ...tab('/Game/game.json', {}), textContent }]);
        expect(map.edges[0].to).toBe('scene:okay');
        expect(map.issues).toEqual([]);
    });
});
