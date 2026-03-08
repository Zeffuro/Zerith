import { editorTheme as t } from '../../../theme/editorTheme';

export function InlineNameInput({
                                    autoFocus = true,
                                    onCancel,
                                    onChange,
                                    onSubmit,
                                    uiScale,
                                    value,
                                }: {
    autoFocus?: boolean;
    onCancel: () => void;
    onChange: (v: string) => void;
    onSubmit: () => Promise<void> | void;
    uiScale: number;
    value: string;
}) {
    return (
        <input
            autoFocus={autoFocus}
            onBlur={() => void onSubmit()}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    void onSubmit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
            }}
            style={{
                background: t.bg.input,
                border: `1px solid ${t.border.input}`,
                borderRadius: t.radius.sm,
                color: t.text.primary,
                flex: 1,
                fontSize: 'inherit',
                minWidth: 0,
                padding: `${2 * uiScale}px ${6 * uiScale}px`,
            }}
            value={value}
        />
    );
}