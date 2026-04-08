import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Edit2, ExternalLink, LayoutDashboard, Loader2, MessageSquare, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { DailyHub, DailySection } from '@/types/domain';
import type { IssueWithHistory } from '@/types/youtrack';
import { pccRepository } from '@/repositories/pccRepository';
import { fetchIssuesActivity } from '@/services/youtrackApi';
import { appStorageKeys, readLocalJson, writeLocalJson } from '@/lib/storage';
import { createClientId, cn } from '@/lib/utils';
import { getSmartDateRange, normalizeStatuses } from '@/features/daily/utils/dailyUtils';
import { DailyIssueDetailsModal } from '@/features/daily/components/DailyIssueDetailsModal';

const HubModal = ({ isOpen, hub, onClose, onSaved }: { isOpen: boolean; hub: DailyHub | null; onClose: () => void; onSaved: () => void }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectCodes, setProjectCodes] = useState('');
  const [sections, setSections] = useState<DailySection[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setName(hub?.name || '');
    setDescription(hub?.description || '');
    setProjectCodes(hub?.projectCodes || '');
    if (hub) void pccRepository.getDailySections(hub.id).then(setSections);
    else setSections([]);
  }, [hub, isOpen]);

  if (!isOpen) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const hubId = hub?.id || createClientId('hub');
    await pccRepository.saveDailyHub({ id: hubId, name: name.trim(), description: description.trim(), projectCodes: projectCodes.trim() });
    for (const [index, section] of sections.entries()) {
      await pccRepository.saveDailySection({ ...section, hubId, orderIndex: index });
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h3 className="text-lg font-bold dark:text-white">{hub ? 'Konfiguracja Hubu' : 'Nowy Kafel (Hub)'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><Plus size={24} className="rotate-45" /></button>
        </div>
        <form className="space-y-6 p-6" onSubmit={save}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Nazwa Hubu</label><input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Opis</label><input value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Kody projektów</label><input required value={projectCodes} onChange={(event) => setProjectCodes(event.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
          </div>
          <div className="border-t pt-4 dark:border-gray-700">
            <div className="mb-4 flex items-center justify-between"><h4 className="text-sm font-bold dark:text-white">Sekcje Tablicy</h4><button type="button" onClick={() => setSections((current) => [...current, { id: createClientId('section'), hubId: hub?.id || 'pending', name: '', youtrackStatuses: '', orderIndex: current.length, respectDates: false }])} className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"><Plus size={14} className="inline" /> Dodaj sekcję</button></div>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={section.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700/40">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center">
                    <input value={section.name} onChange={(event) => setSections((current) => current.map((item) => item.id === section.id ? { ...item, name: event.target.value } : item))} className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="Nazwa sekcji" />
                    <input value={section.youtrackStatuses} onChange={(event) => setSections((current) => current.map((item) => item.id === section.id ? { ...item, youtrackStatuses: event.target.value } : item))} className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="Statusy YouTrack" />
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"><input type="checkbox" checked={section.respectDates} onChange={(event) => setSections((current) => current.map((item) => item.id === section.id ? { ...item, respectDates: event.target.checked } : item))} />Daty</label>
                    <button type="button" onClick={() => setSections((current) => current.filter((item) => item.id !== section.id).map((item, nextIndex) => ({ ...item, orderIndex: nextIndex })))} className="rounded-lg border px-2 py-2 text-xs text-red-600 dark:border-gray-600 dark:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">Anuluj</button><button type="submit" className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700">Zapisz wszystko</button></div>
        </form>
      </div>
    </div>
  );
};

const IssueCard = ({ issue, localComment, isCollapsed, onToggleCollapse, onSaveComment, onAssigneeFilter, showState, dateFrom, dateTo, baseUrl }: { issue: IssueWithHistory; localComment: string; isCollapsed: boolean; onToggleCollapse: (value: boolean) => void; onSaveComment: (value: string) => void; onAssigneeFilter: (assignee: string | null) => void; showState: boolean; dateFrom: string; dateTo: string; baseUrl: string }) => {
  const [comment, setComment] = useState(localComment);
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  useEffect(() => setComment(localComment), [localComment]);
  const periodActivities = useMemo(() => {
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59`).getTime();
    return (issue.timeline || []).filter((entry) => entry.timestamp >= fromTime && entry.timestamp <= toTime).slice(-4);
  }, [dateFrom, dateTo, issue.timeline]);
  if (isCollapsed) {
    return <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 opacity-30 shadow-sm hover:opacity-100 dark:border-gray-800 dark:bg-gray-900"><div className="min-w-0 flex-1"><span className="mr-2 text-[10px] font-bold text-gray-400">{issue.idReadable}</span><span className="truncate text-xs text-gray-600 dark:text-gray-400">{issue.summary}</span></div><button onClick={() => onToggleCollapse(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronDown size={14} className="-rotate-90" /></button><DailyIssueDetailsModal issue={issue} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} dateFrom={dateFrom} dateTo={dateTo} baseUrl={baseUrl} /></div>;
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b bg-gray-50/50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/30"><div className="flex min-w-0 items-center gap-2"><a href={`${baseUrl}/issue/${issue.idReadable}`} target="_blank" rel="noreferrer" className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">{issue.idReadable}</a>{showState && issue.state && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: issue.state.color.background, color: issue.state.color.foreground }}>{issue.state.name}</span>}</div><div className="flex items-center gap-1"><button onClick={() => setIsDetailOpen(true)} className="rounded p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"><ExternalLink size={14} /></button><button onClick={() => onToggleCollapse(true)} className="rounded p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronDown size={14} className="rotate-90" /></button></div></div>
      <div className="space-y-3 p-3"><h4 className="break-words text-sm font-bold text-gray-900 dark:text-white">{issue.summary}</h4>{periodActivities.length > 0 && <div className="space-y-1 border-t pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">{periodActivities.map((activity) => <div key={activity.id}><span className="font-bold text-gray-700 dark:text-gray-300">{activity.author.name}:</span> {activity.type === 'comment' ? activity.text : activity.type === 'field-change' ? `${activity.field}: ${String(activity.added || '')}` : `Zalogowano ${activity.minutes || 0}m`}</div>)}</div>}<button onClick={() => onAssigneeFilter(issue.assignee?.login || null)} className="text-left text-[11px] font-bold text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300">{issue.assignee?.name || 'Nieprzypisane'}</button></div>
      {localComment && !isEditing && <div className="px-3 pb-3"><div className="rounded-lg border border-amber-100/50 bg-amber-50/50 p-2.5 dark:border-amber-800/30 dark:bg-amber-900/10"><span className="text-[9px] font-black uppercase tracking-widest text-amber-600/70">Brudnopis PM</span><p className="mt-1 break-words text-xs font-medium leading-relaxed text-amber-900/80 dark:text-amber-200/70">{localComment}</p></div></div>}
      <div className="px-3 pb-3"><button onClick={() => setIsEditing((current) => !current)} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300">{isEditing ? 'Zamknij edycję' : 'Notatka PM'}</button></div>
      {isEditing && <div className="border-t p-3 dark:border-gray-800"><textarea value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-24 w-full resize-none rounded-lg bg-gray-50 p-2 text-sm outline-none dark:bg-gray-800 dark:text-white" /><div className="mt-2 flex gap-2"><button onClick={() => { onSaveComment(comment); setIsEditing(false); }} className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700">Zapisz</button><button onClick={() => { setComment(localComment); setIsEditing(false); }} className="flex-1 rounded-lg bg-gray-100 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Anuluj</button></div></div>}
      <DailyIssueDetailsModal issue={issue} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} dateFrom={dateFrom} dateTo={dateTo} baseUrl={baseUrl} />
    </div>
  );
};

export const DailyMain = ({ youtrackBaseUrl }: { youtrackBaseUrl: string }) => {
  const [hubs, setHubs] = useState<DailyHub[]>([]);
  const [selectedHub, setSelectedHub] = useState<DailyHub | null>(null);
  const [editingHub, setEditingHub] = useState<DailyHub | null>(null);
  const [isHubModalOpen, setIsHubModalOpen] = useState(false);
  const initialRange = useMemo(() => getSmartDateRange(), []);
  const [dateFrom, setDateFrom] = useState(() => readLocalJson(appStorageKeys.dailyDateFilters, { from: initialRange.from, to: initialRange.to }).from);
  const [dateTo, setDateTo] = useState(() => readLocalJson(appStorageKeys.dailyDateFilters, { from: initialRange.from, to: initialRange.to }).to);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [showOnlyCommented, setShowOnlyCommented] = useState(false);
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [issueStates, setIssueStates] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => readLocalJson(appStorageKeys.dailyCollapsedSections, { fixed_aktywnosci: false }));
  const [sections, setSections] = useState<DailySection[]>([]);
  const [activityIssues, setActivityIssues] = useState<IssueWithHistory[]>([]);
  const [boardIssues, setBoardIssues] = useState<IssueWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBaseData = async () => {
    setHubs(await pccRepository.getDailyHubs());
    setComments(await pccRepository.getDailyComments());
    setIssueStates(await pccRepository.getDailyIssueStates());
  };

  useEffect(() => { void loadBaseData(); }, []);
  useEffect(() => { writeLocalJson(appStorageKeys.dailyDateFilters, { from: dateFrom, to: dateTo }); }, [dateFrom, dateTo]);
  useEffect(() => { writeLocalJson(appStorageKeys.dailyCollapsedSections, collapsedSections); }, [collapsedSections]);
  useEffect(() => { if (selectedHub) void pccRepository.getDailySections(selectedHub.id).then(setSections); }, [selectedHub]);

  const boardStateFilters = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((section) => { if (!section.respectDates) normalizeStatuses(section.youtrackStatuses).forEach((entry) => set.add(entry)); });
    return Array.from(set);
  }, [sections]);

  const syncYouTrack = async () => {
    if (!selectedHub) return;
    setIsLoading(true);
    setError(null);
    try {
      const [activityData, boardData] = await Promise.all([
        fetchIssuesActivity({ projectName: selectedHub.projectCodes, dateFrom, dateTo, tab: 'Aktywno\u015Bci', tabName: 'Aktywno\u015Bci' }),
        fetchIssuesActivity({ projectName: selectedHub.projectCodes, dateFrom, dateTo, tab: 'Aktywno\u015Bci', customStatuses: boardStateFilters, tabName: 'Aktywno\u015Bci' }),
      ]);
      setActivityIssues(activityData);
      setBoardIssues(boardData);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Nie udało się pobrać danych z YouTrack.');
    } finally {
      setIsLoading(false);
    }
  };

  const combinedIssues = useMemo(() => {
    const merged = new Map<string, IssueWithHistory>();
    boardIssues.forEach((issue) => merged.set(issue.id, issue));
    activityIssues.forEach((issue) => { if (!merged.has(issue.id)) merged.set(issue.id, issue); });
    return Array.from(merged.values());
  }, [activityIssues, boardIssues]);

  const projects = useMemo(() => selectedHub ? selectedHub.projectCodes.split(',').map((entry) => entry.trim().toUpperCase()).filter((code) => combinedIssues.some((issue) => issue.project?.shortName?.toUpperCase() === code)) : [], [combinedIssues, selectedHub]);
  const assignees = useMemo(() => Array.from(new Set(combinedIssues.map((issue) => issue.assignee?.login).filter(Boolean) as string[])).sort(), [combinedIssues]);

  const filterIssues = (items: IssueWithHistory[]) => items.filter((issue) => {
    if (selectedProject && issue.project?.shortName !== selectedProject) return false;
    if (selectedAssignee) {
      if (selectedAssignee === '__unassigned__') { if (issue.assignee) return false; }
      else if (issue.assignee?.login !== selectedAssignee) return false;
    }
    if (showOnlyCommented && !comments[issue.idReadable]) return false;
    return true;
  });

  const filteredActivityIssues = useMemo(() => filterIssues(activityIssues), [activityIssues, comments, selectedAssignee, selectedProject, showOnlyCommented]);
  const filteredBoardIssues = useMemo(() => filterIssues(boardIssues), [boardIssues, comments, selectedAssignee, selectedProject, showOnlyCommented]);
  const activityIds = useMemo(() => {
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59`).getTime();
    return new Set(filteredActivityIssues.filter((issue) => issue.timeline.some((entry) => entry.timestamp >= fromTime && entry.timestamp <= toTime)).map((issue) => issue.idReadable));
  }, [dateFrom, dateTo, filteredActivityIssues]);
  if (!selectedHub) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Daily Stand-up Command Center</h1><p className="mt-1 text-gray-500 dark:text-gray-400">Zarządzaj tablicami dla wielu projektów w jednym miejscu.</p></div><button onClick={() => { setEditingHub(null); setIsHubModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-none"><Plus size={20} /> Nowy Kafel Daily</button></div>
          {hubs.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"><LayoutDashboard size={32} /></div><h3 className="mb-2 text-lg font-bold dark:text-white">Brak zdefiniowanych Kafli (Hubów)</h3><p className="mx-auto mb-6 max-w-sm text-gray-500">Dodaj pierwszy Kafel, aby połączyć wiele projektów YouTrack w jedną tablicę daily.</p><button onClick={() => { setEditingHub(null); setIsHubModalOpen(true); }} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-indigo-600 dark:border-gray-700 dark:bg-gray-800 dark:text-indigo-300">Zacznij tutaj</button></div> : <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{hubs.map((hub) => <div key={hub.id} onClick={() => setSelectedHub(hub)} className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-indigo-200 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-900"><div className="absolute right-0 top-0 flex gap-2 p-4 opacity-0 transition-opacity group-hover:opacity-100"><button onClick={(event) => { event.stopPropagation(); setEditingHub(hub); setIsHubModalOpen(true); }} className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300"><Edit2 size={14} /></button><button onClick={(event) => { event.stopPropagation(); void pccRepository.deleteDailyHub(hub.id).then(loadBaseData); }} className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-900 dark:text-red-300"><Trash2 size={14} /></button></div><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"><LayoutDashboard size={24} /></div><h3 className="mb-2 text-xl font-bold dark:text-white">{hub.name}</h3><p className="mb-4 h-10 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{hub.description || 'Brak opisu.'}</p><div className="flex flex-wrap gap-2 border-t pt-4 dark:border-gray-800">{hub.projectCodes.split(',').map((code) => <span key={code} className="rounded-md bg-gray-50 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-600 dark:bg-gray-800 dark:text-gray-400">{code.trim()}</span>)}</div></div>)}</div>}
        </div>
        <HubModal isOpen={isHubModalOpen} hub={editingHub} onClose={() => setIsHubModalOpen(false)} onSaved={() => { setIsHubModalOpen(false); void loadBaseData(); }} />
      </div>
    );
  }

  const columns = [{ id: 'fixed_aktywnosci', title: 'Aktywno\u015Bci', items: filteredActivityIssues.filter((issue) => activityIds.has(issue.idReadable)), showState: true }, ...sections.map((section) => ({ id: section.id, title: section.name, items: filteredBoardIssues.filter((issue) => { const currentState = typeof issue.state === 'string' ? issue.state : issue.state?.name; const statuses = normalizeStatuses(section.youtrackStatuses); if (!statuses.includes((currentState || '').toLowerCase())) return false; return section.respectDates ? activityIds.has(issue.idReadable) : true; }), showState: false }))];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center gap-4"><button onClick={() => setSelectedHub(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft size={20} /></button><div><h2 className="flex items-center gap-2 text-xl font-bold dark:text-white"><LayoutDashboard size={20} className="text-indigo-500" />{selectedHub.name}</h2><p className="text-xs uppercase text-gray-400">{selectedHub.projectCodes.split(',').join(' • ')}</p></div></div><button onClick={() => { setEditingHub(selectedHub); setIsHubModalOpen(true); }} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-indigo-50 dark:text-gray-300 dark:hover:bg-indigo-900/30"><Edit2 size={14} /> Konfiguracja</button></header>
      <div className="flex flex-col gap-4 border-b bg-white/80 px-6 py-4 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-2 overflow-x-auto py-1">{projects.map((code) => <button key={code} onClick={() => setSelectedProject(selectedProject === code ? null : code)} className={cn('rounded-lg border px-3 py-1.5 text-xs font-black', selectedProject === code ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400')}>{code}</button>)}</div><div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1"><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-[120px] rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><span className="text-xs font-semibold text-gray-400">›</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-[120px] rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></div><button onClick={() => setShowOnlyCommented((current) => !current)} className={cn('flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold', showOnlyCommented ? 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-transparent dark:text-gray-400')}><MessageSquare size={14} /> Notatki</button><button onClick={() => setIsGlobalExpanded((current) => !current)} className={cn('rounded-lg border px-3 py-1.5 text-xs font-bold', isGlobalExpanded ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-transparent dark:text-gray-400')}>{isGlobalExpanded ? 'Zwiń' : 'Rozwiń'}</button><button onClick={() => void syncYouTrack()} disabled={isLoading} className={cn('flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold', isLoading ? 'bg-gray-100 text-gray-400' : 'bg-indigo-600 text-white hover:bg-indigo-700')}>{isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw size={14} />} Pobierz dane</button></div></div><div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">{isLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />Ładowanie aktywności...</span> : error ? <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400"><AlertCircle size={14} />{error}</span> : <button onClick={() => { const range = getSmartDateRange(); setDateFrom(range.from); setDateTo(range.to); }} className="text-[11px] font-semibold hover:text-indigo-600">Inteligentny zakres</button>}</div><div className="flex items-center gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Osoby:</span><div className="flex items-center gap-1.5 overflow-x-auto py-1"><button onClick={() => setSelectedAssignee(null)} className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold', !selectedAssignee ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>WSZYSCY</button>{assignees.map((assignee) => <button key={assignee} onClick={() => setSelectedAssignee(assignee)} className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold', selectedAssignee === assignee ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>{assignee}</button>)}<button onClick={() => setSelectedAssignee('__unassigned__')} className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold', selectedAssignee === '__unassigned__' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>Nieprzypisane</button></div></div></div>
      <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-950/50"><div className="flex min-h-full min-w-max items-start gap-6 px-6 py-6">{columns.map((column) => <div key={column.id} className={cn('relative flex shrink-0 flex-col transition-all duration-300', collapsedSections[column.id] ? 'w-12' : 'w-80')}><div className="sticky top-0 z-10 -mx-2 mb-2 cursor-pointer bg-gray-50/95 px-2 pb-4 backdrop-blur-sm hover:text-indigo-600 dark:bg-gray-950/95" onClick={() => setCollapsedSections((current) => ({ ...current, [column.id]: !current[column.id] }))}><div className="flex items-center gap-2">{collapsedSections[column.id] ? <div className="flex flex-col items-center gap-4 py-2"><ChevronRight size={18} className="text-gray-400" /><h3 className="rotate-180 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-gray-700 [writing-mode:vertical-lr] dark:text-gray-300">{column.title}</h3><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{column.items.length}</span></div> : <><ChevronDown size={18} className="shrink-0 text-gray-400" /><h3 className="truncate text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">{column.title}</h3><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{column.items.length}</span></>}</div></div>{!collapsedSections[column.id] && <div className="space-y-4 pb-4">{column.items.length === 0 ? <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/30 py-12 dark:border-gray-800 dark:bg-gray-900/10"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Brak</p></div> : column.items.map((issue) => { const stored = issueStates[issue.idReadable]; const autoCollapsed = column.showState ? false : activityIds.has(issue.idReadable); const resolved = column.showState ? stored ?? false : isGlobalExpanded ? false : stored ?? autoCollapsed; return <IssueCard key={issue.idReadable} issue={issue} localComment={comments[issue.idReadable] || ''} isCollapsed={resolved} onToggleCollapse={(value) => { setIssueStates((current) => ({ ...current, [issue.idReadable]: value })); void pccRepository.saveDailyIssueState({ issueId: issue.idReadable, isCollapsed: value, updatedAt: new Date().toISOString() }); }} onSaveComment={(value) => { setComments((current) => ({ ...current, [issue.idReadable]: value })); void pccRepository.saveDailyComment({ issueId: issue.idReadable, content: value, lastModified: new Date().toISOString() }); }} onAssigneeFilter={setSelectedAssignee} showState={column.showState} dateFrom={dateFrom} dateTo={dateTo} baseUrl={youtrackBaseUrl} />; })}</div>}</div>)}<div className="flex w-10 shrink-0 flex-col items-center justify-start pt-2"><button onClick={() => { const hasCollapsed = columns.some((column) => column.id !== 'fixed_aktywnosci' && collapsedSections[column.id]); const next: Record<string, boolean> = {}; columns.forEach((column) => { next[column.id] = hasCollapsed ? false : column.id !== 'fixed_aktywnosci'; }); setCollapsedSections(next); }} className="group rounded-lg border border-gray-200 bg-white/50 p-2 text-gray-300 opacity-40 shadow-sm transition-all hover:border-indigo-600 hover:text-indigo-600 hover:opacity-100 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-600">{columns.some((column) => column.id !== 'fixed_aktywnosci' && collapsedSections[column.id]) ? <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /> : <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />}</button></div></div></div>
      <HubModal isOpen={isHubModalOpen} hub={editingHub} onClose={() => setIsHubModalOpen(false)} onSaved={() => { setIsHubModalOpen(false); void loadBaseData(); if (selectedHub) void pccRepository.getDailySections(selectedHub.id).then(setSections); }} />
    </div>
  );
};

