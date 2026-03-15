import { Copy, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useConsoleStore } from '../../store/useConsoleStore';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';

export function ConsolePanel() {
    const uiScale = useEditorStore((s) => s.uiScale);
    const clear = useConsoleStore((state) => state.clear);
    const messages = useConsoleStore((state) => state.messages);
    const listReference = useRef<HTMLDivElement>(null);
    const endReference = useRef<HTMLDivElement>(null);

    const [sourceFilter, setSourceFilter] = useState<'all' | 'editor' | 'preview' | 'react'>('all');

    const filtered = useMemo(() => {
        return sourceFilter === 'all'
            ? messages
            : messages.filter((message) => message.source === sourceFilter);
    }, [messages, sourceFilter]);

    const visibleMessages = useMemo(() => {
        const VISIBLE_MESSAGE_LIMIT = 300;
        if (filtered.length <= VISIBLE_MESSAGE_LIMIT) return filtered;
        return filtered.slice(-VISIBLE_MESSAGE_LIMIT);
    }, [filtered]);

    const copyLatestVisible = async () => {
        const latest = filtered.at(-1);
        if (!latest) return;
        await copyTextToClipboard(`[${latest.timestampText}][${latest.source}][${latest.type}] ${latest.text}`);
    };

    const handleConsoleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const module_ = event.ctrlKey || event.metaKey;
        if (!module_ || event.key.toLowerCase() !== 'c') return;

        const selectedText = globalThis.getSelection?.()?.toString().trim() ?? '';
        if (selectedText.length > 0) {
            event.stopPropagation();
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        void copyLatestVisible();
    };

    useEffect(() => {
        const listElement = listReference.current;
        if (!listElement) return;

        const distanceFromBottom = listElement.scrollHeight - listElement.clientHeight - listElement.scrollTop;
        if (distanceFromBottom > 60) return;
        endReference.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    const copyAll = async () => {
        const payload = filtered
            .map((m) => `[${m.timestampText}][${m.source}][${m.type}] ${m.text}`)
            .join('\n');
        await copyTextToClipboard(payload);
    };

    const getColor = (type: string) => {
        if (type === 'error') return t.accent.red;
        if (type === 'warn') return t.accent.yellow;
        if (type === 'info') return t.accent.blue;
        return t.text.normal;
    };

    const chip = (value: 'all' | 'editor' | 'preview' | 'react', label: string) => {
        const active = sourceFilter === value;
        return (
            <button
                onClick={() => setSourceFilter(value)}
                style={{
                    background: active ? t.bg.selected : 'transparent',
                    border: `1px solid ${active ? t.border.accent : t.border.subtle}`,
                    borderRadius: t.radius.sm,
                    color: active ? t.text.primary : t.text.muted,
                    cursor: 'pointer',
                    fontSize: `${11 * uiScale}px`,
                    padding: `${2 * uiScale}px ${6 * uiScale}px`,
                }}
            >
                {label}
            </button>
        );
    };

    return (
        <div
            data-console-panel="true"
            onKeyDown={handleConsoleKeyDown}
            style={{ background: t.bg.app, display: 'flex', flexDirection: 'column', height: '100%' }}
            tabIndex={0}
        >
            <div
                style={{
                    alignItems: 'center',
                    background: t.bg.panel,
                    borderBottom: `1px solid ${t.border.subtle}`,
                    display: 'flex',
                    gap: `${6 * uiScale}px`,
                    justifyContent: 'space-between',
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                }}
            >
                <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px`, fontWeight: 'bold' }}>
                    LOGS
                </span>

                <div style={{ display: 'flex', gap: `${4 * uiScale}px`, marginLeft: 'auto' }}>
                    {chip('all', 'All')}
                    {chip('editor', 'Editor')}
                    {chip('preview', 'Preview')}
                    {chip('react', 'React')}
                </div>

                <button
                    onClick={() => {
                        void copyAll();
                    }}
                    style={{ background: 'transparent', border: 'none', color: t.text.muted, cursor: 'pointer' }}
                    title="Copy visible logs"
                >
                    <Copy size={14 * uiScale} />
                </button>

                <button
                    onClick={clear}
                    style={{ background: 'transparent', border: 'none', color: t.text.muted, cursor: 'pointer' }}
                    title="Clear Console"
                >
                    <Trash2 size={14 * uiScale} />
                </button>
            </div>

            <div
                className="zerith-scrollbar"
                ref={listReference}
                style={{
                    flex: 1,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: `${12 * uiScale}px`,
                    overflowY: 'auto',
                    padding: `${8 * uiScale}px`,
                }}
            >
                {filtered.length === 0 && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No logs yet...</div>}

                {visibleMessages.map((message) => (
                    <div
                        key={message.id}
                        style={{
                            alignItems: 'start',
                            borderBottom: `1px solid ${t.bg.panel}`,
                            color: getColor(message.type),
                            display: 'grid',
                            gap: '8px',
                            gridTemplateColumns: 'auto 1fr auto',
                            marginBottom: '4px',
                            paddingBottom: '4px',
                        }}
                    >
                        <span style={{ opacity: 0.5, whiteSpace: 'nowrap' }}>
                            [{message.timestampText}]
                        </span>

                        <span
                            style={{
                                userSelect: 'text',
                                WebkitUserSelect: 'text',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            [{message.source}] {message.text}
                        </span>

                        <button
                            onClick={() => {
                                void copyTextToClipboard(`[${message.timestampText}][${message.source}][${message.type}] ${message.text}`);
                            }}
                            style={{ background: 'transparent', border: 'none', color: t.text.muted, cursor: 'pointer' }}
                            title="Copy line"
                        >
                            <Copy size={12 * uiScale} />
                        </button>
                    </div>
                ))}
                <div ref={endReference} />
            </div>
        </div>
    );
}

async function copyTextToClipboard(text: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        console.warn('Clipboard write failed:', error);
    }
}
