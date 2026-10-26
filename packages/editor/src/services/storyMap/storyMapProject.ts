import { parseSceneFile, ScriptSchema } from '@zeffuro/zerith-core/schemas';

import type { ProjectState } from '../../store/project/types';
import type { WorkbenchTab } from '../../store/workbench/types';
import type { StoryMap, StoryMapInput, StoryMapSource } from './storyMapModel';

import { resolveProjectFilePath } from '../../store/project/projectPreparation';
import { canonicalPathForComparison, normalizePathForComparison } from '../../utils/pathComparison';
import { isRecord } from '../../utils/typeGuards';
import { buildStoryMap } from './storyMapModel';

export type StoryMapFile = { error: string } | { text: string };
export type StoryMapFiles = ReadonlyMap<string, StoryMapFile>;
export type StoryMapProject = Pick<ProjectState, 'macros' | 'manifest' | 'projectPath' | 'scenePaths' | 'scenes'>;
type ManifestDraft = { macros?: unknown; scenes?: Record<string, unknown>; startScene?: string };
// The graph walks recursively, so bound draft nesting before invoking it.
const maxMapNesting = 256;

export function isStoryMapSceneReadable(text: string | undefined): boolean {
    if (text === undefined) return false;
    try { parseCommands(JSON.parse(text)); return true; }
    catch { return false; }
}

export function prepareStoryMap(project: StoryMapProject, tabs: WorkbenchTab[], files: StoryMapFiles = new Map()) {
    const issues: string[] = [];
    const pending = new Set<string>();
    const drafts = new Map(tabs.filter(tab => tab.dirty && tab.textContent !== undefined).map(tab => [canonicalPathForComparison(tab.path), tab.textContent!]));
    const manifestPath = resolveProjectFilePath(project.projectPath ?? '', 'game.json');
    let manifest: ManifestDraft = project.manifest ?? { macros: project.macros, scenes: project.scenes };
    const manifestText = drafts.get(canonicalPathForComparison(manifestPath));
    if (manifestText !== undefined) {
        try { manifest = parseManifestDraft(manifestText); }
        catch { issues.push('The unsaved manifest cannot be mapped yet. Showing the loaded project version.'); }
    }
    const scenes = new Map<string, StoryMapInput['scenes'][string]>();
    const sources = new Map<string, StoryMapSource>();
    const missing = new Map<string, StoryMapSource>();
    const read = (path: string, label: string): string | undefined => {
        const key = canonicalPathForComparison(path);
        const draft = drafts.get(key);
        if (draft !== undefined) return draft;
        const file = files.get(key);
        if (file && 'text' in file) return file.text;
        if (file) issues.push(`Could not map ${label} from ${path}: ${file.error}. No routes from this file are shown.`);
        else { pending.add(path); issues.push(`Loading ${label} from ${path}.`); }
    };
    for (const [name, value] of Object.entries(manifest.scenes ?? {})) {
        const descriptorSource = { filePath: manifestPath, jsonPath: ['scenes', name] };
        const path = typeof value === 'string' ? resolveProjectFilePath(project.projectPath ?? '', value) : undefined;
        const loadedName = path ? Object.keys(project.scenePaths).find(key => samePath(project.scenePaths[key], path)) : undefined;
        const loaded = loadedName === undefined ? undefined : validLoadedCommands(project.scenes[loadedName]);
        try {
            let candidate: unknown = value;
            if (path) {
                const key = canonicalPathForComparison(path);
                if (!drafts.has(key) && !files.has(key) && loaded !== undefined) {
                    scenes.set(name, loaded);
                    sources.set(name, { filePath: path, jsonPath: [], scriptPath: [] });
                    continue;
                }
                const text = read(path, `scene ${name}`);
                if (text === undefined) { missing.set(name, descriptorSource); continue; }
                candidate = JSON.parse(text);
            }
            const commands = parseCommands(candidate);
            const envelope = isRecord(candidate);
            const source: StoryMapSource = path
                ? { filePath: path, jsonPath: envelope ? ['commands'] : [], scriptPath: [] }
                : { filePath: manifestPath, jsonPath: envelope ? ['scenes', name, 'commands'] : ['scenes', name] };
            scenes.set(name, commands);
            sources.set(name, source);
        } catch (error) {
            if (path && loaded !== undefined && drafts.has(canonicalPathForComparison(path))) {
                scenes.set(name, loaded);
                sources.set(name, { filePath: path, jsonPath: [], scriptPath: [] });
                issues.push(`The unsaved scene ${name} cannot be mapped yet. Showing its loaded version.`);
            } else {
                missing.set(name, descriptorSource);
                issues.push(`The scene ${name} cannot be mapped${path ? ` from ${path}` : ''}${error instanceof RangeError ? `: ${error.message}` : ''}. No routes from this scene are shown.`);
            }
        }
    }
    let macros: NonNullable<StoryMapInput['macros']> = {};
    const macroPath = typeof manifest.macros === 'string' ? resolveProjectFilePath(project.projectPath ?? '', manifest.macros) : undefined;
    const loadedMacroPath = typeof project.manifest?.macros === 'string' ? resolveProjectFilePath(project.projectPath ?? '', project.manifest.macros) : undefined;
    const loadedMacros = validLoadedMacros(project.macros);
    try {
        if (macroPath) {
            const key = canonicalPathForComparison(macroPath);
            if (!drafts.has(key) && !files.has(key) && samePath(loadedMacroPath, macroPath) && loadedMacros) macros = loadedMacros;
            else {
                const text = read(macroPath, 'macros');
                if (text !== undefined) macros = parseMacros(JSON.parse(text));
            }
        } else if (manifest.macros !== undefined) macros = parseMacros(manifest.macros);
    } catch (error) {
        if (macroPath && samePath(loadedMacroPath, macroPath) && drafts.has(canonicalPathForComparison(macroPath)) && loadedMacros) {
            macros = loadedMacros;
            issues.push('The unsaved macros cannot be mapped yet. Showing their loaded version.');
        } else issues.push(`The macros cannot be mapped${macroPath ? ` from ${macroPath}` : ''}${error instanceof RangeError ? `: ${error.message}` : ''}. No macro routes are shown.`);
    }
    const macroSources = Object.fromEntries(Object.keys(macros).map(name => [name, macroPath ? { filePath: macroPath, jsonPath: [name] } : { filePath: manifestPath, jsonPath: ['macros', name] }]));
    const startScene = manifest.startScene ?? Object.keys(manifest.scenes ?? {})[0];
    const map = buildStoryMap({ macros, macroSources, scenes: Object.fromEntries(scenes), sceneSources: Object.fromEntries(sources), startScene });
    for (const [name, source] of missing) {
        const node = map.nodes.find(node => node.id === `scene:${name}`);
        if (node) node.source = source;
        else map.nodes.push({ id: `scene:${name}`, kind: 'missing', label: name, missing: true, reachable: false, source });
    }
    return { map: { ...map, issues: [...map.issues, ...issues] }, pending: [...pending] };
}

export function storyMapFromProject(project: StoryMapProject, tabs: WorkbenchTab[], files?: StoryMapFiles): StoryMap {
    return prepareStoryMap(project, tabs, files).map;
}

export function storyMapVisited(projectPath: string | undefined, visited: string[], request?: { projectPath: string; scenario: { scene: string } }): Set<string> {
    if (!projectPath || !request || normalizePathForComparison(projectPath) !== normalizePathForComparison(request.projectPath)) return new Set();
    return new Set(visited.map(name => `scene:${name === 'preview' ? request.scenario.scene : name}`));
}

export function storyMapVisitedEdges(map: StoryMap, projectPath: string | undefined, visited: string[], request?: { projectPath: string; scenario: { scene: string } }): Set<string> {
    if (!projectPath || !request || normalizePathForComparison(projectPath) !== normalizePathForComparison(request.projectPath)) return new Set();
    const names = visited.map(name => `scene:${name === 'preview' ? request.scenario.scene : name}`);
    const pairs = new Set(names.slice(1).map((name, index) => JSON.stringify([names[index], name])));
    const owners = new Map(map.nodes.map(node => [node.id, node.owner ?? node.id]));
    return new Set(map.edges.filter(edge => edge.type === 'jump' && pairs.has(JSON.stringify([owners.get(edge.from), edge.to]))).map(edge => edge.id));
}

function parseCommands(value: unknown) {
    const commands = Array.isArray(value) ? value : (isRecord(value) ? value.commands : undefined);
    validateNestedCommands(commands);
    ScriptSchema.parse(commands);
    return parseSceneFile(value).commands;
}

function parseMacros(value: unknown): NonNullable<StoryMapInput['macros']> {
    if (!isRecord(value)) throw new TypeError('Invalid macros');
    return Object.fromEntries(Object.entries(value).filter(([name]) => !name.startsWith('$')).map(([name, commands]) => {
        if (!Array.isArray(commands)) throw new TypeError('Invalid macro commands');
        return [name, parseCommands(commands)];
    }));
}

function parseManifestDraft(text: string): ManifestDraft {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || (value.scenes !== undefined && !isRecord(value.scenes))
        || (value.macros !== undefined && typeof value.macros !== 'string' && !isRecord(value.macros))
        || (value.startScene !== undefined && typeof value.startScene !== 'string')) throw new TypeError('Invalid manifest');
    return value;
}

function samePath(left: string | undefined, right: string) {
    return left !== undefined && canonicalPathForComparison(left) === canonicalPathForComparison(right);
}

function validateNestedCommands(commands: unknown, depth = 0): void {
    if (depth > maxMapNesting) throw new RangeError(`Story Map supports up to ${maxMapNesting} nested command levels`);
    if (!Array.isArray(commands)) throw new TypeError('Invalid commands');
    for (const command of commands) {
        if (!isRecord(command) || typeof command.type !== 'string') throw new TypeError('Invalid command');
        for (const key of ['body', 'commands', 'onFalse', 'onTrue']) {
            if (command[key] !== undefined) validateNestedCommands(command[key], depth + 1);
        }
        if (Array.isArray(command.options)) {
            for (const option of command.options) {
                if (!isRecord(option)) throw new TypeError('Invalid option');
                if (option.commands !== undefined) validateNestedCommands(option.commands, depth + 1);
            }
        }
    }
}

function validLoadedCommands(commands: unknown) {
    try { return parseCommands(commands); }
    catch { return; }
}

function validLoadedMacros(macros: unknown) {
    try { return parseMacros(macros); }
    catch { return; }
}
