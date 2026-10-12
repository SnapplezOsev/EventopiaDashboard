'use client';
import { useEffect, useRef } from 'react';
import EventCard from '@/components/EventCard';

export default function WeekGrid({ functions = [], weekStart, onFunctionClick }) {
  const scrollContainerRef = useRef(null);
  const todayRef = useRef(null);

  const getWeekDates = () => {
    let monday;
    if (weekStart) {
      const [y, m, d] = (typeof weekStart === 'string' ? weekStart : weekStart.toISOString().slice(0, 10)).split('-').map(Number);
      monday = new Date(y, m - 1, d);
    } else {
      const now = new Date();
      const day = now.getDay() || 7;
      monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
    }
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDays = getWeekDates();
  const today = new Date();

  // Scroll to today on mount or when week changes
  useEffect(() => {
    if (todayRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: todayRef.current.offsetLeft - scrollContainerRef.current.offsetLeft,
        behavior: 'smooth'
      });
    }
  }, [weekStart]);

  return (
    <div 
      ref={scrollContainerRef}
      className="flex overflow-x-auto gap-4 h-full p-6 snap-x snap-mandatory custom-scrollbar"
    >
      {weekDays.map((day, idx) => {
        const isToday = day.toDateString() === today.toDateString();
        const dayStr = day.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'numeric' });
        const capitalizedDay = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
        
        const dayFunctions = functions.filter(f => {
          const start = new Date(f.planperiod_start);
          const end = new Date(f.planperiod_end);
          const currentDayStart = new Date(day);
          currentDayStart.setHours(0,0,0,0);
          const currentDayEnd = new Date(day);
          currentDayEnd.setHours(23,59,59,999);
          return (start <= currentDayEnd && end >= currentDayStart);
        }).sort((a, b) => new Date(a.planperiod_start) - new Date(b.planperiod_start));

        const unassignedCount = dayFunctions.filter(f => !f.assignedCrew || f.assignedCrew.length < (f.amount || 1)).length;

        return (
          <div 
            key={idx} 
            ref={isToday ? todayRef : null}
            className={`flex-none w-[340px] snap-start flex flex-col h-full bg-white/5 backdrop-blur-sm rounded-2xl border ${isToday ? 'border-blue-400/50 shadow-[0_0_15px_rgba(96,165,250,0.2)]' : 'border-white/10'} overflow-hidden`}
          >
            <div className={`p-4 border-b ${isToday ? 'border-blue-400/30 bg-blue-500/10' : 'border-white/10 bg-white/[0.02]'} flex justify-between items-center`}>
              <h2 className="text-sm font-semibold text-white tracking-wide">{capitalizedDay}</h2>
              {unassignedCount > 0 && (
                <div className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold"
                     style={{ animation: 'pulse-glow 2s infinite' }}>
                  {unassignedCount}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {dayFunctions.map(func => (
                <EventCard key={func.id} func={func} onClick={() => onFunctionClick(func)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
