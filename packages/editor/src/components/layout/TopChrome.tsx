import { Toolbar } from './Toolbar';
import { MenuBar } from './menubar/MenuBar';
import { useEditorStore } from '../../store/useEditorStore';

export function TopChrome() {
    const uiScale = useEditorStore((s) => s.uiScale);

    return (
        <div
            style={{
                width: '100%',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1000,
                display: 'grid',
                gridTemplateRows: `${28 * uiScale}px ${44 * uiScale}px`,
            }}
        >
            <MenuBar uiScale={uiScale} />
            <Toolbar />
        </div>
    );
}