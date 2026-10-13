'use client';
import { useState, useEffect } from 'react';

export default function Header({ 
  weekStart, 
  onWeekChange, 
  onCreateMeeting,
  pendingSyncCount = 0,
  onOpenSyncModal,
  showUnscheduledInGrid = false,
  onToggleUnscheduledInGrid,
  unscheduledCount = 0
}) {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  };

  const weekNum = weekStart ? getWeekNumber(weekStart) : getWeekNumber(new Date());

  const dateStr = time.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = time.toLocaleTimeString('sv-SE', { hour12: false });

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white/[0.03] backdrop-blur-md border-b border-white/10 rounded-b-2xl shadow-lg relative overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      <div className="w-5/12 flex items-center justify-start gap-2.5">
        <button
          onClick={onCreateMeeting}
          className="bg-orange-600/80 hover:bg-orange-500 text-white font-bold py-2 px-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 border border-orange-400/30 text-xs shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Boka Möte
        </button>

        {/* Rentman Sync Checklist Button */}
        <button
          onClick={onOpenSyncModal}
          className={`py-2 px-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold border shrink-0 ${
            pendingSyncCount > 0
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
          }`}
          title="Se lista över tilldelningar att föra in i Rentman"
        >
          <span className="text-sm">📋</span>
          <span>Rentman-synk</span>
          {pendingSyncCount > 0 ? (
            <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded-full font-black text-[11px]">
              {pendingSyncCount}
            </span>
          ) : (
            <span className="text-emerald-400 text-xs">✓</span>
          )}
        </button>

        {/* Toggle Unscheduled in Grid Filter */}
        {onToggleUnscheduledInGrid && (
          <button
            onClick={onToggleUnscheduledInGrid}
            className={`py-2 px-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold border shrink-0 ${
              showUnscheduledInGrid
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 border-white/10'
            }`}
            title={showUnscheduledInGrid ? 'Klicka för att dölja ej tidsatta funktioner i schemat' : 'Klicka för att visa ej tidsatta funktioner med intervall i schemat'}
          >
            <span>{showUnscheduledInGrid ? '👁️' : '👁️‍🗨️'}</span>
            <span>Ej tidsatta</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              showUnscheduledInGrid 
                ? 'bg-amber-400 text-black font-black' 
                : 'bg-white/10 text-white/60'
            }`}>
              {showUnscheduledInGrid ? 'Visas' : 'Dolda'}
            </span>
            {unscheduledCount > 0 && !showUnscheduledInGrid && (
              <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/20 px-1 py-0.2 rounded-full">
                {unscheduledCount}
              </span>
            )}
          </button>
        )}

        <div className="flex items-center space-x-2 bg-white/[0.02] p-1 rounded-xl border border-white/5">
          <button 
            onClick={() => onWeekChange(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white shadow-sm"
            aria-label="Föregående vecka"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-medium text-white px-2">
            Vecka {weekNum}
          </span>
          <button 
            onClick={() => onWeekChange(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white shadow-sm"
            aria-label="Nästa vecka"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="w-1/3 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-white tracking-wide drop-shadow-md">Eventopias Superschema 2000 2.0</h1>
      </div>

      <div className="w-1/3 flex flex-col items-end text-white text-shadow-sm">
        <div className="text-2xl font-mono font-semibold tracking-wider" suppressHydrationWarning>
          {timeStr}
        </div>
        <div className="text-xs font-medium text-white/70 capitalize" suppressHydrationWarning>
          {dateStr}
        </div>
      </div>
    </header>
  );
}
