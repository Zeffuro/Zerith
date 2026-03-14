import { useMemo, useState } from 'react';

import type { ReferenceLocation } from '../../services/referenceScanner';

import { openProjectEntry } from '../../services/openProjectEntry';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useReferenceStore } from '../../store/useReferenceStore';
import { editorTheme as t } from '../../theme/editorTheme';

export function ReferenceTrackerPanel() {
    const uiScale = useEditorStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const scanned = useReferenceStore((state) => state.result);

    const [query, setQuery] = useState('');
    const [showAssets, setShowAssets] = useState(true);
    const [showCharacters, setShowCharacters] = useState(true);
    const [showVariables, setShowVariables] = useState(true);

    const normalizedQuery = query.trim().toLowerCase();

    const filteredVariables = useMemo(
        () => Object.entries(scanned.variables)
            .filter(([name]) => !normalizedQuery || name.toLowerCase().includes(normalizedQuery))
            .toSorted(([left], [right]) => left.localeCompare(right)),
        [normalizedQuery, scanned.variables],
    );

    const filteredAssets = useMemo(
        () => Object.entries(scanned.assets)
            .filter(([name]) => !normalizedQuery || name.toLowerCase().includes(normalizedQuery))
            .toSorted(([left], [right]) => left.localeCompare(right)),
        [normalizedQuery, scanned.assets],
    );

    const filteredCharacters = useMemo(
        () => Object.entries(scanned.characters)
            .filter(([name]) => !normalizedQuery || name.toLowerCase().includes(normalizedQuery))
            .toSorted(([left], [right]) => left.localeCompare(right)),
        [normalizedQuery, scanned.characters],
    );

    const handleOpenLocation = async (location: ReferenceLocation) => {
        const options = location.sceneName.startsWith('macro:') || !location.sceneName.startsWith('macro:')
            ? { forceView: 'timeline' as const }
            : undefined;

        await openProjectEntry(location.filePath, basename(location.filePath), options);
        const editor = useEditorStore.getState();
        editor.setSelectedNodePaths([location.path]);
        editor.setSelectionAnchorPath(location.path);
    };

    if (!projectPath) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>Open a project to scan references.</div>;
    }

    return (
        <div
            className="zerith-scrollbar"
            style={{
                background: t.bg.app,
                color: t.text.normal,
                display: 'flex',
                flexDirection: 'column',
                gap: `${8 * uiScale}px`,
                height: '100%',
                overflow: 'auto',
                padding: `${10 * uiScale}px`,
            }}
        >
            <strong>Reference Tracker</strong>

            <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter variables, assets, characters..."
                style={{
                    background: t.bg.input,
                    border: `1px solid ${t.border.input}`,
                    borderRadius: t.radius.sm,
                    color: t.text.primary,
                    fontSize: `${12 * uiScale}px`,
                    outline: 'none',
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                }}
                value={query}
            />

            <section style={sectionStyle(uiScale)}>
                <button className="toolbar-btn" onClick={() => setShowVariables((value) => !value)} style={sectionHeaderStyle(uiScale)} type="button">
                    Variables ({filteredVariables.length})
                </button>
                {showVariables && filteredVariables.map(([name, stats]) => (
                    <EntryBlock
                        key={`var-${name}`}
                        locations={stats.reads}
                        name={name}
                        onOpenLocation={handleOpenLocation}
                        subtitle={`type: ${stats.inferredType} | reads: ${stats.reads.length} | writes: ${stats.writes.length}`}
                        uiScale={uiScale}
                        writeLocations={stats.writes}
                    />
                ))}
            </section>

            <section style={sectionStyle(uiScale)}>
                <button className="toolbar-btn" onClick={() => setShowAssets((value) => !value)} style={sectionHeaderStyle(uiScale)} type="button">
                    Assets ({filteredAssets.length})
                </button>
                {showAssets && filteredAssets.map(([name, locations]) => (
                    <EntryBlock
                        key={`asset-${name}`}
                        locations={locations}
                        name={name}
                        onOpenLocation={handleOpenLocation}
                        subtitle={`references: ${locations.length}`}
                        uiScale={uiScale}
                    />
                ))}
            </section>

            <section style={sectionStyle(uiScale)}>
                <button className="toolbar-btn" onClick={() => setShowCharacters((value) => !value)} style={sectionHeaderStyle(uiScale)} type="button">
                    Characters ({filteredCharacters.length})
                </button>
                {showCharacters && filteredCharacters.map(([name, locations]) => (
                    <EntryBlock
                        key={`char-${name}`}
                        locations={locations}
                        name={name}
                        onOpenLocation={handleOpenLocation}
                        subtitle={`references: ${locations.length}`}
                        uiScale={uiScale}
                    />
                ))}
            </section>
        </div>
    );
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function EntryBlock({
    locations,
    name,
    onOpenLocation,
    subtitle,
    uiScale,
    writeLocations,
}: {
    locations: ReferenceLocation[];
    name: string;
    onOpenLocation: (location: ReferenceLocation) => Promise<void>;
    subtitle: string;
    uiScale: number;
    writeLocations?: ReferenceLocation[];
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{ border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, padding: `${6 * uiScale}px` }}>
            <button className="toolbar-btn" onClick={() => setExpanded((value) => !value)} style={entryHeaderStyle(uiScale)} type="button">
                <span style={{ color: t.text.primary, fontWeight: 600 }}>{name}</span>
                <span style={{ color: t.text.faint }}>{subtitle}</span>
            </button>

            {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px`, marginTop: `${4 * uiScale}px` }}>
                    {writeLocations && writeLocations.length > 0 && (
                        <div style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>Writes</div>
                    )}
                    {writeLocations?.map((location, index) => (
                        <LocationRow
                            key={`write-${name}-${index}`}
                            location={location}
                            onOpenLocation={onOpenLocation}
                            uiScale={uiScale}
                        />
                    ))}

                    {writeLocations && writeLocations.length > 0 && (
                        <div style={{ color: t.text.muted, fontSize: `${11 * uiScale}px`, marginTop: `${4 * uiScale}px` }}>Reads</div>
                    )}
                    {locations.map((location, index) => (
                        <LocationRow
                            key={`read-${name}-${index}`}
                            location={location}
                            onOpenLocation={onOpenLocation}
                            uiScale={uiScale}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function entryHeaderStyle(uiScale: number) {
    return {
        alignItems: 'flex-start',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${2 * uiScale}px`,
        width: '100%',
    };
}

function LocationRow({
    location,
    onOpenLocation,
    uiScale,
}: {
    location: ReferenceLocation;
    onOpenLocation: (location: ReferenceLocation) => Promise<void>;
    uiScale: number;
}) {
    return (
        <button
            className="toolbar-btn"
            onClick={() => {
                void onOpenLocation(location);
            }}
            style={{
                alignItems: 'flex-start',
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'flex',
                flexDirection: 'column',
                fontSize: `${11 * uiScale}px`,
                gap: `${2 * uiScale}px`,
                padding: `${5 * uiScale}px ${6 * uiScale}px`,
                textAlign: 'left',
                width: '100%',
            }}
            type="button"
        >
            <span style={{ color: t.text.normal }}>{location.sceneName}</span>
            <span style={{ color: t.text.faint }}>{basename(location.filePath)} • {location.commandType}</span>
            <span style={{ color: t.text.faint }}>Path: {location.path.join('.')}</span>
        </button>
    );
}

function sectionHeaderStyle(uiScale: number) {
    return {
        color: t.text.primary,
        fontWeight: 700,
        justifyContent: 'flex-start',
        padding: `${2 * uiScale}px 0`,
    };
}

function sectionStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${6 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

