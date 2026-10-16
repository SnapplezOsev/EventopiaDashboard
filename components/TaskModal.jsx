'use client';
import { useState } from 'react';

function toDDMMYYYY(dateOrStr) {
  if (!dateOrStr) return '';
  const d = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  if (isNaN(d.getTime())) return dateOrStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function toYYYYMMDD(str) {
  if (!str) return null;
  const match = str.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return str;
}

export default function TaskModal({ task, crew, onClose, onSave, onAssign, onUnassignCrew }) {
  const isNew = !task;
  const [name, setName] = useState(task?.name || '');
  const [details, setDetails] = useState(task?.details || '');
  const [deadline, setDeadline] = useState(task?.deadline ? toDDMMYYYY(task.deadline) : '');
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const setRelativeDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDeadline(toDDMMYYYY(d));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    await onSave({
      id: task?.id,
      name,
      details,
      deadline: toYYYYMMDD(deadline) || null,
      color: task?.color || '3b82f6',
      pendingAssignments,
    });
    setIsSaving(false);
  };

  const handleToggleCompleted = async () => {
    if (!task?.id) return;
    setIsSaving(true);
    await onSave({
      id: task.id,
      completed: !task.isCompleted,
      color: task?.color || '3b82f6',
    });
    setIsSaving(false);
  };

  const allCrew = [...(crew?.internal || []), ...(crew?.freelancers || [])];

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/95 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">
              {isNew ? 'Skapa ny uppgift' : 'Uppgift'}
            </h2>
            {task?.isCompleted && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold">
                ✓ Klar
              </span>
            )}
          </div>
          {task && task.status && !task.isCompleted && (
            <span className="px-3 py-1 bg-white/10 text-white/80 rounded-lg text-sm font-medium">
              {task.status}
            </span>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Namn</label>
            <input 
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 text-lg"
              placeholder="Uppgiftens namn..."
            />
          </div>

          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Detaljer</label>
            <textarea 
              value={details}
              onChange={e => setDetails(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 min-h-[120px]"
              placeholder="Frivillig beskrivning..."
            />
          </div>

          {/* Förfallodatum i DD-MM-YYYY format */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-white/60 text-sm font-medium">
                Förfallodatum (DD-MM-ÅÅÅÅ)
              </label>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Rensa datum
                </button>
              )}
            </div>
            
            <input 
              type="text"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              placeholder="DD-MM-ÅÅÅÅ (t.ex. 16-10-2026)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 font-mono text-base mb-2"
            />

            {/* Touch-knappar för snabbval */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRelativeDate(0)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-semibold rounded-lg text-white/80 border border-white/5"
              >
                Idag
              </button>
              <button
                type="button"
                onClick={() => setRelativeDate(1)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-semibold rounded-lg text-white/80 border border-white/5"
              >
                Imorgon
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const daysToFriday = (5 - now.getDay() + 7) % 7 || 7;
                  setRelativeDate(daysToFriday);
                }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-semibold rounded-lg text-white/80 border border-white/5"
              >
                På fredag
              </button>
              <button
                type="button"
                onClick={() => setRelativeDate(7)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-semibold rounded-lg text-white/80 border border-white/5"
              >
                +7 dagar
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <label className="block text-white/60 text-sm font-medium mb-4">Tilldelad Personal</label>
            <div className="space-y-2 mb-4">
              {(task?.assignedCrew || []).map(ac => (
                <div key={ac.crewId} className="flex justify-between items-center bg-white/[0.04] p-3 rounded-lg border border-white/5">
                  <span className="text-white font-medium">{ac.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded text-xs font-bold uppercase">Tilldelad</span>
                    {onUnassignCrew && (
                      <button
                        type="button"
                        onClick={() => onUnassignCrew(task.id, ac.crewId, ac.assignmentId)}
                        className="text-red-400 hover:text-red-300 text-xs px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-all font-semibold"
                        title="Ta bort tilldelning"
                      >
                        Ta bort
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {pendingAssignments.map(crewId => {
                const c = allCrew.find(x => x.id === crewId);
                if (!c) return null;
                return (
                  <div key={crewId} className="flex justify-between items-center bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                    <span className="text-blue-200 font-medium">{c.name}</span>
                    <button onClick={() => setPendingAssignments(prev => prev.filter(id => id !== crewId))} className="text-blue-400 hover:text-blue-300 text-xs uppercase font-bold">Ångra</button>
                  </div>
                );
              })}
              {(!task?.assignedCrew?.length && pendingAssignments.length === 0) && (
                <div className="text-white/40 text-sm italic">Ingen tilldelad än.</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {allCrew.map(c => {
                const isAlreadyAssigned = task?.assignedCrew?.some(ac => ac.crewId === c.id);
                const isPending = pendingAssignments.includes(c.id);
                if (isAlreadyAssigned || isPending) return null;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (isNew) {
                        setPendingAssignments(prev => [...prev, c.id]);
                      } else {
                        onAssign(task.id, c.id);
                      }
                    }}
                    className="bg-white/5 hover:bg-white/10 active:scale-95 transition-all p-3 rounded-lg border border-white/5 text-left flex justify-between items-center"
                  >
                    <span className="text-white text-sm">{c.name}</span>
                    <span className="text-white/30 text-xl leading-none">+</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-white font-semibold transition-all"
          >
            Avbryt
          </button>

          {!isNew && (
            <button
              onClick={handleToggleCompleted}
              disabled={isSaving}
              className={`flex-1 py-4 rounded-xl text-white font-semibold transition-all border ${
                task?.isCompleted
                  ? 'bg-amber-600/30 border-amber-500/40 hover:bg-amber-600/50 text-amber-200'
                  : 'bg-emerald-600/30 border-emerald-500/40 hover:bg-emerald-600/50 text-emerald-200'
              }`}
            >
              {task?.isCompleted ? 'Återöppna uppgift' : '✓ Markera som klar'}
            </button>
          )}

          <button 
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all shadow-lg"
          >
            {isSaving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}
