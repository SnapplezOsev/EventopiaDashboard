'use client';

export default function TaskSidebar({ tasks = [], onTaskClick, onCreateTask }) {
  const sortedTasks = [...tasks].sort((a, b) => {
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
      <div className="p-4 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white tracking-wide">Uppgifter</h2>
          <div className="bg-white/10 px-2.5 py-0.5 rounded-full text-sm text-white font-medium">
            {tasks.length}
          </div>
        </div>
        <button 
          onClick={onCreateTask}
          className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-full text-white font-bold text-lg leading-none active:scale-95 transition-all"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {sortedTasks.map(task => {
          const deadline = new Date(task.deadline);
          const isOverdue = deadline < new Date();
          const dateStr = deadline.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
          
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
              className="bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] transition-all cursor-pointer rounded-xl p-3 border border-white/5 flex flex-col gap-2"
            >
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm text-white leading-tight">{task.name}</span>
                {task.priority !== 'no_priority' && (
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${priorityColor}`}></div>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className={`${isOverdue ? 'text-red-400 font-medium' : 'text-white/50'}`}>
                  {task.deadline ? `Förfaller: ${dateStr}` : 'Inget förfallodatum'}
                </span>
                <span className="bg-white/10 px-2 py-0.5 rounded-full text-white/70 font-semibold uppercase tracking-wider text-[9px]">
                  {task.status || 'Att göra'}
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
        })}
      </div>
    </div>
  );
}
