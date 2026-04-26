mod clicker;
mod config;
pub mod hotkeys;
mod win_input;

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::JoinHandle,
};

use tauri::{AppHandle, Emitter};

pub use config::EngineConfig;

use crate::storage::AutomationSettings;

#[derive(Default)]
pub struct EngineState {
    shared: Arc<EngineShared>,
}

#[derive(Default)]
struct EngineShared {
    stop_requested: AtomicBool,
    inner: Mutex<EngineInner>,
}

#[derive(Default)]
struct EngineInner {
    running: bool,
    settings: AutomationSettings,
    worker: Option<JoinHandle<()>>,
}

impl EngineState {
    pub fn sync_settings(&self, settings: AutomationSettings) -> Result<(), String> {
        let mut inner = self.shared.inner.lock().map_err(|error| error.to_string())?;
        inner.settings = settings;
        Ok(())
    }

    pub fn toggle(&self, app: AppHandle, startup_delay_ms: u64) -> Result<bool, String> {
        if self.is_running()? {
            self.stop()?;
            Ok(false)
        } else {
            self.start(app, startup_delay_ms)?;
            Ok(true)
        }
    }

    pub fn start(&self, app: AppHandle, startup_delay_ms: u64) -> Result<(), String> {
        let mut inner = self.shared.inner.lock().map_err(|error| error.to_string())?;
        cleanup_finished_worker(&mut inner);

        if inner.running {
            return Ok(());
        }

        let config = EngineConfig::from_settings(&inner.settings)?;
        self.shared.stop_requested.store(false, Ordering::SeqCst);

        let shared = Arc::clone(&self.shared);
        let worker_app = app.clone();
        inner.running = true;
        inner.worker = Some(std::thread::spawn(move || {
            if let Err(error) = clicker::run(config, &shared.stop_requested, startup_delay_ms) {
                eprintln!("Engine stopped after input error: {error}");
            }
            mark_stopped(&shared);
            let _ = worker_app.emit("engine-stopped", ());
        }));

        drop(inner);
        app.emit("engine-started", ())
            .map_err(|error| error.to_string())?;

        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.stop_blocking()
    }

    pub fn is_running(&self) -> Result<bool, String> {
        let inner = self.shared.inner.lock().map_err(|error| error.to_string())?;
        Ok(inner.running)
    }

    fn stop_blocking(&self) -> Result<(), String> {
        self.shared.stop_requested.store(true, Ordering::SeqCst);

        let worker = {
            let mut inner = self.shared.inner.lock().map_err(|error| error.to_string())?;
            inner.running = false;
            inner.worker.take()
        };

        if let Some(worker) = worker {
            worker
                .join()
                .map_err(|_| "Engine thread panicked during stop".to_string())?;
        }

        Ok(())
    }
}

impl Drop for EngineState {
    fn drop(&mut self) {
        let _ = self.stop_blocking();
    }
}

fn cleanup_finished_worker(inner: &mut EngineInner) {
    if inner.worker.as_ref().is_some_and(|worker| worker.is_finished()) {
        if let Some(worker) = inner.worker.take() {
            let _ = worker.join();
        }
        inner.running = false;
    }
}

fn mark_stopped(shared: &EngineShared) {
    if let Ok(mut inner) = shared.inner.lock() {
        inner.running = false;
    }
}
