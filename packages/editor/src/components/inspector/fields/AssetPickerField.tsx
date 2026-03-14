import { CSSProperties, useMemo } from 'react';

import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { openProjectEntry } from '../../../services/openProjectEntry';
import { useProjectStore } from '../../../store/storeBootstrap';
import { editorTheme as t } from '../../../theme/editorTheme';

type Properties = {
    inputStyle?: CSSProperties;
    kind?: 'all' | 'audio' | 'bg' | 'bgm' | 'sfx' | 'sprite';
    listId: string;
    onChange: (next: string) => void;
    placeholder?: string;
    value: string;
};

export function AssetPickerField({
                                     inputStyle,
                                     kind = 'all',
                                     listId,
                                     onChange,
                                     placeholder = '/assets/...',
                                     value,
                                 }: Properties) {
    const { assets } = useAssetOptions(kind);
            const projectPath = useProjectStore((s) => s.projectPath);

    const options = useMemo(() => assets.slice(0, 200), [assets]);
            const canOpen = Boolean(projectPath && value.trim());

            const openAssetInWorkbench = async () => {
                if (!projectPath) return;
                const trimmed = value.trim();
                if (!trimmed) return;

                const absolutePath = toAbsoluteProjectPath(projectPath, trimmed);
                await openProjectEntry(absolutePath, basename(trimmed));
            };

    return (
                <div style={{ alignItems: 'center', display: 'flex', gap: 6 }}>
            <input
                list={listId}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                type="text"
                value={value}
            />
                    <button
                        disabled={!canOpen}
                        onClick={() => {
                            void openAssetInWorkbench();
                        }}
                        style={{
                            background: t.bg.panel,
                            border: `1px solid ${t.border.button}`,
                            borderRadius: t.radius.sm,
                            color: canOpen ? t.text.normal : t.text.faint,
                            cursor: canOpen ? 'pointer' : 'not-allowed',
                            fontSize: '12px',
                            padding: '4px 8px',
                        }}
                        type="button"
                    >
                        Open
                    </button>
            <datalist id={listId}>
                {options.map((a) => (
                    <option key={a.value} value={a.value} />
                ))}
            </datalist>
                </div>
    );
}

        function basename(path: string): string {
            return path.split(/[\\/]/).pop() || path;
        }

        function toAbsoluteProjectPath(projectPath: string, maybeRelativePath: string): string {
            if (/^[a-zA-Z]:[\\/]/.test(maybeRelativePath)) return maybeRelativePath;
            if (maybeRelativePath.startsWith('\\\\')) return maybeRelativePath;

            const relative = maybeRelativePath.replace(/^\/+/, '').replaceAll('/', '\\');
            const normalizedProject = projectPath.replace(/[\\/]+$/, '');
            return `${normalizedProject}\\${relative}`;
        }
