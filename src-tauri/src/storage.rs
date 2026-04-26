use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const PROFILE_COUNT: usize = 4;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationSettings {
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_mouse_button")]
    pub mouse_button: String,
    #[serde(default = "default_keyboard_key")]
    pub keyboard_key: String,
    #[serde(default = "default_hold_type")]
    pub hold_type: String,
    #[serde(default = "default_target_cps")]
    pub target_cps: f64,
    #[serde(default)]
    pub limit: u64,
    #[serde(default = "default_hotkey")]
    pub hotkey: String,
}

impl Default for AutomationSettings {
    fn default() -> Self {
        Self {
            mode: default_mode(),
            mouse_button: default_mouse_button(),
            keyboard_key: default_keyboard_key(),
            hold_type: default_hold_type(),
            target_cps: default_target_cps(),
            limit: 0,
            hotkey: default_hotkey(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSettings {
    #[serde(default)]
    pub active_profile_idx: usize,
    #[serde(default)]
    pub use_limit: bool,
    #[serde(default)]
    pub current_settings: AutomationSettings,
}

impl Default for StoredSettings {
    fn default() -> Self {
        Self {
            active_profile_idx: 0,
            use_limit: false,
            current_settings: AutomationSettings::default(),
        }
    }
}

fn default_mode() -> String {
    "click".to_string()
}

fn default_mouse_button() -> String {
    "left".to_string()
}

fn default_keyboard_key() -> String {
    "e".to_string()
}

fn default_hold_type() -> String {
    "mouse".to_string()
}

fn default_target_cps() -> f64 {
    100.0
}

fn default_hotkey() -> String {
    "f6".to_string()
}

fn default_profiles() -> Vec<AutomationSettings> {
    (0..PROFILE_COUNT)
        .map(|_| AutomationSettings::default())
        .collect()
}

fn storage_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(storage_dir(app)?.join("settings.json"))
}

fn profiles_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(storage_dir(app)?.join("profiles.json"))
}

fn read_json_or_default<T>(path: PathBuf) -> T
where
    T: for<'de> Deserialize<'de> + Default,
{
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<T>(&content).ok())
        .unwrap_or_default()
}

fn write_json<T>(path: PathBuf, value: &T) -> Result<(), String>
where
    T: Serialize,
{
    let content = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn normalize_profiles(mut profiles: Vec<AutomationSettings>) -> Vec<AutomationSettings> {
    profiles.truncate(PROFILE_COUNT);
    while profiles.len() < PROFILE_COUNT {
        profiles.push(AutomationSettings::default());
    }
    profiles
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<StoredSettings, String> {
    let mut settings: StoredSettings = read_json_or_default(settings_path(&app)?);
    if settings.active_profile_idx >= PROFILE_COUNT {
        settings.active_profile_idx = 0;
    }
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, mut settings: StoredSettings) -> Result<(), String> {
    if settings.active_profile_idx >= PROFILE_COUNT {
        settings.active_profile_idx = 0;
    }
    write_json(settings_path(&app)?, &settings)
}

#[tauri::command]
pub fn load_profiles(app: AppHandle) -> Result<Vec<AutomationSettings>, String> {
    let profiles: Vec<AutomationSettings> = fs::read_to_string(profiles_path(&app)?)
        .ok()
        .and_then(|content| serde_json::from_str::<Vec<AutomationSettings>>(&content).ok())
        .map(normalize_profiles)
        .unwrap_or_else(default_profiles);
    Ok(profiles)
}

#[tauri::command]
pub fn save_profiles(app: AppHandle, profiles: Vec<AutomationSettings>) -> Result<(), String> {
    write_json(profiles_path(&app)?, &normalize_profiles(profiles))
}

#[tauri::command]
pub fn get_app_data_path(app: AppHandle) -> Result<String, String> {
    storage_dir(&app).map(|path| path.to_string_lossy().to_string())
}
