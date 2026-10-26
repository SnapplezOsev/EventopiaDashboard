'use client';
import { useState, useMemo } from 'react';

export default function WarehouseView({
  warehouseData,
  isLoading,
  error,
  onRefresh,
  onToggleRepairTested,
  onReportLostEquipment,
  onResolveLostEquipment,
  onOpenTaskModal,
  onToggleTaskComplete,
  onAddQuickNote,
  onDeleteQuickNote,
  onOpenSettings,
  onEnterSleep
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [repairFilter, setRepairFilter] = useState('active'); // 'active' | 'done' | 'all'
  const [lostViewMode, setLostViewMode] = useState('models'); // 'models' | 'log'
  const [expandedModelKey, setExpandedModelKey] = useState(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  // Report lost modal state
  const [isReportLostModalOpen, setIsReportLostModalOpen] = useState(false);
  const [lostForm, setLostForm] = useState({
    name: '',
    quantity: 1,
    category: 'Kabel & Signal',
    details: '',
    project: '',
    reportedBy: 'Lagerpersonal',
    estimatedCostPerUnit: ''
  });

  const [newNoteText, setNewNoteText] = useState('');

  // Sökfilter
  const filterBySearch = (item, extraFields = []) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (item.name || item.modelName || item.equipmentName || '').toLowerCase().includes(q);
    const detailMatch = (item.remark || item.details || '').toLowerCase().includes(q);
    const projMatch = (item.projectName || item.project || '').toLowerCase().includes(q);
    const repMatch = (item.reporterName || item.reportedBy || '').toLowerCase().includes(q);
    const extraMatch = extraFields.some(f => (f || '').toLowerCase().includes(q));
    return nameMatch || detailMatch || projMatch || repMatch || extraMatch;
  };

  // 1. Reparationer
  const filteredRepairs = useMemo(() => {
    const list = warehouseData?.testingAndRepairs || [];
    return list.filter(item => {
      if (repairFilter === 'active' && item.isTested) return false;
      if (repairFilter === 'done' && !item.isTested) return false;
      return filterBySearch(item, [item.equipmentCode, String(item.number)]);
    });
  }, [warehouseData?.testingAndRepairs, repairFilter, searchQuery]);

  // 2. Förlorad utrustning (per modell)
  const filteredLostGroups = useMemo(() => {
    const groups = warehouseData?.lostGroupedByModel || [];
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();
    return groups.filter(group => {
      const modelMatch = group.modelName.toLowerCase().includes(q);
      const catMatch = (group.category || '').toLowerCase().includes(q);
      const reportMatch = group.reports.some(r => 
        (r.name || '').toLowerCase().includes(q) || 
        (r.details || '').toLowerCase().includes(q) || 
        (r.project || '').toLowerCase().includes(q)
      );
      return modelMatch || catMatch || reportMatch;
    });
  }, [warehouseData?.lostGroupedByModel, searchQuery]);

  // 2B. Förlorad utrustning (händelselogg)
  const filteredLostRaw = useMemo(() => {
    const list = warehouseData?.lostEquipment || [];
    return list.filter(item => filterBySearch(item, [item.model, item.project]));
  }, [warehouseData?.lostEquipment, searchQuery]);

  // 3. Uppgifter
  const filteredTasks = useMemo(() => {
    const list = warehouseData?.tasks || [];
    return list.filter(item => filterBySearch(item, item.assignedCrew?.map(c => c.name)));
  }, [warehouseData?.tasks, searchQuery]);

  const notes = warehouseData?.quickNotes || [];

  const stats = warehouseData?.stats || {
    activeRepairsCount: filteredRepairs.filter(r => !r.isTested).length,
    totalLostQuantity: 0,
    distinctLostModels: 0,
    openTasksCount: filteredTasks.filter(t => !t.isCompleted).length
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  };

  const handleReportLostSubmit = async (e) => {
    e.preventDefault();
    if (!lostForm.name.trim()) return;
    if (onReportLostEquipment) {
      await onReportLostEquipment({
        ...lostForm,
        model: lostForm.name.trim(),
        quantity: Math.max(1, parseInt(lostForm.quantity, 10) || 1)
      });
    }
    setIsReportLostModalOpen(false);
    setLostForm({
      name: '',
      quantity: 1,
      category: 'Kabel & Signal',
      details: '',
      project: '',
      reportedBy: 'Lagerpersonal',
      estimatedCostPerUnit: ''
    });
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    if (onAddQuickNote) {
      await onAddQuickNote(newNoteText.trim());
      setNewNoteText('');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden select-none">
      {/* ================= 1. SÖKFÄLT & UPPDATERA ================= */}
      <div className="h-11 bg-white/[0.03] backdrop-blur-md px-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4 shrink-0 shadow-lg">
        {/* Vänster: Sökfält */}
        <div className="relative w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök artiklar, fel, projekt..."
            className="w-full h-8 bg-black/30 border border-white/10 rounded-xl pl-8 pr-6 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400/50 transition-all font-sans"
          />
          <svg 
            className="w-4 h-4 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Höger: Uppdatera */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/70 hover:text-white flex items-center justify-center transition-all border border-white/10 shrink-0 shadow-sm"
          title="Uppdatera data från Rentman"
        >
          <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* ================= 2. ARBETSYTOR & KONTROLLER ================= */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* Vänsterdel: Reparationer & Förlorat gods (50/50 delning) */}
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-3 min-h-0">
          {/* ================= KOLUMN 1: REPARATIONER & DEFEKTER (ROSE ACCENT) ================= */}
          <div className="bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/10 flex flex-col min-h-0 overflow-hidden shadow-xl">
          {/* Kolumnrubrik & Filter */}
          <div className="h-11 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <h3 className="text-xs font-bold tracking-wider text-rose-200 uppercase">
                Reparationer & Defekter
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {filteredRepairs.length}
              </span>
            </div>

            {/* Segmenterad filterväljare */}
            <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setRepairFilter('active')}
                className={`h-6 px-2.5 rounded-lg transition-all font-bold ${
                  repairFilter === 'active' 
                    ? 'bg-rose-600 text-white shadow-md' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Aktiva
              </button>
              <button
                onClick={() => setRepairFilter('done')}
                className={`h-6 px-2.5 rounded-lg transition-all font-bold ${
                  repairFilter === 'done' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Klara
              </button>
              <button
                onClick={() => setRepairFilter('all')}
                className={`h-6 px-2.5 rounded-lg transition-all font-bold ${
                  repairFilter === 'all' 
                    ? 'bg-white/20 text-white shadow-md' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Alla
              </button>
            </div>
          </div>

          {/* Lista med reparationer */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 custom-scrollbar">
            {filteredRepairs.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-center text-white/40 text-xs font-mono">
                Inga reparationsärenden i valt filter
              </div>
            ) : (
              filteredRepairs.map((r) => {
                const isTested = r.isTested;
                return (
                  <div
                    key={`repair-${r.id}`}
                    onClick={() => setSelectedDetailItem({ ...r, type: 'repair' })}
                    className={`rounded-xl p-3 border transition-all cursor-pointer space-y-2 ${
                      isTested
                        ? 'bg-white/[0.01] border-white/5 opacity-50 hover:opacity-100'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-l-4 border-l-rose-500 border-white/10 shadow-sm'
                    }`}
                  >
                    {/* Rad 1: ID, Namn & Åtgärdsknapp */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-[11px] text-rose-300/80 font-bold shrink-0">
                          #{r.number}
                        </span>
                        <h4 className="font-bold text-white text-xs truncate">
                          {r.equipmentName}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleRepairTested(r.id, !isTested);
                        }}
                        className={`h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 shrink-0 border ${
                          isTested
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                            : 'bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border-white/15'
                        }`}
                      >
                        {isTested ? '✓ Klar' : 'Markera klar'}
                      </button>
                    </div>

                    {/* Rad 2: Defektbeskrivning */}
                    <p className="text-xs text-rose-100/90 leading-relaxed font-sans line-clamp-2">
                      {r.remark || 'Ingen felbeskrivning angiven'}
                    </p>

                    {/* Rad 3: Metadata (Tekniker, projekt, datum) */}
                    <div className="pt-1.5 text-[11px] text-white/50 font-mono flex items-center justify-between border-t border-white/[0.05]">
                      <span className="truncate max-w-[130px] text-white/70 font-sans">
                        {r.reporterName}
                      </span>
                      {r.projectName && (
                        <span className="truncate max-w-[130px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-medium font-sans">
                          {r.projectName}
                        </span>
                      )}
                      <span>{formatDate(r.reportedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= KOLUMN 2: FÖRLORAT GODS (AMBER ACCENT) ================= */}
        <div className="bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/10 flex flex-col min-h-0 overflow-hidden shadow-xl">
          {/* Kolumnrubrik & Lägesväljare + Rapportera */}
          <div className="h-11 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <h3 className="text-xs font-bold tracking-wider text-amber-200 uppercase">
                Förlorat gods
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {stats.totalLostQuantity} st
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Lägesväljare */}
              <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 text-xs">
                <button
                  onClick={() => setLostViewMode('models')}
                  className={`h-6 px-2.5 rounded-lg transition-all font-bold ${
                    lostViewMode === 'models' 
                      ? 'bg-amber-600 text-white shadow-md' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Per modell
                </button>
                <button
                  onClick={() => setLostViewMode('log')}
                  className={`h-6 px-2.5 rounded-lg transition-all font-bold ${
                    lostViewMode === 'log' 
                      ? 'bg-amber-600 text-white shadow-md' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Logg
                </button>
              </div>

              {/* Anmäl förlust */}
              <button
                onClick={() => setIsReportLostModalOpen(true)}
                className="h-6 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-200 text-xs font-bold border border-amber-500/40 transition-all shadow-sm"
                title="Rapportera förlorat gods manuellt"
              >
                + Anmäl
              </button>
            </div>
          </div>

          {/* Innehåll */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 custom-scrollbar">
            {/* LÄGE 1: TABELLARTAD LISTA GRUPPERAD PER MODELL */}
            {lostViewMode === 'models' && (
              <>
                {filteredLostGroups.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-center text-white/40 text-xs font-mono">
                    Inget förlorat gods registrerat
                  </div>
                ) : (
                  filteredLostGroups.map((group) => {
                    const isExpanded = expandedModelKey === group.modelKey;
                    return (
                      <div
                        key={`grp-${group.modelKey}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all overflow-hidden shadow-sm"
                      >
                        {/* Huvudrad i tabellformat */}
                        <div
                          onClick={() => setExpandedModelKey(isExpanded ? null : group.modelKey)}
                          className="h-11 px-3 flex items-center justify-between gap-3 cursor-pointer"
                        >
                          {/* Färgglad Amber-bricka för antal */}
                          <div className="w-14 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-mono font-bold text-xs text-amber-300 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                            {group.totalQuantity} st
                          </div>

                          {/* Modellnamn & antal händelser */}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-white text-xs truncate">
                              {group.modelName}
                            </h4>
                            <span className="font-mono text-[11px] text-white/50 block truncate">
                              {group.reports.length} händelser i Rentman
                            </span>
                          </div>

                          {/* Utfällningsindikator */}
                          <div className="shrink-0 text-amber-400/80 font-mono text-[10px] font-bold">
                            {isExpanded ? '▲ Dölj' : '▼ Visa'}
                          </div>
                        </div>

                        {/* Utfällda detaljhändelser för denna modell */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-amber-500/20 bg-black/40 space-y-1.5">
                            {group.reports.map((r) => (
                              <div
                                key={r.id}
                                className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-[11px] font-mono flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-amber-300 font-bold">
                                      {r.quantity} st
                                    </span>
                                    <span className="text-white/80 truncate">
                                      {r.project || 'Lager'}
                                    </span>
                                  </div>
                                  <div className="text-white/40 text-[10px] mt-0.5">
                                    {r.reportedBy} • {formatDate(r.reportedAt)}
                                  </div>
                                </div>

                                {r.source === 'manual' && r.status === 'missing' && onResolveLostEquipment && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onResolveLostEquipment(r.id, 'found');
                                    }}
                                    className="h-5 px-2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 shrink-0"
                                  >
                                    ✓ Hittad
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* LÄGE 2: KRONOLOGISK HÄNDELSELOGG */}
            {lostViewMode === 'log' && (
              <>
                {filteredLostRaw.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-center text-white/40 text-xs font-mono">
                    Inga logghändelser matchar sökningen
                  </div>
                ) : (
                  filteredLostRaw.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-3 text-xs shadow-sm"
                    >
                      <div className="w-12 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-mono font-bold text-xs text-amber-300 shrink-0">
                        {item.quantity} st
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white text-xs truncate">
                          {item.name}
                        </h4>
                        <span className="font-mono text-[11px] text-white/50 block truncate">
                          {item.project || 'Lager'} • {item.reportedBy}
                        </span>
                      </div>

                      <div className="font-mono text-[11px] text-white/40 shrink-0">
                        {formatDate(item.reportedAt)}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= KOLUMN 3 (450px): UPPGIFTER & NOTISER + INSTÄLLNINGAR & SOVLÄGE ================= */}
      <div className="w-[450px] flex-shrink-0 flex flex-col gap-3 min-h-0">
        {/* Övre del: 50/50 delning mellan uppgifter och notiser */}
        <div className="flex-1 min-h-0 grid grid-rows-2 gap-3">
            {/* DEL 3A: LAGERUPPGIFTER (BLUE ACCENT) */}
            <div className="bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/10 flex flex-col min-h-0 overflow-hidden shadow-xl">
              <div className="h-11 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <h3 className="text-xs font-bold tracking-wider text-blue-200 uppercase">
                    Lageruppgifter
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {filteredTasks.length}
                  </span>
                </div>

                <button
                  onClick={() => onOpenTaskModal(null)}
                  className="h-6 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-sm transition-all"
                >
                  + Ny uppgift
                </button>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2 custom-scrollbar">
                {filteredTasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-white/40 text-xs font-mono">
                    Inga öppna uppgifter
                  </div>
                ) : (
                  filteredTasks.map((t) => (
                    <div
                      key={`task-${t.id}`}
                      onClick={() => onOpenTaskModal(t)}
                      className={`p-3 rounded-xl border border-white/10 transition-all flex items-start gap-2.5 cursor-pointer shadow-sm ${
                        t.isCompleted 
                          ? 'bg-white/[0.01] opacity-50' 
                          : 'bg-white/[0.03] hover:bg-white/[0.07] border-l-4 border-l-blue-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={t.isCompleted}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggleTaskComplete(t)}
                        className="mt-0.5 w-4 h-4 rounded text-blue-500 bg-white/10 border-white/20 accent-blue-500 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-semibold leading-tight truncate ${t.isCompleted ? 'line-through text-white/40' : 'text-white'}`}>
                          {t.name}
                        </h4>
                        {t.details && (
                          <p className="text-[11px] text-white/60 mt-0.5 line-clamp-1">
                            {t.details}
                          </p>
                        )}
                        <div className="mt-1.5 text-[11px] font-mono text-white/50 flex items-center justify-between">
                          {t.deadline && <span>{formatDate(t.deadline)}</span>}
                          {t.assignedCrew && t.assignedCrew.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-medium truncate max-w-[120px]">
                              {t.assignedCrew.map(c => c.name).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DEL 3B: SKÄRMNOTISER (PURPLE ACCENT) */}
            <div className="bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/10 flex flex-col min-h-0 overflow-hidden shadow-xl">
              <div className="h-11 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <h3 className="text-xs font-bold tracking-wider text-purple-200 uppercase">
                    Skärmnotiser
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {notes.length}
                  </span>
                </div>
              </div>

              {/* Notislista */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2 custom-scrollbar">
                {notes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-white/40 text-xs font-mono">
                    Inga aktiva meddelanden
                  </div>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-xl border border-purple-500/25 bg-purple-500/10 flex items-start justify-between gap-2 text-xs shadow-sm"
                    >
                      <p className="text-purple-100 font-medium leading-snug min-w-0 flex-1 text-xs">{n.text}</p>
                      <button
                        onClick={() => onDeleteQuickNote(n.id)}
                        className="text-purple-300 hover:text-white text-xs shrink-0 font-mono ml-1"
                        title="Ta bort notis"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Inmatning dockad i botten */}
              <div className="p-2.5 border-t border-white/10 bg-black/30 shrink-0">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Lämna ett meddelande på skärmen..."
                    className="flex-1 h-8 bg-black/40 border border-white/15 rounded-xl px-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400/60 font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!newNoteText.trim()}
                    className="h-8 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
                  >
                    Fäst
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Undre del: Inställningar & Sovläge (Exakt samma placering som i kontorsvyn) */}
          <div className="flex gap-3 shrink-0">
            <button
              onClick={onOpenSettings}
              className="flex-1 bg-white/5 hover:bg-white/10 active:scale-95 transition-all p-4 rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-white font-medium shadow-sm"
            >
              <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Inställningar
            </button>
            <button
              onClick={onEnterSleep}
              className="flex-1 bg-white/5 hover:bg-white/10 active:scale-95 transition-all p-4 rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-white font-medium shadow-sm"
            >
              <svg className="w-5 h-5 text-indigo-300" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
              Sovläge
            </button>
          </div>
        </div>
      </div>

      {/* ================= 3. RAPPORTERA FÖRLORAT GODS (MODAL) ================= */}
      {isReportLostModalOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          onClick={() => setIsReportLostModalOpen(false)}
        >
          <div 
            className="glass-panel-bright rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-amber-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-300 tracking-wider font-bold">
                  Lageranmälan
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">Rapportera förlorat gods</h3>
              </div>
              <button 
                onClick={() => setIsReportLostModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReportLostSubmit} className="space-y-3.5">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="text-[10px] uppercase font-bold text-white/60 block mb-1">
                    Antal
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lostForm.quantity}
                    onChange={(e) => setLostForm({ ...lostForm, quantity: e.target.value })}
                    className="w-full h-9 bg-black/40 border border-white/15 rounded-xl px-3 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="col-span-3">
                  <label className="text-[10px] uppercase font-bold text-white/60 block mb-1">
                    Artikel / Modellnamn
                  </label>
                  <input
                    type="text"
                    value={lostForm.name}
                    onChange={(e) => setLostForm({ ...lostForm, name: e.target.value })}
                    placeholder="T.ex: XLR 10m, LED Par 64..."
                    className="w-full h-9 bg-black/40 border border-white/15 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-white/60 block mb-1">
                  Projekt / Gig
                </label>
                <input
                  type="text"
                  value={lostForm.project}
                  onChange={(e) => setLostForm({ ...lostForm, project: e.target.value })}
                  placeholder="T.ex: Företagsgala, Konsert..."
                  className="w-full h-9 bg-black/40 border border-white/15 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-white/60 block mb-1">
                  Anteckning / Detaljer
                </label>
                <textarea
                  value={lostForm.details}
                  onChange={(e) => setLostForm({ ...lostForm, details: e.target.value })}
                  placeholder="Beskriv vad som hänt..."
                  rows={2}
                  className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400 resize-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-white/60 block mb-1">
                  Anmält av
                </label>
                <input
                  type="text"
                  value={lostForm.reportedBy}
                  onChange={(e) => setLostForm({ ...lostForm, reportedBy: e.target.value })}
                  className="w-full h-9 bg-black/40 border border-white/15 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg active:scale-95"
                >
                  Spara anmälan
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportLostModalOpen(false)}
                  className="h-10 px-4 bg-transparent hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold rounded-xl transition-all"
                >
                  Avbryt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 4. DETALJMODAL ================= */}
      {selectedDetailItem && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          onClick={() => setSelectedDetailItem(null)}
        >
          <div 
            className="glass-panel-bright rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-rose-300 tracking-wider font-bold">
                  {selectedDetailItem.type === 'repair' ? 'Reparationsärende' : 'Detaljer'}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedDetailItem.equipmentName || selectedDetailItem.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedDetailItem(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {selectedDetailItem.remark && (
              <div className="bg-black/40 p-3 rounded-xl border border-white/10">
                <span className="text-[10px] uppercase font-mono text-rose-300 font-bold block mb-1">
                  Felbeskrivning
                </span>
                <p className="text-xs text-rose-100 leading-relaxed">
                  {selectedDetailItem.remark}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/10">
                <span className="text-white/40 block text-[10px]">Rapporterad av</span>
                <span className="text-white font-sans">{selectedDetailItem.reporterName || '-'}</span>
              </div>
              <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/10">
                <span className="text-white/40 block text-[10px]">Projekt</span>
                <span className="text-blue-300 truncate block font-sans">{selectedDetailItem.projectName || '-'}</span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              {selectedDetailItem.type === 'repair' && (
                <button
                  onClick={() => {
                    onToggleRepairTested(selectedDetailItem.id, !selectedDetailItem.isTested);
                    setSelectedDetailItem(null);
                  }}
                  className={`flex-1 h-10 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 ${
                    selectedDetailItem.isTested
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {selectedDetailItem.isTested ? '✓ Klar (Klicka för att ångra)' : 'Markera som klar'}
                </button>
              )}
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="h-10 px-5 bg-transparent hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold rounded-xl transition-all"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
