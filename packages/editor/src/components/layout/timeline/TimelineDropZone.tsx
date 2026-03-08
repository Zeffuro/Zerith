import type { ScriptPath } from '../../../utils/scriptPathUtils';

type Properties = {
    borderAccent: string;
    dropIndicator: { arrayPath: ScriptPath; index: number } | null;
    onDragOver: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onDrop: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
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
            onDragOver={(e) => onDragOver(e, [], rootCount)}
            onDrop={(e) => onDrop(e, [], rootCount)}
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