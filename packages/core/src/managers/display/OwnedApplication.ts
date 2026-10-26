import type { ApplicationOptions, ApplicationPlugin, DestroyOptions, RendererDestroyOptions } from 'pixi.js';

import { Application } from 'pixi.js';

import { assertCurrent, attempt, createOwnedRenderer, destroyOwnedRenderer } from './ownedRenderer';

export class OwnedApplication extends Application {
    private cleanupComplete = false;
    private readonly cleanupErrors: unknown[] = [];
    private initializing = false;
    private initStarted = false;
    private readonly plugins: ApplicationPlugin[] = [];
    private rendererOwned = false;
    private retired = false;

    public override destroy(rendererOptions?: RendererDestroyOptions, options?: DestroyOptions): void;
    public override destroy(): void {
        if (this.retired) return;
        this.retired = true;
        if (this.ticker) attempt(() => this.ticker.stop(), this.cleanupErrors);
        if (!this.initializing) {
            this.dispose();
            this.reportCleanupErrors();
        }
    }

    public override async init(options: Partial<ApplicationOptions> = {}): Promise<void> {
        assertCurrent(() => this.retired);
        if (this.initStarted) throw new Error('Application initialization already started');
        this.initStarted = true;
        this.initializing = true;
        let failed = false;
        let failure: unknown;
        try {
            const selected = await createOwnedRenderer(options, () => this.retired);
            this.renderer = selected.renderer;
            this.rendererOwned = true;
            assertCurrent(() => this.retired);
            await this.renderer.init(selected.options);
            assertCurrent(() => this.retired);
            const installedPlugins = [...Application._plugins];
            for (const plugin of installedPlugins) {
                assertCurrent(() => this.retired);
                this.plugins.push(plugin);
                plugin.init.call(this, { ...options, autoStart: false, sharedTicker: false });
            }
            assertCurrent(() => this.retired);
        } catch (error) {
            failed = true;
            failure = error;
            this.retired = true;
        } finally {
            this.initializing = false;
        }
        if (this.retired) this.dispose();
        if (this.cleanupErrors.length > 0) {
            const errors = this.cleanupErrors.splice(0);
            throw new AggregateError(failed ? [failure, ...errors] : errors, 'Application cleanup failed');
        }
        if (failed) throw failure;
        assertCurrent(() => this.retired);
    }

    private dispose(): void {
        if (this.cleanupComplete) return;
        this.cleanupComplete = true;
        for (const plugin of this.plugins.splice(0).toReversed()) {
            attempt(() => plugin.destroy.call(this), this.cleanupErrors);
        }
        attempt(() => this.stage.destroy({ children: true, texture: false, textureSource: false }), this.cleanupErrors);
        if (this.rendererOwned) {
            this.rendererOwned = false;
            destroyOwnedRenderer(this.renderer, this.cleanupErrors);
        }
    }

    private reportCleanupErrors(): void {
        if (this.cleanupErrors.length > 0) {
            throw new AggregateError(this.cleanupErrors.splice(0), 'Application cleanup failed');
        }
    }
}
