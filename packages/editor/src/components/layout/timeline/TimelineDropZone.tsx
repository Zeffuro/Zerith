import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { DropIndicator } from './types';

type Properties = {
    borderAccent: string;
    dropIndicator: DropIndicator;
    onDragOver: (event: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onDrop: (event: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    rootCount: number;
    sameArrayPath: (a: ScriptPath, b: ScriptPath) => boolean;
    uiScale: number;
};

export function TimelineDropZone({
                                     borderAccent,
                                     dropIndicator,
                                     onDragOver,
                                     onDrop,
                                     rootCount,
                                     sameArrayPath,
                                     uiScale,
                                 }: Properties) {
    return (
        <div
            onDragOver={(event) => onDragOver(event, [], rootCount)}
            onDrop={(event) => onDrop(event, [], rootCount)}
            style={{
                borderTop:
                    dropIndicator &&
                    sameArrayPath(dropIndicator.arrayPath, []) &&
                    dropIndicator.index === rootCount
                        ? `2px solid ${borderAccent}`
                        : '2px solid transparent',
                height: `${8 * uiScale}px`,
            }}
        />
    );
}
