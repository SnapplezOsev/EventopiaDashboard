'use client';
import { useState } from 'react';
import { getStatusBadgeStyle } from '@/lib/statusUtils';

export default function AssignmentModal({ 
  func, 
  crew, 
  onAssign, 
  onUnassign, 
  onEditMeeting, 
  onDeleteMeeting, 
  onClose 
}) {
  if (!func) return null;

  const [crewSearch, setCrewSearch] = useState('');
  const [crewCategoryTab, setCrewCategoryTab] = useState('internal'); // 'internal' | 'freelancer'

  const formatTime = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
  };

  const isAppointment = func.type === 'appointment';

  const internalCrew = crew?.internal || [];
  const freelancerCrew = crew?.freelancers || [];

  const activeCrewList = crewCategoryTab === 'internal' ? internalCrew : freelancerCrew;
  const filteredCrew = activeCrewList.filter(c => 
    !crewSearch.trim() || c.name.toLowerCase().includes(crewSearch.toLowerCase())
  );

  const assignedCrewIds = new Set(func.assignedCrew?.map(c => c.crewId) || []);
  const requiredAmount = func.amount || 1;
  const assignedCount = func.assignedCrew?.length || 0;
  const isFullyAssigned = assignedCount >= requiredAmount;
  const statusBadgeClass = getStatusBadgeStyle(func.statusName);

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/95 border border-white/10 rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-6 md:p-7 border-b border-white/10 bg-white/5 relative shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {isAppointment ? (
                  <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                    Möte
                  </span>
                ) : (
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                    {func.type === 'project' ? 'Projekt' : 'Funktion'}
                  </span>
                )}

                <div className="text-sm text-white/80 bg-black/40 px-3 py-1 rounded-lg font-medium border border-white/10">
                  {formatDate(func.planperiod_start)} | {formatTime(func.planperiod_start)} – {formatTime(func.planperiod_end)}
                </div>

                {!isAppointment && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wider border ${statusBadgeClass}`}>
                    {func.statusName || 'Okänd'}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight truncate">{func.name}</h2>
              {!isAppointment && (
                <div className="text-lg font-medium text-white/60 truncate mt-0.5">{func.projectName}</div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAppointment && onEditMeeting && (
                <button
                  onClick={() => {
                    onClose();
                    onEditMeeting(func);
                  }}
                  className="px-4 py-2 bg-orange-600/30 border border-orange-500/40 hover:bg-orange-600/50 active:scale-95 text-orange-200 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Redigera
                </button>
              )}
              {func.projectColor && (
                <div 
                  className="w-8 h-8 rounded-full shadow-lg border-2 border-white/20" 
                  style={{ backgroundColor: func.projectColor.startsWith('#') ? func.projectColor : `#${func.projectColor}` }}
                />
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/70 hover:text-white flex items-center justify-center text-lg ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Body - Split 2-Column Layout */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            
            {/* Column 1 (Left): Info & Assigned Crew */}
            <div className="md:col-span-5 flex flex-col gap-4">
              
              {/* Structured Info Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {(!isAppointment || func.customerName) && (
                  <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex gap-2.5 items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-white/40">Kund</p>
                      <p className="text-white font-medium truncate text-xs">{func.customerName || 'Okänd'}</p>
                    </div>
                  </div>
                )}
                
                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex gap-2.5 items-center">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-white/40">Plats</p>
                    <p className="text-white font-medium truncate text-xs">{func.locationName || 'Okänd'}</p>
                  </div>
                </div>

                {!isAppointment && func.vehicleNames?.length > 0 && (
                  <div className="col-span-2 bg-white/[0.03] p-3 rounded-xl border border-white/5 flex gap-2.5 items-center">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 text-xs">
                      🚚
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-white/40">Fordon</p>
                      <p className="text-white font-medium truncate text-xs">{func.vehicleNames.join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>

              {func.remark && (
                <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">Anteckning</p>
                  <p className="text-white/80 whitespace-pre-wrap text-xs leading-relaxed">{func.remark}</p>
                </div>
              )}

              {/* Assigned Crew Section - Stably Scrollable */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col flex-1 min-h-[220px]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tilldelade personer</h3>
                  <div className={`text-xs px-2 py-0.5 rounded-full font-bold border ${isFullyAssigned ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                    {assignedCount} / {requiredAmount} st
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto max-h-[240px] md:max-h-[300px] custom-scrollbar pr-1">
                  {func.assignedCrew && func.assignedCrew.length > 0 ? (
                    func.assignedCrew.map((c, i) => (
                      <div 
                        key={c.projectCrewId || i} 
                        className="flex justify-between items-center bg-white/[0.04] hover:bg-white/[0.06] p-2.5 rounded-xl border border-white/10 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 font-bold text-[11px] uppercase border border-blue-500/30">
                            {c.name ? c.name.substring(0, 2) : '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate text-xs">{c.name || 'Okänd'}</p>
                            <p className="text-emerald-400 text-[9px] font-bold uppercase tracking-wider">Tilldelad</p>
                          </div>
                        </div>
                        {onUnassign && c.projectCrewId && (
                          <button
                            onClick={() => onUnassign(c.projectCrewId, isAppointment)}
                            className="px-2 py-1 text-[11px] bg-red-500/10 hover:bg-red-500/25 active:scale-95 text-red-300 rounded-lg font-semibold transition-all border border-red-500/20"
                          >
                            Ta bort
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-full min-h-[140px] flex flex-col items-center justify-center p-4 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                      <svg className="w-8 h-8 text-white/20 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      <p className="text-white/40 text-xs">Ingen personal tilldelad än.</p>
                      <p className="text-white/25 text-[11px] mt-0.5">Välj personer till höger för att tilldela.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Column 2 (Right): Staff Selection Picker (Non-shifting) */}
            {onAssign && (
              <div className="md:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col h-full">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tilldela personal</h3>
                  
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Sök personal..."
                      value={crewSearch}
                      onChange={(e) => setCrewSearch(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl pl-3 pr-7 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 w-44"
                    />
                    {crewSearch && (
                      <button 
                        onClick={() => setCrewSearch('')} 
                        className="absolute right-2 top-1.5 text-white/40 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setCrewCategoryTab('internal')}
                    className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold transition-all ${
                      crewCategoryTab === 'internal'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    Intern personal ({internalCrew.length})
                  </button>
                  <button
                    onClick={() => setCrewCategoryTab('freelancer')}
                    className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold transition-all ${
                      crewCategoryTab === 'freelancer'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    Frilansare ({freelancerCrew.length})
                  </button>
                </div>

                {/* Fixed Height Crew List Grid - ZERO Layout Shift When Adding */}
                <div className="grid grid-cols-2 gap-2 h-[340px] overflow-y-auto custom-scrollbar pr-1 content-start">
                  {filteredCrew.map(c => {
                    const isAssigned = assignedCrewIds.has(c.id);
                    return (
                      <button
                        key={c.id}
                        disabled={isAssigned}
                        onClick={() => onAssign(c.id)}
                        className={`p-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                          isAssigned
                            ? 'bg-emerald-950/20 border-emerald-500/30 opacity-70 cursor-default'
                            : 'bg-white/5 hover:bg-white/10 active:scale-[0.98] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="min-w-0 pr-1.5">
                          <p className="text-white text-xs font-medium truncate">{c.name}</p>
                          {c.preferred && (
                            <p className="text-amber-400 text-[10px] font-semibold flex items-center gap-0.5">
                              ★ Föredragen
                            </p>
                          )}
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 border ${
                          isAssigned 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          {isAssigned ? '✓ Tilldelad' : '+ Välj'}
                        </span>
                      </button>
                    );
                  })}
                  {filteredCrew.length === 0 && (
                    <div className="col-span-full text-center py-8 text-white/40 text-xs">
                      Ingen personal matchade &quot;{crewSearch}&quot;.
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-white/10 bg-black/20 flex gap-3 shrink-0">
          {isAppointment && onDeleteMeeting && (
            <button
              onClick={() => {
                if (confirm('Är du säker på att du vill ta bort detta möte?')) {
                  onClose();
                  onDeleteMeeting(func.realId || func.id);
                }
              }}
              className="px-5 py-3 bg-red-600/20 border border-red-500/30 hover:bg-red-600/40 active:scale-95 rounded-xl text-red-200 text-sm font-semibold transition-all"
            >
              Ta bort möte
            </button>
          )}
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all rounded-xl text-white text-base font-semibold tracking-wide border border-white/5"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}
