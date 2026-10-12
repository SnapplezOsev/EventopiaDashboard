'use client';
import { useState } from 'react';

// Helpers for DD-MM-YYYY <-> YYYY-MM-DD
function toDDMMYYYY(dateOrStr) {
  if (!dateOrStr) return '';
  const d = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function toYYYYMMDD(str) {
  if (!str) return '';
  const match = str.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return str;
}

export default function MeetingModal({ meeting, crew, onClose, onSave, onDelete }) {
  const isEditing = Boolean(meeting);

  const initialStart = meeting?.planperiod_start ? new Date(meeting.planperiod_start) : null;
  const initialEnd = meeting?.planperiod_end ? new Date(meeting.planperiod_end) : null;

  const formatTime24h = (d) => {
    if (!d || isNaN(d.getTime())) return '09:00';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const todayDDMMYYYY = toDDMMYYYY(new Date());

  const [name, setName] = useState(meeting?.name || '');
  const [dateInput, setDateInput] = useState(initialStart ? toDDMMYYYY(initialStart) : todayDDMMYYYY);
  const [startTime, setStartTime] = useState(initialStart ? formatTime24h(initialStart) : '09:00');
  const [endTime, setEndTime] = useState(initialEnd ? formatTime24h(initialEnd) : '10:00');
  const [location, setLocation] = useState(meeting?.locationName || meeting?.location || '');
  const [remark, setRemark] = useState(meeting?.remark || '');
  const [color, setColor] = useState(meeting?.projectColor?.replace('#', '') || 'E67E22');
  const [pendingAssignments, setPendingAssignments] = useState(
    meeting?.assignedCrew?.map(c => c.crewId) || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const setRelativeDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDateInput(toDDMMYYYY(d));
  };

  const handleSave = async () => {
    const isoDate = toYYYYMMDD(dateInput);
    if (!name.trim() || !isoDate || !startTime || !endTime) return;
    setIsSaving(true);

    const startStr = `${isoDate}T${startTime}:00+02:00`;
    const endStr = `${isoDate}T${endTime}:00+02:00`;

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

  const quickTimes = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

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

          {/* Datum och Tider (DD-MM-YYYY och 24h) */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Datumfält (DD-MM-YYYY) */}
              <div>
                <label className="block text-white/60 text-xs uppercase tracking-wider font-bold mb-2">
                  Datum (DD-MM-ÅÅÅÅ)
                </label>
                <input 
                  type="text"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  placeholder="DD-MM-ÅÅÅÅ"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 font-mono text-center text-base"
                />
              </div>

              {/* Starttid (24h) */}
              <div>
                <label className="block text-white/60 text-xs uppercase tracking-wider font-bold mb-2">
                  Start-tid (24h)
                </label>
                <input 
                  type="text"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  placeholder="09:00"
                  pattern="[0-2][0-9]:[0-5][0-9]"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 font-mono text-center text-base"
                />
              </div>

              {/* Sluttid (24h) */}
              <div>
                <label className="block text-white/60 text-xs uppercase tracking-wider font-bold mb-2">
                  Slut-tid (24h)
                </label>
                <input 
                  type="text"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  placeholder="10:00"
                  pattern="[0-2][0-9]:[0-5][0-9]"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 font-mono text-center text-base"
                />
              </div>
            </div>

            {/* Touch-knappar för snabbval */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex gap-1.5">
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
                  onClick={() => setRelativeDate(2)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-semibold rounded-lg text-white/80 border border-white/5"
                >
                  I övermorgon
                </button>
              </div>

              <div className="flex gap-1 text-[11px] text-white/50 overflow-x-auto">
                {quickTimes.slice(0, 4).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setStartTime(t);
                      const [h, m] = t.split(':').map(Number);
                      setEndTime(`${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                    }}
                    className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white/70"
                  >
                    {t}
                  </button>
                ))}
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
            disabled={!name.trim() || !dateInput || !startTime || !endTime || isSaving || isDeleting}
            className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all shadow-lg text-lg"
          >
            {isSaving ? 'Sparar...' : (isEditing ? 'Spara Ändringar' : 'Boka Möte')}
          </button>
        </div>
      </div>
    </div>
  );
}
