import { describe, expect, it, vi } from 'vitest';

import type { EngineDeps } from '../Engine';
import type { RegisteredCommandHandler } from '../interfaces/ICommandHandler';
import type { MenuPanel, RuntimePlugin } from '../types';

import { Engine } from '../Engine';

describe('runtime plugin lifecycle', () => {
    it('registers plugin handlers and panels, then removes them on deactivation', async () => {
        const { engine, handlers, panels } = createPluginEngineHarness();
        const handlerDestroy = vi.fn();
        const handler = createHandler('plugin_echo', handlerDestroy);
        const panel = createPanel('plugin-panel');
        const activationCleanup = vi.fn();
        const deactivate = vi.fn();

        const registered = await engine.registerPlugin({
            activate(context) {
                context.registerHandler(handler);
                context.registerPanel(panel);
                return activationCleanup;
            },
            deactivate,
            manifest: {
                capabilities: ['overlays', 'commands', 'commands'],
                id: ' plugin.echo ',
                name: ' Echo Plugin ',
                version: ' 1.0.0 ',
            },
        });

        expect(registered).toMatchObject({
            active: true,
            capabilities: ['commands', 'overlays'],
            manifest: {
                id: 'plugin.echo',
                name: 'Echo Plugin',
                version: '1.0.0',
            },
        });
        expect(engine.getRegisteredPlugins()).toHaveLength(1);
        expect(handlers.get('plugin_echo')).toBe(handler);
        expect(panels).toEqual([panel]);

        await expect(engine.deactivatePlugin(' plugin.echo ')).resolves.toBe(true);

        expect(deactivate).toHaveBeenCalledTimes(1);
        expect(activationCleanup).toHaveBeenCalledTimes(1);
        expect(handlerDestroy).toHaveBeenCalledTimes(1);
        expect(handlers.has('plugin_echo')).toBe(false);
        expect(panels).toEqual([]);
        expect(engine.getRegisteredPlugins()).toEqual([]);
    });

    it('restores a previous command handler when a plugin override is deactivated', async () => {
        const { engine, handlers } = createPluginEngineHarness();
        const previousHandlerDestroy = vi.fn();
        const previousHandler = createHandler('dialogue', previousHandlerDestroy);
        const pluginHandlerDestroy = vi.fn();
        const pluginHandler = createHandler('dialogue', pluginHandlerDestroy);

        engine.registerHandler(previousHandler);
        await engine.registerPlugin({
            activate(context) {
                context.registerHandler(pluginHandler);
            },
            manifest: createManifest('plugin.dialogue-override'),
        });

        expect(handlers.get('dialogue')).toBe(pluginHandler);

        await engine.deactivatePlugin('plugin.dialogue-override');

        expect(handlers.get('dialogue')).toBe(previousHandler);
        expect(pluginHandlerDestroy).toHaveBeenCalledTimes(1);
        expect(previousHandlerDestroy).not.toHaveBeenCalled();
    });

    it('rolls back contributions when activation fails', async () => {
        const { engine, handlers, panels } = createPluginEngineHarness();
        const handlerDestroy = vi.fn();
        const handler = createHandler('plugin_broken', handlerDestroy);
        const panel = createPanel('broken-panel');

        const plugin: RuntimePlugin = {
            activate(context) {
                context.registerHandler(handler);
                context.registerPanel(panel);
                throw new Error('activation failed');
            },
            manifest: createManifest('plugin.broken'),
        };

        await expect(engine.registerPlugin(plugin)).rejects.toThrow('activation failed');

        expect(handlerDestroy).toHaveBeenCalledTimes(1);
        expect(handlers.has('plugin_broken')).toBe(false);
        expect(panels).toEqual([]);
        expect(engine.getRegisteredPlugins()).toEqual([]);
    });

    it('rejects incompatible plugin API versions before activation', async () => {
        const { engine } = createPluginEngineHarness();
        const activate = vi.fn();

        await expect(engine.registerPlugin({
            activate,
            manifest: {
                ...createManifest('plugin.incompatible'),
                pluginApiVersion: 999,
            },
        })).rejects.toThrow('targets plugin API v999');

        expect(activate).not.toHaveBeenCalled();
        expect(engine.getRegisteredPlugins()).toEqual([]);
    });
});

function createHandler(type: string, destroy = vi.fn()): RegisteredCommandHandler {
    return {
        destroy,
        execute: vi.fn(),
        type,
    };
}

function createManifest(id: string): RuntimePlugin['manifest'] {
    return {
        capabilities: ['commands'],
        id,
        name: 'Plugin',
        version: '1.0.0',
    };
}

function createPanel(id: string): MenuPanel {
    return {
        build: vi.fn(() => ({ container: {} as ReturnType<MenuPanel['build']>['container'] })),
        id,
        label: 'Plugin Panel',
    };
}

function createPluginEngineHarness(): {
    engine: Engine;
    handlers: Map<string, RegisteredCommandHandler>;
    panels: MenuPanel[];
} {
    const handlers = new Map<string, RegisteredCommandHandler>();
    const panels: MenuPanel[] = [];
    const deps = {
        animations: {},
        assets: {},
        audio: {},
        display: {},
        events: {},
        flow: {
            getHandler: (type: string) => handlers.get(type),
            registerHandler: (handler: RegisteredCommandHandler) => {
                handlers.set(handler.type, handler);
            },
            registerHandlers: (nextHandlers: RegisteredCommandHandler[]) => {
                for (const handler of nextHandlers) {
                    handlers.set(handler.type, handler);
                }
            },
            unregisterHandler: (type: string) => {
                const handler = handlers.get(type);
                void handler?.destroy?.();
                handlers.delete(type);
            },
        },
        history: {},
        input: {},
        items: {},
        notifications: {},
        overlay: {
            hasPanel: (id: string) => panels.some((panel) => panel.id === id),
            registerPanel: (panel: MenuPanel) => {
                if (!panels.some((existing) => existing.id === panel.id)) {
                    panels.push(panel);
                }
            },
            removePanel: (id: string) => {
                const index = panels.findIndex((panel) => panel.id === id);
                if (index !== -1) {
                    panels.splice(index, 1);
                }
            },
        },
        saves: {},
        scenes: {},
        spritesheets: {},
        startScreen: {},
        state: {},
    } as unknown as EngineDeps;

    return {
        engine: new Engine({}, deps),
        handlers,
        panels,
    };
}
