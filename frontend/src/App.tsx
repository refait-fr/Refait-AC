import { useState, useEffect, useMemo } from 'react';
import {
   installBackendBridge,
   loadProfiles as loadStoredProfiles,
   loadSettings as loadStoredSettings,
   saveProfiles as persistProfiles,
   saveSettings as persistSettings,
   type BackendApi
} from './backend';
import './index.css';

type Tab = 'simple' | 'advanced' | 'system' | 'infos';
type AutomationMode = 'click' | 'keyboard' | 'hold';
type MouseButton = 'left' | 'middle' | 'right';
type HoldType = 'mouse' | 'keyboard';

interface Settings {
   mode: AutomationMode;
   mouseButton: MouseButton;
   keyboardKey: string;
   holdType: HoldType;
   targetCps: number;
   limit: number;
   hotkey: string;
}

type Profile = Settings;

interface UpdateInfo {
   version: string;
   url: string;
}

declare global {
   interface Window {
      backendApi?: BackendApi;
      onEngineStarted?: () => void;
      onEngineStopped?: () => void;
      onUpdateAvailable?: (version: string, url: string) => void;
   }
}

const DEFAULT_SETTINGS: Settings = {
   mode: 'click',
   mouseButton: 'left',
   keyboardKey: 'e',
   holdType: 'mouse',
   targetCps: 100,
   limit: 0,
   hotkey: 'f6'
};

const PROFILE_COUNT = 4;
const STABLE_WINDOW_WIDTH = 580;
const STABLE_WINDOW_HEIGHT = 480;
const MIN_CPS = 1;
const MAX_CPS = 10000;
const PANIC_HOTKEY = 'ctrl+alt+f12';

const createDefaultSettings = (): Settings => ({ ...DEFAULT_SETTINGS });

const isAutomationMode = (value: unknown): value is AutomationMode => (
   value === 'click' || value === 'keyboard' || value === 'hold'
);

const isMouseButton = (value: unknown): value is MouseButton => (
   value === 'left' || value === 'middle' || value === 'right'
);

const isHoldType = (value: unknown): value is HoldType => (
   value === 'mouse' || value === 'keyboard'
);

const parseNumberValue = (value: unknown, fallback: number): number => {
   const parsed = typeof value === 'number' ? value : Number(value);
   return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const clampNumber = (value: number, min: number, max: number): number => {
   return Math.min(max, Math.max(min, value));
};

const parseCpsValue = (value: unknown, fallback: number): number => {
   return clampNumber(parseNumberValue(value, fallback), MIN_CPS, MAX_CPS);
};

const parseLimitValue = (value: unknown, fallback: number): number => {
   return Math.max(1, Math.floor(parseNumberValue(value, fallback)));
};

const readString = (value: unknown, fallback: string): string => {
   return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

const normalizeHotkey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '');

const isSupportedKeyName = (value: string): boolean => {
   const normalized = value.trim().toLowerCase();
   if (/^[a-z0-9]$/.test(normalized)) return true;
   if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalized)) return true;
   return ['space', 'enter', 'tab', 'esc', 'escape', 'backspace', 'shift', 'ctrl', 'control', 'alt'].includes(normalized);
};

const isSupportedHotkey = (value: string): boolean => {
   const normalized = normalizeHotkey(value);
   if (!normalized) return false;

   const parts = normalized.split('+').filter(Boolean);
   const keyParts = parts.filter(part => !['ctrl', 'control', 'shift', 'alt', 'meta', 'super', 'win', 'windows'].includes(part));
   return keyParts.length === 1 && isSupportedKeyName(keyParts[0]);
};

const getHotkeyError = (hotkey: string): string | null => {
   const normalized = normalizeHotkey(hotkey);
   if (!normalized) return 'Raccourci requis.';
   if (normalized === PANIC_HOTKEY) return 'Le panic stop est réservé.';
   if (!isSupportedHotkey(hotkey)) return 'Raccourci invalide.';
   return null;
};

const normalizeSettings = (value: unknown): Settings => {
   const raw = typeof value === 'object' && value !== null
      ? value as Partial<Record<keyof Settings, unknown>>
      : {};

   return {
      mode: isAutomationMode(raw.mode) ? raw.mode : DEFAULT_SETTINGS.mode,
      mouseButton: isMouseButton(raw.mouseButton) ? raw.mouseButton : DEFAULT_SETTINGS.mouseButton,
      keyboardKey: readString(raw.keyboardKey, DEFAULT_SETTINGS.keyboardKey),
      holdType: isHoldType(raw.holdType) ? raw.holdType : DEFAULT_SETTINGS.holdType,
      targetCps: parseCpsValue(raw.targetCps, DEFAULT_SETTINGS.targetCps),
      limit: parseNumberValue(raw.limit, DEFAULT_SETTINGS.limit),
      hotkey: readString(raw.hotkey, DEFAULT_SETTINGS.hotkey)
   };
};

function UpdateBanner({
   updateInfo,
   onDownload,
   onDismiss
}: {
   updateInfo: UpdateInfo;
   onDownload: (url: string) => void;
   onDismiss: () => void;
}) {
   return (
      <div className="update-banner">
         <span>Update {updateInfo.version}</span>
         <button type="button" onClick={() => onDownload(updateInfo.url)} className="update-btn">Voir la release</button>
         <button type="button" aria-label="Fermer la bannière de mise à jour" onClick={onDismiss} className="icon-btn">x</button>
      </div>
   );
}

export default function App() {
   const [tab, setTab] = useState<Tab>('simple');
   const [running, setRunning] = useState(false);
   const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

   const loadProfiles = (): Profile[] => {
      try {
         const saved = localStorage.getItem('refait_profiles');
         if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
               return Array.from({ length: PROFILE_COUNT }, (_, index) => normalizeSettings(parsed[index]));
            }
         }
      } catch {
         return Array.from({ length: PROFILE_COUNT }, createDefaultSettings);
      }
      return Array.from({ length: PROFILE_COUNT }, createDefaultSettings);
   };

   const [profiles, setProfiles] = useState<Profile[]>(loadProfiles());
   const [activeProfileIdx, setActiveProfileIdx] = useState(() => {
      const savedIndex = Number(localStorage.getItem('refait_active_idx'));
      return Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < PROFILE_COUNT ? savedIndex : 0;
   });
   const [saveNotifier, setSaveNotifier] = useState(false);

   const settings = profiles[activeProfileIdx] ?? createDefaultSettings();
   const [useLimit, setUseLimit] = useState(settings.limit > 0);
   const [storageReady, setStorageReady] = useState(false);

   const hotkeyLabel = settings.hotkey.trim().toUpperCase() || 'F6';
   const panicHotkeyLabel = 'Ctrl+Alt+F12';
   const isHoldMode = settings.mode === 'hold';
   const isHighCps = settings.mode !== 'hold' && settings.targetCps >= 200;
   const isKeyboardTargetActive = settings.mode === 'keyboard' || (settings.mode === 'hold' && settings.holdType === 'keyboard');
   const isMouseTargetActive = settings.mode === 'click' || (settings.mode === 'hold' && settings.holdType === 'mouse');
   const isAdvancedOnlySimpleMode = settings.mode === 'keyboard' || (settings.mode === 'hold' && settings.holdType === 'keyboard');
   const effectiveUseLimit = settings.mode !== 'hold' && useLimit;
   const hotkeyError = getHotkeyError(settings.hotkey);
   const keyboardKeyError = isKeyboardTargetActive && !isSupportedKeyName(settings.keyboardKey)
      ? 'Touche non supportée.'
      : null;
   const configError = hotkeyError ?? keyboardKeyError;
   const controlsDisabled = running;
   const simpleControlsDisabled = controlsDisabled || isAdvancedOnlySimpleMode;
   const currentSettingsForEngine = useMemo<Settings>(() => ({
      ...settings,
      targetCps: parseCpsValue(settings.targetCps, DEFAULT_SETTINGS.targetCps),
      limit: effectiveUseLimit ? parseLimitValue(settings.limit, 1) : 0
   }), [effectiveUseLimit, settings]);

   useEffect(() => {
      if (window.backendApi) {
         window.backendApi.resize_window(STABLE_WINDOW_WIDTH, STABLE_WINDOW_HEIGHT);
      }
   }, []);

   useEffect(() => {
      let cancelled = false;
      let channelInitialized = false;

      const initChannel = () => {
         if (channelInitialized) return;
         if (window.backendApi) {
            channelInitialized = true;
            window.backendApi.is_running((res: boolean) => setRunning(res));
            window.onEngineStarted = () => setRunning(true);
            window.onEngineStopped = () => setRunning(false);
            window.onUpdateAvailable = (version, url) => setUpdateInfo({ version, url });
            window.backendApi.resize_window(STABLE_WINDOW_WIDTH, STABLE_WINDOW_HEIGHT);
            window.backendApi.check_updates();
         }
      };

      const hydrateStoredState = async () => {
         await installBackendBridge();
         const [storedProfiles, storedSettings] = await Promise.all([
            loadStoredProfiles(),
            loadStoredSettings()
         ]);

         if (cancelled) return;

         const normalizedProfiles = Array.from({ length: PROFILE_COUNT }, (_, index) => (
            normalizeSettings(storedProfiles[index])
         ));
         const nextActiveProfileIdx = Number.isInteger(storedSettings.activeProfileIdx)
            && storedSettings.activeProfileIdx >= 0
            && storedSettings.activeProfileIdx < PROFILE_COUNT
            ? storedSettings.activeProfileIdx
            : 0;

         normalizedProfiles[nextActiveProfileIdx] = normalizeSettings(
            storedSettings.currentSettings ?? normalizedProfiles[nextActiveProfileIdx]
         );

         setProfiles(normalizedProfiles);
         setActiveProfileIdx(nextActiveProfileIdx);
         setUseLimit(normalizedProfiles[nextActiveProfileIdx].mode !== 'hold' && storedSettings.useLimit);
         setStorageReady(true);
         initChannel();
      };

      window.addEventListener('backendApiReady', initChannel);
      void hydrateStoredState();

      return () => {
         cancelled = true;
         window.removeEventListener('backendApiReady', initChannel);
      };
   }, []);

   useEffect(() => {
      if (!storageReady) return;

      const timeout = setTimeout(() => {
         if (configError) return;

         if (window.backendApi) {
            window.backendApi.sync_settings(JSON.stringify(currentSettingsForEngine));
         }
         void persistSettings({
            activeProfileIdx,
            useLimit: effectiveUseLimit,
            currentSettings: currentSettingsForEngine
         });
      }, 200);
      return () => clearTimeout(timeout);
   }, [activeProfileIdx, configError, currentSettingsForEngine, effectiveUseLimit, storageReady]);

   const saveProfile = () => {
      if (controlsDisabled) return;
      const normalizedProfiles = [...profiles];
         normalizedProfiles[activeProfileIdx] = currentSettingsForEngine;
      setProfiles(normalizedProfiles);
      void persistProfiles(normalizedProfiles);
      void persistSettings({
         activeProfileIdx,
         useLimit: effectiveUseLimit,
         currentSettings: currentSettingsForEngine
      });
      setSaveNotifier(true);
      setTimeout(() => setSaveNotifier(false), 1600);
   };

   const updateSettings = (nextSettings: Partial<Settings>) => {
      if (controlsDisabled) return;
      const newProfiles = [...profiles];
      newProfiles[activeProfileIdx] = { ...newProfiles[activeProfileIdx], ...nextSettings };
      setProfiles(newProfiles);
   };

   const updateSetting = <K extends keyof Settings>(settingKey: K, nextValue: Settings[K]) => {
      updateSettings({ [settingKey]: nextValue } as Pick<Settings, K>);
   };

   const updateMode = (mode: AutomationMode, holdType?: HoldType) => {
      if (controlsDisabled) return;
      if (mode === 'hold') {
         setUseLimit(false);
      }
      updateSettings(holdType ? { mode, holdType } : { mode });
   };

   const adjustCps = (delta: number) => {
      updateSetting('targetCps', clampNumber(settings.targetCps + delta, MIN_CPS, MAX_CPS));
   };

   const handleToggle = () => {
      if (!running && configError) return;
      window.backendApi?.manual_toggle();
   };

   const openUrl = (url: string) => {
      window.backendApi?.open_url(url);
   };

   const switchProfile = (index: number) => {
      if (controlsDisabled) return;
      if (index < 0 || index >= PROFILE_COUNT) return;
      setActiveProfileIdx(index);
      setUseLimit(profiles[index].mode !== 'hold' && profiles[index].limit > 0);
   };

   return (
      <div className="app">
         {updateInfo && (
            <UpdateBanner
               updateInfo={updateInfo}
               onDownload={openUrl}
               onDismiss={() => setUpdateInfo(null)}
            />
         )}

         <header className="header">
            <div className="title-block">
               <h1>Refait AC</h1>
               <span>Profil {activeProfileIdx + 1}</span>
            </div>
            <div className="header-meta" aria-label="État et raccourcis">
               <span className="key-pill">{hotkeyLabel}</span>
               <span className="key-pill danger">{panicHotkeyLabel}</span>
               <span className={`status ${running ? 'running' : ''}`} aria-live="polite">
                  {running ? 'Actif' : 'Inactif'}
               </span>
            </div>
         </header>

         <nav className="tabs" aria-label="Sections de Refait AC">
            <button type="button" aria-current={tab === 'simple' ? 'page' : undefined} className={tab === 'simple' ? 'active' : ''} onClick={() => setTab('simple')}>Simple</button>
            <button type="button" aria-current={tab === 'advanced' ? 'page' : undefined} className={tab === 'advanced' ? 'active' : ''} onClick={() => setTab('advanced')}>Avancé</button>
            <button type="button" aria-current={tab === 'system' ? 'page' : undefined} className={tab === 'system' ? 'active' : ''} onClick={() => setTab('system')}>Système</button>
            <button type="button" aria-current={tab === 'infos' ? 'page' : undefined} className={tab === 'infos' ? 'active' : ''} onClick={() => setTab('infos')}>Infos</button>
         </nav>

         <main className="panel">
            {tab === 'simple' && (
               <section className="page simple-page" id="simple-panel">
                  {isAdvancedOnlySimpleMode && (
                     <p className="simple-mode-banner" role="status">Mode avancé actif — modifier dans Avancé</p>
                  )}

                  <div className="simple-grid">
                     <div className="control-group">
                        <label htmlFor="simple-target-cps">CPS</label>
                        <div className="stepper">
                           <button type="button" aria-label="Réduire le CPS" disabled={simpleControlsDisabled || settings.mode === 'hold'} onClick={() => adjustCps(-1)}>-</button>
                           <input
                              id="simple-target-cps"
                              type="number"
                              min={MIN_CPS}
                              value={settings.targetCps}
                              disabled={simpleControlsDisabled || settings.mode === 'hold'}
                              onChange={e => updateSetting('targetCps', parseCpsValue(e.target.value, settings.targetCps))}
                           />
                           <button type="button" aria-label="Augmenter le CPS" disabled={simpleControlsDisabled || settings.mode === 'hold'} onClick={() => adjustCps(1)}>+</button>
                        </div>
                     </div>

                     <div className="control-group">
                        <span id="simple-mouse-button-label">Bouton</span>
                        {isMouseTargetActive ? (
                           <div className="segmented" role="group" aria-labelledby="simple-mouse-button-label">
                              <button type="button" disabled={controlsDisabled} aria-label="Utiliser le clic gauche" aria-pressed={settings.mouseButton === 'left'} className={settings.mouseButton === 'left' ? 'active' : ''} onClick={() => updateSetting('mouseButton', 'left')}>L</button>
                              <button type="button" disabled={controlsDisabled} aria-label="Utiliser le clic milieu" aria-pressed={settings.mouseButton === 'middle'} className={settings.mouseButton === 'middle' ? 'active' : ''} onClick={() => updateSetting('mouseButton', 'middle')}>M</button>
                              <button type="button" disabled={controlsDisabled} aria-label="Utiliser le clic droit" aria-pressed={settings.mouseButton === 'right'} className={settings.mouseButton === 'right' ? 'active' : ''} onClick={() => updateSetting('mouseButton', 'right')}>R</button>
                           </div>
                        ) : (
                           <span className="static-pill advanced-state">Voir Avancé</span>
                        )}
                     </div>

                     <div className="control-group">
                        <label htmlFor="simple-hotkey">Raccourci</label>
                        <input
                           id="simple-hotkey"
                           className="short-input pill-input"
                           type="text"
                           value={settings.hotkey}
                           disabled={controlsDisabled}
                           onChange={e => updateSetting('hotkey', e.target.value)}
                           onBlur={() => {
                              if (!settings.hotkey.trim()) updateSetting('hotkey', DEFAULT_SETTINGS.hotkey);
                           }}
                        />
                     </div>

                     <div className="control-group">
                        <span id="simple-mode-label">Mode</span>
                        <div className="segmented" role="group" aria-labelledby="simple-mode-label">
                           <button type="button" disabled={simpleControlsDisabled} aria-label="Mode clic répété" aria-pressed={settings.mode === 'click'} className={settings.mode === 'click' ? 'active' : ''} onClick={() => updateMode('click')}>Spam</button>
                           <button type="button" disabled={simpleControlsDisabled} aria-label="Mode maintien souris" aria-pressed={settings.mode === 'hold' && settings.holdType === 'mouse'} className={settings.mode === 'hold' && settings.holdType === 'mouse' ? 'active' : ''} onClick={() => updateMode('hold', 'mouse')}>Hold</button>
                        </div>
                     </div>
                  </div>

                  {(controlsDisabled || hotkeyError) && (
                     <div className="simple-messages">
                        {controlsDisabled && <p className="field-note" role="status">Arrêtez le moteur pour modifier les réglages.</p>}
                        {hotkeyError && <p className="field-error" role="alert">{hotkeyError}</p>}
                     </div>
                  )}

                  {(isHighCps || isHoldMode) && (
                     <p className={`notice ${isHoldMode ? 'danger' : ''}`} role="status">
                        {isHoldMode ? `Hold actif. Gardez ${panicHotkeyLabel} prêt.` : 'CPS élevé. Testez progressivement.'}
                     </p>
                  )}

                  <button type="button" className={`start-btn ${running ? 'running' : ''}`} disabled={!running && Boolean(configError)} onClick={handleToggle}>
                     {running ? 'ARRÊTER' : 'DÉMARRER'}
                  </button>
                  <span className="panic-line">Panic stop : {panicHotkeyLabel}</span>
               </section>
            )}

            {tab === 'advanced' && (
               <section className="page scroll-page" id="advanced-panel">
                  {controlsDisabled && (
                     <p className="field-note" role="status">Arrêtez le moteur pour modifier les réglages.</p>
                  )}

                  <div className="adv-section">
                     <div className="section-head">
                        <span id="advanced-action-label">Action</span>
                        <small>Choisir ce qui est envoyé</small>
                     </div>
                     <div className="segmented wide" role="group" aria-labelledby="advanced-action-label">
                        <button type="button" disabled={controlsDisabled} aria-pressed={settings.mode === 'click'} className={settings.mode === 'click' ? 'active' : ''} onClick={() => updateMode('click')}>Souris</button>
                        <button type="button" disabled={controlsDisabled} aria-pressed={settings.mode === 'keyboard'} className={settings.mode === 'keyboard' ? 'active' : ''} onClick={() => updateMode('keyboard')}>Clavier</button>
                        <button type="button" disabled={controlsDisabled} aria-pressed={settings.mode === 'hold'} className={settings.mode === 'hold' ? 'active' : ''} onClick={() => updateMode('hold')}>Hold</button>
                     </div>
                  </div>

                  <div className="adv-section">
                     <div className="section-head">
                        <span>Cible</span>
                        <small>{settings.mode === 'hold' ? 'Élément maintenu' : 'Élément déclenché'}</small>
                     </div>

                     {settings.mode === 'hold' && (
                        <div className="setting-row">
                           <span id="advanced-hold-type-label">Maintenir</span>
                           <div className="segmented" role="group" aria-labelledby="advanced-hold-type-label">
                              <button type="button" disabled={controlsDisabled} aria-pressed={settings.holdType === 'mouse'} className={settings.holdType === 'mouse' ? 'active' : ''} onClick={() => updateSetting('holdType', 'mouse')}>Souris</button>
                              <button type="button" disabled={controlsDisabled} aria-pressed={settings.holdType === 'keyboard'} className={settings.holdType === 'keyboard' ? 'active' : ''} onClick={() => updateSetting('holdType', 'keyboard')}>Clavier</button>
                           </div>
                        </div>
                     )}

                     {isMouseTargetActive && (
                        <div className="setting-row">
                           <span id="advanced-mouse-button-label">Bouton souris</span>
                           <div className="segmented" role="group" aria-labelledby="advanced-mouse-button-label">
                              <button type="button" disabled={controlsDisabled} aria-label="Utiliser le clic gauche" aria-pressed={settings.mouseButton === 'left'} className={settings.mouseButton === 'left' ? 'active' : ''} onClick={() => updateSetting('mouseButton', 'left')}>L</button>
                              <button type="button" disabled={controlsDisabled} aria-label="Utiliser le clic milieu" aria-pressed={settings.mouseButton === 'middle'} className={settings.mouseButton === 'middle' ? 'active' : ''} onClick={() => updateSetting('mouseButton', 'middle')}>M</button>
                              <button type="button" disabled={controlsDisabled} aria-label="Utiliser le clic droit" aria-pressed={settings.mouseButton === 'right'} className={settings.mouseButton === 'right' ? 'active' : ''} onClick={() => updateSetting('mouseButton', 'right')}>R</button>
                           </div>
                        </div>
                     )}

                     {isKeyboardTargetActive && (
                        <div className="setting-row">
                           <label htmlFor="advanced-keyboard-key">Touche</label>
                           <input
                              id="advanced-keyboard-key"
                              className="short-input"
                              type="text"
                              placeholder="e, f6, space"
                              value={settings.keyboardKey}
                              disabled={controlsDisabled}
                              onChange={e => updateSetting('keyboardKey', e.target.value)}
                           />
                        </div>
                     )}
                  </div>

                  {keyboardKeyError && <p className="field-error" role="alert">{keyboardKeyError}</p>}

                  <div className="adv-section">
                     <div className="section-head">
                        <label htmlFor="advanced-target-cps">Vitesse</label>
                        <small>{settings.mode === 'hold' ? 'Non utilisée en Hold' : 'Clics par seconde'}</small>
                     </div>
                     <div className="setting-row compact">
                        <span>CPS</span>
                        <div className="stepper">
                           <button type="button" aria-label="Réduire le CPS" disabled={controlsDisabled || settings.mode === 'hold'} onClick={() => adjustCps(-1)}>-</button>
                           <input
                              id="advanced-target-cps"
                              type="number"
                              min={MIN_CPS}
                              value={settings.targetCps}
                              disabled={controlsDisabled || settings.mode === 'hold'}
                              aria-describedby={settings.mode === 'hold' ? 'advanced-cps-hold-note' : undefined}
                              onChange={e => updateSetting('targetCps', parseCpsValue(e.target.value, settings.targetCps))}
                           />
                           <button type="button" aria-label="Augmenter le CPS" disabled={controlsDisabled || settings.mode === 'hold'} onClick={() => adjustCps(1)}>+</button>
                        </div>
                        {settings.mode === 'hold' && <span id="advanced-cps-hold-note" className="inline-note">Non utilisé</span>}
                     </div>
                  </div>

                  <div className="adv-section">
                     <div className="section-head">
                        <span>Limite</span>
                        <small>{settings.mode === 'hold' ? 'Désactivée en Hold' : 'Arrêt automatique'}</small>
                     </div>
                     {settings.mode !== 'hold' ? (
                        <div className="setting-row compact">
                           <label className="check-row">
                              <input type="checkbox" disabled={controlsDisabled} checked={useLimit} onChange={e => setUseLimit(e.target.checked)} />
                              Activer
                           </label>
                           {useLimit && (
                              <input
                                 className="number-input"
                                 aria-label="Nombre limite d'actions"
                                 type="number"
                                 min={1}
                                 value={Math.max(1, settings.limit || 1)}
                                 disabled={controlsDisabled}
                                 onChange={e => updateSetting('limit', parseLimitValue(e.target.value, settings.limit || 1))}
                              />
                           )}
                        </div>
                     ) : (
                        <p className="field-note">Le hold reste actif jusqu'au stop ou panic stop.</p>
                     )}
                  </div>

                  <div className="adv-section">
                     <div className="setting-row read-only compact">
                        <span>Sécurité</span>
                        <strong>{panicHotkeyLabel}</strong>
                     </div>
                  </div>

                  {(isHighCps || isHoldMode) && (
                     <p className={`notice ${isHoldMode ? 'danger' : ''}`}>
                        {isHoldMode ? 'Le hold se relâche au stop ou panic stop.' : 'CPS élevé : vérifier le stop avant usage long.'}
                     </p>
                  )}
               </section>
            )}

            {tab === 'system' && (
               <section className="page system-page" id="system-panel">
                  {controlsDisabled && (
                     <p className="field-note" role="status">Arrêtez le moteur pour changer de profil ou modifier le raccourci.</p>
                  )}

                  <div className="settings-row">
                     <span id="profiles-label">Profils</span>
                     <div className="segmented profiles" role="group" aria-labelledby="profiles-label">
                        {[0, 1, 2, 3].map(i => (
                           <button
                              key={i}
                              type="button"
                              aria-label={`Charger le profil ${i + 1}`}
                              aria-pressed={activeProfileIdx === i}
                              className={activeProfileIdx === i ? 'active' : ''}
                              disabled={controlsDisabled}
                              onClick={() => switchProfile(i)}
                           >
                              P{i + 1}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="settings-row">
                     <span>Slot actif</span>
                     <button type="button" className="secondary-btn" disabled={controlsDisabled} onClick={saveProfile}>
                        {saveNotifier ? `P${activeProfileIdx + 1} sauvegardé` : `Sauvegarder P${activeProfileIdx + 1}`}
                     </button>
                  </div>

                  <div className="settings-row">
                     <label htmlFor="system-hotkey">Start / stop</label>
                     <input
                        id="system-hotkey"
                        className="short-input"
                        type="text"
                        value={settings.hotkey}
                        disabled={controlsDisabled}
                        onChange={e => updateSetting('hotkey', e.target.value)}
                        onBlur={() => {
                           if (!settings.hotkey.trim()) updateSetting('hotkey', DEFAULT_SETTINGS.hotkey);
                        }}
                     />
                  </div>

                  {hotkeyError && <p className="field-error" role="alert">{hotkeyError}</p>}

                  <div className="settings-row read-only">
                     <span>Panic stop</span>
                     <strong>{panicHotkeyLabel}</strong>
                  </div>
               </section>
            )}

            {tab === 'infos' && (
               <section className="page infos-page" id="infos-panel">
                  <div className="info-lines">
                     <p><span>Version</span><strong>0.1.0 beta</strong></p>
                     <p><span>Stack</span><strong>Tauri + React + Rust</strong></p>
                     <p><span>Statut</span><strong>Beta privée non signée</strong></p>
                  </div>

                  <div className="social-row">
                     <button type="button" onClick={() => openUrl('https://www.youtube.com/@refait-fr')}>YouTube</button>
                     <button type="button" onClick={() => openUrl('https://github.com/refait-fr')}>GitHub</button>
                     <button type="button" disabled aria-label="Discord bientôt disponible">Discord bientôt</button>
                  </div>
                  <p className="info-note">Panic stop toujours disponible : {panicHotkeyLabel}</p>
               </section>
            )}
         </main>
      </div>
   );
}
