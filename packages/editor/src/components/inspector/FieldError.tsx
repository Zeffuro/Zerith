import { editorTheme as t } from '../../theme/editorTheme';

export function FieldError({ errors }: { errors?: string[] }) {
    if (!errors || errors.length === 0) return;

    return (
        <div style={{ color: t.accent.red, fontSize: '0.8em', marginTop: '4px' }}>
            {errors[0]}
        </div>
    );
}