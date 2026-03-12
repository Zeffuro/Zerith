import { describe, expect, it } from 'vitest';

import { formatScriptBranchLabel, SCRIPT_BRANCH_LABEL_SEPARATOR } from '../globalSearch/branchLabels';

describe('globalSearch branch label helpers', () => {
    it('exposes a stable branch label separator token', () => {
        expect(SCRIPT_BRANCH_LABEL_SEPARATOR).toBe(' > ');
    });

    it('formats parent and branch labels with stable separator', () => {
        expect(formatScriptBranchLabel('Scene: intro', 'If > then')).toBe('Scene: intro > If > then');
        expect(formatScriptBranchLabel('Macro: greet', 'Else')).toBe('Macro: greet > Else');
    });
});

