import ReactDOM from "react-dom/client";

import App from "./App";
import './services/monacoSetup';
import './styles/flexlayout-zerith.css';

async function boot(): Promise<void> {
    const { isTauriRuntime } = await import('./services/runtime/runtimeEnvironment');
    if (isTauriRuntime()) {
        const { invoke } = await import('@tauri-apps/api/core');
        const config = await invoke<import('./services/installedEditorSmoke').InstalledSmokeConfig | null>('installed_smoke_config');
        if (config) {
            const { runInstalledEditorSmoke } = await import('./services/installedEditorSmoke');
            await runInstalledEditorSmoke(config);
            return;
        }
    }
    ReactDOM.createRoot(document.querySelector("#root") as HTMLElement).render(<App />);
}

// eslint-disable-next-line unicorn/prefer-top-level-await -- Keep the WebView entry compatible with the build target.
void boot().catch((error: unknown) => console.error('Editor startup failed:', error));
