import type { Theme } from '../../utils/Theme';

export interface IThemeProvider {
    getTheme(): Theme;
}

