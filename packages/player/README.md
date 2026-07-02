# @zeffuro/zerith-player

Static web player and export CLI for Zerith visual novel projects.

## Commands

- `npx @zeffuro/zerith-player --game=. --outDir=dist/game --base=./`: build the current game folder as a static site.
- `npx @zeffuro/zerith-player --game=. --outDir=dist/game --zip --zipFile=dist/game.zip`: build and create an uploadable zip.
- `npm run dev:player` from repo root: launches the player against `games/classic-vn-starter`.
- `npm run build:game -- --game=games/classic-vn-starter`: builds a distributable to `dist/<game-name>`.

## How it works

- `scripts/build-game.mjs` resolves the game folder and validates that `game.json` exists.
- The script passes `ZERITH_GAME_DIR`, `ZERITH_OUT_DIR`, and `ZERITH_BASE` into Vite.
- `vite.config.ts` uses those env vars to set `publicDir` (game files), `build.outDir`, and deploy `base`.
- Production build base defaults to `./` to keep generated asset URLs portable on itch and subpath hosting. Dev server still uses `/`.
- `src/main.ts` and `src/runtime/bootstrapPlayer.ts` resolve runtime URLs using Vite base, which keeps builds portable under itch subpaths.

## Editor export

- The editor `File > Export Game...` menu opens an in-editor dialog with target, base, output, and zip options.
- Itch preset in the dialog enforces `base=./` and enables zip for HTML5 upload compatibility.
- Export logs are written to the Console panel so you can inspect build output without leaving the editor.
- Export actions call the same `build:game` pipeline used by the CLI, so output behavior stays consistent.

