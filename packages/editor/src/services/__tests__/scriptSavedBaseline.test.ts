import { validateScript } from '@zeffuro/zerith-core/schemas';
import { describe, expect, it } from 'vitest';

import { normalizeScript } from '../../store/script/helpers';
import { scriptMatchesSavedBaseline } from '../scriptSavedBaseline';

const commands = [{ speaker: 'Guide', text: 'Saved line', type: 'dialogue' }];

describe('visual saved script baseline', () => {
    it.each([commands, { commands, localeNamespace: 'intro' }])('recognizes saved scene content with normalized editor defaults', source => {
        expect(scriptMatchesSavedBaseline(JSON.stringify(source), normalizeScript(commands), [], false)).toBe(true);
    });

    it('recognizes the active individual macro and all macros with metadata', () => {
        const source = JSON.stringify({ $schema: 'macros', alpha: commands, beta: [] });
        expect(scriptMatchesSavedBaseline(source, normalizeScript(commands), [], false, 'alpha')).toBe(true);
        expect(scriptMatchesSavedBaseline(source, [], [{ commands: [], name: 'beta' }, { commands: normalizeScript(commands), name: 'alpha' }], true)).toBe(true);
        expect(scriptMatchesSavedBaseline(source, [], [{ commands: normalizeScript(commands), name: 'alpha' }], true)).toBe(false);
    });

    it('recognizes unchanged macro compatibility defaults without marking the file dirty', () => {
        const commands = [{ type: 'for' }, { type: 'while' }, { options: [{ label: 'Choice' }], type: 'choice' }];
        const source = JSON.stringify({ alpha: commands });
        expect(scriptMatchesSavedBaseline(source, [], [{ commands, name: 'alpha' }], true)).toBe(true);
        const changed = [{ ...commands[0], from: 2 }, ...commands.slice(1)];
        expect(scriptMatchesSavedBaseline(source, [], [{ commands: changed, name: 'alpha' }], true)).toBe(false);
    });

    it('compares normalized saved choices with schema-validated models despite key order', () => {
        const commands = [{ options: [{ label: 'Choice' }], type: 'choice' }];
        const source = JSON.stringify({ alpha: commands });
        expect(scriptMatchesSavedBaseline(source, [], [{ commands: validateScript(commands), name: 'alpha' }], true)).toBe(true);
    });

    it.each([undefined, 'invalid JSON', '{}', '[{"speaker":"Guide","text":"Earlier line","type":"dialogue"}]'])('keeps changed or unknown content dirty', source => {
        expect(scriptMatchesSavedBaseline(source, normalizeScript(commands), [], false)).toBe(false);
    });
});
