import type { CSSProperties } from 'react';
import type { EvidenceItem, Serializable } from 'zerith-core';

import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useEngineBridgeStore } from '../../store/useEngineBridgeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';

type RuntimeSnapshot = {
    background: string | undefined;
    bgmCommandUrl: string | undefined;
    bgmResolvedUrl: string | undefined;
    currentIndex: number;
    currentScene: string;
    dialogueSpeaker: string | undefined;
    dialogueText: string | undefined;
    isMuted: boolean;
    items: EvidenceItem[];
    persistent: Record<string, Serializable>;
    scriptLength: number;
    sprites: Record<string, unknown>;
    state: Record<string, Serializable>;
    volumes: {
        bgmVolume: number;
        masterVolume: number;
        sfxVolume: number;
        voiceVolume: number;
    };
};

type TimelineEntry = {
    id: number;
    kind: TimelineKind;
    text: string;
    timestamp: number;
};

type TimelineKind = 'engine' | 'input' | 'scene' | 'state';

const MAX_TIMELINE_ENTRIES = 120;

export function RuntimeMonitorPanel() {
    const uiScale = useSettingsStore((state) => state.uiScale);
    const engine = useEngineBridgeStore((state) => state.engine);
    const [snapshot, setSnapshot] = useState<RuntimeSnapshot | undefined>();
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

    const signatureReference = useRef('');
    const timelineIdReference = useRef(0);
    const previousSnapshotReference = useRef<RuntimeSnapshot | undefined>(snapshot);

    const appendTimeline = (kind: TimelineKind, text: string) => {
        timelineIdReference.current += 1;
        const nextEntry: TimelineEntry = {
            id: timelineIdReference.current,
            kind,
            text,
            timestamp: Date.now(),
        };
        setTimeline((previous) => {
            const next = [...previous, nextEntry];
            return next.length > MAX_TIMELINE_ENTRIES ? next.slice(next.length - MAX_TIMELINE_ENTRIES) : next;
        });
    };

    useEffect(() => {
        if (!engine) {
            signatureReference.current = '';
            previousSnapshotReference.current = undefined;
            return;
        }

        const pull = () => {
            const next: RuntimeSnapshot = {
                background: engine.stateManager.system.background,
                bgmCommandUrl: engine.stateManager.system.bgm,
                bgmResolvedUrl: engine.audio.currentBgmUrl,
                currentIndex: engine.currentIndex,
                currentScene: engine.currentSceneName,
                dialogueSpeaker: engine.stateManager.system.dialogue?.speaker,
                dialogueText: engine.stateManager.system.dialogue?.text,
                isMuted: engine.audio.muted,
                items: engine.items.getAll(),
                persistent: engine.stateManager.persistentState,
                scriptLength: engine.scenes.scriptLength,
                sprites: engine.stateManager.system.sprites,
                state: engine.stateManager.state,
                volumes: {
                    bgmVolume: engine.audio.bgmVolume,
                    masterVolume: engine.audio.masterVolume,
                    sfxVolume: engine.audio.sfxVolume,
                    voiceVolume: engine.audio.voiceVolume,
                },
            };

            const nextSignature = JSON.stringify(next);
            if (nextSignature === signatureReference.current) return;
            signatureReference.current = nextSignature;

            const previous = previousSnapshotReference.current;
            if (previous) {
                if (previous.currentScene !== next.currentScene) {
                    appendTimeline('scene', `Scene -> ${next.currentScene || '(none)'}`);
                }
                if (previous.background !== next.background) {
                    appendTimeline('engine', `Background -> ${next.background || '(none)'}`);
                }
                if (previous.bgmCommandUrl !== next.bgmCommandUrl || previous.bgmResolvedUrl !== next.bgmResolvedUrl) {
                    appendTimeline('engine', `BGM -> ${next.bgmCommandUrl || '(none)'} [${next.bgmResolvedUrl || 'resolved:none'}]`);
                }
                if (previous.items.length !== next.items.length) {
                    appendTimeline('state', `Inventory count -> ${next.items.length}`);
                }
                if (Object.keys(previous.state).length !== Object.keys(next.state).length) {
                    appendTimeline('state', `State keys -> ${Object.keys(next.state).length}`);
                }
            }

            previousSnapshotReference.current = next;
            setSnapshot(next);
        };

        pull();
        const interval = globalThis.setInterval(pull, 150);
        return () => {
            globalThis.clearInterval(interval);
        };
    }, [engine]);

    useEffect(() => {
        if (!engine) return;

        const onSceneLoading = (sceneName: string) => appendTimeline('scene', `scene:loading ${sceneName}`);
        const onSceneLoaded = (sceneName: string) => appendTimeline('scene', `scene:loaded ${sceneName}`);
        const onInputNext = () => appendTimeline('input', 'input:next');
        const onInputConfirm = () => appendTimeline('input', 'input:confirm');
        const onInputSkip = () => appendTimeline('input', 'input:skip');
        const onPersistentChanged = (state: Record<string, Serializable>) =>
            appendTimeline('state', `persistent keys -> ${Object.keys(state).length}`);

        engine.events.on('scene:loading', onSceneLoading);
        engine.events.on('scene:loaded', onSceneLoaded);
        engine.events.on('input:next', onInputNext);
        engine.events.on('input:confirm', onInputConfirm);
        engine.events.on('input:skip', onInputSkip);
        engine.events.on('state:persistent_changed', onPersistentChanged);

        return () => {
            engine.events.off('scene:loading', onSceneLoading);
            engine.events.off('scene:loaded', onSceneLoaded);
            engine.events.off('input:next', onInputNext);
            engine.events.off('input:confirm', onInputConfirm);
            engine.events.off('input:skip', onInputSkip);
            engine.events.off('state:persistent_changed', onPersistentChanged);
        };
    }, [engine]);

    if (!engine || !snapshot) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>Game preview not running.</div>;
    }

    return (
        <div
            className="zerith-scrollbar"
            style={{
                background: t.bg.app,
                color: t.text.normal,
                display: 'flex',
                flexDirection: 'column',
                fontSize: `${11 * uiScale}px`,
                gap: `${10 * uiScale}px`,
                height: '100%',
                overflow: 'auto',
                padding: `${10 * uiScale}px`,
            }}
        >
            <section style={sectionStyle(uiScale)}>
                <strong>Playback</strong>
                <InfoRow label="Scene" value={`${snapshot.currentScene || '(none)'} @ ${snapshot.currentIndex}/${snapshot.scriptLength}`} />
                <InfoRow label="Background" value={snapshot.background || '(none)'} />
                <InfoRow label="Dialogue" value={snapshot.dialogueSpeaker ? `${snapshot.dialogueSpeaker}: ${snapshot.dialogueText ?? ''}` : '(none)'} />
                <InfoRow
                    label="Recent Dialogue"
                    value={
                        engine.history
                            .getRecent(3)
                            .map((entry) => `${entry.speaker}: ${entry.text}`)
                            .join(' | ') || '(none)'
                    }
                />
            </section>

            <section style={sectionStyle(uiScale)}>
                <strong>Audio</strong>
                <InfoRow label="BGM (command)" value={snapshot.bgmCommandUrl || '(none)'} />
                <InfoRow label="BGM (resolved)" value={snapshot.bgmResolvedUrl || '(none)'} />
                <InfoRow label="Muted" value={snapshot.isMuted ? 'Yes' : 'No'} />
                <InfoRow label="Volumes" value={`M:${snapshot.volumes.masterVolume} B:${snapshot.volumes.bgmVolume} S:${snapshot.volumes.sfxVolume} V:${snapshot.volumes.voiceVolume}`} />
            </section>

            <section style={sectionStyle(uiScale)}>
                <strong>World</strong>
                <InfoRow label="Items" value={String(snapshot.items.length)} />
                <InfoRow label="Sprites" value={String(Object.keys(snapshot.sprites).length)} />
                <InfoRow label="State Keys" value={String(Object.keys(snapshot.state).length)} />
                <InfoRow label="Persistent Keys" value={String(Object.keys(snapshot.persistent).length)} />
            </section>

            <section style={sectionStyle(uiScale)}>
                <div style={{ alignItems: 'center', display: 'flex' }}>
                    <strong>Event Timeline</strong>
                    <button
                        className="toolbar-btn"
                        onClick={() => setTimeline([])}
                        style={{ marginLeft: 'auto', padding: `${3 * uiScale}px ${6 * uiScale}px` }}
                        title="Clear timeline"
                    >
                        <Trash2 size={12 * uiScale} />
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px`, marginTop: `${6 * uiScale}px` }}>
                    {timeline.length === 0 ? (
                        <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No events yet.</div>
                    ) : (
                        timeline
                            .toReversed()
                            .map((entry) => (
                                <div key={entry.id} style={{ display: 'grid', gap: 8, gridTemplateColumns: '72px 54px 1fr' }}>
                                    <span style={{ color: t.text.faint }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                    <span style={{ color: kindColor(entry.kind) }}>{entry.kind}</span>
                                    <span style={{ wordBreak: 'break-word' }}>{entry.text}</span>
                                </div>
                            ))
                    )}
                </div>
            </section>

            <section style={sectionStyle(uiScale)}>
                <strong>State (JSON)</strong>
                <CodeBlock uiScale={uiScale} value={JSON.stringify(snapshot.state, undefined, 2)} />
            </section>

            <section style={sectionStyle(uiScale)}>
                <strong>Sprites (JSON)</strong>
                <CodeBlock uiScale={uiScale} value={JSON.stringify(snapshot.sprites, undefined, 2)} />
            </section>
        </div>
    );
}

function CodeBlock({ uiScale, value }: { uiScale: number; value: string; }) {
    return (
        <pre
            style={{
                background: t.bg.input,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: `${11 * uiScale}px`,
                margin: `${6 * uiScale}px 0 0`,
                maxHeight: `${140 * uiScale}px`,
                overflow: 'auto',
                padding: `${8 * uiScale}px`,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}
        >
            {value}
        </pre>
    );
}

function InfoRow({ label, value }: { label: string; value: string; }) {
    return (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '140px 1fr' }}>
            <span style={{ color: t.text.muted }}>{label}</span>
            <span style={{ wordBreak: 'break-word' }}>{value}</span>
        </div>
    );
}

function kindColor(kind: TimelineKind): string {
    if (kind === 'scene') return '#60a5fa';
    if (kind === 'input') return '#fbbf24';
    if (kind === 'state') return '#4ade80';
    return '#d1d5db';
}

function sectionStyle(uiScale: number): CSSProperties {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'flex',
        flexDirection: 'column',
        gap: `${4 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}
