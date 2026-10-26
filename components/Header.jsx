'use client';
import { useState, useEffect } from 'react';

export default function Header({ 
  currentView = 'office',
  onViewChange,
  warehouseAlertCount = 0,
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
    <header className="flex items-center justify-between px-6 py-2.5 bg-white/[0.03] backdrop-blur-md border-b border-white/10 rounded-b-2xl shadow-lg relative overflow-hidden shrink-0">
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      {/* Left side: View-specific actions */}
      <div className="flex items-center justify-start gap-2.5 min-w-0">
        {currentView === 'office' ? (
          <>
            <button
              onClick={onCreateMeeting}
              className="bg-orange-600/80 hover:bg-orange-500 text-white font-bold py-1.5 px-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 border border-orange-400/30 text-xs shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Boka Möte
            </button>

            {/* Rentman Sync Checklist Button */}
            <button
              onClick={onOpenSyncModal}
              className={`py-1.5 px-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold border shrink-0 ${
                pendingSyncCount > 0
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
              }`}
              title="Se lista över tilldelningar att föra in i Rentman"
            >
              <span className="text-xs">📋</span>
              <span>Rentman-synk</span>
              {pendingSyncCount > 0 ? (
                <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded-full font-black text-[10px]">
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
                className={`py-1.5 px-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold border shrink-0 ${
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

            {/* Week navigation */}
            <div className="flex items-center space-x-1.5 bg-white/[0.02] p-1 rounded-xl border border-white/5 shrink-0">
              <button 
                onClick={() => onWeekChange(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white shadow-sm"
                aria-label="Föregående vecka"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-xs font-medium text-white px-1.5">
                V.{weekNum}
              </span>
              <button 
                onClick={() => onWeekChange(1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white shadow-sm"
                aria-label="Nästa vecka"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </>
        ) : (
          /* Warehouse view left side: show sync button only if pending sync */
          pendingSyncCount > 0 ? (
            <button
              onClick={onOpenSyncModal}
              className="py-1 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition-all"
            >
              📋 {pendingSyncCount} att synka
            </button>
          ) : null
        )}
      </div>

      {/* Center Title */}
      <div className="flex items-center justify-center">
        <h1 className="text-xl font-bold text-white tracking-wide drop-shadow-md flex items-center gap-2">
          <span>Eventopias</span>
          <span className={currentView === 'warehouse' ? 'text-amber-400' : 'text-blue-400'}>
            {currentView === 'warehouse' ? 'Lagervy' : 'Superschema 2.0'}
          </span>
        </h1>
      </div>

      {/* Right side: View Switcher (to the left of clock) + Time & Date */}
      <div className="flex items-center gap-4 shrink-0">
        {onViewChange && (
          <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/10 shadow-inner">
            <button
              onClick={() => onViewChange('office')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                currentView === 'office'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Byt till Kontorsvy [Kortkommando: 1]"
            >
              <span>🏢</span>
              <span>Kontor</span>
            </button>
            <button
              onClick={() => onViewChange('warehouse')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                currentView === 'warehouse'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Byt till Lagervy [Kortkommando: 2]"
            >
              <span>📦</span>
              <span>Lager</span>
            </button>
          </div>
        )}

        <div className="flex flex-col items-end text-white text-shadow-sm min-w-[100px]">
          <div className="text-2xl font-mono font-semibold tracking-wider leading-none" suppressHydrationWarning>
            {timeStr}
          </div>
          <div className="text-xs font-medium text-white/70 capitalize mt-0.5" suppressHydrationWarning>
            {dateStr}
          </div>
        </div>
      </div>
    </header>
  );
}
