import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Copy, Eye, ExternalLink, FilePlus2, FileText, Loader2, RefreshCw, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { format, subDays } from 'date-fns';
import type { Project, StatusReport } from '@/types/domain';
import { pccRepository } from '@/repositories/pccRepository';
import { appStorageKeys, readLocalJson, writeLocalJson } from '@/lib/storage';
import { createClientId, cn } from '@/lib/utils';
import { Editor } from '@/components/Editor';
import { useStatusStories } from '@/features/status/hooks/useStatusStories';
import { buildDefaultStatusTitle, buildStatusStoryHtml, escapeHtml, stripRichText } from '@/features/status/utils/statusUtils';
import { ProjectLinksDropdown } from '@/components/ProjectLinksDropdown';
import { DailyIssueDetailsModal } from '@/features/daily/components/DailyIssueDetailsModal';

export const StatusMain = ({ project, youtrackBaseUrl }: { project: Project; youtrackBaseUrl: string }) => {
  const { stories, issues, isLoading, error, refreshStories, setStories, setIssues } = useStatusStories();
  const [reports, setReports] = useState<StatusReport[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [title, setTitle] = useState(buildDefaultStatusTitle(project.code, format(new Date(), 'yyyy-MM-dd')));
  const [editorContent, setEditorContent] = useState('');
  const [activePreview, setActivePreview] = useState<StatusReport | null>(null);
  const [activeIssueDetailsId, setActiveIssueDetailsId] = useState<string | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [includedSourceIds, setIncludedSourceIds] = useState<Record<string, boolean>>({});
  const [removedSourceIds, setRemovedSourceIds] = useState<Record<string, boolean>>({});
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorApiRef = useRef<any>(null);

  const loadReports = async () => {
    setIsHistoryLoading(true);
    const saved = await pccRepository.getStatusReports(project.id);
    setReports(saved);
    setIsHistoryLoading(false);
    return saved;
  };

  useEffect(() => {
    setReports([]); setStories([]); setIssues([]); setEditorContent(''); setSelectionText(''); setActiveIssueDetailsId(null); setRemovedSourceIds({}); setTitle(buildDefaultStatusTitle(project.code, format(new Date(), 'yyyy-MM-dd')));
    setIncludedSourceIds(readLocalJson(appStorageKeys.statusIncludedSources(project.id), {}));
    void loadReports().then((savedReports) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const latest = savedReports[0];
      const fallbackDateFrom = latest?.dateTo || format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const rawDraft = readLocalJson<{ title?: string; dateFrom?: string; dateTo?: string; editorContent?: string; removedSourceIds?: Record<string, boolean> } | null>(appStorageKeys.statusDraft(project.id), null);
      if (rawDraft) {
        setDateFrom(fallbackDateFrom);
        setDateTo(today);
        setTitle(rawDraft.title?.trim() || buildDefaultStatusTitle(project.code, today));
        setEditorContent(rawDraft.editorContent || '');
        setRemovedSourceIds(rawDraft.removedSourceIds || {});
        return;
      }
      setDateFrom(fallbackDateFrom);
      setDateTo(today);
      setTitle(readLocalJson(appStorageKeys.statusTitle(project.id), buildDefaultStatusTitle(project.code, today)));
    });
  }, [project.code, project.id, setIssues, setStories]);

  useEffect(() => { writeLocalJson(appStorageKeys.statusIncludedSources(project.id), includedSourceIds); }, [includedSourceIds, project.id]);
  useEffect(() => {
    setIsDraftSaving(true);
    const timer = window.setTimeout(() => {
      writeLocalJson(appStorageKeys.statusDraft(project.id), { title, dateFrom, dateTo, editorContent, removedSourceIds, updatedAt: new Date().toISOString() });
      writeLocalJson(appStorageKeys.statusTitle(project.id), title.trim() || buildDefaultStatusTitle(project.code, dateTo));
      setIsDraftSaving(false);
      setIsDraftSaved(true);
      window.setTimeout(() => setIsDraftSaved(false), 2200);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, editorContent, project.code, project.id, removedSourceIds, title]);

  useEffect(() => {
    if (!activePreview) return;
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || !previewRef.current || selection.rangeCount === 0) return setSelectionText('');
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
      setSelectionText(element && previewRef.current.contains(element) ? selection.toString().trim() : '');
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [activePreview]);
  const refreshSources = async () => {
    const dailyComments = await pccRepository.getDailyComments();
    await refreshStories({ project, dateFrom, dateTo, dailyComments, youtrackBaseUrl });
  };

  const saveReport = async () => {
    if (!editorContent.trim()) return;
    const now = new Date().toISOString();
    const report: StatusReport = { id: createClientId('status'), projectId: project.id, title: title.trim() || buildDefaultStatusTitle(project.code, dateTo), dateFrom, dateTo, content: editorContent, stories, createdAt: now, updatedAt: now };
    setIsSaving(true);
    await pccRepository.saveStatusReport(report);
    await loadReports();
    writeLocalJson(appStorageKeys.statusDraft(project.id), null);
    setIsSaving(false);
  };

  const deleteReport = async (reportId: string) => {
    if (!window.confirm('Usunąć zapisany raport statusowy?')) return;
    await pccRepository.deleteStatusReport(reportId);
    await loadReports();
    if (activePreview?.id === reportId) setActivePreview(null);
  };

  const appendHtmlToCanvas = (html: string) => {
    const editor = editorApiRef.current;
    if (editor) {
      editor.chain().focus().insertContent(html).run();
      return;
    }
    setEditorContent((current) => `${current}${html}`);
  };

  const insertStory = (storyId: string) => {
    const story = stories.find((item) => item.id === storyId);
    if (!story) return;
    appendHtmlToCanvas(buildStatusStoryHtml(story));
  };

  const removeStory = (sourceId: string, issueReadableId: string) => {
    const parser = new DOMParser();
    const fragment = parser.parseFromString(editorContent, 'text/html');
    const headings = Array.from(fragment.querySelectorAll('h2'));
    const heading = headings.find((entry) => (entry.textContent || '').trim().startsWith(issueReadableId));
    if (!heading) return setRemovedSourceIds((current) => ({ ...current, [sourceId]: true }));
    let current: Element | null = heading;
    while (current) {
      const nextElement: Element | null = current.nextElementSibling;
      current.remove();
      if (!nextElement || nextElement.tagName.toLowerCase() === 'h2') break;
      current = nextElement;
    }
    setEditorContent(fragment.body.innerHTML.trim());
    setRemovedSourceIds((current) => ({ ...current, [sourceId]: true }));
  };

  const restoreStory = (storyId: string) => {
    const story = stories.find((item) => item.id === storyId);
    if (!story) return;
    appendHtmlToCanvas(buildStatusStoryHtml(story));
    setRemovedSourceIds((current) => ({ ...current, [storyId]: false }));
  };

  const sourceItems = useMemo(() => stories.map((story) => ({ id: story.id, issueReadableId: story.issueReadableId, issueUrl: story.issueUrl, title: story.title, stateName: story.stateName || 'Brak statusu', parentIssueReadableId: story.parentIssueReadableId || null })), [stories]);
  const issuesPresentInCanvas = useMemo(() => {
    const parser = new DOMParser();
    const fragment = parser.parseFromString(editorContent || '', 'text/html');
    const ids = new Set<string>();
    fragment.querySelectorAll('section[data-issue-id]').forEach((section) => { const issueId = section.getAttribute('data-issue-id'); if (issueId) ids.add(issueId); });
    fragment.querySelectorAll('h2').forEach((heading) => { const match = (heading.textContent || '').trim().match(/^([A-Z][A-Z0-9]+-\d+)/); if (match?.[1]) ids.add(match[1]); });
    return ids;
  }, [editorContent]);

  const activeIssueDetails = useMemo(() => issues.find((issue) => issue.id === activeIssueDetailsId || issue.idReadable === activeIssueDetailsId) || null, [activeIssueDetailsId, issues]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7.4fr)_minmax(300px,2.6fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Spotkanie statusowe</h2><ProjectLinksDropdown project={project} visibleInTab="status" /></div>
              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[repeat(2,minmax(140px,180px))_minmax(260px,1fr)_auto_auto]">
                <label className="space-y-1"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Data od</span><input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Data do</span><input type="date" value={dateTo} min={dateFrom} onChange={(event) => { const nextDate = event.target.value; const currentDefault = buildDefaultStatusTitle(project.code, dateTo); const shouldUpdateTitle = !title.trim() || title.trim() === currentDefault; setDateTo(nextDate); if (shouldUpdateTitle) setTitle(buildDefaultStatusTitle(project.code, nextDate)); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tytuł statusu</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
                <button type="button" onClick={() => void refreshSources()} disabled={isLoading} title="Odśwież źródła z YouTrack" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">{isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
                <button type="button" onClick={() => void saveReport()} disabled={isSaving || !editorContent.trim()} title="Zapisz w historii" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">{isDraftSaving && <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Loader2 size={14} className="animate-spin" /></span>}{!isDraftSaving && isDraftSaved && <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><CheckCircle2 size={14} /></span>}{error && <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"><AlertCircle size={14} />{error}</span>}{!isLoading && !sourceItems.length && <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><RotateCcw size={14} />YouTrack nie odświeża się automatycznie po wejściu. Użyj przycisku odświeżania.</span>}</div>
          </section>
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800"><Editor content={editorContent} onChange={setEditorContent} onEditorReady={(editor) => { editorApiRef.current = editor; }} placeholder="Wprowadź narrację statusową dla klienta..." openLinksOnClick minHeight={520} /></section>
        </div>
        <aside className="sticky top-4 self-start rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800 xl:max-h-[calc(100vh-2rem)] xl:min-h-0 xl:overflow-hidden"><div className="min-h-0 overflow-y-auto pr-1"><div className="mb-4 flex items-start justify-between gap-3"><button type="button" onClick={() => setIsSourcesCollapsed((current) => !current)} className="flex flex-1 items-start justify-between gap-3 text-left"><div className="min-w-0"><div className="flex items-center gap-2">{isSourcesCollapsed ? <ChevronRight size={16} className="shrink-0 text-gray-400" /> : <ChevronDown size={16} className="shrink-0 text-gray-400" />}<h3 className="text-lg font-bold text-gray-900 dark:text-white">Źródła do statusu</h3></div></div><span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">{sourceItems.length}</span></button></div>{!isSourcesCollapsed && <div className="space-y-3">{sourceItems.map((story) => { const isIncluded = !!includedSourceIds[story.id]; const isRemoved = !!removedSourceIds[story.id]; const isPresentInCanvas = issuesPresentInCanvas.has(story.issueReadableId); return <article key={story.id} className={cn('relative rounded-xl border px-3 py-2.5 transition-all', story.parentIssueReadableId ? 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/20' : 'border-sky-200 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/20', isIncluded && 'opacity-45 saturate-50')}><div className="space-y-2"><div className="min-w-0"><a href={story.issueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-black text-sky-700 hover:underline dark:text-sky-300">{story.issueReadableId}<ExternalLink size={12} /></a><button type="button" onClick={() => setActiveIssueDetailsId(story.issueReadableId)} className="mt-1 block text-left text-[12px] font-semibold leading-4 text-gray-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">{story.title}</button></div><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => insertStory(story.id)} className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-800"><FilePlus2 size={14} /></button><span className={cn('rounded-lg border p-1.5', isPresentInCanvas ? 'border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' : 'border-gray-200 bg-white text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600')}><FileText size={14} /></span>{isRemoved ? <button type="button" onClick={() => restoreStory(story.id)} className="rounded-lg border border-amber-200 bg-amber-100 p-1.5 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><RotateCcw size={14} /></button> : <button type="button" onClick={() => removeStory(story.id, story.issueReadableId)} className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:bg-gray-800"><Trash2 size={14} /></button>}<button type="button" onClick={() => setIncludedSourceIds((current) => ({ ...current, [story.id]: !current[story.id] }))} className={cn('rounded-lg border p-1.5', isIncluded ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'border-gray-200 bg-white text-gray-400 hover:border-emerald-300 hover:text-emerald-600 dark:border-gray-700 dark:bg-gray-800')}><CheckCircle2 size={14} /></button><span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">{story.stateName}</span></div></div></article>; })}{!sourceItems.length && !isLoading && <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Brak aktywności i notatek dla wybranego zakresu dat.</div>}</div>}</div></aside>
      </div>
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-gray-900 dark:text-white">Historia statusów</h3><p className="text-sm text-gray-500 dark:text-gray-400">Podgląd poprzednich spotkań i kopiowanie do bieżącej wersji.</p></div><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{reports.length}</span></div>{isHistoryLoading ? <div className="flex flex-col items-center justify-center py-12 text-gray-500"><Loader2 className="mb-3 animate-spin" />Ładowanie historii...</div> : <div className="space-y-3">{reports.map((report) => <div key={report.id} className="relative rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0 space-y-1"><p className="truncate font-semibold text-gray-900 dark:text-white">{report.title}</p><p className="text-xs text-gray-500 dark:text-gray-400">{report.dateFrom} › {report.dateTo}</p><p className="pt-2 text-sm text-gray-600 line-clamp-3 dark:text-gray-300">{stripRichText(report.content).slice(0, 160) || 'Brak treści podglądu.'}</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => { setActivePreview(report); setSelectionText(''); }} className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-800"><Eye size={15} /></button><button type="button" onClick={() => void deleteReport(report.id)} className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-red-600 dark:hover:bg-gray-800"><Trash2 size={15} /></button></div></div></div>)}{!reports.length && <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center dark:border-gray-700"><FileText className="mx-auto mb-3 text-gray-300 dark:text-gray-600" /><p className="text-sm text-gray-500 dark:text-gray-400">Brak zapisanych raportów statusowych.</p></div>}</div>}</section>
      {activeIssueDetails && <DailyIssueDetailsModal issue={activeIssueDetails} isOpen={!!activeIssueDetails} onClose={() => setActiveIssueDetailsId(null)} dateFrom={dateFrom} dateTo={dateTo} baseUrl={youtrackBaseUrl} />}
      {activePreview && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"><div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Archiwalny status</p><h3 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{activePreview.title}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Zakres: {activePreview.dateFrom} › {activePreview.dateTo}</p></div><button type="button" onClick={() => { setActivePreview(null); setSelectionText(''); }} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button></div><div className="grid max-h-[calc(90vh-76px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="overflow-y-auto p-6"><div ref={previewRef} className="prose max-w-none dark:prose-invert prose-a:text-indigo-600" dangerouslySetInnerHTML={{ __html: activePreview.content }} /></div><div className="space-y-4 border-l border-gray-200 bg-gray-50/70 p-6 dark:border-gray-800 dark:bg-gray-950/40"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Akcje</p><div className="space-y-2"><button type="button" onClick={() => { if (selectionText.trim()) appendHtmlToCanvas(`<blockquote><p>${escapeHtml(selectionText)}</p><p><strong>Źródło:</strong> ${escapeHtml(activePreview.title)}</p></blockquote>`); }} disabled={!selectionText} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"><Copy size={16} />Kopiuj zaznaczenie</button><button type="button" onClick={() => appendHtmlToCanvas(`<hr /><h2>${escapeHtml(activePreview.title)}</h2>${activePreview.content}`)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"><FileText size={16} />Wstaw cały raport</button></div></div><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Zaznaczenie</p><div className="min-h-[160px] whitespace-pre-wrap rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">{selectionText || 'Zaznacz fragment w podglądzie raportu, a potem wstaw go do bieżącego statusu.'}</div></div></div></div></div></div>}
    </div>
  );
};

