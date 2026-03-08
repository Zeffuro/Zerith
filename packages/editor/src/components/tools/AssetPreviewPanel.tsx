import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';

import { useAssetOptions } from '../../hooks/useAssetOptions';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { editorTheme as t } from '../../theme/editorTheme';

function extensionOf(path: string) {
    const index = path.lastIndexOf('.');
    return index === -1 ? '' : path.slice(index).toLowerCase();
}

const IMG_EXT = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp']);
const AUDIO_EXT = new Set(['.m4a', '.mp3', '.ogg', '.wav']);

export function AssetPreviewPanel({ uiScale }: { uiScale: number }) {
    const projectPath = useProjectStore((s) => s.projectPath);
    const { assets } = useAssetOptions('all');
    const selectedAssetPath = useEditorStore((s) => s.selectedAssetPath);

    const [value, setValue] = useState('');
    const [prevSelected, setPrevSelected] = useState(selectedAssetPath);

    if (selectedAssetPath !== prevSelected) {
        setPrevSelected(selectedAssetPath);
        if (selectedAssetPath) {
            setValue(selectedAssetPath);
        }
    }

    const resolvedSource = useMemo(() => {
        if (!value) return '';
        if (!projectPath) return value;
        if (value.startsWith('http')) return value;
        return convertFileSrc(projectPath + value);
    }, [value, projectPath]);

    const extension = extensionOf(value);
    const isImg = IMG_EXT.has(extension);
    const isAudio = AUDIO_EXT.has(extension);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${8 * uiScale}px`, height: '100%' }}>
            <strong style={{ color: t.text.primary }}>Asset Preview</strong>

            <input
                list="asset-preview-options"
                onChange={(event) => setValue(event.target.value)}
                placeholder="/assets/..."
                style={{
                    background: t.bg.input,
                    border: `1px solid ${t.border.input}`,
                    borderRadius: t.radius.md,
                    color: t.text.primary,
                    padding: `${8 * uiScale}px`,
                    width: '100%',
                }}
                type="text"
                value={value}
            />
            <datalist id="asset-preview-options">
                {assets.slice(0, 500).map((a) => (
                    <option key={a.value} value={a.value} />
                ))}
            </datalist>

            <div
                style={{
                    background: t.bg.panelAlt,
                    border: `1px solid ${t.border.subtle}`,
                    borderRadius: t.radius.md,
                    flex: 1,
                    overflow: 'auto',
                    padding: `${8 * uiScale}px`,
                }}
            >
                {!value && <div style={{ color: t.text.faint }}>Pick an asset to preview.</div>}

                {!!value && isImg && (
                    <img alt={value} src={resolvedSource} style={{ maxHeight: '100%', maxWidth: '100%' }} />
                )}

                {!!value && isAudio && (
                    <audio controls src={resolvedSource} style={{ width: '100%' }} />
                )}

                {!!value && !isImg && !isAudio && (
                    <div style={{ color: t.text.muted }}>
                        No preview renderer for <code>{extension || 'unknown'}</code>.
                    </div>
                )}
            </div>
        </div>
    );
}
