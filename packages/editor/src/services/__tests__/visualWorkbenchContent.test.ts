import { describe, expect, it } from 'vitest';

import { serializeMacroEntries, serializeSceneCommands } from '../visualWorkbenchContent';

describe('visual file serialization', () => {
    it('retains the complete scene envelope while replacing only commands', () => {
        const envelope = {
            $schema: 'zerith/scene',
            commands: [{ name: 'original', type: 'label' }],
            custom: { positions: [13, 27] },
            graph: { entry: 'intro', exits: ['next'] },
            id: 'intro',
            localeNamespace: 'story.intro',
            schemaVersion: 2,
        };
        const commands = [{ name: 'edited', type: 'label' as const }];
        expect(JSON.parse(serializeSceneCommands(commands, JSON.stringify(envelope)))).toEqual({ ...envelope, commands });
    });

    it('keeps array scenes in their existing format', () => {
        const commands = [{ text: 'edited', type: 'dialogue' as const }];
        expect(JSON.parse(serializeSceneCommands(commands, '[]'))).toEqual(commands);
    });

    it('retains macro metadata while applying additions and deletions', () => {
        const source = { $custom: { owner: 'author' }, $schema: 'zerith/macros', removed: [] };
        const entries = [{ commands: [{ text: 'edited', type: 'dialogue' as const }], name: 'added' }];
        expect(JSON.parse(serializeMacroEntries(entries, JSON.stringify(source)))).toEqual({
            $custom: source.$custom,
            $schema: source.$schema,
            added: entries[0].commands,
        });
    });
});
