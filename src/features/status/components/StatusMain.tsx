import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Check, Eye, FilePlus2, History, Loader2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import type { Project, StatusAgendaItem, StatusReport, StatusStory } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import { ProjectLinksDropdown } from '../../project-links/components/ProjectLinksMain';
import { useStatusStories } from '../hooks/useStatusStories';
import { buildStatusStoryHtml, escapeHtml, stripRichText } from '../utils/statusUtils';
import { agendaDepth, buildAgendaHtml, createAgendaItem, createStatusId, getReportAgenda, mergeAgenda, moveAgenda, orderAgenda, refreshAgendaSources, statusDraftKey } from '../utils/agendaUtils';
import { StatusAgendaCard } from './StatusAgendaCard';
import { StatusSources } from './StatusSources';
import './status.css';

interface StatusDraft {
  title: string;
  dateFrom: string;
  dateTo: string;
  agenda: StatusAgendaItem[];
  reportId?: string;
}

const defaultTitle = (project: Project, date: string) => {
  const parsed = new Date(`${date}T12:00:00`);
  return `Status projektu ${project.code} — ${format(Number.isNaN(parsed.getTime()) ? new Date() : parsed, 'dd.MM.yyyy')}`;
};
const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';
const headerButtonClass = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';
const headerInputClass = 'h-8 rounded-md border border-gray-200 bg-transparent px-2 text-sm text-gray-900 dark:border-gray-700 dark:text-white';

const readDraft = (project: Project): StatusDraft => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const fallback = { title: defaultTitle(project, today), dateFrom: format(subDays(new Date(), 7), 'yyyy-MM-dd'), dateTo: today, agenda: [] };
  try {
    const raw = localStorage.getItem(statusDraftKey(project.id));
    if (raw) {
      const parsed = JSON.parse(raw) as StatusDraft;
      if (Array.isArray(parsed.agenda) && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateTo)) return parsed;
    }
    const legacy = localStorage.getItem(`status_canvas_draft_${project.id}`);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      return { ...fallback, title: parsed.title || fallback.title, dateFrom: parsed.dateFrom || fallback.dateFrom, dateTo: parsed.dateTo || today,
        agenda: parsed.editorContent?.trim() ? [{ id: createStatusId(), title: 'Dotychczasowa treść statusu', summaryHtml: parsed.editorContent, detailsHtml: '' }] : [] };
    }
  } catch (error) { console.error('Status draft restore failed:', error); }
  return fallback;
};

const StatusWorkspace = ({ project }: { project: Project }) => {
  const { settings } = useProjectContext();
  const [initialDraft] = useState(() => readDraft(project));
  const [title, setTitle] = useState(initialDraft.title);
  const [dateFrom, setDateFrom] = useState(initialDraft.dateFrom);
  const [dateTo, setDateTo] = useState(initialDraft.dateTo);
  const [agenda, setAgenda] = useState(initialDraft.agenda);
  const [reportId, setReportId] = useState(initialDraft.reportId);
  const [reports, setReports] = useState<StatusReport[]>([]);
  const [ready, setReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [meeting, setMeeting] = useState(false);
  const [tab, setTab] = useState<'activity' | 'previous'>('activity');
  const [historyId, setHistoryId] = useState('');
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<StatusReport | StatusStory | null>(null);
  const [selection, setSelection] = useState('');
  const [newItemId, setNewItemId] = useState('');
  const agendaRef = useRef(agenda);
  const alive = useRef(true);
  const historyRef = useRef<HTMLDivElement>(null);
  const { stories, allStories, isLoading, error, warning, loadedRange, refreshStories } = useStatusStories();
  const range = `${dateFrom}/${dateTo}`;
  const sourcesStale = loadedRange !== range;
  const orderedAgenda = useMemo(() => orderAgenda(agenda), [agenda]);
  const included = useMemo(() => new Set(agenda.flatMap(item => item.source ? [item.source.issueReadableId] : [])), [agenda]);
  const historyReport = reports.find(report => report.id === historyId) || reports.find(report => report.id !== reportId) || reports[0];
  const historyAgenda = useMemo(() => historyReport ? getReportAgenda(historyReport) : [], [historyReport]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { agendaRef.current = agenda; }, [agenda]);
  useEffect(() => {
    if (newItemId) document.getElementById(`agenda-${newItemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [newItemId]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const loadReports = useCallback(async () => {
    const saved: StatusReport[] = window.electron?.getStatusReports
      ? await window.electron.getStatusReports(project.id)
      : JSON.parse(localStorage.getItem(`status_reports_${project.id}`) || '[]');
    return saved.filter(report => report.projectId === project.id);
  }, [project.id]);

  useEffect(() => {
    let active = true;
    loadReports().then(saved => {
      if (!active) return;
      setReports(saved);
      if (!localStorage.getItem(statusDraftKey(project.id)) && !localStorage.getItem(`status_canvas_draft_${project.id}`) && saved[0]) setDateFrom(saved[0].dateTo);
    }).catch(err => { if (active) setSaveError(`Nie udało się odczytać historii. ${String(err)}`); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [loadReports, project.id]);

  useEffect(() => {
    if (!ready) return;
    const draft: StatusDraft = { title, dateFrom, dateTo, agenda, reportId };
    const saveDraft = () => {
      try { localStorage.setItem(statusDraftKey(project.id), JSON.stringify(draft)); }
      catch (err) { console.error('Status draft save failed:', err); if (alive.current) setSaveError('Nie udało się zapisać szkicu. Zapisz agendę w historii.'); }
    };
    const timer = window.setTimeout(saveDraft, 350);
    // Flush the latest edit when switching projects or leaving the tab.
    return () => { window.clearTimeout(timer); saveDraft(); };
  }, [agenda, dateFrom, dateTo, project.id, ready, reportId, title]);

  const refreshSources = useCallback(async () => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    const mapped = await refreshStories({ project, dateFrom, dateTo,
      youtrackBaseUrl: settings?.youtrackBaseUrl, youtrackToken: settings?.youtrackToken,
      additionalIssueIds: agendaRef.current.flatMap(item => item.source?.issueId ? [item.source.issueReadableId] : [])
    });
    if (mapped && alive.current) setAgenda(current => refreshAgendaSources(current, mapped));
  }, [dateFrom, dateTo, project, refreshStories, settings?.youtrackBaseUrl, settings?.youtrackToken]);

  const openIssue = (url: string) => {
    if (window.electron?.openExternal) void window.electron.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };
  const addSource = (source: StatusStory) => {
    const existing = agenda.find(item => item.source?.issueReadableId === source.issueReadableId);
    if (existing) { document.getElementById(`agenda-${existing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const item = createAgendaItem(source);
    setNewItemId(item.id);
    setAgenda(current => mergeAgenda(current, [item]));
  };
  const addManual = (text?: string, label?: string) => {
    const item = { ...createAgendaItem(), title: label || 'Nowy temat', summaryHtml: text ? `<p>${escapeHtml(text)}</p>` : '' };
    setNewItemId(item.id);
    setAgenda(current => [...current, item]);
  };
  const saveReport = async () => {
    if (!agenda.length || !dateFrom || !dateTo || dateFrom > dateTo) return null;
    setIsSaving(true);
    setSaveError('');
    const now = new Date().toISOString();
    const report: StatusReport = {
      id: reportId || createStatusId(), projectId: project.id, title: title.trim() || defaultTitle(project, dateTo), dateFrom, dateTo,
      content: buildAgendaHtml(orderedAgenda), agenda: orderedAgenda, stories: orderedAgenda.flatMap(item => item.source ? [item.source] : []),
      version: 2, createdAt: reports.find(item => item.id === reportId)?.createdAt || now, updatedAt: now
    };
    try {
      if (window.electron?.saveStatusReport) {
        const result = await window.electron.saveStatusReport({ projectId: project.id, data: report });
        if (!result.success) throw new Error('Zapis nie został potwierdzony.');
      } else localStorage.setItem(`status_reports_${project.id}`, JSON.stringify([report, ...reports.filter(item => item.id !== report.id)]));
      if (!alive.current) return report;
      setReports(current => [report, ...current.filter(item => item.id !== report.id)].sort((a, b) => b.dateTo.localeCompare(a.dateTo) || b.updatedAt.localeCompare(a.updatedAt)));
      setReportId(report.id);
      setMessage('Zapisano w historii tego projektu.');
      return report;
    } catch (err) { if (alive.current) setSaveError(`Nie udało się zapisać statusu. ${String(err)}`); return null; }
    finally { if (alive.current) setIsSaving(false); }
  };
  const startNext = async () => {
    if (agenda.length && !window.confirm('Zapisać bieżącą agendę w historii i rozpocząć kolejny status?')) return;
    const saved = agenda.length ? await saveReport() : null;
    if ((agenda.length && !saved) || !alive.current) return;
    if (agendaRef.current !== agenda) {
      setMessage('Agenda zmieniła się podczas zapisu. Sprawdź ją przed rozpoczęciem kolejnego statusu.');
      return;
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    const start = saved?.dateTo || reports[0]?.dateTo || dateFrom;
    const end = start > today ? start : today;
    setAgenda([]); setReportId(undefined); setDateFrom(start); setDateTo(end); setTitle(defaultTitle(project, end));
    setHistoryId(saved?.id || ''); setTab('previous'); setMessage('Wybierz tematy do kontynuowania.');
  };
  const carryOver = (items: StatusAgendaItem[]) => {
    if (!historyReport || historyReport.projectId !== project.id) return;
    const refreshed = sourcesStale ? items : refreshAgendaSources(items, allStories);
    setAgenda(current => mergeAgenda(current, refreshed, historyReport));
    if (!agenda.length && !reportId) {
      setDateFrom(historyReport.dateTo);
      const today = format(new Date(), 'yyyy-MM-dd');
      const end = today < historyReport.dateTo ? historyReport.dateTo : today;
      setDateTo(end);
      setTitle(defaultTitle(project, end));
    }
    setMessage('Przeniesiono tematy. Opisy i szczegóły zachowano.');
  };
  const deleteReport = async (report: StatusReport) => {
    if (!window.confirm('Usunąć ten status z historii projektu?')) return;
    try {
      if (window.electron?.deleteStatusReport) await window.electron.deleteStatusReport(report.id);
      else localStorage.setItem(`status_reports_${project.id}`, JSON.stringify(reports.filter(item => item.id !== report.id)));
      if (!alive.current) return;
      setReports(current => current.filter(item => item.id !== report.id));
      setPreview(null);
      if (reportId === report.id) setReportId(undefined);
    } catch (err) { if (alive.current) setSaveError(`Nie udało się usunąć statusu. ${String(err)}`); }
  };

  return <div className="space-y-4">
    <section className="pcc-card-compact status-header space-y-2" aria-label="Ustawienia statusu">
      <div className="flex h-9 min-w-0 items-center gap-2">
        <h2 className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">Status</h2>
        {meeting ? <p title={title} className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
          : <input aria-label="Tytuł statusu" title={title} className={`${headerInputClass} min-w-0 flex-1`} value={title} onChange={event => setTitle(event.target.value)} />}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="status-header-links"><ProjectLinksDropdown project={project} visibleInTab="status" /></div>
          <button type="button" onClick={() => { setMeeting(false); setTab('previous'); }} title="Poprzednie statusy" aria-label="Poprzednie statusy" className={headerButtonClass}><History size={15} /></button>
          <button type="button" onClick={() => setMeeting(!meeting)} title={meeting ? 'Przygotowanie' : 'Widok spotkania'} aria-label={meeting ? 'Przygotowanie' : 'Widok spotkania'} aria-pressed={meeting} className={headerButtonClass}><Eye size={15} /><span className="hidden sm:inline">{meeting ? 'Przygotowanie' : 'Spotkanie'}</span></button>
        </div>
      </div>
      <div className="flex h-9 min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
          {meeting ? <p className="text-xs text-gray-600 dark:text-gray-300">{dateFrom} — {dateTo}</p> : <>
            <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">Od<input type="date" className={`${headerInputClass} w-[132px]`} value={dateFrom} max={dateTo} onChange={event => setDateFrom(event.target.value)} /></label>
            <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">Do<input type="date" className={`${headerInputClass} w-[132px]`} value={dateTo} min={dateFrom} onChange={event => { const next = event.target.value; if (next && title === defaultTitle(project, dateTo)) setTitle(defaultTitle(project, next)); setDateTo(next); }} /></label>
            <button type="button" onClick={() => void refreshSources()} disabled={isLoading || !ready || !dateFrom || !dateTo || dateFrom > dateTo} title="Odśwież źródła" aria-label="Odśwież źródła" className={headerButtonClass}>{isLoading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}</button>
            <button type="button" disabled={isSaving || !ready} onClick={() => void startNext()} title="Nowy status" aria-label="Nowy status" className={headerButtonClass}><FilePlus2 size={15} /></button>
          </>}
        </div>
        <span role="status" title={message || 'Szkic zapisywany automatycznie dla tego projektu'} className="max-w-48 truncate text-xs text-gray-500 dark:text-gray-400">{message || 'Szkic auto'}</span>
        <button type="button" disabled={isSaving || !ready || !agenda.length || !dateFrom || !dateTo || dateFrom > dateTo} onClick={() => void saveReport()} title="Zapisz w historii" aria-label="Zapisz w historii" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">{isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Zapisz</button>
      </div>
    </section>
    {saveError && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{saveError}</p>}

    <div className={`grid grid-cols-1 items-start gap-4 ${meeting ? '' : 'lg:grid-cols-[minmax(0,1fr)_minmax(310px,380px)]'}`}>
      <section className={`min-w-0 ${meeting ? 'status-meeting-document bg-white dark:bg-gray-900' : 'space-y-3'}`}>
        <div className={`flex items-center gap-2 ${meeting ? 'justify-end' : 'justify-between'}`}><h2 className={meeting ? 'sr-only' : 'text-lg font-bold text-gray-900 dark:text-white'}>Agenda spotkania <span className="text-sm font-normal text-gray-500">({agenda.length})</span></h2>
          <button type="button" disabled={!ready} onClick={() => addManual(undefined, meeting ? 'Notatka ze spotkania' : undefined)} className={meeting ? 'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800' : buttonClass}><Plus size={15} />{meeting ? 'Dodaj notatkę' : 'Własny temat'}</button>
        </div>
        {!ready ? <p className="p-6 text-sm text-gray-500">Odczytywanie statusu projektu...</p> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over) setAgenda(current => moveAgenda(current, String(active.id), String(over.id))); }}>
          <SortableContext items={orderedAgenda.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className={meeting ? 'status-meeting-topics' : 'space-y-3'}>{orderedAgenda.map((item, index) => <StatusAgendaCard key={`${item.id}-${meeting}`} item={item} index={index} depth={agendaDepth(item, orderedAgenda)} meeting={meeting} initiallyEditing={newItemId === item.id}
              activityState={item.source ? sourcesStale ? 'stale' : allStories.some(source => source.issueReadableId === item.source?.issueReadableId) ? (allStories.find(source => source.issueReadableId === item.source?.issueReadableId)?.activityCount ? 'active' : 'inactive') : 'missing' : undefined}
              onChange={updated => setAgenda(current => current.map(candidate => candidate.id === updated.id ? updated : candidate))}
              onRemove={() => { setAgenda(current => current.filter(candidate => candidate.id !== item.id)); setMessage('Usunięto temat z agendy. Możesz dodać go ponownie ze źródeł lub historii.'); }}
              onSource={source => { setSelection(''); setPreview(source); }} onOpenIssue={openIssue} />)}</div>
          </SortableContext>
        </DndContext>}
        {ready && !agenda.length && <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm leading-6 text-gray-500 dark:border-gray-700 dark:text-gray-400">Dodaj zadania z aktywności lub przenieś tematy z poprzedniego statusu.<br />Każdy temat ma własny opis, szczegóły i miejsce w agendzie.</div>}
      </section>

      {!meeting && <aside className="pcc-card-compact sticky top-4 max-h-[calc(100vh-2rem)] space-y-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          <button type="button" onClick={() => setTab('activity')} className={`rounded-md px-2 py-2 text-xs font-semibold ${tab === 'activity' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-300' : 'text-gray-500'}`}>Aktywność w okresie</button>
          <button type="button" onClick={() => setTab('previous')} className={`rounded-md px-2 py-2 text-xs font-semibold ${tab === 'previous' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-300' : 'text-gray-500'}`}>Poprzedni status</button>
        </div>
        {tab === 'activity' ? <>
          <div><h3 className="font-bold text-gray-900 dark:text-white">Źródła do statusu</h3><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{project.youtrackQuery || project.code} · {stories.filter(story => !story.isContextOnly).length} zadań z aktywnością</p></div>
          {isLoading && <p role="status" className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-300"><Loader2 size={16} className="animate-spin" />Pobieranie pełnej historii...</p>}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          {warning && <p role="status" className="text-xs leading-5 text-amber-700 dark:text-amber-300">{warning}</p>}
          {sourcesStale && !isLoading && <p className="text-xs text-amber-700 dark:text-amber-300">Kliknij „Odśwież źródła”, aby pobrać aktywność dla wybranego okresu.</p>}
          <StatusSources projectId={project.id} stories={allStories} included={included} stale={sourcesStale || isLoading} onAdd={addSource} onPreview={source => { setSelection(''); setPreview(source); }} onOpenIssue={openIssue} />
          {!isLoading && !error && !sourcesStale && !allStories.length && <p className="py-6 text-center text-sm text-gray-500">Brak zadań dla tego projektu. Tematy możesz przenieść z poprzedniego statusu.</p>}
        </> : <>
          <h3 className="font-bold text-gray-900 dark:text-white">Historia tego projektu</h3>
          {historyReport ? <>
            <select aria-label="Poprzedni status" className={inputClass} value={historyReport.id} onChange={event => { setHistoryId(event.target.value); setSelectedHistoryIds([]); }}>
              {reports.map(report => <option key={report.id} value={report.id}>{report.title} ({report.dateTo})</option>)}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400">Okres: {historyReport.dateFrom} — {historyReport.dateTo}</p>
            {!historyReport.agenda && <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">Starszy raport zachowuje wspólną treść. Przenieś ją w całości lub skopiuj wybrany fragment z podglądu.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => carryOver(historyAgenda)} className={buttonClass}>Przenieś wszystkie</button>
              <button type="button" onClick={() => { setSelection(''); setPreview(historyReport); }} className={buttonClass}><Eye size={14} />Podgląd</button>
            </div>
            <div className="space-y-2">{historyAgenda.map(item => <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <input type="checkbox" checked={selectedHistoryIds.includes(item.id)} onChange={event => setSelectedHistoryIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} className="mt-1" />
              <span className="min-w-0"><span className="block text-xs font-bold text-indigo-600 dark:text-indigo-300">{item.source?.issueReadableId || 'Własna treść'}</span><span className="mt-1 block text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</span><span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{stripRichText(item.summaryHtml).slice(0, 160)}</span>{item.source && included.has(item.source.issueReadableId) && <span className="mt-1 block text-xs font-semibold text-emerald-600">Już w agendzie</span>}</span>
            </label>)}</div>
            <button type="button" disabled={!selectedHistoryIds.length} onClick={() => { carryOver(historyAgenda.filter(item => selectedHistoryIds.includes(item.id))); setSelectedHistoryIds([]); }} className={`${buttonClass} w-full`}><Check size={15} />Przenieś wybrane ({selectedHistoryIds.length})</button>
          </> : <p className="py-6 text-center text-sm text-gray-500">Ten projekt nie ma jeszcze zapisanych statusów.</p>}
        </>}
      </aside>}
    </div>

    {preview && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={preview.title} className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700"><div><p className="text-xs font-semibold text-indigo-500">{'projectId' in preview ? 'Archiwalny status tego projektu' : 'Materiał źródłowy'}</p><h3 className="mt-1 font-bold text-gray-900 dark:text-white">{preview.title}</h3></div><button type="button" onClick={() => setPreview(null)} className={buttonClass} aria-label="Zamknij podgląd"><X size={17} /></button></div>
        <div ref={historyRef} onMouseUp={() => { const selected = window.getSelection(); if (selected?.anchorNode && selected.focusNode && historyRef.current?.contains(selected.anchorNode) && historyRef.current.contains(selected.focusNode)) setSelection(selected.toString().trim()); }} className="status-rich-text prose max-w-none overflow-y-auto p-5 text-gray-900 dark:prose-invert dark:text-gray-100" dangerouslySetInnerHTML={{ __html: 'projectId' in preview ? preview.content : buildStatusStoryHtml(preview) }} />
        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <button type="button" disabled={!selection} onClick={() => { addManual(selection, `Fragment: ${preview.title}`); setPreview(null); }} className={buttonClass}>Dodaj zaznaczony fragment</button>
          {'projectId' in preview && <button type="button" onClick={() => void deleteReport(preview)} className={`${buttonClass} text-red-600`}><Trash2 size={15} />Usuń z historii</button>}
        </div>
      </div>
    </div>}
  </div>;
};

// Remount every project to isolate drafts, editors and pending requests.
export const StatusMain = ({ project }: { project: Project }) => <StatusWorkspace key={project.id} project={project} />;
