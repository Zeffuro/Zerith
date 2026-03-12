import { beforeEach, describe, expect, it } from 'vitest';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
} from '../../test-utils/registerOpenProjectEntryMocks';
import {
    getPreferredViewForJsonResource,
    getViewActionForJsonResource,
} from '../openProjectEntry/index';

const openProjectEntryMocks = getOpenProjectEntryMocks();

describe('openProjectEntry viewPrefs', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('maps resource kinds to preferred view selectors', () => {
        expect(getPreferredViewForJsonResource('manifest', 'timeline')).toBe('timeline');
        expect(getPreferredViewForJsonResource('items', 'timeline')).toBe('timeline');
        expect(getPreferredViewForJsonResource('characters', 'json')).toBe('json');

        expect(openProjectEntryMocks.getPreferredManifestView).toHaveBeenCalledWith('timeline');
        expect(openProjectEntryMocks.getPreferredItemsView).toHaveBeenCalledWith('timeline');
        expect(openProjectEntryMocks.getPreferredCharactersView).toHaveBeenCalledWith('json');
    });

    it('maps resource kinds to view action names', () => {
        expect(getViewActionForJsonResource('manifest')).toBe('setManifestView');
        expect(getViewActionForJsonResource('items')).toBe('setItemsView');
        expect(getViewActionForJsonResource('characters')).toBe('setCharactersView');
    });
});

