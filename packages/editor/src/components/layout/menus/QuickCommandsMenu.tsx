import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo, useRef } from 'react';

import type { NonMacroEditorCommandType } from '../../../plugins/types';

import { useDismissiblePopup } from '../../../hooks/useDismissiblePopup';
import { getAllPlugins } from '../../../plugins/commandPlugins';
import { editorTheme as t } from '../../../theme/editorTheme';

export function QuickCommandsMenu({
                                      moveQuickCommandType,
                                      onClose,
                                      open,
                                      quickCommandTypes,
                                      toggleQuickCommandType,
                                      uiScale,
                                  }: {
    moveQuickCommandType: (type: NonMacroEditorCommandType, direction: 'left' | 'right') => void;
    onClose: () => void;
    open: boolean;
    quickCommandTypes: NonMacroEditorCommandType[];
    toggleQuickCommandType: (type: NonMacroEditorCommandType) => void;
    uiScale: number;
}) {
    const allPlugins = useMemo(() => getAllPlugins(), []);
    const rootReference = useRef<HTMLDivElement>(null);

    useDismissiblePopup(open, rootReference, onClose);

    if (!open) return null;

    return (
        <div
            className="zerith-scrollbar"
            ref={rootReference}
            style={{
                background: t.bg.popup,
                border: `1px solid ${t.border.normal}`,
                borderRadius: t.radius.lg,
                boxShadow: t.shadow.popupStrong,
                left: `${220 * uiScale}px`,
                maxHeight: `${360 * uiScale}px`,
                overflowY: 'auto',
                padding: `${10 * uiScale}px`,
                position: 'absolute',
                top: `${42 * uiScale}px`,
                width: `${420 * uiScale}px`,
                zIndex: 2000,
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
                            alignItems: 'center',
                            background: active ? t.bg.hover : 'transparent',
                            borderRadius: '4px',
                            display: 'grid',
                            gap: `${6 * uiScale}px`,
                            gridTemplateColumns: '1fr auto auto auto',
                            padding: `${6 * uiScale}px`,
                        }}
                    >
                        <button
                            onClick={() => toggleQuickCommandType(p.type)}
                            style={{
                                alignItems: 'center',
                                background: 'transparent',
                                border: 'none',
                                color: active ? t.text.primary : t.text.muted,
                                cursor: 'pointer',
                                display: 'flex',
                                gap: `${8 * uiScale}px`,
                                padding: 0,
                                textAlign: 'left',
                            }}
                        >
                            {p.icon(14 * uiScale)}
                            <span>{p.label}</span>
                            <span style={{ color: t.text.faint, fontSize: '0.8em' }}>({p.type})</span>
                        </button>

                        <button
                            disabled={!active}
                            onClick={() => moveQuickCommandType(p.type, 'left')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#aaa',
                                cursor: active ? 'pointer' : 'not-allowed',
                                opacity: active ? 1 : 0.35,
                                padding: `${4 * uiScale}px`,
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
                                opacity: active ? 1 : 0.35,
                                padding: `${4 * uiScale}px`,
                            }}
                            title="Move right"
                        >
                            <ArrowRight size={14 * uiScale} />
                        </button>

                        <span style={{ color: active ? t.accent.green : t.text.faint, fontSize: '0.75em' }}>
                            {active ? 'ON' : 'OFF'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
