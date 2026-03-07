import type { ScriptPath } from '../../../utils/scriptPathUtils';

type Props = {
    uiScale: number;
    rootCount: number;
    dropIndicator: { arrayPath: ScriptPath; index: number } | null;
    sameArrayPath: (a: ScriptPath, b: ScriptPath) => boolean;
    onDragOver: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    onDrop: (e: React.DragEvent, arrayPath: ScriptPath, index: number) => void;
    borderAccent: string;
};

export function TimelineDropZone({
                                     uiScale,
                                     rootCount,
                                     dropIndicator,
                                     sameArrayPath,
                                     onDragOver,
                                     onDrop,
                                     borderAccent,
                                 }: Props) {
    return (
        <div
            onDragOver={(e) => onDragOver(e, [], rootCount)}
            onDrop={(e) => onDrop(e, [], rootCount)}
            style={{
                height: `${8 * uiScale}px`,
                borderTop:
                    dropIndicator &&
                    sameArrayPath(dropIndicator.arrayPath, []) &&
                    dropIndicator.index === rootCount
                        ? `2px solid ${borderAccent}`
                        : '2px solid transparent',
            }}
        />
    );
}