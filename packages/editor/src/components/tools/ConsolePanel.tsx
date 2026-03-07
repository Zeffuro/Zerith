import { useEffect, useRef } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { Trash2 } from 'lucide-react';

export function ConsolePanel() {
    const uiScale = useEditorStore(s => s.uiScale);
    const { messages, clear } = useConsoleStore();
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    const getColor = (type: string) => {
        if (type === 'error') return t.accent.red;
        if (type === 'warn') return '#fbbf24';
        if (type === 'info') return '#60a5fa';
        return t.text.normal;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg.app }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${4 * uiScale}px ${8 * uiScale}px`, background: t.bg.panel, borderBottom: `1px solid ${t.border.subtle}` }}>
                <span style={{ fontWeight: 'bold', fontSize: `${11 * uiScale}px`, color: t.text.muted }}>ENGINE LOGS</span>
                <button onClick={clear} title="Clear Console" style={{ background: 'transparent', border: 'none', color: t.text.muted, cursor: 'pointer' }}>
                    <Trash2 size={14 * uiScale} />
                </button>
            </div>
            <div className="zerith-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: `${8 * uiScale}px`, fontFamily: 'monospace', fontSize: `${12 * uiScale}px` }}>
                {messages.length === 0 && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No logs yet...</div>}
                {messages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', gap: '8px', marginBottom: '4px', color: getColor(msg.type), borderBottom: `1px solid ${t.bg.panel}`, paddingBottom: '4px' }}>
                        <span style={{ opacity: 0.5, whiteSpace: 'nowrap' }}>[{msg.timestamp.toLocaleTimeString()}]</span>
                        <span style={{ wordBreak: 'break-all' }}>{msg.text}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}