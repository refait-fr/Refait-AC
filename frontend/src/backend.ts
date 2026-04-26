import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface BackendApi {
   resize_window: (width: number, height: number) => void;
   is_running: (callback: (res: boolean) => void) => void;
   check_updates: () => void;
   sync_settings: (settingsJson: string) => void;
   manual_toggle: () => void;
   open_url: (url: string) => void;
}

export interface AutomationSettings {
   mode: 'click' | 'keyboard' | 'hold';
   mouseButton: 'left' | 'middle' | 'right';
   keyboardKey: string;
   holdType: 'mouse' | 'keyboard';
   targetCps: number;
   limit: number;
   hotkey: string;
}

export type Profile = AutomationSettings;

export interface StoredSettings {
   activeProfileIdx: number;
   useLimit: boolean;
   currentSettings: AutomationSettings;
}

interface UpdateInfo {
   version: string;
   url: string;
}

declare global {
   interface Window {
      __TAURI_INTERNALS__?: unknown;
      backendApi?: BackendApi;
      onEngineStarted?: () => void;
      onEngineStopped?: () => void;
      onUpdateAvailable?: (version: string, url: string) => void;
   }
}

let installPromise: Promise<void> | null = null;
let mockRunning = false;

const DEFAULT_SETTINGS: AutomationSettings = {
   mode: 'click',
   mouseButton: 'left',
   keyboardKey: 'e',
   holdType: 'mouse',
   targetCps: 100,
   limit: 0,
   hotkey: 'f6'
};

const PROFILE_COUNT = 4;

const isTauriRuntime = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

const dispatchBackendReady = () => {
   window.dispatchEvent(new CustomEvent('backendApiReady'));
};

const createBrowserMockBackend = (): BackendApi => ({
   resize_window: () => undefined,
   is_running: (callback) => callback(mockRunning),
   check_updates: () => undefined,
   sync_settings: () => undefined,
   manual_toggle: () => {
      mockRunning = !mockRunning;
      if (mockRunning) {
         window.onEngineStarted?.();
      } else {
         window.onEngineStopped?.();
      }
   },
   open_url: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
   }
});

const createDefaultProfiles = (): Profile[] => (
   Array.from({ length: PROFILE_COUNT }, () => ({ ...DEFAULT_SETTINGS }))
);

const loadLocalProfiles = (): Profile[] => {
   try {
      const saved = localStorage.getItem('refait_profiles');
      if (saved) {
         const parsed = JSON.parse(saved);
         if (Array.isArray(parsed)) {
            return Array.from({ length: PROFILE_COUNT }, (_, index) => ({
               ...DEFAULT_SETTINGS,
               ...parsed[index]
            }));
         }
      }
   } catch {
      return createDefaultProfiles();
   }
   return createDefaultProfiles();
};

const loadLocalSettings = (): StoredSettings => {
   const profiles = loadLocalProfiles();
   const savedIndex = Number(localStorage.getItem('refait_active_idx'));
   const activeProfileIdx = Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < PROFILE_COUNT
      ? savedIndex
      : 0;

   return {
      activeProfileIdx,
      useLimit: profiles[activeProfileIdx].limit > 0,
      currentSettings: profiles[activeProfileIdx]
   };
};

const saveLocalProfiles = (profiles: Profile[]) => {
   localStorage.setItem('refait_profiles', JSON.stringify(profiles));
};

const saveLocalSettings = (settings: StoredSettings) => {
   localStorage.setItem('refait_active_idx', String(settings.activeProfileIdx));
};

const createTauriBackend = (): BackendApi => ({
   resize_window: (width, height) => {
      void invoke('resize_window', { args: { width, height } });
   },
   is_running: (callback) => {
      void invoke<boolean>('is_running')
         .then(callback)
         .catch(() => callback(false));
   },
   check_updates: () => {
      void invoke<UpdateInfo | null>('check_updates')
         .then((updateInfo) => {
            if (updateInfo) {
               window.onUpdateAvailable?.(updateInfo.version, updateInfo.url);
            }
         })
         .catch((error) => console.warn('Update check failed:', error));
   },
   sync_settings: (settingsJson) => {
      void invoke('sync_settings', { settingsJson });
   },
   manual_toggle: () => {
      void invoke('manual_toggle');
   },
   open_url: (url) => {
      void invoke('open_url', { url })
         .catch((error) => console.warn('URL opening failed:', error));
   }
});

export const loadSettings = async (): Promise<StoredSettings> => {
   if (isTauriRuntime()) {
      return invoke<StoredSettings>('load_settings');
   }
   return loadLocalSettings();
};

export const saveSettings = async (settings: StoredSettings): Promise<void> => {
   if (isTauriRuntime()) {
      await invoke('save_settings', { settings });
      return;
   }
   saveLocalSettings(settings);
};

export const loadProfiles = async (): Promise<Profile[]> => {
   if (isTauriRuntime()) {
      return invoke<Profile[]>('load_profiles');
   }
   return loadLocalProfiles();
};

export const saveProfiles = async (profiles: Profile[]): Promise<void> => {
   if (isTauriRuntime()) {
      await invoke('save_profiles', { profiles });
      return;
   }
   saveLocalProfiles(profiles);
};

export const getAppDataPath = async (): Promise<string | null> => {
   if (isTauriRuntime()) {
      return invoke<string>('get_app_data_path');
   }
   return null;
};

const listenToTauriEvents = async () => {
   await Promise.all([
      listen('engine-started', () => window.onEngineStarted?.()),
      listen('engine-stopped', () => window.onEngineStopped?.()),
      listen<UpdateInfo>('update-available', (event) => {
         window.onUpdateAvailable?.(event.payload.version, event.payload.url);
      })
   ]);
};

export const installBackendBridge = async () => {
   if (installPromise) return installPromise;

   installPromise = (async () => {
      if (window.backendApi) {
         return;
      }

      if (isTauriRuntime()) {
         window.backendApi = createTauriBackend();
         await listenToTauriEvents();
         dispatchBackendReady();
         return;
      }

      // PySide6 injects its own backend asynchronously through QWebChannel.
      // If Qt is present, keep waiting for the existing Python bridge instead of installing mocks.
      if ('qt' in window) {
         return;
      }

      window.backendApi = createBrowserMockBackend();
      dispatchBackendReady();
   })();

   return installPromise;
};
