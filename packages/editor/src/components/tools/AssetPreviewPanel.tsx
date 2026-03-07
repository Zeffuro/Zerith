import { useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useProjectStore } from '../../store/useProjectStore';
import { useAssetOptions } from '../../hooks/useAssetOptions';
import { editorTheme as t } from '../../theme/editorTheme';

function extOf(path: string) {
    const i = path.lastIndexOf('.');
    return i >= 0 ? path.slice(i).toLowerCase() : '';
}

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const AUDIO_EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a']);

export function AssetPreviewPanel({ uiScale }: { uiScale: number }) {
    const projectPath = useProjectStore((s) => s.projectPath);
    const { assets } = useAssetOptions('all');

    const [value, setValue] = useState('');

    const resolvedSrc = useMemo(() => {
        if (!value) return '';
        if (!projectPath) return value;
        if (value.startsWith('http')) return value;
        return convertFileSrc(projectPath + value);
    }, [value, projectPath]);

    const ext = extOf(value);
    const isImg = IMG_EXT.has(ext);
    const isAudio = AUDIO_EXT.has(ext);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${8 * uiScale}px`, height: '100%' }}>
            <strong style={{ color: t.text.primary }}>Asset Preview</strong>

            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                list="asset-preview-options"
                placeholder="/assets/..."
                style={{
                    width: '100%',
                    background: t.bg.input,
                    border: `1px solid ${t.border.input}`,
                    color: t.text.primary,
                    borderRadius: t.radius.md,
                    padding: `${8 * uiScale}px`,
                }}
            />
            <datalist id="asset-preview-options">
                {assets.slice(0, 500).map((a) => (
                    <option key={a.value} value={a.value} />
                ))}
            </datalist>

            <div
                style={{
                    flex: 1,
                    border: `1px solid ${t.border.subtle}`,
                    borderRadius: t.radius.md,
                    background: t.bg.panelAlt,
                    padding: `${8 * uiScale}px`,
                    overflow: 'auto',
                }}
            >
                {!value && <div style={{ color: t.text.faint }}>Pick an asset to preview.</div>}

                {!!value && isImg && (
                    <img src={resolvedSrc} alt={value} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                )}

                {!!value && isAudio && (
                    <audio src={resolvedSrc} controls style={{ width: '100%' }} />
                )}

                {!!value && !isImg && !isAudio && (
                    <div style={{ color: t.text.muted }}>
                        No preview renderer for <code>{ext || 'unknown'}</code>.
                    </div>
                )}
            </div>
        </div>
    );
}