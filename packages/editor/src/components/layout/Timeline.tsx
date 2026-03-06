import { useProjectStore } from '../../store/useProjectStore';

export function Timeline() {
    const script = useProjectStore(state => state.script);

    return (
        <div style={{ padding: '12px', height: '100%', backgroundColor: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>SCRIPT TIMELINE</div>
            <pre style={{ flexGrow: 1, backgroundColor: '#111', padding: '12px', borderRadius: '4px', overflow: 'auto', fontSize: '13px', border: '1px solid #333' }}>
                {JSON.stringify(script, null, 2)}
            </pre>
        </div>
    );
}