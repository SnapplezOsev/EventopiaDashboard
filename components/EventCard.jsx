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

  const timeString = `${formatTime(func.planperiod_start)} – ${formatTime(func.planperiod_end)}`;
  
  // Create initials e.g. "Emil Reinfeldt" -> "ER"
  const initials = func.assignedCrew?.map(c => {
    const parts = c.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length-1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }).join(', ') || 'Ingen';

  const projStatusClass = getStatusBadgeStyle(func.statusName);

  return (
    <div 
      onClick={onClick}
      className={`relative bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97] transition-all border-l-[3px] rounded-xl p-2 cursor-pointer group shadow-sm flex flex-col gap-1.5 ${isFullyAssigned ? 'border-l-green-500' : 'border-l-red-500'}`}
    >
      {/* Row 1: Time and Function */}
      <div className="flex justify-between items-center w-full">
        <div className="bg-white/10 text-white text-sm px-2 py-0.5 rounded-md font-bold tracking-wide">
          {timeString}
        </div>
        <div className="font-bold text-white text-sm truncate max-w-[150px] text-right">
          {func.name}
        </div>
      </div>

      {/* Row 2: Project and Assigned Initials */}
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-1.5 min-w-0">
          {func.projectColor && (
            <div className="w-2 h-2 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: func.projectColor.startsWith('#') ? func.projectColor : `#${func.projectColor}` }}></div>
          )}
          <div className="text-white/70 text-xs truncate max-w-[160px] font-medium">
            {func.projectName}
          </div>
        </div>
        <div className={`text-[11px] shrink-0 px-1.5 py-0.5 rounded font-bold tracking-widest ${isFullyAssigned ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
          [{initials}]
        </div>
      </div>

      {/* Badges: Status, Vehicle, and Assignee count */}
      <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-1.5 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${projStatusClass} font-semibold uppercase tracking-wider shrink-0`}>
            {func.statusName || 'Okänd'}
          </span>
          {func.vehicleNames && func.vehicleNames.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white/10 text-white/80 border-white/20 font-medium truncate max-w-[80px]" title={func.vehicleNames.join(', ')}>
              🚚 {func.vehicleNames.join(', ')}
            </span>
          )}
        </div>
        
        <div className={`shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${isFullyAssigned ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          {assignedCount} / {requiredAmount}
        </div>
      </div>
    </div>
  );
}
