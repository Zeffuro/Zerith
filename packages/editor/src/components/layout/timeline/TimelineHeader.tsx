import { Home, ChevronRight } from 'lucide-react';
import { editorTheme as t } from '../../../theme/editorTheme';

type Props = {
    uiScale: number;
    scopePath: (string | number)[];
    selectedCount: number;
    onResetScope: () => void;
    onPopScope: () => void;
};

export function TimelineHeader({
                                   uiScale,
                                   scopePath,
                                   selectedCount,
                                   onResetScope,
                                   onPopScope,
                               }: Props) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: `1px solid ${t.border.subtle}`,
                color: t.text.muted,
                fontSize: '0.85em',
            }}
        >
            <button
                onClick={onResetScope}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    color: scopePath.length === 0 ? t.text.primary : t.text.muted,
                }}
            >
                <Home size={14 * uiScale} />
            </button>

            {scopePath.length > 0 && (
                <>
                    {scopePath.map((part, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                            <ChevronRight size={12 * uiScale} />
                            <span style={{ color: i === scopePath.length - 1 ? t.text.primary : t.text.muted }}>
                                {typeof part === 'number' ? `Node ${part}` : part}
                            </span>
                        </div>
                    ))}
                    <button
                        onClick={onPopScope}
                        style={{
                            marginLeft: 'auto',
                            background: '#333',
                            border: 'none',
                            color: '#ccc',
                            borderRadius: '3px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            cursor: 'pointer',
                        }}
                    >
                        UP
                    </button>
                </>
            )}

            {selectedCount > 1 && (
                <span
                    style={{
                        marginLeft: 'auto',
                        color: '#93c5fd',
                        fontSize: '0.8em',
                        fontWeight: 600,
                        padding: '2px 8px',
                        border: '1px solid #1e40af',
                        borderRadius: '999px',
                        background: '#0b1733',
                    }}
                >
                    {selectedCount} selected
                </span>
            )}
        </div>
    );
}