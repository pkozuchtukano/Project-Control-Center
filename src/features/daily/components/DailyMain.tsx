import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Settings as SettingsIcon, Plus, ChevronLeft, Loader2, Trash2, Edit2, Info } from 'lucide-react';
import { useProjectContext } from '../../../context/ProjectContext';
import type { DailyHub, DailySection } from '../../../types';
import { DailyBoard } from './DailyBoard';

export const DailyMain = () => {
  const { dailyHubs, refreshDailyHubs, saveDailyHub, deleteDailyHub } = useProjectContext();
  const [selectedHub, setSelectedHub] = useState<DailyHub | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<DailyHub | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    refreshDailyHubs();
  }, []);

  const handleCreateHub = () => {
    setEditingHub(null);
    setIsModalOpen(true);
  };

  const handleEditHub = (hub: DailyHub, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingHub(hub);
    setIsModalOpen(true);
  };

  const handleDeleteHub = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Czy na pewno chcesz usunąć ten Kafel (Hub)? Stracisz też konfigurację jego sekcji.')) {
      deleteDailyHub(id);
    }
  };

  const HubModal = ({ isOpen, onClose, hub }: { isOpen: boolean, onClose: () => void, hub: DailyHub | null }) => {
    const [formData, setFormData] = useState({
      name: hub?.name || '',
      description: hub?.description || '',
      projectCodes: hub?.projectCodes || ''
    });
    const [sections, setSections] = useState<DailySection[]>([]);
    const [editingSection, setEditingSection] = useState<Partial<DailySection> | null>(null);

    useEffect(() => {
      if (isOpen) {
        setFormData({
          name: hub?.name || '',
          description: hub?.description || '',
          projectCodes: hub?.projectCodes || ''
        });
        if (hub) {
          window.electron?.getDailySections(hub.id).then((loaded) => {
            setSections((loaded || []).map((section: DailySection) => ({
              ...section,
              respectDates: !!section.respectDates
            })));
          });
        } else {
          setSections([]);
        }
      }
    }, [isOpen, hub]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const hubId = hub?.id || crypto.randomUUID();
      const newHub: DailyHub = {
        id: hubId,
        ...formData
      };
      
      await saveDailyHub(newHub);
      
      // Save sections (simple sequential save for now, could be transaction-like or individual)
      for (const section of sections) {
        await window.electron?.saveDailySection({ ...section, hubId });
      }
      
      onClose();
    };

    const handleAddSection = () => {
      setEditingSection({
        id: crypto.randomUUID(),
        name: '',
        youtrackStatuses: '',
        orderIndex: sections.length,
        respectDates: false
      });
    };

    const handleSaveSection = () => {
      if (!editingSection?.name) return;
      const normalizedSection = {
        ...(editingSection as DailySection),
        respectDates: !!editingSection.respectDates
      };
      
      if (sections.find(s => s.id === editingSection.id)) {
        setSections(sections.map(s => s.id === editingSection.id ? normalizedSection : s));
      } else {
        setSections([...sections, normalizedSection]);
      }
      setEditingSection(null);
    };

    const handleDeleteSection = async (sectionId: string) => {
      if (confirm('Czy na pewno usunąć tę sekcję?')) {
        setSections(sections.filter(s => s.id !== sectionId));
        // If it was already in DB, we should delete it there too if we want immediate sync, 
        // but here we are in a "Save" flow. Let's delete immediately to be safe since we don't have a "deletedSections" tracker.
        await window.electron?.deleteDailySection(sectionId);
      }
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl animate-in fade-in zoom-in-95 my-8">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-bold dark:text-white">{hub ? 'Konfiguracja Hubu' : 'Nowy Kafel (Hub)'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <Plus size={24} className="rotate-45" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Nazwa Hubu</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 px-3 py-2 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="np. Mobile Team" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Opis</label>
                  <input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 px-3 py-2 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Krótki opis..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Kody projektów</label>
                  <input required value={formData.projectCodes} onChange={e => setFormData({...formData, projectCodes: e.target.value})} className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 px-3 py-2 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" placeholder="np. IOS, ANDROID" />
                </div>
              </div>

              <div className="pt-4 border-t dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <LayoutDashboard size={16} className="text-indigo-500" />
                    Sekcje Tablicy
                  </h4>
                  <button type="button" onClick={handleAddSection} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-md transition-colors">
                    <Plus size={14} /> Dodaj Sekcję
                  </button>
                </div>

                <div className="space-y-3">
                  {sections.length === 0 && !editingSection && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl text-gray-400 text-sm italic">
                      Brak zdefiniowanych sekcji. Zrób to teraz!
                    </div>
                  )}

                  {sections.map((s, idx) => (
                    <div key={s.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4 group">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 w-4">{idx + 1}.</span>
                          <span className="font-bold text-sm dark:text-white">{s.name}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 ml-6 font-mono truncate">{s.youtrackStatuses}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.respectDates && (
                          <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-full uppercase tracking-wide">Daty</span>
                        )}
                        <button type="button" onClick={() => setEditingSection({ ...s, respectDates: !!s.respectDates })} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-700 rounded-lg shadow-sm">
                          <Edit2 size={14} />
                        </button>
                        <button type="button" onClick={() => handleDeleteSection(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-gray-700 rounded-lg shadow-sm">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {editingSection && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border-2 border-indigo-200 dark:border-indigo-800/50 space-y-4 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Nazwa Sekcji</label>
                          <input autoFocus value={editingSection.name} onChange={e => setEditingSection({...editingSection, name: e.target.value})} className="w-full rounded-lg border-indigo-200 dark:border-indigo-900 dark:bg-gray-800 px-3 py-2 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="np. W trakcie" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Statusy YouTrack (przecinek)</label>
                          <input value={editingSection.youtrackStatuses} onChange={e => setEditingSection({...editingSection, youtrackStatuses: e.target.value})} className="w-full rounded-lg border-indigo-200 dark:border-indigo-900 dark:bg-gray-800 px-3 py-2 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono" placeholder="In Progress, Testing" />
                        </div>
                      </div>
                      <div className="flex items-start gap-3 text-[11px] text-gray-600 dark:text-gray-300">
                        <label className="inline-flex items-center gap-2 font-semibold text-indigo-600 dark:text-indigo-300">
                          <input
                            type="checkbox"
                            className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                            checked={!!editingSection.respectDates}
                            onChange={e => setEditingSection({ ...editingSection, respectDates: e.target.checked })}
                          />
                          Uwzględniaj daty
                        </label>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          Po zaznaczeniu kolumna pokaże tylko zadania z aktywnością w wybranym zakresie dat (poza sekcją „Aktywności”, która ma filtr zawsze).
                        </span>
                      </div>
                      <div className="flex justify-end gap-2 text-sm">
                        <button type="button" onClick={() => setEditingSection(null)} className="px-3 py-1.5 text-gray-500 hover:bg-white/50 rounded-lg">Anuluj</button>
                        <button type="button" onClick={handleSaveSection} className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">Dodaj / Aktualizuj</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium">Anuluj</button>
              <button type="submit" className="px-8 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95">Zapisz wszystko</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-950">
      {selectedHub ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="px-6 py-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedHub(null)} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <LayoutDashboard size={20} className="text-indigo-500" />
                  {selectedHub.name}
                </h2>
                <p className="text-xs text-gray-400 font-mono uppercase">{selectedHub.projectCodes.split(',').join(' • ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleEditHub(selectedHub, e)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors flex items-center gap-1.5 border border-transparent hover:border-indigo-200"
              >
                <SettingsIcon size={14} /> Konfiguracja
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-hidden">
            <DailyBoard 
              key={selectedHub.id + refreshCounter} 
              hubId={selectedHub.id} 
              projectCodes={selectedHub.projectCodes} 
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Daily Stand-up Command Center</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Zarządzaj tablicami dla wielu projektów w jednym miejscu.</p>
              </div>
              <button 
                onClick={handleCreateHub} 
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 transition-transform active:scale-95"
              >
                <Plus size={20} /> Nowy Kafel Daily
              </button>
            </div>

            {dailyHubs.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-4">
                  <LayoutDashboard size={32} />
                </div>
                <h3 className="text-lg font-bold dark:text-white mb-2">Brak zdefiniowanych Kafli (Hubów)</h3>
                <p className="text-gray-500 max-w-sm mx-auto mb-6">Dodaj swój pierwszy Kafel, aby połączyć wiele projektów YouTrack w jeden Command Center dla Twoich daily stand-upów.</p>
                <button 
                  onClick={handleCreateHub} 
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:border-indigo-500 transition-colors"
                >
                  Zacznij tutaj
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dailyHubs.map(hub => (
                  <div
                    key={hub.id}
                    onClick={() => setSelectedHub(hub)}
                    className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button 
                        onClick={(e) => handleEditHub(hub, e)} 
                        className="p-2 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteHub(hub.id, e)} 
                        className="p-2 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                      <LayoutDashboard size={24} />
                    </div>
                    <h3 className="text-xl font-bold dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{hub.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 h-10 mb-4">{hub.description || 'Brak opisu.'}</p>
                    <div className="pt-4 border-t dark:border-gray-800 flex flex-wrap gap-2">
                      {hub.projectCodes.split(',').map(code => (
                        <span key={code} className="px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md text-[10px] font-bold tracking-wider">{code.trim()}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <HubModal 
        hub={editingHub} 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setRefreshCounter(prev => prev + 1);
        }} 
      />
    </div>
  );
};
