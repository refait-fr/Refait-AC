use std::mem::size_of;

use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYEVENTF_KEYUP,
    MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
    MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEINPUT,
};

use super::config::{MouseButton, VirtualKey};

pub fn mouse_click(button: MouseButton) -> Result<(), String> {
    mouse_down(button)?;
    mouse_up(button)
}

pub fn mouse_down(button: MouseButton) -> Result<(), String> {
    send_mouse(mouse_flags(button).0)
}

pub fn mouse_up(button: MouseButton) -> Result<(), String> {
    send_mouse(mouse_flags(button).1)
}

pub fn key_tap(key: VirtualKey) -> Result<(), String> {
    key_down(key)?;
    key_up(key)
}

pub fn key_down(key: VirtualKey) -> Result<(), String> {
    send_key(key, 0)
}

pub fn key_up(key: VirtualKey) -> Result<(), String> {
    send_key(key, KEYEVENTF_KEYUP)
}

fn mouse_flags(button: MouseButton) -> (u32, u32) {
    match button {
        MouseButton::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        MouseButton::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        MouseButton::Middle => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
    }
}

fn send_mouse(flags: u32) -> Result<(), String> {
    let mut input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    send_input(&mut input)
}

fn send_key(key: VirtualKey, flags: u32) -> Result<(), String> {
    let mut input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key.0,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    send_input(&mut input)
}

fn send_input(input: &mut INPUT) -> Result<(), String> {
    let sent = unsafe { SendInput(1, input, size_of::<INPUT>() as i32) };
    if sent == 1 {
        Ok(())
    } else {
        Err("SendInput returned 0".to_string())
    }
}
