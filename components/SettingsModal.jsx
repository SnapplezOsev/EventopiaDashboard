'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function SettingsModal({ onClose, onSave, currentSettings }) {
  const [activeTab, setActiveTab] = useState('display'); // 'display' | 'sleep' | 'calendar' | 'system'

  // View & General Settings
  const [defaultView, setDefaultView] = useState(currentSettings?.defaultView || 'office');
  const [showUnscheduledInGrid, setShowUnscheduledInGrid] = useState(Boolean(currentSettings?.showUnscheduledInGrid));

  // Screensaver Settings
  const [startTime, setStartTime] = useState(currentSettings?.startTime || '07:00');
  const [endTime, setEndTime] = useState(currentSettings?.endTime || '19:00');
  const [wakeDuration, setWakeDuration] = useState(currentSettings?.wakeDuration || 2);

  // Update State
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStage, setUpdateStage] = useState('none');
  const pollTimerRef = useRef(null);

  // Google Calendar State
  const [calendarConfig, setCalendarConfig] = useState(null);
  const [calendarInputId, setCalendarInputId] = useState('');
  const [calendarLastSync, setCalendarLastSync] = useState(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarSyncMsg, setCalendarSyncMsg] = useState('');

  // Clean up poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    let consecutiveErrors = 0;
    let hasSeenRestart = false;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/system/update?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        consecutiveErrors = 0;
        setUpdateInfo(data);

        const st = data.updateStatus;
        if (st) {
          if (st.status === 'running') {
            setUpdateStage(st.stage || 'running');
            setUpdateStatusMsg(st.message || 'Uppdatering pågår...');
            setUpdateProgress(st.progress || 30);
            if (st.stage === 'restarting') {
              hasSeenRestart = true;
            }
          } else if (st.status === 'success') {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setUpdateStage('complete');
            setUpdateProgress(100);
            setUpdateStatusMsg(st.message || 'Uppdatering slutförd! Laddar om sidan...');
            setTimeout(() => {
              window.location.reload();
            }, 2500);
          } else if (st.status === 'error') {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setIsUpdating(false);
            setUpdateStage('failed');
            setUpdateProgress(0);
            setUpdateStatusMsg(`Uppdateringen misslyckades: ${st.error || st.message}`);
          }
        }

        if (hasSeenRestart && (!data.hasUpdate || data.currentCommit === data.latestCommit)) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setUpdateStage('complete');
          setUpdateProgress(100);
          setUpdateStatusMsg(`Uppdatering klar! Kör nu version ${data.currentCommit}. Laddar om...`);
          setTimeout(() => {
            window.location.reload();
          }, 2500);
        }
      } catch (err) {
        consecutiveErrors += 1;
        hasSeenRestart = true;
        setUpdateStage('restarting');
        setUpdateProgress(88);
        setUpdateStatusMsg('Dashboard-tjänsten startar om, ansluter på nytt...');

        if (consecutiveErrors > 60) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setIsUpdating(false);
          setUpdateStage('failed');
          setUpdateStatusMsg('Kunde inte återansluta efter tjänsteomstart. Kontrollera status på enheten.');
        }
      }
    }, 2000);
  }, []);

  const checkUpdates = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch('/api/system/update?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
        if (data.updateStatus?.status === 'running') {
          setIsUpdating(true);
          setUpdateStage(data.updateStatus.stage || 'running');
          setUpdateStatusMsg(data.updateStatus.message || 'Uppdatering pågår...');
          setUpdateProgress(data.updateStatus.progress || 30);
          startPolling();
        }
      }
    } catch (err) {
      console.warn('Could not check updates:', err);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [startPolling]);

  const fetchCalendarStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/sync');
      if (res.ok) {
        const data = await res.json();
        setCalendarConfig(data.config);
        setCalendarInputId(data.config.calendarId || '');
        setCalendarLastSync(data.lastSync);
      }
    } catch (e) {
      console.warn('Could not fetch calendar status:', e);
    }
  }, []);

  useEffect(() => {
    checkUpdates();
    fetchCalendarStatus();
  }, [checkUpdates, fetchCalendarStatus]);

  const handleSaveCalendarId = async () => {
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveConfig', calendarId: calendarInputId }),
      });
      const data = await res.json();
      if (data.config) {
        setCalendarConfig(data.config);
        setCalendarSyncMsg('Kalender-ID sparat!');
        setTimeout(() => setCalendarSyncMsg(''), 3000);
      }
    } catch (err) {
      setCalendarSyncMsg('Kunde inte spara Kalender-ID');
    }
  };

  const handleTriggerCalendarSync = async () => {
    setIsSyncingCalendar(true);
    setCalendarSyncMsg('Synkar schemat med Google Kalender...');
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCalendarSyncMsg(`✔ Synk klar! ${data.result.created} skapade, ${data.result.updated} uppdaterade.`);
        setCalendarLastSync(data.result);
      } else {
        setCalendarSyncMsg(`Fel vid synk: ${data.error || 'Okänt fel'}`);
      }
    } catch (err) {
      setCalendarSyncMsg(`Kunde inte kontakta servern: ${err.message}`);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleTriggerUpdate = async () => {
    setIsUpdating(true);
    setUpdateStatusMsg('Kontrollerar och påbörjar uppdatering...');
    setUpdateProgress(10);
    setUpdateStage('starting');

    try {
      const res = await fetch('/api/system/update', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsUpdating(false);
        if (data.isDocker) {
          setUpdateStage('docker_info');
          setUpdateStatusMsg(data.message || 'Dashboarden körs i Docker.');
        } else {
          setUpdateStage('failed');
          setUpdateStatusMsg(data.error || data.message || 'Kunde inte starta uppdatering.');
        }
        return;
      }

      setUpdateStatusMsg('Uppdatering påbörjad. Väntar på status...');
      startPolling();
    } catch (err) {
      setIsUpdating(false);
      setUpdateStage('failed');
      setUpdateStatusMsg('Kunde inte kontakta servern: ' + err.message);
    }
  };

  const handleSave = () => {
    onSave({
      startTime,
      endTime,
      wakeDuration: Number(wakeDuration),
      showUnscheduledInGrid,
      defaultView
    });
  };

  const tabs = [
    {
      id: 'display',
      title: 'Visning & Standardvy',
      icon: '🖥️',
      badge: defaultView === 'warehouse' ? 'Lager' : 'Kontor'
    },
    {
      id: 'sleep',
      title: 'Sovläge & Skärm',
      icon: '🌙',
      badge: `${startTime}–${endTime}`
    },
    {
      id: 'calendar',
      title: 'Google Kalender',
      icon: '📅',
      badge: calendarConfig?.isConfigured ? 'Kopplad' : 'Ej konfigurerad'
    },
    {
      id: 'system',
      title: 'System & Uppdatering',
      icon: '🔄',
      badge: updateInfo?.hasUpdate ? 'Ny version!' : 'Uppdaterad'
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-white/15 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden h-[82vh] max-h-[750px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-white/[0.04] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">
                Inställningar & Konfiguration
              </h2>
              <p className="text-white/40 text-xs">
                Anpassa standardvy, skärmsläckare och externa integrationer för denna TV
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/70 hover:text-white flex items-center justify-center text-lg transition-all"
          >
            ✕
          </button>
        </div>

        {/* Body: Left Sidebar Tabs + Right Content Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div className="w-64 border-r border-white/10 bg-black/20 p-3 space-y-1.5 shrink-0 overflow-y-auto">
            <div className="text-[10px] uppercase font-bold text-white/40 px-3 py-1 tracking-wider">
              Kategorier
            </div>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between group active:scale-98 ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20'
                      : 'hover:bg-white/5 text-white/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{tab.icon}</span>
                    <span className="text-xs truncate">{tab.title}</span>
                  </div>
                  {tab.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full truncate shrink-0 ${
                      isActive
                        ? 'bg-black/30 text-white font-semibold'
                        : tab.badge.includes('Ny') || tab.badge.includes('Lager')
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                        : 'bg-white/10 text-white/50'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-900/60">
            {/* ================= TAB 1: VISNING & STANDARDVY ================= */}
            {activeTab === 'display' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                    <span>🖥️</span>
                    <span>Standardvy för denna TV</span>
                  </h3>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Välj vilken vy som automatiskt ska laddas när denna TV/webbläsare startas eller uppdateras. Inställningen sparas lokalt på denna skärm.
                  </p>
                </div>

                {/* View Selection Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Card 1: Kontor */}
                  <div
                    onClick={() => setDefaultView('office')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      defaultView === 'office'
                        ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🏢</span>
                        {defaultView === 'office' ? (
                          <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-white/20" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">
                        Kontor (Veckoschema)
                      </h4>
                      <p className="text-white/60 text-xs leading-relaxed">
                        Klassisk vy för kontors-TV:n och mötesrummet. Visar 7-dagars veckoschema, tidsatta funktioner, bokningar, personaltilldelning och allmänna uppgifter.
                      </p>
                    </div>
                    {defaultView === 'office' && (
                      <div className="mt-4 pt-2 border-t border-blue-500/30 text-blue-300 font-bold text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        Aktiv standardvy på denna skärm
                      </div>
                    )}
                  </div>

                  {/* Card 2: Lager */}
                  <div
                    onClick={() => setDefaultView('warehouse')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      defaultView === 'warehouse'
                        ? 'bg-amber-600/20 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">📦</span>
                        {defaultView === 'warehouse' ? (
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-xs font-black">
                            ✓
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-white/20" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">
                        Lager (Packning, Returer & Testning)
                      </h4>
                      <p className="text-white/60 text-xs leading-relaxed">
                        Optimerad för TV:n på lagret. Visar order som ska packas, förväntade returer, utrustning med defekter som måste testas samt lager-bulletin.
                      </p>
                    </div>
                    {defaultView === 'warehouse' && (
                      <div className="mt-4 pt-2 border-t border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Aktiv standardvy på denna skärm
                      </div>
                    )}
                  </div>
                </div>

                {/* Schemainställningar */}
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm font-bold text-white mb-3">
                    Veckoschema inställningar
                  </h4>
                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showUnscheduledInGrid}
                        onChange={e => setShowUnscheduledInGrid(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-white/10 border-white/20 accent-blue-500 cursor-pointer"
                      />
                      <div className="text-xs flex-1">
                        <span className="font-bold text-white block text-sm">
                          Visa ej tidsatta funktioner i veckoschemat
                        </span>
                        <p className="text-white/50 leading-relaxed mt-0.5">
                          När detta är avstängt (standard) hålls schemat helt rent och visar enbart fast schemalagda funktioner. Ej tidsatta funktioner visas alltid i sidopanelens flik &quot;⚠️ Ej tidsatta&quot;.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: SOVLÄGE & SKÄRM ================= */}
            {activeTab === 'sleep' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                    <span>🌙</span>
                    <span>Skärmsläckare & Sovläge</span>
                  </h3>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Styr vilka tider skärmen automatiskt släcks för att spara energi under kvällar och helger, samt hur länge den håller sig vaken vid beröring.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10">
                    <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-2">
                      Vaknar (Tid, 24h)
                    </label>
                    <input 
                      type="text" 
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      placeholder="07:00"
                      pattern="[0-2][0-9]:[0-5][0-9]"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 font-mono text-center text-xl font-bold"
                    />
                    <p className="text-white/40 text-[11px] mt-2">
                      Skärmen tänds automatiskt vardagar kl {startTime}.
                    </p>
                  </div>

                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10">
                    <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-2">
                      Somnar (Tid, 24h)
                    </label>
                    <input 
                      type="text" 
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      placeholder="19:00"
                      pattern="[0-2][0-9]:[0-5][0-9]"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 font-mono text-center text-xl font-bold"
                    />
                    <p className="text-white/40 text-[11px] mt-2">
                      Skärmen släcks automatiskt vardagar kl {endTime}.
                    </p>
                  </div>
                </div>

                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-white">Vaken vid beröring utanför arbetstid</span>
                      <p className="text-white/50 text-xs mt-0.5">
                        Hur många minuter ska skärmen vara aktiv efter att någon rört den utanför ordinarie tider?
                      </p>
                    </div>
                    <span className="text-blue-400 font-mono text-xl font-bold bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-xl">
                      {wakeDuration} min
                    </span>
                  </div>

                  <input 
                    type="range" 
                    min="1" max="15" 
                    value={wakeDuration}
                    onChange={e => setWakeDuration(e.target.value)}
                    className="w-full accent-blue-500 h-2 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ================= TAB 3: GOOGLE KALENDER ================= */}
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                      <span>📅</span>
                      <span>Google Kalender Synk</span>
                    </h3>
                    <p className="text-white/50 text-xs leading-relaxed">
                      Synkronisera bokade möten och interna händelser automatiskt med Google Kalender.
                    </p>
                  </div>
                  {calendarConfig?.isConfigured ? (
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Kopplad
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                      Kräver konfiguration
                    </span>
                  )}
                </div>

                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 space-y-3">
                  <div>
                    <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-1.5">
                      Google Kalender-ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={calendarInputId}
                        onChange={e => setCalendarInputId(e.target.value)}
                        placeholder="t.ex. c_xxxxxxxx@group.calendar.google.com"
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500/50"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCalendarId}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all border border-white/5"
                      >
                        Spara ID
                      </button>
                    </div>
                  </div>

                  {calendarConfig?.serviceAccountEmail ? (
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-xs text-white/70">
                      <span className="text-white/40 block text-[10px] uppercase font-bold mb-0.5">Kopplat Service-konto:</span>
                      <span className="font-mono text-emerald-300 select-all block truncate">{calendarConfig.serviceAccountEmail}</span>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-200">
                      Service-konto saknas i data/google-service-account.json
                    </div>
                  )}

                  {calendarLastSync && (
                    <div className="text-white/50 text-xs flex justify-between items-center pt-2 border-t border-white/5">
                      <span>Senaste synk: {new Date(calendarLastSync.syncedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-emerald-400 font-medium">✓ {calendarLastSync.created + calendarLastSync.updated} händelser i synk</span>
                    </div>
                  )}

                  {calendarSyncMsg && (
                    <div className="p-3 rounded-xl text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      {calendarSyncMsg}
                    </div>
                  )}

                  {calendarConfig?.isConfigured && (
                    <button
                      type="button"
                      onClick={handleTriggerCalendarSync}
                      disabled={isSyncingCalendar}
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSyncingCalendar ? 'Synkar med Google Kalender...' : '🔄 Synka med Google Kalender nu'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ================= TAB 4: SYSTEM & UPPDATERING ================= */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                      <span>🔄</span>
                      <span>System & Uppdateringar</span>
                    </h3>
                    <p className="text-white/50 text-xs leading-relaxed">
                      Kontrollera senaste programversionen och uppdatera dashboarden.
                    </p>
                  </div>
                  {updateInfo?.currentCommit && (
                    <span className="text-xs font-mono text-white/70 bg-white/5 border border-white/10 px-3 py-1 rounded-xl">
                      v: {updateInfo.currentCommit}
                    </span>
                  )}
                </div>

                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Status:</span>
                    <span className="font-medium text-white">
                      {isCheckingUpdate ? (
                        <span className="text-blue-400 animate-pulse">Söker efter uppdateringar...</span>
                      ) : isUpdating ? (
                        <span className="text-blue-300 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                          Uppdatering pågår...
                        </span>
                      ) : updateInfo?.hasUpdate ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                          Ny version tillgänglig! ({updateInfo.latestCommit})
                        </span>
                      ) : (
                        <span className="text-emerald-300/80 font-medium flex items-center gap-1.5">
                          <span>✓</span>
                          <span>Senaste versionen är installerad</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Real-time Progress Bar */}
                  {isUpdating && (
                    <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-blue-300 font-semibold">
                        <span>{updateStatusMsg || 'Uppdaterar...'}</span>
                        <span className="font-mono">{updateProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, Math.min(100, updateProgress))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={checkUpdates}
                      disabled={isCheckingUpdate || isUpdating}
                      className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all border border-white/10 flex items-center justify-center gap-2"
                    >
                      {isCheckingUpdate ? 'Söker...' : 'Sök efter ny version'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerUpdate}
                      disabled={isCheckingUpdate || isUpdating}
                      className={`flex-1 py-3 px-4 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-md ${
                        updateInfo?.hasUpdate
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-blue-600/40 hover:bg-blue-600/60 text-white border border-blue-500/30'
                      }`}
                    >
                      {updateInfo?.hasUpdate ? 'Uppdatera nu' : 'Tvinga uppdatering'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/30 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium text-xs transition-all"
          >
            Avbryt
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl text-white font-bold text-xs transition-all shadow-lg flex items-center gap-1.5"
          >
            <span>✓</span>
            <span>Spara inställningar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
