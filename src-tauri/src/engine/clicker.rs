use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

use super::{
    config::{EngineConfig, EngineMode},
    win_input,
};

pub fn run(
    config: EngineConfig,
    stop_requested: &AtomicBool,
    startup_delay_ms: u64,
) -> Result<(), String> {
    wait_for_startup_delay(startup_delay_ms, stop_requested);
    if stop_requested.load(Ordering::SeqCst) {
        return Ok(());
    }

    match config.mode {
        EngineMode::MouseHold => run_mouse_hold(&config, stop_requested),
        EngineMode::KeyboardHold => run_keyboard_hold(&config, stop_requested),
        EngineMode::MouseClick | EngineMode::KeyboardTap => run_repeating(config, stop_requested),
    }
}

fn wait_for_startup_delay(startup_delay_ms: u64, stop_requested: &AtomicBool) {
    if startup_delay_ms == 0 {
        return;
    }

    let deadline = Instant::now() + Duration::from_millis(startup_delay_ms);
    wait_until(deadline, stop_requested);
}

fn run_mouse_hold(config: &EngineConfig, stop_requested: &AtomicBool) -> Result<(), String> {
    win_input::mouse_down(config.mouse_button)?;
    let guard = MouseReleaseGuard::new(config.mouse_button);
    wait_until_stopped(stop_requested);
    drop(guard);
    Ok(())
}

fn run_keyboard_hold(config: &EngineConfig, stop_requested: &AtomicBool) -> Result<(), String> {
    let key = config
        .keyboard_key
        .ok_or_else(|| "Keyboard hold requires a keyboard key".to_string())?;
    win_input::key_down(key)?;
    let guard = KeyReleaseGuard::new(key);
    wait_until_stopped(stop_requested);
    drop(guard);
    Ok(())
}

fn run_repeating(config: EngineConfig, stop_requested: &AtomicBool) -> Result<(), String> {
    let interval = Duration::from_secs_f64(1.0 / config.cps);
    let mut next_tick = Instant::now() + interval;
    let mut actions_done = 0_u64;

    while !stop_requested.load(Ordering::SeqCst) {
        match config.mode {
            EngineMode::MouseClick => win_input::mouse_click(config.mouse_button)?,
            EngineMode::KeyboardTap => {
                let key = config
                    .keyboard_key
                    .ok_or_else(|| "Keyboard tap requires a keyboard key".to_string())?;
                win_input::key_tap(key)?;
            }
            EngineMode::MouseHold | EngineMode::KeyboardHold => unreachable!(),
        }

        actions_done += 1;
        if config.limit > 0 && actions_done >= config.limit {
            break;
        }

        wait_until(next_tick, stop_requested);
        next_tick += interval;
    }

    Ok(())
}

fn wait_until_stopped(stop_requested: &AtomicBool) {
    while !stop_requested.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_until(deadline: Instant, stop_requested: &AtomicBool) {
    while !stop_requested.load(Ordering::SeqCst) {
        let now = Instant::now();
        if now >= deadline {
            break;
        }

        let remaining = deadline - now;
        if remaining > Duration::from_millis(2) {
            thread::sleep(Duration::from_millis(1));
        } else {
            thread::yield_now();
        }
    }
}

struct MouseReleaseGuard {
    button: super::config::MouseButton,
}

impl MouseReleaseGuard {
    fn new(button: super::config::MouseButton) -> Self {
        Self { button }
    }
}

impl Drop for MouseReleaseGuard {
    fn drop(&mut self) {
        let _ = win_input::mouse_up(self.button);
    }
}

struct KeyReleaseGuard {
    key: super::config::VirtualKey,
}

impl KeyReleaseGuard {
    fn new(key: super::config::VirtualKey) -> Self {
        Self { key }
    }
}

impl Drop for KeyReleaseGuard {
    fn drop(&mut self) {
        let _ = win_input::key_up(self.key);
    }
}
