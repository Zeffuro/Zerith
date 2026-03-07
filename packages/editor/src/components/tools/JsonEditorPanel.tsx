import { useEffect, useMemo, useState } from 'react';
import { useScriptStore } from '../../store/useScriptStore';
import { editorTheme as t } from '../../theme/editorTheme';

export function JsonEditorPanel({ uiScale }: { uiScale: number }) {
    const rootScript = useScriptStore((s) => s.rootScript);
    const setScript = useScriptStore((s) => s.setScript);

    const initial = useMemo(() => JSON.stringify(rootScript, null, 2), [rootScript]);
    const [text, setText] = useState(initial);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setText(initial);
        setError(null);
    }, [initial]);

    const apply = () => {
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
                setError('Root JSON must be an array.');
                return;
            }
            setScript(parsed);
            setError(null);
        } catch (e: any) {
            setError(e?.message ?? 'Invalid JSON');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${8 * uiScale}px`, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ color: t.text.primary }}>JSON Editor</strong>
                <button
                    onClick={apply}
                    style={{
                        background: t.accent.primary,
                        border: `1px solid ${t.border.primaryBtn}`,
                        color: t.text.primary,
                        borderRadius: t.radius.md,
                        padding: `${4 * uiScale}px ${8 * uiScale}px`,
                        cursor: 'pointer',
                    }}
                >
                    Apply
                </button>
            </div>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                    flex: 1,
                    width: '100%',
                    background: t.bg.input,
                    border: `1px solid ${error ? '#ef4444' : t.border.input}`,
                    color: t.text.primary,
                    borderRadius: t.radius.md,
                    padding: `${8 * uiScale}px`,
                    fontFamily: 'monospace',
                    fontSize: `${12 * uiScale}px`,
                    resize: 'none',
                }}
            />

            {error && <div style={{ color: '#ef4444', fontSize: `${12 * uiScale}px` }}>{error}</div>}
        </div>
    );
}