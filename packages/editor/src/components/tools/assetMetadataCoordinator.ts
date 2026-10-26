import {
    type AssetLibraryMetadata,
    type AssetLibraryMetadataSnapshot,
    createEmptyAssetLibraryMetadata,
    serializeAssetLibraryMetadata,
} from '../../services/assetLibraryMetadata';

export type AssetMetadataState = {
    error?: string;
    loading: boolean;
    metadata: AssetLibraryMetadata;
    ready: boolean;
    saving: boolean;
};

type Dependencies = {
    load: () => Promise<AssetLibraryMetadataSnapshot>;
    ownsSession: () => boolean;
    publish: (state: AssetMetadataState) => void;
    refresh: (isCurrent: () => boolean) => Promise<void>;
    report: (level: 'error' | 'info' | 'warn', message: string, detail?: string) => void;
    save: (metadata: AssetLibraryMetadata, snapshot: AssetLibraryMetadataSnapshot, isCurrent: () => boolean) => Promise<void>;
};

export function createAssetMetadataCoordinator(dependencies: Dependencies) {
    let active = false;
    let request = 0;
    let reloadPending = false;
    let snapshot: AssetLibraryMetadataSnapshot | undefined;
    let state: AssetMetadataState = {
        loading: false, metadata: createEmptyAssetLibraryMetadata(), ready: false, saving: false,
    };
    const ownsSession = () => active && dependencies.ownsSession();
    const publish = (update: Partial<AssetMetadataState>) => {
        state = { ...state, ...update };
        dependencies.publish(state);
    };

    async function load(): Promise<void> {
        if (!ownsSession()) return;
        if (state.saving) {
            reloadPending = true;
            return;
        }
        const currentRequest = ++request;
        const isCurrent = () => ownsSession() && request === currentRequest;
        publish({ error: undefined, loading: true, ready: false });
        try {
            const loaded = await dependencies.load();
            if (!isCurrent()) return;
            snapshot = loaded;
            publish({ metadata: loaded.metadata, ready: true });
        } catch (error) {
            if (!isCurrent()) return;
            publish({ error: String(error), ready: false });
            dependencies.report('error', 'Asset library metadata load failed:', String(error));
        } finally {
            if (isCurrent()) publish({ loading: false });
        }
    }

    async function mutate(
        update: (metadata: AssetLibraryMetadata) => AssetLibraryMetadata,
        successMessage: string,
    ): Promise<boolean> {
        if (!ownsSession() || !snapshot || !state.ready || state.loading || state.saving) return false;
        const currentRequest = ++request;
        const isCurrent = () => ownsSession() && request === currentRequest;
        const baseline = snapshot;
        const nextMetadata = update(state.metadata);
        publish({ error: undefined, saving: true });
        try {
            await dependencies.save(nextMetadata, baseline, isCurrent);
            if (!isCurrent()) return false;
            snapshot = { metadata: nextMetadata, text: serializeAssetLibraryMetadata(nextMetadata) };
            publish({ metadata: nextMetadata });
            try {
                await dependencies.refresh(isCurrent);
            } catch (error) {
                if (isCurrent()) dependencies.report('warn', 'Asset metadata saved, but reference refresh failed:', String(error));
            }
            if (!isCurrent()) return false;
            dependencies.report('info', successMessage);
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            publish({ error: String(error) });
            dependencies.report('error', 'Asset library metadata save failed:', String(error));
            return false;
        } finally {
            if (isCurrent()) {
                publish({ saving: false });
                if (reloadPending) {
                    reloadPending = false;
                    void load();
                }
            }
        }
    }

    return {
        activate() { active = true; },
        deactivate() { active = false; request++; },
        getState: () => state,
        load,
        mutate,
        ownsSession,
    };
}
