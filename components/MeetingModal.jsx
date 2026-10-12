'use client';
import { useState } from 'react';

export default function MeetingModal({ meeting, crew, onClose, onSave, onDelete }) {
  const isEditing = Boolean(meeting);

  const initialStart = meeting?.planperiod_start ? new Date(meeting.planperiod_start) : null;
  const initialEnd = meeting?.planperiod_end ? new Date(meeting.planperiod_end) : null;

  const formatDate = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const formatTime = (d) => {
    if (!d || isNaN(d.getTime())) return '09:00';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [name, setName] = useState(meeting?.name || '');
  const [startDate, setStartDate] = useState(initialStart ? formatDate(initialStart) : '');
  const [startTime, setStartTime] = useState(initialStart ? formatTime(initialStart) : '09:00');
  const [endDate, setEndDate] = useState(initialEnd ? formatDate(initialEnd) : '');
  const [endTime, setEndTime] = useState(initialEnd ? formatTime(initialEnd) : '10:00');
  const [location, setLocation] = useState(meeting?.locationName || meeting?.location || '');
  const [remark, setRemark] = useState(meeting?.remark || '');
  const [color, setColor] = useState(meeting?.projectColor?.replace('#', '') || 'E67E22');
  const [pendingAssignments, setPendingAssignments] = useState(
    meeting?.assignedCrew?.map(c => c.crewId) || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !startDate || !startTime || !endDate || !endTime) return;
    setIsSaving(true);

    const startStr = `${startDate}T${startTime}:00+02:00`;
    const endStr = `${endDate}T${endTime}:00+02:00`;

    await onSave({
      id: meeting?.realId || meeting?.id,
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

  const handleDelete = async () => {
    if (!meeting?.id || !onDelete) return;
    if (confirm('Är du säker på att du vill ta bort detta möte?')) {
      setIsDeleting(true);
      await onDelete(meeting.id);
      setIsDeleting(false);
    }
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
        className="bg-slate-900/95 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isEditing ? 'Redigera Möte' : 'Boka Möte'}
          </h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-lg"
          >
            ✕
          </button>
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
                  type="button"
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
            <label className="block text-white/60 text-sm font-medium mb-4">Deltagare / Personal</label>
            <div className="space-y-2 mb-4">
              {pendingAssignments.map(crewId => {
                const c = allCrew.find(x => x.id === crewId);
                if (!c) return null;
                return (
                  <div key={crewId} className="flex justify-between items-center bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                    <span className="text-orange-200 font-medium">{c.name}</span>
                    <button 
                      type="button"
                      onClick={() => setPendingAssignments(prev => prev.filter(id => id !== crewId))} 
                      className="text-orange-400 hover:text-orange-300 text-xs uppercase font-bold px-2 py-1 bg-orange-500/20 rounded-lg"
                    >
                      Ta bort
                    </button>
                  </div>
                );
              })}
              {pendingAssignments.length === 0 && (
                <div className="text-white/40 text-sm italic py-2">Inga deltagare valda än. Klicka på personer nedan för att lägga till.</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 max-h-[160px] overflow-y-auto custom-scrollbar">
              {allCrew.map(c => {
                const isSelected = pendingAssignments.includes(c.id);
                if (isSelected) return null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPendingAssignments(prev => [...prev, c.id])}
                    className="bg-white/5 hover:bg-white/10 active:scale-95 transition-all p-3 rounded-xl border border-white/5 text-left flex justify-between items-center"
                  >
                    <span className="text-white text-sm">{c.name}</span>
                    <span className="text-orange-400 text-lg leading-none font-bold">+</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-white font-semibold transition-all"
          >
            Avbryt
          </button>

          {isEditing && onDelete && (
            <button 
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="px-5 py-4 bg-red-600/30 border border-red-500/40 hover:bg-red-600/50 text-red-200 rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              {isDeleting ? 'Tar bort...' : '🗑 Ta bort'}
            </button>
          )}

          <button 
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || !startDate || !endDate || isSaving || isDeleting}
            className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all shadow-lg text-lg"
          >
            {isSaving ? 'Sparar...' : (isEditing ? 'Spara Ändringar' : 'Boka Möte')}
          </button>
        </div>
      </div>
    </div>
  );
}
