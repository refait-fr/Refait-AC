use crate::storage::AutomationSettings;

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub mode: EngineMode,
    pub mouse_button: MouseButton,
    pub keyboard_key: Option<VirtualKey>,
    pub cps: f64,
    pub limit: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineMode {
    MouseClick,
    KeyboardTap,
    MouseHold,
    KeyboardHold,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VirtualKey(pub u16);

impl EngineConfig {
    pub fn from_settings(settings: &AutomationSettings) -> Result<Self, String> {
        let mode = match settings.mode.as_str() {
            "keyboard" => EngineMode::KeyboardTap,
            "hold" if settings.hold_type == "keyboard" => EngineMode::KeyboardHold,
            "hold" => EngineMode::MouseHold,
            _ => EngineMode::MouseClick,
        };

        let keyboard_key = match mode {
            EngineMode::KeyboardTap | EngineMode::KeyboardHold => {
                Some(parse_virtual_key(&settings.keyboard_key).ok_or_else(|| {
                    format!("Unsupported keyboard key: {}", settings.keyboard_key)
                })?)
            }
            _ => None,
        };

        Ok(Self {
            mode,
            mouse_button: match settings.mouse_button.as_str() {
                "right" => MouseButton::Right,
                "middle" => MouseButton::Middle,
                _ => MouseButton::Left,
            },
            keyboard_key,
            cps: settings.target_cps.max(0.1),
            limit: settings.limit,
        })
    }
}

fn parse_virtual_key(key: &str) -> Option<VirtualKey> {
    let normalized = key.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "space" => Some(VirtualKey(0x20)),
        "enter" => Some(VirtualKey(0x0D)),
        "tab" => Some(VirtualKey(0x09)),
        "esc" | "escape" => Some(VirtualKey(0x1B)),
        "backspace" => Some(VirtualKey(0x08)),
        "shift" => Some(VirtualKey(0x10)),
        "ctrl" | "control" => Some(VirtualKey(0x11)),
        "alt" => Some(VirtualKey(0x12)),
        _ => parse_function_key(&normalized).or_else(|| parse_ascii_key(&normalized)),
    }
}

fn parse_function_key(key: &str) -> Option<VirtualKey> {
    let number = key.strip_prefix('f')?.parse::<u16>().ok()?;
    if (1..=24).contains(&number) {
        Some(VirtualKey(0x70 + number - 1))
    } else {
        None
    }
}

fn parse_ascii_key(key: &str) -> Option<VirtualKey> {
    let mut chars = key.chars();
    let char = chars.next()?;
    if chars.next().is_some() {
        return None;
    }

    if char.is_ascii_alphanumeric() {
        Some(VirtualKey(char.to_ascii_uppercase() as u16))
    } else {
        None
    }
}
