'use client';
import { useState } from 'react';
import { formatFullDateRange, formatEventTimeBadge } from '@/lib/statusUtils';

export default function TaskSidebar({ 
  tasks = [], 
  unscheduledFunctions = [],
  onTaskClick, 
  onCreateTask,
  onFunctionClick,
  onToggleTaskComplete
}) {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed' | 'unscheduled'

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  const currentList = activeTab === 'active' ? activeTasks : completedTasks;

  const sortedTasks = [...currentList].sort((a, b) => {
    if (activeTab === 'completed') {
      const aTime = a.completedAt ? new Date(a.completedAt) : 0;
      const bTime = b.completedAt ? new Date(b.completedAt) : 0;
      return bTime - aTime;
    }

    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    const aDate = new Date(a.deadline);
    const bDate = new Date(b.deadline);
    const now = new Date();
    const aOverdue = aDate < now;
    const bOverdue = bDate < now;
    
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return aDate - bDate;
  });

  return (
    <div className="w-full h-full flex flex-col bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white tracking-wide">Uppgifter & Oplanerat</h2>
          <div className="bg-white/10 px-2.5 py-0.5 rounded-full text-sm text-white font-medium">
            {activeTasks.length + unscheduledFunctions.length}
          </div>
        </div>
        <button 
          onClick={onCreateTask}
          title="Skapa ny uppgift"
          className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-full text-white font-bold text-xl leading-none active:scale-95 transition-all shadow-md"
        >
          +
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-1.5 border-b border-white/10 bg-black/20 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>Aktiva</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === 'active' ? 'bg-black/25 text-white' : 'bg-white/10 text-white/70'
          }`}>
            {activeTasks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('unscheduled')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'unscheduled'
              ? 'bg-amber-600 text-white shadow-md'
              : unscheduledFunctions.length > 0 
                ? 'text-amber-300 hover:text-white hover:bg-amber-500/10' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>⚠️ Ej tidsatta</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === 'unscheduled' 
              ? 'bg-black/25 text-white' 
              : unscheduledFunctions.length > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/70'
          }`}>
            {unscheduledFunctions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>Klara</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === 'completed' ? 'bg-black/25 text-white' : 'bg-white/10 text-white/70'
          }`}>
            {completedTasks.length}
          </span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {activeTab === 'unscheduled' ? (
          unscheduledFunctions.length === 0 ? (
            <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 text-white/40">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl mb-3">
                ✓
              </div>
              <p className="font-semibold text-white/80">Alla funktioner är tidsatta</p>
              <p className="text-xs text-white/40 mt-1">Inga funktioner saknar planeringstider i veckans projekt.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-amber-200 text-xs flex items-start gap-2.5">
                <span className="text-base shrink-0">⚠️</span>
                <div className="leading-relaxed">
                  <span className="font-bold text-amber-100">Kräver tidsättning i Rentman:</span> Dessa funktioner har lagts till med en varaktighet inom ett tidsintervall, men saknar fasta timmar på tidslinjen. De kan inte tilldelas på personal förrän de schemaläggs i Rentman.
                </div>
              </div>

              {unscheduledFunctions.map(func => (
                <div
                  key={func.id}
                  onClick={() => onFunctionClick && onFunctionClick(func)}
                  className="bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] transition-all border border-amber-500/30 border-l-[4px] border-l-amber-500 rounded-xl p-3 cursor-pointer shadow-sm flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-white font-bold text-sm truncate" title={func.name}>
                        {func.name}
                      </div>
                      {func.projectName && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {func.projectColor && (
                            <div 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: func.projectColor.startsWith('#') ? func.projectColor : `#${func.projectColor}` }} 
                            />
                          )}
                          <span className="text-white/70 text-xs truncate max-w-[200px]" title={func.projectName}>
                            {func.projectName}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                      {func.durationHours ? `⏱️ ${func.durationHours}h duration` : 'Obestämd tid'}
                    </span>
                  </div>

                  {func.intervalStart && func.intervalEnd && (
                    <div className="text-[11px] text-amber-200/90 bg-black/25 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                      <span>📅</span>
                      <span className="font-medium truncate">
                        Fönster: {formatFullDateRange(func.intervalStart, func.intervalEnd)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-white/50">
                    <span>Behov: {func.amount || 1} pers</span>
                    <span className="text-amber-400 font-medium text-[10px] flex items-center gap-1">
                      <span>⚠️ Ej tidsatt</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : sortedTasks.length === 0 ? (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 text-white/40">
            {activeTab === 'active' ? (
              <>
                <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">Inga aktiva uppgifter</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 mb-2 opacity-50 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm">Inga avslutade uppgifter denna vecka</p>
              </>
            )}
          </div>
        ) : (
          sortedTasks.map(task => {
            const deadline = task.deadline ? new Date(task.deadline) : null;
            const isOverdue = deadline && deadline < new Date() && !task.isCompleted;
            const dateStr = deadline ? deadline.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : null;
            
            let priorityColor = 'bg-transparent';
            if (task.priority === 'high') priorityColor = 'bg-red-500';
            else if (task.priority === 'medium') priorityColor = 'bg-amber-500';

            const initials = task.assignedCrew?.map(c => {
              const parts = (c.name || '').split(' ');
              if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length-1][0]}`.toUpperCase();
              if (parts.length === 1 && parts[0]) return parts[0].substring(0, 2).toUpperCase();
              return '?';
            }).join(', ');

            return (
              <div 
                key={task.id} 
                onClick={() => onTaskClick(task)}
                className={`transition-all cursor-pointer rounded-xl p-3 border flex flex-col gap-2 ${
                  task.isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/20 hover:bg-emerald-950/30'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/5 active:scale-[0.98]'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTaskComplete && onToggleTaskComplete(task);
                      }}
                      title={task.isCompleted ? "Markera som ej klar" : "Markera som klar"}
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        task.isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40'
                          : 'border border-white/30 hover:border-emerald-400 hover:bg-emerald-500/10 text-transparent hover:text-emerald-400'
                      }`}
                    >
                      <span className="text-xs font-bold leading-none">✓</span>
                    </button>
                    <span className={`font-medium text-sm leading-tight truncate ${
                      task.isCompleted ? 'text-white/60 line-through' : 'text-white'
                    }`}>
                      {task.name}
                    </span>
                  </div>
                  {!task.isCompleted && task.priority !== 'no_priority' && (
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${priorityColor}`}></div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] mt-1">
                  <span className={`${isOverdue ? 'text-red-400 font-medium' : 'text-white/50'}`}>
                    {task.isCompleted ? (
                      <span className="text-emerald-400/80 font-medium">Klar</span>
                    ) : (
                      dateStr ? `Förfaller: ${dateStr}` : 'Inget förfallodatum'
                    )}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[9px] ${
                    task.isCompleted
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/10 text-white/70'
                  }`}>
                    {task.isCompleted ? 'Klar' : (task.status || 'Att göra')}
                  </span>
                </div>
                
                {((task.projectName && task.projectName !== 'Unknown Project') || initials) && (
                  <div className="flex justify-between items-center text-[11px] mt-1 pt-2 border-t border-white/5">
                    <span className="text-white/40 truncate max-w-[150px]">
                      {task.projectName !== 'Unknown Project' ? task.projectName : ''}
                    </span>
                    {initials && (
                      <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold tracking-widest text-[9px]">
                        [{initials}]
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
