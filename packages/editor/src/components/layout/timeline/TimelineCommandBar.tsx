import type { NonMacroEditorCommandType } from '../../../plugins/types';

import { editorTheme as t } from '../../../theme/editorTheme';
import { AddCommandMenu } from '../menus/AddCommandMenu';

type Item = { icon: React.ReactNode; label: string; type: NonMacroEditorCommandType; };

type Properties = {
    commandMenuItems: Item[];
    getQuickMeta: (type: NonMacroEditorCommandType) => { bg: string; border: string; icon: React.ReactNode; title: string; };
    onAdd: (type: NonMacroEditorCommandType) => void;
    quickTypes: NonMacroEditorCommandType[];
    uiScale: number;
};

type QuickButtonProperties = {
    bg?: string;
    border?: string;
    icon: React.ReactNode;
    onClick: () => void;
    scale: number;
    title: string;
};

export function TimelineCommandBar({
                                       commandMenuItems,
                                       getQuickMeta,
                                       onAdd,
                                       quickTypes,
                                       uiScale,
                                   }: Properties) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${4 * uiScale}px`, marginBottom: `${4 * uiScale}px` }}>
            <AddCommandMenu items={commandMenuItems} onAdd={onAdd} uiScale={uiScale} />
            {quickTypes.map((type) => {
                const meta = getQuickMeta(type);
                return (
                    <QuickButton
                        bg={meta.bg}
                        border={meta.border}
                        icon={meta.icon}
                        key={type}
                        onClick={() => onAdd(type)}
                        scale={uiScale}
                        title={meta.title}
                    />
                );
            })}
        </div>
    );
}


function QuickButton({
                         bg,
                         border,
                         icon,
                         onClick,
                         scale,
                         title
                     }: QuickButtonProperties) {
    return (
        <button
            onClick={onClick}
            onMouseEnter={(event) => (event.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={(event) => (event.currentTarget.style.filter = 'none')}
            style={{
                alignItems: 'center',
                // Use theme fallback if no specific color is passed in
                background: bg ?? t.bg.panelAlt,
                border: `1px solid ${border ?? t.border.normal}`,
                borderRadius: t.radius.sm,
                boxSizing: 'border-box',
                // Use the theme's text color instead of hardcoded #ccc
                color: t.text.primary,
                cursor: 'pointer',
                display: 'inline-flex',
                height: `${26 * scale}px`,
                justifyContent: 'center',
                padding: 0,
                transition: 'filter 0.1s', // Optional: adds a nice hover feel
                width: `${28 * scale}px`,
            }}
            title={title}
        >
            {icon}
        </button>
    );
}