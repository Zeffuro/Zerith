import type { RenderablePaletteAction } from './commandPalettePresentationModel';

import { CommandPaletteActionRow } from './CommandPaletteActionRow';
import { CommandPaletteEmptyState } from './CommandPaletteEmptyState';

type Properties = {
    actions: RenderablePaletteAction[];
    onActionClick: (index: number) => void;
    selectedIndex: number;
    showEmptyState: boolean;
    uiScale: number;
};

export function CommandPaletteResultsList({
    actions,
    onActionClick,
    selectedIndex,
    showEmptyState,
    uiScale,
}: Properties) {
    return (
        <div className="zerith-scrollbar" style={{ maxHeight: `min(60vh, ${500 * uiScale}px)`, overflowY: 'auto' }}>
            {showEmptyState && <CommandPaletteEmptyState uiScale={uiScale} />}

            {actions.map((action, index) => {
                return (
                    <CommandPaletteActionRow
                        action={action}
                        isActive={selectedIndex === index}
                        key={action.id}
                        onClick={() => {
                            onActionClick(index);
                        }}
                        uiScale={uiScale}
                    />
                );
            })}
        </div>
    );
}

