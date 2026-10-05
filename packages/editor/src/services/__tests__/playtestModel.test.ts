import { describe, expect, it } from 'vitest';

import { checkPlaytestResult, parsePlaytestDocument, parsePlaytestScenario, parsePlaytestState } from '../playtests/playtestModel';
import { validatePlaytestTarget } from '../playtests/playtestRuntime';

const scenario = { choices: [1, 0], expectedScene: 'station', expectedState: { trust: 2 }, id: 'evening', index: 1, inventory: ['ticket'], name: 'Evening shift', scene: 'station', state: { trust: 1 } };

describe('saved playtest scenarios', () => {
    it('reads a named starting state and route without changing its source', () => {
        const source = JSON.stringify({ scenarios: [scenario], version: 1 });
        const result = parsePlaytestDocument(source);
        expect(result.scenarios[0]).toEqual(scenario);
        result.scenarios[0].state.trust = 3;
        expect(scenario.state.trust).toBe(1);
    });

    it.each([
        { ...scenario, index: -1 }, { ...scenario, choices: [0.5] }, { ...scenario, inventory: ['ticket', 'ticket'] },
        { ...scenario, name: '' }, { ...scenario, state: [] }, { ...scenario, expectedState: undefined },
    ])('rejects invalid scenario data before launch', value => {
        expect(() => parsePlaytestScenario(value)).toThrow();
    });

    it('rejects unsupported versions and duplicate scenario IDs', () => {
        expect(() => parsePlaytestDocument(JSON.stringify({ scenarios: [], version: 2 }))).toThrow();
        expect(() => parsePlaytestDocument(JSON.stringify({ scenarios: [scenario, scenario], version: 1 }))).toThrow('Duplicate');
    });

    it('rejects unsafe nested keys and non-finite variables', () => {
        expect(() => parsePlaytestState(JSON.parse('{"trust":{"__proto__":1}}'))).toThrow();
        expect(() => parsePlaytestState({ trust: Number.NaN })).toThrow();
    });

    it('checks nested JSON values without requiring identical key order', () => {
        const value = { ...scenario, expectedState: { notebook: { dock: false, station: true } } };
        expect(checkPlaytestResult(value, 'station', { notebook: { dock: false, station: true } })).toEqual([]);
        expect(checkPlaytestResult(value, 'dock', { notebook: { dock: true, station: true } })).toHaveLength(2);
    });

    it('does not claim success when no result check is configured', () => {
        expect(checkPlaytestResult({ ...scenario, expectedScene: undefined, expectedState: {} }, 'station', {})).toHaveLength(1);
    });

    it('rejects stale scenes, commands, inventory and locales', () => {
        const scenes = { station: [{ name: 'entry', type: 'label' }, { text: 'The last train leaves at ten.', type: 'dialogue' }] };
        expect(() => validatePlaytestTarget(scenario, scenes, ['ticket'], [])).not.toThrow();
        expect(() => validatePlaytestTarget({ ...scenario, scene: 'dock' }, scenes, ['ticket'], [])).toThrow('Scene');
        expect(() => validatePlaytestTarget({ ...scenario, index: 2 }, scenes, ['ticket'], [])).toThrow('command');
        expect(() => validatePlaytestTarget(scenario, scenes, [], [])).toThrow('inventory');
        expect(() => validatePlaytestTarget({ ...scenario, locale: 'nl' }, scenes, ['ticket'], [])).toThrow('Locale');
    });
});
