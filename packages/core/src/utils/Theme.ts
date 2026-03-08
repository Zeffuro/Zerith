export interface Theme {
    accentColor: number;
    borderColor: number;
    borderWidth: number;
    boxAlpha: number;
    boxColor: number;
    fontFamily: string;
    fontSize: number;
    hoverColor: number;
}

export const DefaultTheme: Theme = {
    accentColor: 0xFF_AA_AA,
    borderColor: 0xAA_AA_FF,
    borderWidth: 4,
    boxAlpha: 0.9,
    boxColor: 0x00_00_55,
    fontFamily: 'Courier New',
    fontSize: 24,
    hoverColor: 0x33_33_99
};