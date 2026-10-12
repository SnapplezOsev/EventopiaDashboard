'use client';
import { useState } from 'react';

export default function MeetingModal({ crew, onClose, onSave }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [remark, setRemark] = useState('');
  const [color, setColor] = useState('E67E22');
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !startDate || !startTime || !endDate || !endTime) return;
    setIsSaving(true);

    const startStr = `${startDate}T${startTime}:00+02:00`;
    const endStr = `${endDate}T${endTime}:00+02:00`;

    await onSave({
      name,
      start: startStr,
      end: endStr,
      location,
      remark,
      color,
      pendingAssignments,
    });
    setIsSaving(false);
  };

  const allCrew = [...(crew?.internal || []), ...(crew?.freelancers || [])];

  const colors = [
    { value: 'E67E22', label: 'Orange' },
    { value: '3498DB', label: 'Blå' },
    { value: '2ECC71', label: 'Grön' },
    { value: 'E74C3C', label: 'Röd' },
    { value: '9B59B6', label: 'Lila' },
  ];

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
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Boka Möte
          </h2>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Mötets Namn</label>
            <input 
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 text-lg"
              placeholder="T.ex. Planeringsmöte..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-sm font-medium mb-2">Start</label>
              <div className="flex gap-2">
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500/50"
                />
                <input 
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-white/60 text-sm font-medium mb-2">Slut</label>
              <div className="flex gap-2">
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500/50"
                />
                <input 
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Plats (Frivillig)</label>
            <input 
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50"
              placeholder="T.ex. Konferensrummet..."
            />
          </div>

          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Färg</label>
            <div className="flex gap-3">
              {colors.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${color === c.value ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: `#${c.value}` }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-white/60 text-sm font-medium mb-2">Anteckning (Frivillig)</label>
            <textarea 
              value={remark}
              onChange={e => setRemark(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 min-h-[80px]"
              placeholder="Mer detaljer kring mötet..."
            />
          </div>

          <div className="pt-4 border-t border-white/10">
            <label className="block text-white/60 text-sm font-medium mb-4">Deltagare (Frivillig)</label>
            <div className="space-y-2 mb-4">
              {pendingAssignments.map(crewId => {
                const c = allCrew.find(x => x.id === crewId);
                if (!c) return null;
                return (
                  <div key={crewId} className="flex justify-between items-center bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                    <span className="text-orange-200 font-medium">{c.name}</span>
                    <button onClick={() => setPendingAssignments(prev => prev.filter(id => id !== crewId))} className="text-orange-400 hover:text-orange-300 text-xs uppercase font-bold">Ångra</button>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {allCrew.map(c => {
                if (pendingAssignments.includes(c.id)) return null;
                return (
                  <button
                    key={c.id}
                    onClick={() => setPendingAssignments(prev => [...prev, c.id])}
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
            disabled={!name.trim() || !startDate || !endDate || isSaving}
            className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all shadow-lg"
          >
            {isSaving ? 'Bokar...' : 'Boka Möte'}
          </button>
        </div>
      </div>
    </div>
  );
}
