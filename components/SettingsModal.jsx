'use client';
import { useState, useEffect } from 'react';

export default function SettingsModal({ onClose, onSave, currentSettings }) {
  const [startTime, setStartTime] = useState(currentSettings?.startTime || '09:50');
  const [endTime, setEndTime] = useState(currentSettings?.endTime || '19:00');
  const [wakeDuration, setWakeDuration] = useState(currentSettings?.wakeDuration || 1);

  // Update State
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');

  const checkUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatusMsg('');
    try {
      const res = await fetch('/api/system/update');
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
      }
    } catch (err) {
      console.warn('Could not check updates:', err);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    checkUpdates();
  }, []);

  const handleTriggerUpdate = async () => {
    setIsUpdating(true);
    setUpdateStatusMsg('Startar uppdatering och bygger om appen...');
    try {
      const res = await fetch('/api/system/update', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setUpdateStatusMsg(data.message || 'Uppdatering pågår. Sidan laddas om om 15 sekunder...');
        // Poll and reload
        setTimeout(() => {
          window.location.reload();
        }, 15000);
      } else {
        setUpdateStatusMsg(`Fel vid uppdatering: ${data.error || 'Okänt fel'}`);
        setIsUpdating(false);
      }
    } catch (err) {
      setUpdateStatusMsg('Kunde inte trigga uppdatering: ' + err.message);
      setIsUpdating(false);
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
                <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Vaknar (Tid)</label>
                <input 
                  type="time" 
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-lg"
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Somnar (Tid)</label>
                <input 
                  type="time" 
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-lg"
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
              {updateInfo?.currentCommit && (
                <span className="text-xs font-mono text-white/50 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                  Version: {updateInfo.currentCommit}
                </span>
              )}
            </h3>

            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Status:</span>
                <span className="font-medium text-white">
                  {isCheckingUpdate ? (
                    <span className="text-blue-400 animate-pulse">Söker efter uppdateringar...</span>
                  ) : updateInfo?.hasUpdate ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      Ny version tillgänglig! ({updateInfo.latestCommit})
                    </span>
                  ) : (
                    <span className="text-white/60">Senaste versionen är installerad</span>
                  )}
                </span>
              </div>

              {updateInfo?.commitMessage && updateInfo.hasUpdate && (
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-xs text-white/70 truncate">
                  <span className="text-white/40 block text-[10px] uppercase font-bold mb-0.5">Senaste ändring:</span>
                  {updateInfo.commitMessage}
                </div>
              )}

              {updateStatusMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium border ${
                  isUpdating ? 'bg-blue-500/10 border-blue-500/20 text-blue-300 animate-pulse' : 'bg-white/5 border-white/10 text-white/80'
                }`}>
                  {updateStatusMsg}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={checkUpdates}
                  disabled={isCheckingUpdate || isUpdating}
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
                  disabled={isUpdating}
                  className={`flex-1 py-3 px-4 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-md ${
                    updateInfo?.hasUpdate
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-blue-600/40 hover:bg-blue-600/60 border border-blue-500/30'
                  }`}
                >
                  <svg className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  {isUpdating ? 'Uppdaterar...' : (updateInfo?.hasUpdate ? 'Uppdatera nu' : 'Tvinga uppdatering')}
                </button>
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
