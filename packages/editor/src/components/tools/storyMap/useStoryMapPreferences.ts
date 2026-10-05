import { useEffect, useState } from 'react';

import { defaultStoryMapPreferences, readStoryMapPreferences, saveStoryMapPreferences, type StoryMapPreferences } from '../../../services/storyMap/storyMapPreferences';

export function useStoryMapPreferences(projectPath: string | undefined) {
    const [session, setSession] = useState<{ path?: string; preferences: StoryMapPreferences }>({ preferences: defaultStoryMapPreferences });
    const [warning, setWarning] = useState('');
    useEffect(() => {
        try { setSession({ path: projectPath, preferences: projectPath ? readStoryMapPreferences(projectPath) : defaultStoryMapPreferences }); setWarning(''); }
        catch { setSession({ path: projectPath, preferences: defaultStoryMapPreferences }); setWarning('Saved map view could not be read. Your game files are unaffected.'); }
    }, [projectPath]);
    const preferences = session.path === projectPath ? session.preferences : defaultStoryMapPreferences;
    const update = (next: StoryMapPreferences) => {
        setSession({ path: projectPath, preferences: next });
        if (!projectPath) return;
        try { saveStoryMapPreferences(projectPath, next); }
        catch { setWarning('The map view could not be remembered. Your game files are unaffected.'); }
    };
    return { preferences, update, warning };
}
