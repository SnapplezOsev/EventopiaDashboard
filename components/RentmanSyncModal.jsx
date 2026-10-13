'use client';
import { useState } from 'react';

export default function RentmanSyncModal({ 
  pendingList = [], 
  onDismiss, 
  onUnassign, 
  onClose 
}) {
  const [copied, setCopied] = useState(false);

  const formatDateTime = (startStr, endStr) => {
    if (!startStr) return '';
    const s = new Date(startStr);
    const dateFormatted = s.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
    const startTime = s.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    const endTime = endStr ? new Date(endStr).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
    return `${dateFormatted} kl. ${startTime}${endTime ? ` – ${endTime}` : ''}`;
  };

  const handleCopyList = () => {
    if (pendingList.length === 0) return;
    const lines = [
      '--- TILLDELNINGAR ATT FÖRA IN I RENTMAN ---',
      ...pendingList.map((item, idx) => {
        const time = formatDateTime(item.planperiod_start, item.planperiod_end);
        return `${idx + 1}. ${item.projectName} | ${item.functionName}\n   Personal: ${item.crewName} (${item.crewCategory === 'internal' ? 'Intern' : 'Frilans'})\n   Tid: ${time || 'Ej angiven'}`;
      })
    ].join('\n\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(err => {
      console.warn('Could not copy:', err);
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/95 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-start gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white leading-tight">Att föra in i Rentman</h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-xs font-bold">
                  {pendingList.length} st
                </span>
              </div>
              <p className="text-white/50 text-xs mt-0.5">
                Personal tilldelad på touchskärmen som ska registreras i Rentmans bemanningsplan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/70 hover:text-white flex items-center justify-center text-lg shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Action bar */}
        {pendingList.length > 0 && (
          <div className="px-6 py-3 bg-white/[0.02] border-b border-white/5 flex justify-between items-center shrink-0">
            <p className="text-white/60 text-xs">
              Klicka <span className="text-emerald-400 font-semibold">&quot;Inlagd&quot;</span> när du matat in raden i Rentman.
            </p>
            <button
              onClick={handleCopyList}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border active:scale-95 ${
                copied 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Kopierad till urklipp!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  Kopiera lista
                </>
              )}
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {pendingList.length > 0 ? (
            <div className="space-y-3">
              {pendingList.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0 mt-1 shadow-sm"
                      style={{ backgroundColor: item.projectColor || '#14B4EC' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm truncate max-w-[220px]">
                          {item.projectName}
                        </span>
                        <span className="text-white/40 text-xs">•</span>
                        <span className="text-blue-300 font-medium text-xs truncate max-w-[200px]">
                          {item.functionName}
                        </span>
                      </div>
                      
                      <div className="text-white/50 text-xs mt-1 flex items-center gap-2">
                        <span>🗓️ {formatDateTime(item.planperiod_start, item.planperiod_end) || 'Tid saknas'}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-semibold text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                          👤 {item.crewName}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          item.crewCategory === 'internal' 
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}>
                          {item.crewCategory === 'internal' ? 'Intern' : 'Frilans'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5 w-full md:w-auto justify-end">
                    <button
                      onClick={() => onDismiss(item.id)}
                      className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 active:scale-95 text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      title="Kvittera att detta nu är inlagt i Rentman"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Inlagd i Rentman
                    </button>
                    <button
                      onClick={() => onUnassign(item.id, false, item.functionId, item.crewId)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 active:scale-95 text-red-300 border border-red-500/20 rounded-xl text-xs font-semibold transition-all"
                      title="Ta bort tilldelningen helt från dashboarden"
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-3xl mb-4 shadow-lg">
                ✓
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Alla tilldelningar är i fas!</h3>
              <p className="text-white/40 text-sm max-w-sm">
                Det finns inga lokala tilldelningar som väntar på att registreras i Rentmans schema.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="w-full md:w-auto px-6 py-2.5 bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all rounded-xl text-white text-sm font-semibold tracking-wide border border-white/5"
          >
            Stäng
          </button>
        </div>

      </div>
    </div>
  );
}
