import { editorTheme as t } from '../../../theme/editorTheme';

export function InlineNameInput({
                                    uiScale,
                                    value,
                                    onChange,
                                    onSubmit,
                                    onCancel,
                                    autoFocus = true,
                                }: {
    uiScale: number;
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void | Promise<void>;
    onCancel: () => void;
    autoFocus?: boolean;
}) {
    return (
        <input
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => void onSubmit()}
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
                flex: 1,
                minWidth: 0,
                background: t.bg.input,
                border: `1px solid ${t.border.input}`,
                color: t.text.primary,
                borderRadius: t.radius.sm,
                padding: `${2 * uiScale}px ${6 * uiScale}px`,
                fontSize: 'inherit',
            }}
        />
    );
}