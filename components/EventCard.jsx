import { getStatusBadgeStyle } from '@/lib/statusUtils';

export default function EventCard({ func, onClick }) {
  const requiredAmount = func.amount || 1;
  const assignedCount = func.assignedCrew?.length || 0;
  const isFullyAssigned = assignedCount >= requiredAmount;
  
  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    return isNaN(d) ? '--:--' : d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const timeString = func.isUnscheduled 
    ? `⚠️ Obestämd tid ${func.durationHours ? `(${func.durationHours}h)` : ''}`
    : `${formatTime(func.planperiod_start)} – ${formatTime(func.planperiod_end)}`;
  
  // Create initials e.g. "Emil Reinfeldt" -> "ER"
  const initials = func.assignedCrew?.map(c => {
    const parts = c.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }).join(', ') || 'Ingen';

  const isInternalShift = !func.projectName && func.type === 'shift';
  const displayStatus = isInternalShift && (func.statusName === 'Koncept' || !func.statusName) 
    ? 'Skift' 
    : (func.statusName || 'Okänd');
  const projStatusClass = getStatusBadgeStyle(displayStatus);

  const cardBorderClass = func.isUnscheduled
    ? 'bg-amber-500/[0.07] hover:bg-amber-500/[0.12] border-l-[3px] border-l-amber-500 border border-amber-500/30 border-dashed'
    : `bg-white/[0.06] hover:bg-white/[0.1] border-l-[3px] ${isFullyAssigned ? 'border-l-green-500' : 'border-l-red-500'}`;

  return (
    <div 
      onClick={onClick}
      className={`relative active:scale-[0.97] transition-all rounded-xl p-2 cursor-pointer group shadow-sm flex flex-col gap-1.5 ${cardBorderClass}`}
    >
      {/* Row 1: Time and Function */}
      <div className="flex justify-between items-center w-full">
        <div className={`${func.isUnscheduled ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30 text-xs' : 'bg-white/10 text-white text-sm'} px-2 py-0.5 rounded-md font-bold tracking-wide flex items-center gap-1`}>
          {timeString}
        </div>
        <div className="font-bold text-white text-sm truncate max-w-[150px] text-right" title={func.name}>
          {func.name}
        </div>
      </div>

      {/* Row 2: Project, Function Group, and Assigned Initials */}
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-1.5 min-w-0">
          {func.projectName ? (
            <>
              {func.projectColor && (
                <div 
                  className="w-2 h-2 shrink-0 rounded-full shadow-sm" 
                  style={{ backgroundColor: func.projectColor.startsWith('#') ? func.projectColor : `#${func.projectColor}` }}
                />
              )}
              <div className="text-white/70 text-xs truncate max-w-[140px] font-medium" title={func.projectName}>
                {func.projectName}
              </div>
            </>
          ) : (
            <div className="text-white/40 text-xs italic font-medium">
              {isInternalShift ? 'Internt skift' : ''}
            </div>
          )}

          {func.functionGroupName && (
            <span 
              className="text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded-md font-medium shrink-0 truncate max-w-[90px]"
              title={`Funktionsgrupp: ${func.functionGroupName}`}
            >
              📁 {func.functionGroupName}
            </span>
          )}
        </div>

        {func.isUnscheduled ? (
          <div className="text-[10px] shrink-0 px-2 py-0.5 rounded font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30">
            ⚠️ Ej tidsatt
          </div>
        ) : (
          <div className={`text-[11px] shrink-0 px-1.5 py-0.5 rounded font-bold tracking-widest ${isFullyAssigned ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            [{initials}]
          </div>
        )}
      </div>

      {/* Badges: Status, Vehicle, and Assignee count */}
      <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-1.5 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${projStatusClass} font-semibold uppercase tracking-wider shrink-0`}>
            {displayStatus}
          </span>
          {func.vehicleNames && func.vehicleNames.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white/10 text-white/80 border-white/20 font-medium truncate max-w-[80px]" title={func.vehicleNames.join(', ')}>
              🚚 {func.vehicleNames.join(', ')}
            </span>
          )}
        </div>
        
        {func.isUnscheduled ? (
          <div className="shrink-0 text-[10px] text-amber-300/90 font-medium flex items-center gap-1">
            <span>Kan ej bemannas</span>
          </div>
        ) : (
          <div className={`shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${isFullyAssigned ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            {assignedCount} / {requiredAmount}
          </div>
        )}
      </div>
    </div>
  );
}
