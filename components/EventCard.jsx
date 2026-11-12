'use client';
import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { getStatusBadgeStyle, getWarehouseStatusInfo, formatEventTimeBadge, isFunctionCompleted, shortenLeverans } from '@/lib/statusUtils';

function areEventCardPropsEqual(prevProps, nextProps) {
  if (prevProps.onClick !== nextProps.onClick) return false;
  if (prevProps.onCardClick !== nextProps.onCardClick) return false;

  const pf = prevProps.func;
  const nf = nextProps.func;
  if (pf === nf) return true;
  if (!pf || !nf) return false;

  if (pf.id !== nf.id) return false;
  if (pf.name !== nf.name) return false;
  if (pf.planperiod_start !== nf.planperiod_start) return false;
  if (pf.planperiod_end !== nf.planperiod_end) return false;
  if (pf.statusName !== nf.statusName) return false;
  if (pf.warehouseStatus !== nf.warehouseStatus) return false;
  if (pf.amount !== nf.amount) return false;
  if (pf.isUnscheduled !== nf.isUnscheduled) return false;
  if (pf.customerName !== nf.customerName) return false;
  if (pf.projectName !== nf.projectName) return false;
  if (pf.projectColor !== nf.projectColor) return false;
  if (pf.functionGroupName !== nf.functionGroupName) return false;

  const pVehicles = pf.vehicleNames || [];
  const nVehicles = nf.vehicleNames || [];
  if (pVehicles.length !== nVehicles.length) return false;
  for (let i = 0; i < pVehicles.length; i++) {
    if (pVehicles[i] !== nVehicles[i]) return false;
  }

  const pCrew = pf.assignedCrew || [];
  const nCrew = nf.assignedCrew || [];
  if (pCrew.length !== nCrew.length) return false;
  for (let i = 0; i < pCrew.length; i++) {
    if (
      pCrew[i].projectCrewId !== nCrew[i].projectCrewId ||
      pCrew[i].crewId !== nCrew[i].crewId ||
      pCrew[i].name !== nCrew[i].name
    ) {
      return false;
    }
  }

  return true;
}

function EventCard({ func, onClick, onCardClick }) {
  const isFirstMountRef = useRef(true);
  const prevFuncRef = useRef(func);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevFuncRef.current = func;
      return;
    }

    const prev = prevFuncRef.current;
    const crewChanged = JSON.stringify(prev?.assignedCrew) !== JSON.stringify(func?.assignedCrew);
    const statusChanged = prev?.statusName !== func?.statusName || prev?.warehouseStatus !== func?.warehouseStatus;
    const timeChanged = prev?.planperiod_start !== func?.planperiod_start || prev?.planperiod_end !== func?.planperiod_end;

    if (crewChanged || statusChanged || timeChanged) {
      const updateTimer = setTimeout(() => setJustUpdated(true), 0);
      const clearTimer = setTimeout(() => setJustUpdated(false), 2400);
      prevFuncRef.current = func;
      return () => {
        clearTimeout(updateTimer);
        clearTimeout(clearTimer);
      };
    }
    prevFuncRef.current = func;
  }, [func]);

  const handleClick = useCallback((e) => {
    if (onCardClick) {
      onCardClick(func);
    } else if (onClick) {
      onClick(e);
    }
  }, [onCardClick, onClick, func]);

  const requiredAmount = func.amount || 1;
  const assignedCount = func.assignedCrew?.length || 0;
  const isFullyAssigned = assignedCount >= requiredAmount;
  
  const timeString = formatEventTimeBadge(func);
  
  // Create initials e.g. "Emil Reinfeldt" -> "ER"
  const initials = func.assignedCrew?.map(c => {
    const parts = c.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }).join(', ') || 'Ingen';

  const isInternalShift = !func.projectName || func.type === 'shift' || func.isInternalShift;
  const isAppointment = func.type === 'appointment' || func.type === 'google_calendar' || func.source === 'google_calendar' || String(func.id).startsWith('app-') || String(func.id).startsWith('gcal-');
  const isDone = isFunctionCompleted(func);

  let displayStatus = null;
  if (isAppointment || isInternalShift) {
    displayStatus = null;
  } else {
    displayStatus = func.statusName || 'Okänd';
  }

  const projStatusClass = getStatusBadgeStyle(displayStatus);
  const warehouseInfo = !isAppointment && !isInternalShift ? getWarehouseStatusInfo(func.warehouseStatus) : null;

  const cardStyleClass = isDone
    ? 'opacity-50 hover:opacity-100 grayscale-[0.5] hover:grayscale-0 bg-white/[0.02] border border-white/5 hover:border-white/20'
    : func.isUnscheduled
    ? 'bg-amber-500/[0.07] hover:bg-amber-500/[0.12] border border-amber-500/30 border-dashed'
    : 'bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20';

  const timeBadgeClass = isDone
    ? 'bg-white/5 text-white/50 text-sm'
    : func.isUnscheduled
    ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30 text-xs'
    : 'bg-white/10 text-white text-sm';

  return (
    <div 
      onClick={handleClick}
      className={`relative active:scale-[0.97] transition-all rounded-xl p-2 cursor-pointer group shadow-sm flex flex-col gap-1.5 ${cardStyleClass} ${justUpdated ? 'card-updated' : ''}`}
    >
      {/* Row 1: Time and Function */}
      <div className="flex justify-between items-center w-full">
        <div className={`${timeBadgeClass} px-2 py-0.5 rounded-md font-bold tracking-wide`}>
          {timeString}
        </div>
        <div className={`font-bold ${isDone ? 'text-white/60' : 'text-white'} text-sm truncate max-w-[150px] text-right`} title={func.name}>
          {shortenLeverans(func.name)}
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
              📁 {shortenLeverans(func.functionGroupName)}
            </span>
          )}
        </div>

        {func.isUnscheduled ? (
          <div className="text-[10px] shrink-0 px-2 py-0.5 rounded font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30">
            ⚠️ Ej tidsatt
          </div>
        ) : isAppointment && assignedCount === 0 ? (
          null
        ) : (
          <div className={`text-[11px] shrink-0 px-1.5 py-0.5 rounded font-bold tracking-widest ${isFullyAssigned ? 'text-green-400 bg-green-500/10' : (isAppointment ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10')}`}>
            [{initials}]
          </div>
        )}
      </div>

      {/* Badges: Status, Vehicle, and Assignee count */}
      <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-1.5 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {displayStatus && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${projStatusClass} font-semibold uppercase tracking-wider shrink-0`}>
              {displayStatus}
            </span>
          )}
          {warehouseInfo && (
            <span 
              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${warehouseInfo.badgeClass} font-bold shrink-0 flex items-center shadow-sm cursor-help`}
              title={`Lagerstatus: ${warehouseInfo.label}`}
            >
              <span>{warehouseInfo.icon}</span>
            </span>
          )}
          {func.vehicleNames && func.vehicleNames.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white/10 text-white/80 border-white/20 font-medium truncate max-w-[170px]" title={func.vehicleNames.join(', ')}>
              🚚 {func.vehicleNames.join(', ')}
            </span>
          )}
        </div>
        
        {func.isUnscheduled ? (
          <div className="shrink-0 text-[10px] text-amber-300/90 font-medium flex items-center gap-1">
            <span>Kan ej bemannas</span>
          </div>
        ) : isAppointment ? (
          null
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

export default memo(EventCard, areEventCardPropsEqual);
