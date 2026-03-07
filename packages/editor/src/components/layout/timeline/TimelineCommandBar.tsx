import { AddCommandMenu } from '../AddCommandMenu.tsx';

type Item = { type: string; label: string; icon: React.ReactNode };

type Props = {
    uiScale: number;
    commandMenuItems: Item[];
    quickTypes: string[];
    onAdd: (type: string) => void;
    getQuickMeta: (type: string) => { icon: React.ReactNode; title: string; bg: string; border: string };
};

export function TimelineCommandBar({
                                       uiScale,
                                       commandMenuItems,
                                       quickTypes,
                                       onAdd,
                                       getQuickMeta,
                                   }: Props) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${4 * uiScale}px`, marginBottom: `${12 * uiScale}px` }}>
            <AddCommandMenu uiScale={uiScale} onAdd={onAdd} items={commandMenuItems} />
            {quickTypes.map((type) => {
                const meta = getQuickMeta(type);
                return (
                    <QuickBtn
                        key={type}
                        onClick={() => onAdd(type)}
                        icon={meta.icon}
                        title={meta.title}
                        scale={uiScale}
                        bg={meta.bg}
                        border={meta.border}
                    />
                );
            })}
        </div>
    );
}

function QuickBtn({ onClick, icon, title, scale, bg = '#333', border = '#444' }: any) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: bg,
                border: `1px solid ${border}`,
                color: '#ccc',
                borderRadius: '3px',
                width: `${28 * scale}px`,
                height: `${26 * scale}px`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                cursor: 'pointer',
                padding: 0,
            }}
        >
            {icon}
        </button>
    );
}