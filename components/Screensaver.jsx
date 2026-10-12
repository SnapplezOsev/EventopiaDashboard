'use client';
import { useState, useEffect } from 'react';

export default function Screensaver({ isActive, onWake, nextDayEventCount = 0 }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    let timer;
    if (isActive) {
      timer = setInterval(() => setTime(new Date()), 1000);
    }
    return () => clearInterval(timer);
  }, [isActive]);

  if (!isActive) return null;

  const timeStr = time.toLocaleTimeString('sv-SE', { hour12: false });
  const dateStr = time.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-opacity duration-1000 screensaver-bg"
      onClick={onWake}
    >
      <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
        <div className="text-[12rem] font-mono font-light text-white tracking-widest drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] leading-none" suppressHydrationWarning>
          {timeStr}
        </div>
        <div className="text-4xl font-light text-white/60 capitalize tracking-wide" suppressHydrationWarning>
          {dateStr}
        </div>
        
        <div className="mt-16 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-4 flex items-center space-x-4 shadow-2xl">
          <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-2xl text-white/80 font-medium">
            Imorgon: {nextDayEventCount} {nextDayEventCount === 1 ? 'händelse' : 'händelser'}
          </span>
        </div>
      </div>
    </div>
  );
}
