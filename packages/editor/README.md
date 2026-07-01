# Zerith Editor

The editor is the Tauri + React desktop workbench for Zerith projects. It opens local game folders, edits scenes and assets, validates content, previews runtime behavior, and calls the same player export pipeline used by the CLI.

## Commands

From the repository root:

```bash
npm run dev:editor
npm run build --workspace=zerith-editor
```

From this package:

```bash
npm run dev
npm run build
npm run tauri -- dev
```

## Package Shape

- `src/components`: workbench panels, inspectors, editors, dialogs, and layout surfaces.
- `src/services`: project loading, saves, validation, export, search, references, Git, plugins, and runtime bridges.
- `src/store`: editor, project, script, settings, workbench, and engine bridge state.
- `src-tauri`: desktop shell configuration, capabilities, and native entry points.
- `visual-smoke`: Playwright coverage for loaded-project and no-project editor flows.

## Boundaries

- The editor shell has desktop filesystem/opener capabilities through Tauri; browser-only behavior stays explicitly limited.
- Packaged desktop game export should use a dedicated player shell, not the editor shell.
- Plugin loading remains explicit and local-first; remote marketplace discovery is still deferred.
- Keep editor docs short. Prefer tests, pure model helpers, readiness reports, and package scripts as the durable explanation of behavior.
