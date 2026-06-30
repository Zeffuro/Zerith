# Player Build Prototype

This package provides a standalone runtime build for shipping a game as a static site.

## Commands

- `npm run dev:player` from repo root: launches the player against `games/classic-vn-starter`.
- `npm run build:game -- --game=games/classic-vn-starter`: builds a distributable to `dist/<game-name>`.
- `npm run build:game -- --game=games/classic-vn-starter --outDir=dist/custom-output`: builds to a custom output folder.
- `npm run build:game:zip -- --game=games/classic-vn-starter`: builds and creates `dist/<game-name>.zip`.
- `npm run build:game -- --game=games/classic-vn-starter --zip --zipFile=dist/my-upload.zip`: custom zip path.
- `npm run build:game -- --game=games/classic-vn-starter --base=./`: optional explicit base override.

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

## Itch upload checklist

- Build with zip: `npm run build:game:zip -- --game=games/classic-vn-starter`
- Upload the generated zip file (default: `dist/<game-name>.zip`) directly to itch.
- The zip root must contain `index.html` and `assets/` (this build script zips the output root, not a parent folder).
- Zip creation is implemented in Node and is cross-platform (no OS-specific zip shell dependency).

## Future options

- **Desktop**: package this static player in a dedicated Tauri shell (separate from the editor app).
- **Mobile**: evaluate Tauri mobile and Capacitor once the runtime packaging contract is stable.

