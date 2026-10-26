'use client';
import { getStatusBadgeStyle, formatEventTimeBadge } from '@/lib/statusUtils';

export default function GroupedEventCard({ group, onFunctionClick }) {
  const projectColor = group.projectColor?.startsWith('#') 
    ? group.projectColor 
    : (group.projectColor ? `#${group.projectColor}` : '#14B4EC');

  // Total required vs assigned in group
  const totalRequired = group.functions.reduce((sum, f) => sum + (f.amount || 1), 0);
  const totalAssigned = group.functions.reduce((sum, f) => sum + (f.assignedCrew?.length || 0), 0);
  const isAllGroupAssigned = totalAssigned >= totalRequired;

  // Check if all functions in the group are on location/done
  const isAllGroupDone = group.functions.every(f => {
    const s = (f.statusName || '').toLowerCase();
    return s.includes('plats') || s.includes('location') || s.includes('retur') || s.includes('return');
  });

  return (
    <div 
      className={`bg-white/[0.04] hover:bg-white/[0.06] border border-white/10 rounded-2xl p-2.5 flex flex-col gap-2 transition-all shadow-md relative overflow-hidden ${
        isAllGroupDone ? 'opacity-65 hover:opacity-100' : ''
      }`}
    >
      {/* Group Header: Project name & Function group pill */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
        <div className="min-w-0 flex items-center gap-1.5">
          <div 
            className="w-2.5 h-2.5 shrink-0 rounded-full shadow-sm"
            style={{ backgroundColor: projectColor }}
          />
          <div className="min-w-0">
            <span className="text-white font-bold text-xs truncate block max-w-[170px]" title={group.projectName}>
              {group.projectName}
            </span>
            {group.customerName && (
              <span className="text-white/40 text-[10px] truncate block max-w-[170px]">
                {group.customerName}
              </span>
            )}
          </div>
        </div>

        {/* Function Group Name Pill */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span 
            className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm"
            title={`Funktionsgrupp: ${group.groupName}`}
          >
            <span>📁</span>
            <span className="truncate max-w-[90px]">{group.groupName}</span>
          </span>
        </div>
      </div>

      {/* Function Items inside this group */}
      <div className="space-y-1.5">
        {group.functions.map((func) => {
          const requiredAmount = func.amount || 1;
          const assignedCount = func.assignedCrew?.length || 0;
          const isFullyAssigned = assignedCount >= requiredAmount;
          const timeString = formatEventTimeBadge(func);
          
          const initials = func.assignedCrew?.map(c => {
            const parts = c.name.split(' ');
            if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
            return parts[0].substring(0, 2).toUpperCase();
          }).join(', ') || 'Ingen';

          const projStatusClass = getStatusBadgeStyle(func.statusName);

          const sLower = (func.statusName || '').toLowerCase();
          const isOnLocationOrDone = sLower.includes('plats') || sLower.includes('location') || sLower.includes('retur') || sLower.includes('return');

          const itemStyleClass = isOnLocationOrDone
            ? 'opacity-50 hover:opacity-100 grayscale-[0.5] hover:grayscale-0 bg-white/[0.02] border border-white/5 hover:border-white/20'
            : func.isUnscheduled
            ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.1] border border-amber-500/25 border-dashed'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20';

          const timeBadgeClass = isOnLocationOrDone
            ? 'bg-white/5 text-white/50 text-sm'
            : func.isUnscheduled
            ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30 text-xs'
            : 'bg-white/10 text-white text-sm';

          return (
            <div
              key={func.id}
              onClick={(e) => {
                e.stopPropagation();
                onFunctionClick(func);
              }}
              className={`active:scale-[0.98] transition-all rounded-xl p-2 cursor-pointer flex flex-col gap-1 shadow-sm ${itemStyleClass}`}
            >
              {/* Row 1: Time and Function Name */}
              <div className="flex justify-between items-center w-full">
                <div className={`${timeBadgeClass} px-2 py-0.5 rounded-md font-bold tracking-wide flex items-center gap-1`}>
                  {timeString}
                </div>
                <div className={`font-bold ${isOnLocationOrDone ? 'text-white/60' : 'text-white'} text-xs truncate max-w-[150px] text-right`} title={func.name}>
                  {func.name}
                </div>
              </div>

              {/* Row 2: Status, Vehicle and Assignee info */}
              <div className="flex justify-between items-center w-full pt-1 border-t border-white/5 gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${projStatusClass} font-semibold uppercase tracking-wider shrink-0`}>
                    {func.statusName || 'Okänd'}
                  </span>
                  {func.vehicleNames && func.vehicleNames.length > 0 && (
                    <span 
                      className="text-[9px] px-1.5 py-0.2 rounded-full border bg-white/10 text-white/80 border-white/20 font-medium truncate max-w-[70px]" 
                      title={func.vehicleNames.join(', ')}
                    >
                      🚚 {func.vehicleNames.join(', ')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {func.isUnscheduled ? (
                    <div className="text-[9px] px-1.5 py-0.2 rounded font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30">
                      ⚠️ Ej tidsatt
                    </div>
                  ) : (
                    <>
                      <div className={`text-[10px] px-1.5 py-0.2 rounded font-bold tracking-widest ${isFullyAssigned ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        [{initials}]
                      </div>
                      <div className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-0.5 ${isFullyAssigned ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                        {assignedCount}/{requiredAmount}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
