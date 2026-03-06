import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getAllPlugins } from '../../editor/commandPlugins';
import { useMemo, useRef } from 'react';
import { useDismissiblePopup } from '../../hooks/useDismissiblePopup';

export function QuickCommandsMenu({
                                      uiScale,
                                      open,
                                      onClose,
                                      quickCommandTypes,
                                      toggleQuickCommandType,
                                      moveQuickCommandType,
                                  }: {
    uiScale: number;
    open: boolean;
    onClose: () => void;
    quickCommandTypes: string[];
    toggleQuickCommandType: (type: string) => void;
    moveQuickCommandType: (type: string, direction: 'left' | 'right') => void;
}) {
    const allPlugins = useMemo(() => getAllPlugins(), []);
    const rootRef = useRef<HTMLDivElement>(null);

    useDismissiblePopup(open, rootRef, onClose);

    if (!open) return null;

    return (
        <div
            ref={rootRef}
            className="zerith-scrollbar"
            style={{
                position: 'absolute',
                top: `${42 * uiScale}px`,
                left: `${220 * uiScale}px`,
                width: `${420 * uiScale}px`,
                maxHeight: `${360 * uiScale}px`,
                overflowY: 'auto',
                background: '#1f1f1f',
                border: '1px solid #3a3a3a',
                borderRadius: '6px',
                zIndex: 2000,
                boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
                padding: `${10 * uiScale}px`,
            }}
        >
            <div style={{ color: '#aaa', fontSize: '0.8em', marginBottom: `${8 * uiScale}px` }}>
                Toggle commands and reorder quick buttons.
            </div>

            {allPlugins.map((p) => {
                const active = quickCommandTypes.includes(p.type);

                return (
                    <div
                        key={p.type}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto auto',
                            gap: `${6 * uiScale}px`,
                            alignItems: 'center',
                            padding: `${6 * uiScale}px`,
                            borderRadius: '4px',
                            background: active ? '#2a2a2a' : 'transparent',
                        }}
                    >
                        <button
                            onClick={() => toggleQuickCommandType(p.type)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: `${8 * uiScale}px`,
                                background: 'transparent',
                                border: 'none',
                                color: active ? '#fff' : '#888',
                                textAlign: 'left',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        >
                            {p.icon(14 * uiScale)}
                            <span>{p.label}</span>
                            <span style={{ color: '#666', fontSize: '0.8em' }}>({p.type})</span>
                        </button>

                        <button
                            disabled={!active}
                            onClick={() => moveQuickCommandType(p.type, 'left')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#aaa',
                                cursor: active ? 'pointer' : 'not-allowed',
                                padding: `${4 * uiScale}px`,
                                opacity: active ? 1 : 0.35,
                            }}
                            title="Move left"
                        >
                            <ArrowLeft size={14 * uiScale} />
                        </button>

                        <button
                            disabled={!active}
                            onClick={() => moveQuickCommandType(p.type, 'right')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#aaa',
                                cursor: active ? 'pointer' : 'not-allowed',
                                padding: `${4 * uiScale}px`,
                                opacity: active ? 1 : 0.35,
                            }}
                            title="Move right"
                        >
                            <ArrowRight size={14 * uiScale} />
                        </button>

                        <span style={{ color: active ? '#22c55e' : '#666', fontSize: '0.75em' }}>
                            {active ? 'ON' : 'OFF'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}