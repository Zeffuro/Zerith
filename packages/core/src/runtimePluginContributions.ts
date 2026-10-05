import type { RegisteredCommandHandler } from './interfaces/ICommandHandler';
import type { IFlowManager, IOverlayManager } from './interfaces/managers';
import type { MenuPanel, RuntimePluginCleanup } from './types';

interface HandlerEntry {
    handler: RegisteredCommandHandler;
}

interface HandlerStack {
    base?: RegisteredCommandHandler;
    entries: HandlerEntry[];
}

export class RuntimePluginContributions {
    private readonly borrowedHandlers = new WeakSet<RegisteredCommandHandler>();
    private readonly destroyedHandlers = new WeakSet<RegisteredCommandHandler>();
    private readonly flow: IFlowManager;
    private readonly overlay: IOverlayManager;
    private readonly references = new Map<RegisteredCommandHandler, { count: number; type: string }>();
    private readonly stacks = new Map<string, HandlerStack>();

    constructor(flow: IFlowManager, overlay: IOverlayManager) {
        this.flow = flow;
        this.overlay = overlay;
    }

    public registerHandler(handler: RegisteredCommandHandler): RuntimePluginCleanup {
        const { type } = handler;
        if (this.destroyedHandlers.has(handler)) throw new Error('This plugin handler has been destroyed.');
        const reference = this.references.get(handler);
        if (reference && reference.type !== type) throw new Error('This plugin handler is already registered under another command type.');
        const current = this.flow.getHandler(type);
        let stack = this.stacks.get(type);
        if (!stack || stack.entries.at(-1)?.handler !== current) {
            stack = { base: current, entries: [] };
            this.stacks.set(type, stack);
            if (current && !this.references.has(current)) this.borrowedHandlers.add(current);
        }
        const ownedStack = stack;
        const entry = { handler };
        this.flow.registerHandler(handler);
        ownedStack.entries.push(entry);
        this.references.set(handler, { count: (reference?.count ?? 0) + 1, type });

        return onceCleanup(() => {
            const ownsCurrent = this.stacks.get(type) === ownedStack && ownedStack.entries.at(-1) === entry
                && this.flow.getHandler(type) === handler;
            ownedStack.entries.splice(ownedStack.entries.indexOf(entry), 1);
            const remaining = this.references.get(handler)!.count - 1;
            if (remaining > 0) this.references.set(handler, { count: remaining, type });
            else this.references.delete(handler);
            if (ownedStack.entries.length === 0 && this.stacks.get(type) === ownedStack) this.stacks.delete(type);
            const shouldDestroy = remaining === 0 && !this.borrowedHandlers.has(handler);
            if (shouldDestroy) this.destroyedHandlers.add(handler);
            const canRestore = (candidate: RegisteredCommandHandler) => candidate.type === type && !this.destroyedHandlers.has(candidate);
            const next = ownedStack.entries.findLast(candidate => canRestore(candidate.handler))?.handler
                ?? (ownedStack.base && canRestore(ownedStack.base) ? ownedStack.base : undefined);
            if (ownsCurrent) {
                if (next) this.flow.registerHandler(next);
                else return this.flow.unregisterHandler(type, { destroy: shouldDestroy });
            }
            if (shouldDestroy) return handler.destroy?.();
        });
    }

    public registerPanel(panel: MenuPanel): RuntimePluginCleanup {
        const { id } = panel;
        const existed = this.overlay.hasPanel(id);
        if (!existed) this.overlay.registerPanel(panel);
        return onceCleanup(() => { if (!existed) this.overlay.removePanel(id); });
    }
}

export function onceCleanup(cleanup: RuntimePluginCleanup): () => Promise<void> {
    let completion: Promise<void> | undefined;
    return () => {
        if (completion) return completion;
        let resolve!: () => void;
        let reject!: (error: unknown) => void;
        completion = new Promise<void>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
        try {
            void Promise.resolve(cleanup()).then(resolve, reject);
        } catch (error) {
            reject(error);
        }
        return completion;
    };
}
