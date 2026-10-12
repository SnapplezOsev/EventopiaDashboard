'use client';
import { useState, useEffect } from 'react';

export default function SettingsModal({ onClose, onSave, currentSettings }) {
  const [startTime, setStartTime] = useState(currentSettings?.startTime || '09:50');
  const [endTime, setEndTime] = useState(currentSettings?.endTime || '19:00');
  const [wakeDuration, setWakeDuration] = useState(currentSettings?.wakeDuration || 1);

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
        className="bg-slate-900/90 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 bg-white/5">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Systeminställningar
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-white/80 font-semibold mb-4 border-b border-white/10 pb-2">Skärmsläckare (Sovläge)</h3>
            
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
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-white font-semibold transition-all"
          >
            Avbryt
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold transition-all shadow-lg"
          >
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}
