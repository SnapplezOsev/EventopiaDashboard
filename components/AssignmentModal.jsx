'use client';

export default function AssignmentModal({ func, onClose }) {
  if (!func) return null;

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
  };

  const isAppointment = func.type === 'appointment';

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/80 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-8 border-b border-white/10 bg-white/5 relative shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-6">
              <div className="flex items-center gap-3 mb-3">
                {isAppointment && (
                  <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                    Möte
                  </span>
                )}
                {!isAppointment && (
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                    Projekt
                  </span>
                )}
                <div className="text-md text-white/80 bg-black/40 px-3 py-1 rounded-lg font-medium border border-white/10">
                  {formatDate(func.planperiod_start)} | {formatTime(func.planperiod_start)} – {formatTime(func.planperiod_end)}
                </div>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2 leading-tight">{func.name}</h2>
              {!isAppointment && (
                <div className="text-xl font-medium text-white/60 mb-2">{func.projectName}</div>
              )}
            </div>
            {func.projectColor && (
              <div className="w-8 h-8 rounded-full shadow-lg shrink-0 border-2 border-white/20" style={{ backgroundColor: func.projectColor.startsWith('#') ? func.projectColor : `#${func.projectColor}` }}></div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          
          {/* Structured Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            {(!isAppointment || func.customerName) && (
              <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider font-bold text-white/40 mb-1">Kund / Ansvarig</p>
                  <p className="text-white font-medium truncate">{func.customerName || 'Okänd'}</p>
                </div>
              </div>
            )}
            
            <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider font-bold text-white/40 mb-1">Plats</p>
                <p className="text-white font-medium truncate">{func.locationName || 'Okänd'}</p>
              </div>
            </div>
            
            {!isAppointment && (
              <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider font-bold text-white/40 mb-1">Status</p>
                  <p className="text-white font-medium truncate">{func.statusName || 'Okänd'}</p>
                </div>
              </div>
            )}

            {!isAppointment && func.vehicleNames?.length > 0 && (
              <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider font-bold text-white/40 mb-1">Fordon</p>
                  <p className="text-white font-medium truncate">{func.vehicleNames.join(', ')}</p>
                </div>
              </div>
            )}
          </div>

          {func.remark && (
            <div className="bg-white/[0.02] p-5 rounded-xl border border-white/10">
              <p className="text-xs uppercase tracking-wider font-bold text-white/40 mb-2">Anteckning</p>
              <p className="text-white/80 whitespace-pre-wrap">{func.remark}</p>
            </div>
          )}
          
          <section className="pt-4 border-t border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Deltagare / Personal</h3>
              <div className="text-sm font-medium text-white/50">
                {func.assignedCrew?.length || 0} {func.amount > 1 ? `av ${func.amount} tilldelade` : ''}
              </div>
            </div>
            
            {func.assignedCrew && func.assignedCrew.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {func.assignedCrew.map((c, i) => (
                  <div key={c.projectCrewId || i} className="flex items-center gap-3 bg-white/[0.04] p-3 rounded-xl border border-white/10">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white font-bold uppercase">
                      {c.name ? c.name.substring(0,2) : '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate text-sm">{c.name || 'Okänd'}</p>
                      <p className="text-green-400 text-xs font-bold uppercase mt-0.5">Tilldelad</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-white/5">
                <p className="text-white/40 text-lg">Ingen personal tilldelad än.</p>
              </div>
            )}
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-black/20 shrink-0">
          <button 
            onClick={onClose}
            className="w-full h-14 bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all rounded-xl text-white text-xl font-semibold tracking-wide border border-white/5"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}
