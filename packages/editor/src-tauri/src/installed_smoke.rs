use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SmokeConfig {
    parent_path: String,
    project_name: String,
    out_dir: String,
    zip_file: String,
    existing_project_path: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SmokeRequest {
    #[serde(flatten)]
    config: SmokeConfig,
    receipt_path: PathBuf,
}

#[derive(Default)]
pub(crate) struct InstalledSmokeState {
    request: Option<SmokeRequest>,
}

impl InstalledSmokeState {
    pub(crate) fn from_args() -> Result<Self, String> {
        let mut args = std::env::args_os().skip(1);
        while let Some(argument) = args.next() {
            if argument != "--smoke-project" {
                continue;
            }
            let path = args
                .next()
                .ok_or("--smoke-project needs an absolute JSON config path")?;
            if !Path::new(&path).is_absolute() {
                return Err("Smoke config path must be absolute".to_owned());
            }
            let text = std::fs::read(&path).map_err(|error| error.to_string())?;
            let request: SmokeRequest =
                serde_json::from_slice(&text).map_err(|error| error.to_string())?;
            for path in [
                &request.config.parent_path,
                &request.config.out_dir,
                &request.config.zip_file,
            ] {
                if !Path::new(path).is_absolute() {
                    return Err("Smoke paths must be absolute".to_owned());
                }
            }
            if !request.receipt_path.is_absolute() {
                return Err("Smoke receipt must be absolute".to_owned());
            }
            if request
                .config
                .existing_project_path
                .as_ref()
                .is_some_and(|path| !Path::new(path).is_absolute())
            {
                return Err("Existing smoke project path must be absolute".to_owned());
            }
            return Ok(Self {
                request: Some(request),
            });
        }
        Ok(Self::default())
    }

    pub(crate) fn enabled(&self) -> bool {
        self.request.is_some()
    }
}

#[tauri::command]
pub(crate) fn installed_smoke_config(state: State<'_, InstalledSmokeState>) -> Option<SmokeConfig> {
    state.request.as_ref().map(|request| request.config.clone())
}

#[tauri::command]
pub(crate) fn installed_smoke_complete(
    app: AppHandle,
    state: State<'_, InstalledSmokeState>,
    mut result: serde_json::Value,
) -> Result<(), String> {
    let request = state
        .request
        .as_ref()
        .ok_or("Installed smoke is inactive")?;
    let node_on_path = std::env::var_os("PATH").is_some_and(|paths| {
        std::env::split_paths(&paths).any(|directory| directory.join("node.exe").is_file())
    });
    result.as_object_mut().ok_or("Smoke result must be an object")?.insert(
        "runtime".to_owned(),
        serde_json::json!({ "nodeOnPath": node_on_path, "workingDirectory": std::env::current_dir().map_err(|error| error.to_string())? }),
    );
    let content = serde_json::to_vec_pretty(&result).map_err(|error| error.to_string())?;
    crate::native_fs::write_atomic_bytes(&request.receipt_path, &content, None, true)
        .map_err(|error| error.message)?;
    app.exit(
        if result.get("status").and_then(|status| status.as_str()) == Some("passed") {
            0
        } else {
            1
        },
    );
    Ok(())
}
