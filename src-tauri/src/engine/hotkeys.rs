use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

use super::EngineState;

const PANIC_HOTKEY_LABEL: &str = "ctrl+alt+f12";

#[derive(Default)]
pub struct HotkeyState {
    toggle_shortcut: Mutex<Option<Shortcut>>,
}

pub fn handle_shortcut(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }

    let engine = app.state::<EngineState>();
    if is_panic_shortcut(shortcut) {
        if let Err(error) = engine.stop() {
            eprintln!("Panic stop failed: {error}");
        }
        return;
    }

    if let Err(error) = engine.toggle(app.clone(), 0) {
        eprintln!("Toggle hotkey failed: {error}");
    }
}

pub fn register_panic_hotkey(app: &AppHandle) -> Result<(), String> {
    let panic_shortcut = parse_shortcut(PANIC_HOTKEY_LABEL)?;
    app.global_shortcut()
        .register(panic_shortcut)
        .map_err(|error| format!("Failed to register panic hotkey: {error}"))
}

pub fn update_toggle_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let shortcut = parse_shortcut(hotkey)?;
    if is_panic_shortcut(&shortcut) {
        return Err("Toggle hotkey cannot use the panic hotkey".to_string());
    }

    let state = app.state::<HotkeyState>();
    let mut registered = state
        .toggle_shortcut
        .lock()
        .map_err(|error| error.to_string())?;

    if registered.as_ref() == Some(&shortcut) {
        return Ok(());
    }

    if let Some(previous) = registered.take() {
        if let Err(error) = app.global_shortcut().unregister(previous) {
            eprintln!("Failed to unregister previous toggle hotkey: {error}");
        }
    }

    app.global_shortcut()
        .register(shortcut)
        .map_err(|error| format!("Failed to register toggle hotkey '{hotkey}': {error}"))?;
    *registered = Some(shortcut);

    Ok(())
}

fn is_panic_shortcut(shortcut: &Shortcut) -> bool {
    parse_shortcut(PANIC_HOTKEY_LABEL)
        .map(|panic_shortcut| &panic_shortcut == shortcut)
        .unwrap_or(false)
}

fn parse_shortcut(raw: &str) -> Result<Shortcut, String> {
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err("Hotkey cannot be empty".to_string());
    }

    let mut modifiers = Modifiers::empty();
    let mut code = None;

    for part in normalized.split('+').map(str::trim).filter(|part| !part.is_empty()) {
        match part {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "shift" => modifiers |= Modifiers::SHIFT,
            "alt" => modifiers |= Modifiers::ALT,
            "meta" | "super" | "win" | "windows" => modifiers |= Modifiers::SUPER,
            key => {
                if code.is_some() {
                    return Err(format!("Hotkey has multiple keys: {raw}"));
                }
                code = Some(parse_code(key).ok_or_else(|| format!("Unsupported hotkey: {raw}"))?);
            }
        }
    }

    let code = code.ok_or_else(|| format!("Hotkey has no key: {raw}"))?;
    let modifiers = if modifiers.is_empty() {
        None
    } else {
        Some(modifiers)
    };

    Ok(Shortcut::new(modifiers, code))
}

fn parse_code(key: &str) -> Option<Code> {
    match key {
        "escape" | "esc" => Some(Code::Escape),
        "space" => Some(Code::Space),
        "enter" => Some(Code::Enter),
        "tab" => Some(Code::Tab),
        "backspace" => Some(Code::Backspace),
        "f1" => Some(Code::F1),
        "f2" => Some(Code::F2),
        "f3" => Some(Code::F3),
        "f4" => Some(Code::F4),
        "f5" => Some(Code::F5),
        "f6" => Some(Code::F6),
        "f7" => Some(Code::F7),
        "f8" => Some(Code::F8),
        "f9" => Some(Code::F9),
        "f10" => Some(Code::F10),
        "f11" => Some(Code::F11),
        "f12" => Some(Code::F12),
        "0" => Some(Code::Digit0),
        "1" => Some(Code::Digit1),
        "2" => Some(Code::Digit2),
        "3" => Some(Code::Digit3),
        "4" => Some(Code::Digit4),
        "5" => Some(Code::Digit5),
        "6" => Some(Code::Digit6),
        "7" => Some(Code::Digit7),
        "8" => Some(Code::Digit8),
        "9" => Some(Code::Digit9),
        "a" => Some(Code::KeyA),
        "b" => Some(Code::KeyB),
        "c" => Some(Code::KeyC),
        "d" => Some(Code::KeyD),
        "e" => Some(Code::KeyE),
        "f" => Some(Code::KeyF),
        "g" => Some(Code::KeyG),
        "h" => Some(Code::KeyH),
        "i" => Some(Code::KeyI),
        "j" => Some(Code::KeyJ),
        "k" => Some(Code::KeyK),
        "l" => Some(Code::KeyL),
        "m" => Some(Code::KeyM),
        "n" => Some(Code::KeyN),
        "o" => Some(Code::KeyO),
        "p" => Some(Code::KeyP),
        "q" => Some(Code::KeyQ),
        "r" => Some(Code::KeyR),
        "s" => Some(Code::KeyS),
        "t" => Some(Code::KeyT),
        "u" => Some(Code::KeyU),
        "v" => Some(Code::KeyV),
        "w" => Some(Code::KeyW),
        "x" => Some(Code::KeyX),
        "y" => Some(Code::KeyY),
        "z" => Some(Code::KeyZ),
        _ => None,
    }
}
