import { CommandPaletteView } from './CommandPaletteView';
import { useCommandPaletteController } from './useCommandPaletteController';

type Properties = {
    onRequestClose: () => void;
    uiScale: number;
};

export function CommandPalette({ onRequestClose, uiScale }: Properties) {
    const viewProperties = useCommandPaletteController({ onRequestClose, uiScale });

    return <CommandPaletteView {...viewProperties} />;
}


