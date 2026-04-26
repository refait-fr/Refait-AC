#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tauri_plugin_opener::OpenerExt;

mod engine;
mod storage;

const UI_STARTUP_DELAY_MS: u64 = 700;
const UPDATE_ENDPOINT: &str = "https://api.github.com/repos/refait-fr/Refait-AC/releases/latest";

#[derive(Debug, Serialize)]
struct UpdateInfo {
    version: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct ResizeArgs {
    width: f64,
    height: f64,
}

#[tauri::command]
fn resize_window(window: tauri::Window, args: ResizeArgs) -> Result<(), String> {
    window
        .set_size(tauri::LogicalSize::new(args.width, args.height))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "URL invalide".to_string())?;
    match parsed.scheme() {
        "http" | "https" => app
            .opener()
            .open_url(parsed.as_str(), None::<&str>)
            .map_err(|error| error.to_string()),
        _ => Err("Seules les URL http:// et https:// sont autorisées".to_string()),
    }
}

#[tauri::command]
fn check_updates() -> Result<Option<UpdateInfo>, String> {
    let response = ureq::get(UPDATE_ENDPOINT)
        .set("User-Agent", "Refait-AC-Tauri")
        .timeout(std::time::Duration::from_secs(3))
        .call();

    let Ok(response) = response else {
        return Ok(None);
    };

    let payload: serde_json::Value = response.into_json().map_err(|error| error.to_string())?;
    let latest_version = payload
        .get("tag_name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    let html_url = payload
        .get("html_url")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("https://github.com/refait-fr/Refait-AC/releases");

    if latest_version.is_empty() || latest_version == env!("CARGO_PKG_VERSION") {
        return Ok(None);
    }

    let parsed_url = url::Url::parse(html_url).map_err(|_| "URL de release invalide".to_string())?;
    if !matches!(parsed_url.scheme(), "http" | "https") {
        return Ok(None);
    }

    Ok(Some(UpdateInfo {
        version: latest_version.to_string(),
        url: parsed_url.to_string(),
    }))
}

#[tauri::command]
fn manual_toggle(
    app: tauri::AppHandle,
    engine: State<'_, engine::EngineState>,
) -> Result<bool, String> {
    engine.toggle(app, UI_STARTUP_DELAY_MS)
}

#[tauri::command]
fn is_running(engine: State<'_, engine::EngineState>) -> Result<bool, String> {
    engine.is_running()
}

#[tauri::command]
fn sync_settings(
    app: tauri::AppHandle,
    settings_json: String,
    engine: State<'_, engine::EngineState>,
) -> Result<(), String> {
    let settings: storage::AutomationSettings =
        serde_json::from_str(&settings_json).map_err(|error| error.to_string())?;
    engine.sync_settings(settings.clone())?;
    if let Err(error) = engine::hotkeys::update_toggle_hotkey(&app, &settings.hotkey) {
        eprintln!("{error}");
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    engine::hotkeys::handle_shortcut(app, shortcut, event.state());
                })
                .build(),
        )
        .manage(engine::EngineState::default())
        .manage(engine::hotkeys::HotkeyState::default())
        .setup(|app| {
            if let Err(error) = engine::hotkeys::register_panic_hotkey(app.handle()) {
                eprintln!("{error}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                let engine = window.app_handle().state::<engine::EngineState>();
                if let Err(error) = engine.stop() {
                    eprintln!("Failed to stop engine during window close: {error}");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            resize_window,
            open_url,
            check_updates,
            manual_toggle,
            is_running,
            sync_settings,
            storage::load_settings,
            storage::save_settings,
            storage::load_profiles,
            storage::save_profiles,
            storage::get_app_data_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Refait AC Tauri shell");
}
