'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function SettingsModal({ onClose, onSave, currentSettings }) {
  const [startTime, setStartTime] = useState(currentSettings?.startTime || '09:50');
  const [endTime, setEndTime] = useState(currentSettings?.endTime || '19:00');
  const [wakeDuration, setWakeDuration] = useState(currentSettings?.wakeDuration || 1);

  // Update State
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStage, setUpdateStage] = useState('none'); // 'none' | 'starting' | 'git_pull' | 'npm_install' | 'building' | 'restarting' | 'complete' | 'failed' | 'docker_info'
  const pollTimerRef = useRef(null);

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

        // If we witnessed the restart and now the service is back up and has no update
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

  useEffect(() => {
    checkUpdates();
  }, [checkUpdates]);

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
      wakeDuration: Number(wakeDuration)
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/95 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Systeminställningar
          </h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Skärmsläckare sektion */}
          <div>
            <h3 className="text-white/80 font-semibold mb-4 border-b border-white/10 pb-2">
              Skärmsläckare (Sovläge)
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Vaknar (Tid, 24h)</label>
                <input 
                  type="text" 
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  placeholder="07:00"
                  pattern="[0-2][0-9]:[0-5][0-9]"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 font-mono text-center text-lg"
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Somnar (Tid, 24h)</label>
                <input 
                  type="text" 
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  placeholder="19:00"
                  pattern="[0-2][0-9]:[0-5][0-9]"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 font-mono text-center text-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Vaken vid tryck (Minuter)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="1" max="15" 
                  value={wakeDuration}
                  onChange={e => setWakeDuration(e.target.value)}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-white font-mono bg-white/10 px-3 py-1 rounded-lg min-w-[3rem] text-center">
                  {wakeDuration}
                </span>
              </div>
              <p className="text-white/30 text-xs mt-2 leading-relaxed">
                När någon rör skärmen utanför ordinarie tider, hur länge ska den hålla sig vaken innan den somnar om?
              </p>
            </div>
          </div>

          {/* Uppdatering Sektion */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-white/80 font-semibold mb-4 flex items-center justify-between">
              <span>Applikationsuppdatering</span>
              <div className="flex items-center gap-2">
                {updateInfo?.isDocker && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    Docker
                  </span>
                )}
                {updateInfo?.currentCommit && updateInfo.currentCommit !== 'unknown' && (
                  <span className="text-xs font-mono text-white/50 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                    Version: {updateInfo.currentCommit}
                  </span>
                )}
              </div>
            </h3>

            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 space-y-3">
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

              {updateInfo?.commitMessage && updateInfo.hasUpdate && !isUpdating && (
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-xs text-white/70 truncate">
                  <span className="text-white/40 block text-[10px] uppercase font-bold mb-0.5">Senaste ändring:</span>
                  {updateInfo.commitMessage}
                </div>
              )}

              {/* Real-time Update Progress Bar & Steps */}
              {isUpdating ? (
                <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-blue-300 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
                      <span>
                        {updateStage === 'git_pull' && '📦 Hämtar kod från GitHub...'}
                        {updateStage === 'npm_install' && '📥 Kontrollerar och installerar npm-paket...'}
                        {updateStage === 'building' && '⚙️ Bygger om applikationen (detta tar cirka 1 min)...'}
                        {updateStage === 'restarting' && '🔄 Startar om dashboard-tjänsten...'}
                        {updateStage === 'complete' && '✅ Klar! Laddar om sidan...'}
                        {(updateStage === 'starting' || updateStage === 'running' || updateStage === 'none') && '⏳ Uppdaterar applikation...'}
                      </span>
                    </div>
                    <span className="text-blue-300 font-mono font-bold">{updateProgress}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, updateProgress))}%` }}
                    />
                  </div>

                  <p className="text-white/80 text-xs leading-relaxed font-mono">
                    {updateStatusMsg}
                  </p>

                  <p className="text-white/40 text-[11px] italic">
                    Vänligen vänta. Sidan laddas om automatiskt när uppdateringen är helt slutförd.
                  </p>
                </div>
              ) : updateStage === 'docker_info' ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <span>🐳</span>
                    <span>Lokal Docker-miljö identifierad</span>
                  </div>
                  <p className="text-white/70 leading-relaxed">
                    Automatisk systemd-uppdatering sker i kioskmiljön på Linux-NUC:en. För att uppdatera containern i denna lokala testmiljö, kör i terminalen:
                  </p>
                  <div className="bg-black/40 p-2.5 rounded-xl border border-white/10 font-mono text-emerald-300 select-all">
                    docker compose up -d --build
                  </div>
                </div>
              ) : updateStage === 'failed' ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-red-300 font-bold">
                    <span>⚠️</span>
                    <span>Uppdateringen misslyckades</span>
                  </div>
                  <p className="text-red-200/80 leading-relaxed font-mono text-[11px]">
                    {updateStatusMsg}
                  </p>
                  <button
                    onClick={() => {
                      setUpdateStage('none');
                      setUpdateStatusMsg('');
                    }}
                    className="text-white/60 hover:text-white underline text-xs pt-1 block"
                  >
                    Stäng felmeddelande
                  </button>
                </div>
              ) : (
                updateStatusMsg && (
                  <div className="p-3 rounded-xl text-xs font-medium border bg-white/5 border-white/10 text-white/80">
                    {updateStatusMsg}
                  </div>
                )
              )}

              {/* Action Buttons */}
              <div className="pt-1">
                {isUpdating ? (
                  <button
                    type="button"
                    disabled={true}
                    className="w-full py-3 px-4 bg-blue-600/30 border border-blue-500/40 text-blue-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-wait"
                  >
                    <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                    <span>Uppdatering pågår — vänta på slutförande...</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={checkUpdates}
                      disabled={isCheckingUpdate}
                      className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all border border-white/10 flex items-center justify-center gap-2"
                    >
                      <svg className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isCheckingUpdate ? 'Söker...' : 'Sök uppdatering'}
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerUpdate}
                      disabled={isCheckingUpdate}
                      className={`flex-1 py-3 px-4 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-md ${
                        updateInfo?.hasUpdate
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-blue-600/40 hover:bg-blue-600/60 text-white border border-blue-500/30'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      {updateInfo?.hasUpdate ? 'Uppdatera nu' : 'Tvinga uppdatering'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex gap-4 shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-white font-semibold transition-all"
          >
            Stäng
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold transition-all shadow-lg text-base"
          >
            Spara inställningar
          </button>
        </div>
      </div>
    </div>
  );
}
