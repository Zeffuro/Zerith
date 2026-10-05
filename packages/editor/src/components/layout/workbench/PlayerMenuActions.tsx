import type { EngineConfigFile } from '@zeffuro/zerith-core';

import { GripVertical } from 'lucide-react';
import { useState } from 'react';

import { editorTheme as t } from '../../../theme/editorTheme';
import { sharedStyles } from './EditorSharedUI';
import { movePlayerConfigAction, PLAYER_ACTION_LABELS, PLAYER_MENU_DEFAULTS, type PlayerConfigAction, type PlayerConfigMenu, readPlayerConfigActions, reorderPlayerConfigAction, requiredPlayerConfigAction, setPlayerConfigAction } from './playerConfigModel';

type Properties = {
    config: EngineConfigFile;
    menu: PlayerConfigMenu;
    onUpdate: (updater: (current: EngineConfigFile) => EngineConfigFile) => void;
    uiScale: number;
};

export function PlayerMenuActions({ config, menu, onUpdate, uiScale }: Properties) {
    const [dragged, setDragged] = useState<PlayerConfigAction>();
    const [announcement, setAnnouncement] = useState('');
    const actions = readPlayerConfigActions(config.player, menu);
    const ordered = [...actions, ...PLAYER_MENU_DEFAULTS[menu].filter(action => !actions.includes(action))];
    const name = menu === 'titleActions' ? 'title' : 'pause';
    const reorder = (action: PlayerConfigAction, target: PlayerConfigAction) => {
        onUpdate(current => reorderPlayerConfigAction(current, menu, action, target));
        setAnnouncement(`${PLAYER_ACTION_LABELS[action]} moved to position ${actions.indexOf(target) + 1}`);
        setDragged(undefined);
    };
    return (
        <fieldset style={{ border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, minWidth: 0, padding: 10 }}>
            <legend style={{ fontSize: `${12 * uiScale}px` }}>{name === 'title' ? 'Title menu actions' : 'Pause menu actions'}</legend>
            <p style={{ color: t.text.muted, fontSize: 11, margin: '0 0 8px' }}>Drag the handle to reorder. Focus it and use Arrow Up or Arrow Down.</p>
            <span aria-live="polite" style={{ clipPath: 'inset(50%)', height: 1, overflow: 'hidden', position: 'absolute', width: 1 }}>{announcement}</span>
            {ordered.map(action => {
                const index = actions.indexOf(action);
                const label = PLAYER_ACTION_LABELS[action];
                return (
                    <div data-player-action={action} data-player-menu={menu} key={action}
                        onDragOver={event => { if (dragged && index !== -1) event.preventDefault(); }}
                        onDrop={event => { event.preventDefault(); if (dragged && index !== -1) reorder(dragged, action); }}
                        style={{ alignItems: 'center', display: 'flex', gap: 6, marginTop: 6, opacity: dragged === action ? .6 : 1 }}>
                        <button aria-label={`Reorder ${label} in ${name} menu`} disabled={index === -1} draggable={index !== -1}
                            onDragEnd={() => setDragged(undefined)}
                            onDragStart={event => { setDragged(action); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', action); }}
                            onKeyDown={event => {
                                if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                                event.preventDefault();
                                const direction = event.key === 'ArrowUp' ? -1 : 1;
                                onUpdate(current => movePlayerConfigAction(current, menu, action, direction));
                                setAnnouncement(`${label} at position ${Math.min(actions.length, Math.max(1, index + direction + 1))}`);
                            }}
                            onPointerCancel={() => setDragged(undefined)}
                            onPointerDown={event => {
                                if (event.pointerType === 'mouse') return;
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setDragged(action);
                            }}
                            onPointerUp={event => {
                                if (event.pointerType === 'mouse') return;
                                const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-player-action]');
                                const target = row?.dataset.playerAction as PlayerConfigAction | undefined;
                                if (target && row?.dataset.playerMenu === menu && actions.includes(target)) reorder(action, target);
                                else setDragged(undefined);
                            }}
                            style={{ ...sharedStyles.iconButton(index >= 0, uiScale), cursor: index >= 0 ? 'grab' : 'default', minHeight: 32, minWidth: 32, touchAction: 'none' }} type="button">
                            <GripVertical aria-hidden size={16} />
                        </button>
                        <label style={{ alignItems: 'center', display: 'flex', fontSize: `${12 * uiScale}px`, gap: 6 }}>
                            <input checked={index !== -1} disabled={action === requiredPlayerConfigAction(menu)} onChange={event => onUpdate(current => setPlayerConfigAction(current, menu, action, event.target.checked))} type="checkbox" />
                            {label}{action === requiredPlayerConfigAction(menu) ? ' (required)' : ''}
                        </label>
                    </div>
                );
            })}
        </fieldset>
    );
}
