import { useState, useEffect } from 'react';
import './index.css';

declare global {
  interface Window {
    backendApi?: any;
    onEngineStarted: () => void;
    onEngineStopped: () => void;
    onUpdateAvailable: (version: string, url: string) => void;
  }
}

const DEFAULT_SETTINGS = {
  mode: 'click', 
  mouseButton: 'left',
  keyboardKey: 'e',
  holdType: 'mouse',
  targetCps: 100,
  limit: 0,
  hotkey: 'f6'
};

export default function App() {
  const [tab, setTab] = useState('simple');
  const [running, setRunning] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{version: string, url: string} | null>(null);
  
  // Profiles state
  const loadProfiles = () => {
     try {
       const saved = localStorage.getItem('refait_profiles');
       if (saved) return JSON.parse(saved);
     } catch(e) {}
     return [DEFAULT_SETTINGS, DEFAULT_SETTINGS, DEFAULT_SETTINGS, DEFAULT_SETTINGS];
  };

  const [profiles, setProfiles] = useState<any[]>(loadProfiles());
  const [activeProfileIdx, setActiveProfileIdx] = useState(() => {
     return Number(localStorage.getItem('refait_active_idx')) || 0;
  });

  const settings = profiles[activeProfileIdx];

  const [useLimit, setUseLimit] = useState(settings.limit > 0);

  // Dynamic window resizing based on tab
  useEffect(() => {
     if(window.backendApi) {
        if (tab === 'simple') {
            window.backendApi.resize_window(550, 310 + (updateInfo ? 40 : 0));
        } else if (tab === 'advanced') {
            window.backendApi.resize_window(600, 600 + (updateInfo ? 40 : 0));
        } else {
            // Infos tab
            window.backendApi.resize_window(500, 300 + (updateInfo ? 40 : 0));
        }
     }
  }, [tab, updateInfo]);

  useEffect(() => {
    const initChannel = () => {
      if (window.backendApi) {
          window.backendApi.is_running((res: boolean) => setRunning(res));
          window.onEngineStarted = () => setRunning(true);
          window.onEngineStopped = () => setRunning(false);
          window.onUpdateAvailable = (version, url) => setUpdateInfo({version, url});
          
          window.backendApi.resize_window(550, 310);
          
          // Trigger update check on startup
          window.backendApi.check_updates();
      }
    };
    
    if (window.backendApi) {
       initChannel();
    } else {
       window.addEventListener('backendApiReady', initChannel);
    }
    
    return () => window.removeEventListener('backendApiReady', initChannel);
  }, []);

  const [saveNotifier, setSaveNotifier] = useState(false);

  useEffect(() => {
    // Sync backend without saving to disk
    let timeout = setTimeout(() => {
        if(window.backendApi) {
            window.backendApi.sync_settings(JSON.stringify({
               ...settings,
               limit: useLimit ? settings.limit : 0
            }));
        }
    }, 200);
    return () => clearTimeout(timeout);
  }, [settings, useLimit]);

  const saveProfile = () => {
    localStorage.setItem('refait_profiles', JSON.stringify(profiles));
    localStorage.setItem('refait_active_idx', String(activeProfileIdx));
    setSaveNotifier(true);
    setTimeout(() => setSaveNotifier(false), 2000);
  };

  const updateSetting = (key: string, value: any) => {
    const newProfiles = [...profiles];
    newProfiles[activeProfileIdx] = { ...newProfiles[activeProfileIdx], [key]: value };
    setProfiles(newProfiles);
  };

  const handleToggle = () => {
     if(window.backendApi) {
         window.backendApi.manual_toggle();
     }
  };

  const openUrl = (url: string) => {
      if (window.backendApi) {
          window.backendApi.open_url(url);
      }
  };

  const switchProfile = (index: number) => {
      setActiveProfileIdx(index);
      setUseLimit(profiles[index].limit > 0);
  };

  return (
    <div className="app">
      {updateInfo && (
        <div className="update-banner">
           <span>🚀 Une mise à jour est disponible ({updateInfo.version})</span>
           <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
               <button onClick={() => openUrl(updateInfo.url)} className="update-btn">Télécharger</button>
               <button onClick={() => setUpdateInfo(null)} style={{background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px'}}>✕</button>
           </div>
        </div>
      )}

      <div className="header">
         <h1 style={{color: 'var(--text-primary)'}}>Refait AC</h1>
         <div style={{
           color: running ? 'var(--accent-red)' : 'var(--text-muted)',
           fontWeight: 'bold',
           fontSize: '14px',
           transition: 'color 0.3s'
         }}>
           {running ? 'ACTIF 🔴' : 'DÉSACTIVÉ'}
         </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'simple' ? 'active' : ''}`} onClick={() => setTab('simple')}>Simple</button>
        <button className={`tab ${tab === 'advanced' ? 'active' : ''}`} onClick={() => setTab('advanced')}>Avancé</button>
        <button className={`tab ${tab === 'infos' ? 'active' : ''}`} onClick={() => setTab('infos')}>Infos</button>
      </div>

      <div className="panel slide-in" key={tab}>
        {tab === 'simple' && (
           <div className="simple-panel">
             <div className="simple-row">
                <div className="simple-group">
                   <span className="simple-label">Vitesse</span>
                   <div className="simple-input-box">
                      <input 
                         type="number" className="simple-number" 
                         value={settings.targetCps} 
                         onChange={e => updateSetting('targetCps', e.target.value)} 
                      />
                      <span className="simple-unit">cps</span>
                   </div>
                </div>

                <div className="simple-group">
                   <span className="simple-label">Bouton</span>
                   <div className="simple-seg-group">
                      <button 
                         className={`simple-seg-btn ${settings.mouseButton === 'left' ? 'active' : ''}`}
                         onClick={() => updateSetting('mouseButton', 'left')}
                      >L</button>
                      <button 
                         className={`simple-seg-btn ${settings.mouseButton === 'middle' ? 'active' : ''}`}
                         onClick={() => updateSetting('mouseButton', 'middle')}
                      >M</button>
                      <button 
                         className={`simple-seg-btn ${settings.mouseButton === 'right' ? 'active' : ''}`}
                         onClick={() => updateSetting('mouseButton', 'right')}
                      >R</button>
                   </div>
                </div>
             </div>

             <div className="simple-row">
                <div className="simple-group">
                   <span className="simple-label">Raccourci</span>
                   <div className="simple-input-box" style={{width: '90px'}}>
                      <input 
                         type="text" className="simple-hotkey-text" 
                         value={settings.hotkey} 
                         onChange={e => updateSetting('hotkey', e.target.value)}
                         style={{width: '100%', textAlign: 'center'}}
                      />
                   </div>
                </div>

                <div className="simple-group">
                   <span className="simple-label">Mode</span>
                   <div className="simple-seg-group">
                      <button 
                         className={`simple-seg-btn ${settings.mode === 'click' ? 'active' : ''}`}
                         onClick={() => updateSetting('mode', 'click')}
                      >Spam</button>
                      <button 
                         className={`simple-seg-btn ${settings.mode === 'hold' ? 'active' : ''}`}
                         onClick={() => updateSetting('mode', 'hold')}
                      >Hold</button>
                   </div>
                </div>
             </div>

             <button 
                className={`btn-primary ${running ? 'running' : ''}`}
                onClick={handleToggle}
             >
                {running ? `ARRÊTER (${settings.hotkey.toUpperCase()})` : `DÉMARRER (${settings.hotkey.toUpperCase()})`}
             </button>
           </div>
        )}

        {tab === 'advanced' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', height: '100%'}}>
            
            <div className="sectioncontainer">
               <div className="adv-card-title">Profils</div>
               <div className="adv-row">
                 <span className="adv-label">Profil actif :</span>
                 <div className="simple-seg-group">
                    {[0,1,2,3].map(i => (
                       <button 
                         key={i}
                         className={`simple-seg-btn ${activeProfileIdx === i ? 'active' : ''}`}
                         onClick={() => switchProfile(i)}
                       >
                         {i + 1}
                       </button>
                    ))}
                 </div>
                 <button className="save-btn slide-in" onClick={saveProfile}>
                    {saveNotifier ? '✅ Sauvegardé' : '💾 Sauvegarder'}
                 </button>
               </div>
            </div>

            <div className="sectioncontainer">
               <div className="adv-card-title">Cible Avancée</div>
               <div className="adv-row" style={{marginBottom: '10px'}}>
                 <span className="adv-label">Action Principale</span>
                 <select className="adv-numbox" value={settings.mode} onChange={e => updateSetting('mode', e.target.value)} style={{width: 150}}>
                    <option value="click">Clic Souris</option>
                    <option value="keyboard">Spam Clavier</option>
                    <option value="hold">Maintien (Hold)</option>
                 </select>
               </div>
               {settings.mode === 'keyboard' || (settings.mode === 'hold' && settings.holdType === 'keyboard') ? (
                  <div className="adv-row slide-in">
                    <span className="adv-label">Touche Appuyée</span>
                    <input className="adv-numbox" type="text" maxLength={1} value={settings.keyboardKey} onChange={e => updateSetting('keyboardKey', e.target.value)} style={{width: 60}} />
                    {settings.mode === 'hold' && (
                       <select className="adv-numbox slide-in" value={settings.holdType} onChange={e => updateSetting('holdType', e.target.value)} style={{width: 100, marginLeft: 10}}>
                         <option value="mouse">Souris</option>
                         <option value="keyboard">Clavier</option>
                       </select>
                    )}
                  </div>
               ) : null}
            </div>

            <div className="sectioncontainer">
               <div className="adv-card-title">Vitesse & Limites</div>
               <div className="adv-row" style={{marginBottom: '10px'}}>
                 <span className="adv-label" style={{opacity: settings.mode === 'hold' ? 0.3 : 1}}>Clics par seconde (CPS)</span>
                 <input className="adv-numbox" type="number" value={settings.targetCps} onChange={e => updateSetting('targetCps', e.target.value)} disabled={settings.mode === 'hold'} />
               </div>
               <div className="adv-row">
                 <span className="adv-label">S'arrêter automatiquement</span>
                 <label className="switch">
                   <input type="checkbox" checked={useLimit} onChange={e => setUseLimit(e.target.checked)} />
                   <span className="slider"></span>
                 </label>
                 {useLimit && (
                    <input className="adv-numbox slide-in" type="number" value={settings.limit} onChange={e => updateSetting('limit', e.target.value)} placeholder="0" />
                 )}
               </div>
            </div>

            <div className="sectioncontainer">
               <div className="adv-card-title">Système</div>
               <div className="adv-row">
                 <span className="adv-label">Raccourci Global</span>
                 <input className="adv-numbox" type="text" value={settings.hotkey} onChange={e => updateSetting('hotkey', e.target.value)} />
               </div>
            </div>

            <button 
                className={`btn-primary ${running ? 'running' : ''}`}
                style={{marginTop: 'auto'}}
                onClick={handleToggle}
             >
                {running ? `ARRÊTER (${settings.hotkey.toUpperCase()})` : `DÉMARRER (${settings.hotkey.toUpperCase()})`}
             </button>
          </div>
        )}

        {tab === 'infos' && (
           <div style={{display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', height: '100%', paddingBottom: '20px'}}>
               <button className="social-btn yt" onClick={() => openUrl('https://www.youtube.com/@refait-fr')} title="YouTube">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                 </svg>
               </button>
               <button className="social-btn gh" onClick={() => openUrl('https://github.com/refait-fr')} title="GitHub">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                 </svg>
               </button>
               <button className="social-btn dc" style={{opacity: 0.5, cursor: 'not-allowed'}} title="Discord (Bientôt)">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                 </svg>
               </button>
           </div>
        )}
      </div>

    </div>
  );
}
