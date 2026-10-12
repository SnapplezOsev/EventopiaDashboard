'use client';
import { useState } from 'react';

export default function TaskModal({ task, crew, onClose, onSave, onAssign }) {
  const isNew = !task;
  const [name, setName] = useState(task?.name || '');
  const [details, setDetails] = useState(task?.details || '');
  const [deadline, setDeadline] = useState(task?.deadline ? task.deadline.slice(0, 10) : '');
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    await onSave({
      id: task?.id,
      name,
      details,
      deadline: deadline || null,
      pendingAssignments,
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
        className="bg-slate-900/90 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {isNew ? 'Skapa ny uppgift' : 'Uppgift'}
          </h2>
          {task && task.status && (
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

          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Förfallodatum</label>
            <input 
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="pt-4 border-t border-white/10">
              <label className="block text-white/60 text-sm font-medium mb-4">Tilldelad Personal</label>
              <div className="space-y-2 mb-4">
                {(task?.assignedCrew || []).map(ac => (
                  <div key={ac.crewId} className="flex justify-between items-center bg-white/[0.04] p-3 rounded-lg border border-white/5">
                    <span className="text-white font-medium">{ac.name}</span>
                    <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded text-xs font-bold uppercase">Tilldelad</span>
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

        <div className="p-6 border-t border-white/10 bg-black/20 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-white font-semibold transition-all"
          >
            Avbryt
          </button>
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
