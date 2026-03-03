export interface Theme {
    fontFamily: string;
    fontSize: number;
    boxColor: number;
    boxAlpha: number;
    borderColor: number;
    borderWidth: number;
    accentColor: number;
    hoverColor: number;
}

export const DefaultTheme: Theme = {
    fontFamily: 'Courier New',
    fontSize: 24,
    boxColor: 0x000055,
    boxAlpha: 0.9,
    borderColor: 0xaaaaff,
    borderWidth: 4,
    accentColor: 0xffaaaa,
    hoverColor: 0x333399
};