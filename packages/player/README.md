# @zeffuro/zerith-player

Static web player and export CLI for Zerith visual novel projects.

## Commands

- `npx @zeffuro/zerith-player --game=. --outDir=dist/game --base=./`: build the current game folder as a static site.
- `npx @zeffuro/zerith-player --game=. --outDir=dist/game --zip --zipFile=dist/game.zip`: build and create an uploadable zip.
- `npm run dev:player` from repo root: launches the player against `games/classic-vn-starter`.
- `npm run build:game -- --game=games/classic-vn-starter`: builds a distributable to `dist/<game-name>`.
- `npm run build:game:desktop -- --game=games/classic-vn-starter --outDir=dist/starter-desktop`: packages a standalone game using the prebuilt player for this computer.
- `npm run build:player:desktop`: developer command to compile the reusable player. Rust tools are needed for this step, not for exporting games with the installed editor.

## How it works

- `scripts/build-game.mjs` resolves the game folder and validates that `game.json` exists.
- The script passes `ZERITH_GAME_DIR`, `ZERITH_OUT_DIR`, and `ZERITH_BASE` into Vite.
- `vite.config.ts` uses those env vars to set `publicDir` (game files), `build.outDir`, and deploy `base`.
- Production build base defaults to `./` to keep generated asset URLs portable on itch and subpath hosting. Dev server still uses `/`.
- `src/main.ts` and `src/runtime/bootstrapPlayer.ts` resolve runtime and project URLs using the Vite base or the browser export's base metadata. Browser exports support relative paths, host paths, and HTTP(S) content URLs.

## Editor export

- The editor `File > Export Game...` menu opens an in-editor dialog with target, base, output, and zip options.
- Itch preset in the dialog enforces `base=./` and enables zip for HTML5 upload compatibility.
- Export logs are written to the Console panel so you can inspect build output without leaving the editor.
- Web exports use the shared compiler and player template.
- The desktop editor's Desktop app package profile copies its bundled player and creates `game.zpack`. No Rust or Node installation is required for editor export.
- Desktop output directories must be new and outside the project. Failed exports retain their output so a retry can use a new directory.
- On Windows, distribute `game-player.exe` and `game.zpack` together. They run without Rust, Node or the editor. The destination computer needs WebView2. The `web` folder is an inspectable web export and is optional for desktop distribution.
- Display controls live in Settings. F11 or Alt+Enter toggles fullscreen. Escape opens the pause menu. Window size, position and display mode are remembered per game. Resizing preserves the game's aspect ratio.
- Set a stable `id` in `game.json` when making a distinct game or renaming one. The player uses that identity for saved data. Without an explicit ID it derives identity from the title, so games with the same title share an identity.
- `pwsh -File scripts/smoke-desktop-game.ps1 -Executable dist/starter-desktop/game-player.exe` verifies standalone Windows playback. Use `-Fixture example-game` for the showcase fixture.

## Player menus

Games include a title menu, pause menu, Settings, Save, Load and History. Continue
opens the most recent readable save. Save replacement, loading during play and
returning to title ask for confirmation. Menus hold story command execution.
Escape, right-click or touch and hold opens pause. S and L open Save and Load.
Keyboard and gamepad controls follow `engine.config.json` input settings.

The editor's Engine Config form includes Player menus. Customize the title,
subtitle, background asset, accent color, action labels, order, visibility and
save slots. The matching JSON section is:

```json
{
  "player": {
    "title": "Late Train",
    "subtitle": "A station after closing",
    "accentColor": "#88aacc",
    "saveSlots": 6,
    "titleActions": ["new-game", "continue", "load", "settings"],
    "pauseActions": ["resume", "save", "load", "history", "settings", "title"],
    "actionLabels": { "new-game": "Start" },
    "rememberSettings": true
  }
}
```

New Game and Resume stay available. Empty fields use defaults. Settings remember
audio, text and accessibility choices per game. Reset settings restores authored
defaults. Self-voicing uses the browser's system speech support when available.
Custom font assets configured in `preview.fontAssetUrl` also load in the player.

Set `player.enabled` to `false` to retain the core start screen and menus.
Custom hosts can pass `shell: false` to `bootstrapPlayer`, or provide a shell
factory with `start()` and `dispose()` methods. Its context contains the engine,
canvas, display controller, preferences and start scene. A custom shell owns
starting playback and can use `engine.flow.acquireSuspension?.()` while open.
The default shell uses DOM elements and scoped CSS that hosts can restyle.

Default browser saves now use a namespace derived from the manifest's stable
`id`, falling back to its title. Disabling menus keeps that namespace. Existing
unscoped browser saves remain stored but are not automatically assigned to a game.
A custom storage provider can retain an earlier namespace. Desktop save keys
keep their existing per-game namespace.


Player menu appearance can be authored in `engine.config.json` under `player`.
The editor provides title alignment (`left`, `center`, `right`), menu font
(`system`, `serif`, `monospace`), font size (14 to 24 px), menu button width
(220 to 600 px), button height (44 to 80 px), and corner style
(`rounded`, `square`, `pill`). `panelColor`, `textColor`, `buttonColor` and
`accentColor` accept six-digit hex colors or RGB integers. `panelOpacity` and
`backgroundOpacity` range from 0 to 1. Background opacity affects the authored
menu background image. Controls stay within the available viewport width.

Drag an enabled action by its handle to reorder it. A focused handle also accepts
Arrow Up and Arrow Down. New Game and Resume remain available. Empty appearance
overrides use the defaults, and Use player defaults clears all known menu fields.
