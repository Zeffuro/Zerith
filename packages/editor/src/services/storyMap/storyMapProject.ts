import { parseSceneFile } from '@zeffuro/zerith-core/schemas';

import type { ProjectState } from '../../store/project/types';
import type { WorkbenchTab } from '../../store/workbench/types';
import type { StoryMap, StoryMapInput } from './storyMapModel';

import { resolveProjectFilePath } from '../../store/project/projectPreparation';
import { normalizePathForComparison } from '../../utils/pathComparison';
import { isRecord } from '../../utils/typeGuards';
import { buildStoryMap } from './storyMapModel';

export function storyMapFromProject(project: ProjectState, tabs: WorkbenchTab[]) {
    const input: StoryMapInput = { macros: { ...project.macros }, macroSources: {}, scenes: { ...project.scenes }, sceneSources: {}, startScene: project.manifest?.startScene };
    const errors: string[] = [];
    const manifestPath = `${project.projectPath}/game.json`;
    const dirty = (path: string) => tabs.find(tab => normalizePathForComparison(tab.path) === normalizePathForComparison(path) && tab.dirty && tab.textContent !== undefined)?.textContent;
    for (const name of Object.keys(input.scenes)) {
        const path = project.scenePaths[name];
        const scene = project.manifest?.scenes?.[name];
        const inlinePath = isRecord(scene) && Array.isArray(scene.commands) ? ['scenes', name, 'commands'] : ['scenes', name];
        input.sceneSources![name] = path ? { filePath: path, jsonPath: [], scriptPath: [] } : { filePath: manifestPath, jsonPath: inlinePath };
        if (!path) continue;
        const text = dirty(path);
        if (text === undefined) continue;
        try { input.scenes[name] = parseSceneFile(JSON.parse(text)).commands; }
        catch { errors.push(`The unsaved scene ${name} cannot be mapped yet. Showing its last valid version.`); }
    }
    const macroPath = typeof project.manifest?.macros === 'string' && project.projectPath ? resolveProjectFilePath(project.projectPath, project.manifest.macros) : undefined;
    if (macroPath && dirty(macroPath) !== undefined) {
        try {
            const value: unknown = JSON.parse(dirty(macroPath)!);
            if (!isRecord(value)) throw new Error('Invalid macros');
            input.macros = Object.fromEntries(Object.entries(value).filter(([name, commands]) => !name.startsWith('$') && Array.isArray(commands)).map(([name, commands]) => [name, parseSceneFile(commands).commands]));
        } catch { errors.push('The unsaved macros cannot be mapped yet. Showing their last valid version.'); }
    }
    for (const name of Object.keys(input.macros ?? {})) {
        input.macroSources![name] = macroPath ? { filePath: macroPath, jsonPath: [name] } : { filePath: manifestPath, jsonPath: ['macros', name] };
    }
    const map = buildStoryMap(input);
    return { ...map, issues: [...map.issues, ...errors] };
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
