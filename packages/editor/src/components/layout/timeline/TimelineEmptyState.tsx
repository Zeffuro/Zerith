import { editorTheme as t } from '../../../theme/editorTheme';

export function TimelineEmptyState() {
    return (
        <div style={{ color: t.text.faint, fontSize: '0.9em', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
            Empty Block
        </div>
    );
}