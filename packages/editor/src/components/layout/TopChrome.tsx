import { useEditorStore } from '../../store/useEditorStore';
import { MenuBar } from './menubar/MenuBar';
import { Toolbar } from './Toolbar';

export function TopChrome() {
    const uiScale = useEditorStore((s) => s.uiScale);

    return (
        <div
            style={{
                display: 'grid',
                flexShrink: 0,
                gridTemplateRows: `${28 * uiScale}px ${44 * uiScale}px`,
                position: 'relative',
                width: '100%',
                zIndex: 1000,
            }}
        >
            <MenuBar uiScale={uiScale} />
            <Toolbar />
        </div>
    );
}