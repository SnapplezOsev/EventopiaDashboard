'use client';
import { useEffect, useRef, useLayoutEffect } from 'react';
import EventCard from '@/components/EventCard';
import GroupedEventCard from '@/components/GroupedEventCard';

function organizeDayEvents(dayFunctions) {
  const groupsMap = new Map();
  const standalone = [];

  for (const f of dayFunctions) {
    // Only group functions if they have a functionGroupId and a project
    const groupKey = f.functionGroupId && f.projectName
      ? `${f.projectId || ''}_${f.functionGroupId}`
      : null;

    if (groupKey) {
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey).push(f);
    } else {
      standalone.push({
        type: 'single',
        func: f,
        sortTime: new Date(f.planperiod_start).getTime()
      });
    }
  }

  const result = [...standalone];

  for (const [key, groupFuncs] of groupsMap.entries()) {
    if (groupFuncs.length >= 2) {
      // 2 or more functions share the same function group on this day -> group together
      const earliestStart = Math.min(...groupFuncs.map(f => new Date(f.planperiod_start).getTime()));
      result.push({
        type: 'group',
        groupId: groupFuncs[0].functionGroupId,
        groupName: groupFuncs[0].functionGroupName,
        projectId: groupFuncs[0].projectId,
        projectName: groupFuncs[0].projectName,
        projectColor: groupFuncs[0].projectColor,
        customerName: groupFuncs[0].customerName,
        functions: groupFuncs.sort((a, b) => new Date(a.planperiod_start) - new Date(b.planperiod_start)),
        sortTime: earliestStart,
      });
    } else {
      // Standalone single function in this group on this day
      result.push({
        type: 'single',
        func: groupFuncs[0],
        sortTime: new Date(groupFuncs[0].planperiod_start).getTime(),
      });
    }
  }

  // Sort all cards on the day by earliest start time
  return result.sort((a, b) => a.sortTime - b.sortTime);
}

function SkeletonCard({ delay = 0 }) {
  return (
    <div 
      className="rounded-xl p-3 bg-white/[0.03] border border-white/10 animate-pulse flex flex-col gap-2.5 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top row: Time pill + Status */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 bg-white/10 rounded-md" />
        <div className="h-4 w-20 bg-white/10 rounded-md" />
      </div>

      {/* Project color bar + name */}
      <div className="flex items-center gap-2 mt-0.5">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-400/30" />
        <div className="h-3.5 w-3/5 bg-white/10 rounded-md" />
      </div>

      {/* Function name */}
      <div className="h-5 w-4/5 bg-white/15 rounded-md" />

      {/* Location / details */}
      <div className="h-3.5 w-1/2 bg-white/5 rounded-md" />

      {/* Crew section skeleton */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 mt-1">
        <div className="h-6 w-20 bg-white/10 rounded-full" />
        <div className="h-6 w-16 bg-white/5 rounded-full" />
      </div>
    </div>
  );
}

function AnimatedCardList({ children, weekStart, dayKey }) {
  const containerRef = useRef(null);
  const prevPositionsRef = useRef(new Map());
  const prevWeekRef = useRef(weekStart);
  const prevDayRef = useRef(dayKey);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset positions if week or day changed so we don't animate across different weeks/days
    if (prevWeekRef.current !== weekStart || prevDayRef.current !== dayKey) {
      prevWeekRef.current = weekStart;
      prevDayRef.current = dayKey;
      prevPositionsRef.current.clear();
    }

    const currentPositions = new Map();
    const elements = container.querySelectorAll(':scope > [data-flip-id]');

    elements.forEach((el) => {
      const id = el.getAttribute('data-flip-id');
      if (id) {
        currentPositions.set(id, el.getBoundingClientRect());
      }
    });

    const isInitialRender = prevPositionsRef.current.size === 0;

    if (!isInitialRender) {
      const animatedEls = [];

      elements.forEach((el) => {
        const id = el.getAttribute('data-flip-id');
        if (!id) return;

        const oldRect = prevPositionsRef.current.get(id);
        const newRect = currentPositions.get(id);

        if (oldRect && newRect) {
          // Existing element: calculate vertical delta
          const deltaY = oldRect.top - newRect.top;
          if (Math.abs(deltaY) > 0.5) {
            el.style.transform = `translate3d(0, ${deltaY}px, 0)`;
            el.style.transition = 'none';
            animatedEls.push({ el, type: 'move' });
          }
        } else if (!oldRect && newRect) {
          // Brand new element inserted: pop-in animation
          el.style.opacity = '0';
          el.style.transform = 'scale(0.88) translate3d(0, -10px, 0)';
          el.style.transition = 'none';
          animatedEls.push({ el, type: 'enter' });
        }
      });

      if (animatedEls.length > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            animatedEls.forEach(({ el, type }) => {
              if (type === 'move') {
                el.style.transition = 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)';
                el.style.transform = 'translate3d(0, 0, 0)';
              } else if (type === 'enter') {
                el.classList.add('new-card-highlight');
                el.style.transition = 'opacity 400ms ease-out, transform 450ms cubic-bezier(0.16, 1, 0.3, 1)';
                el.style.opacity = '1';
                el.style.transform = 'scale(1) translate3d(0, 0, 0)';
              }
            });

            setTimeout(() => {
              animatedEls.forEach(({ el, type }) => {
                el.style.transition = '';
                el.style.transform = '';
                if (type === 'enter') {
                  setTimeout(() => {
                    el.classList.remove('new-card-highlight');
                  }, 2500);
                }
              });
            }, 500);
          });
        });
      }
    }

    prevPositionsRef.current = currentPositions;
  });

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar relative">
      {children}
    </div>
  );
}

export default function WeekGrid({ functions = [], weekStart, onFunctionClick, isLoading = false }) {
  const scrollContainerRef = useRef(null);
  const todayRef = useRef(null);

  const getWeekDates = () => {
    let monday;
    if (weekStart) {
      if (typeof weekStart === 'string') {
        const [y, m, d] = weekStart.slice(0, 10).split('-').map(Number);
        monday = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else if (weekStart instanceof Date) {
        monday = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0, 0);
      } else {
        const d = new Date(weekStart);
        monday = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      }
    } else {
      const now = new Date();
      const day = now.getDay() || 7;
      monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1), 0, 0, 0, 0);
    }

    // Force monday to always be a Monday (ISO day 1: Mon=1 ... Sun=7)
    const dayOfWeek = monday.getDay() || 7;
    if (dayOfWeek !== 1) {
      monday.setDate(monday.getDate() - (dayOfWeek - 1));
    }
    monday.setHours(0, 0, 0, 0);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 0, 0, 0, 0);
      week.push(day);
    }
    return week;
  };

  const weekDays = getWeekDates();
  const today = new Date();

  // Scroll to today on mount or when week changes (scrolls to beginning if today is not in this week)
  useEffect(() => {
    if (todayRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: todayRef.current.offsetLeft - scrollContainerRef.current.offsetLeft,
        behavior: 'smooth'
      });
    } else if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: 0,
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
          if (!f.planperiod_start) return false;
          const start = new Date(f.planperiod_start);
          const end = new Date(f.planperiod_end || f.planperiod_start);
          
          if (isNaN(start.getTime()) || start.getFullYear() < 2000) return false;

          const currentDayStart = new Date(day);
          currentDayStart.setHours(0, 0, 0, 0);
          const currentDayEnd = new Date(day);
          currentDayEnd.setHours(23, 59, 59, 999);

          // Check if event starts on this calendar day in local time
          const startsToday = (
            start.getFullYear() === day.getFullYear() &&
            start.getMonth() === day.getMonth() &&
            start.getDate() === day.getDate()
          );
          if (startsToday) return true;

          // For unscheduled functions with multi-day intervals:
          // Only show on the start day in the grid (to avoid cluttering every subsequent day)
          if (f.isUnscheduled) return false;

          // If it started earlier and runs into today:
          // Only show it if it continues past 04:00 AM today (to avoid yesterday's late night shifts from cluttering today)
          if (start < currentDayStart && end > currentDayStart) {
            const endHour = end.getHours() + (end.getMinutes() / 60);
            return endHour > 4 || end > currentDayEnd;
          }

          return false;
        }).sort((a, b) => new Date(a.planperiod_start) - new Date(b.planperiod_start));

        const unassignedCount = dayFunctions.filter(f => !f.assignedCrew || f.assignedCrew.length < (f.amount || 1)).length;
        const organizedItems = organizeDayEvents(dayFunctions);

        return (
          <div 
            key={idx} 
            ref={isToday ? todayRef : null}
            className={`flex-none w-[340px] snap-start flex flex-col h-full bg-white/5 backdrop-blur-sm rounded-2xl border ${isToday ? 'border-blue-400/50 shadow-[0_0_15px_rgba(96,165,250,0.2)]' : 'border-white/10'} overflow-hidden`}
          >
            <div className={`p-4 border-b ${isToday ? 'border-blue-400/30 bg-blue-500/10' : 'border-white/10 bg-white/[0.02]'} flex justify-between items-center`}>
              <h2 className="text-sm font-semibold text-white tracking-wide">{capitalizedDay}</h2>
              {!isLoading && unassignedCount > 0 && (
                <div className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold"
                     style={{ animation: 'pulse-glow 2s infinite' }}>
                  {unassignedCount}
                </div>
              )}
            </div>
            <AnimatedCardList weekStart={weekStart} dayKey={day.toDateString()}>
              {isLoading ? (
                <>
                  <SkeletonCard delay={idx * 60} />
                  <SkeletonCard delay={idx * 60 + 100} />
                  {idx % 2 === 0 && <SkeletonCard delay={idx * 60 + 200} />}
                </>
              ) : organizedItems.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-white/20 text-xs font-mono select-none">
                  Inga bokningar
                </div>
              ) : (
                organizedItems.map((item) => {
                  const flipId = item.type === 'group'
                    ? `group-${item.projectId || 'p'}-${item.groupId}`
                    : `func-${item.func.id}`;

                  if (item.type === 'group') {
                    return (
                      <div key={flipId} data-flip-id={flipId}>
                        <GroupedEventCard
                          group={item}
                          onFunctionClick={onFunctionClick}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={flipId} data-flip-id={flipId}>
                      <EventCard
                        func={item.func}
                        onCardClick={onFunctionClick}
                        onClick={() => onFunctionClick(item.func)}
                      />
                    </div>
                  );
                })
              )}
            </AnimatedCardList>
          </div>
        );
      })}
    </div>
  );
}
