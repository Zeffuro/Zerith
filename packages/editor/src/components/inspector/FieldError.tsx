export function FieldError({ errors }: { errors?: string[] }) {
    if (!errors || errors.length === 0) return;

    return (
        <div style={{ color: '#ef4444', fontSize: '0.8em', marginTop: '4px' }}>
            {errors[0]}
        </div>
    );
}