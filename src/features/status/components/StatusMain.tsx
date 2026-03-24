import { useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X
} from 'lucide-react';
import type { Project, StatusReport } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import { Editor } from '../../meeting-notes/components/Editor';
import { useStatusStories } from '../hooks/useStatusStories';
import { buildStatusEditorHtml, buildStatusStoryHtml, escapeHtml, stripRichText } from '../utils/statusUtils';
import { ProjectLinksDropdown } from '../../project-links/components/ProjectLinksMain';

interface StatusMainProps {
  project: Project;
}

interface StatusDraft {
  title: string;
  dateFrom: string;
  dateTo: string;
  editorContent: string;
  removedSourceIds: Record<string, boolean>;
  updatedAt: string;
}

const buildDefaultTitle = (projectCode: string, dateTo: string) =>
  `Status projektu ${projectCode} - ${format(new Date(`${dateTo}T00:00:00`), 'dd.MM.yyyy')}`;

const createReportId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `status_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const getStatusDraftKey = (projectId: string) => `status_canvas_draft_${projectId}`;
const getStatusTitleKey = (projectId: string) => `status_title_${projectId}`;

export const StatusMain = ({ project }: StatusMainProps) => {
  const { settings } = useProjectContext();
  const { stories, isLoading, error, refreshStories, setStories } = useStatusStories();
  const [reports, setReports] = useState<StatusReport[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [title, setTitle] = useState(buildDefaultTitle(project.code, format(new Date(), 'yyyy-MM-dd')));
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activePreview, setActivePreview] = useState<StatusReport | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [includedSourceIds, setIncludedSourceIds] = useState<Record<string, boolean>>({});
  const [removedSourceIds, setRemovedSourceIds] = useState<Record<string, boolean>>({});
  const [hasDraftRestored, setHasDraftRestored] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [activeRefreshAction, setActiveRefreshAction] = useState<'sources' | 'canvas' | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const loadReports = async () => {
    setIsHistoryLoading(true);
    try {
      if (window.electron?.getStatusReports) {
        const saved = await window.electron.getStatusReports(project.id);
        setReports(saved || []);
        return saved || [];
      }

      const local = localStorage.getItem(`status_reports_${project.id}`);
      const parsed = local ? JSON.parse(local) : [];
      setReports(parsed);
      return parsed;
    } catch (loadError) {
      console.error('Status history load failed:', loadError);
      setReports([]);
      return [];
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    setReports([]);
    setStories([]);
    setEditorContent('');
    setSelectionText('');
    setIsDirty(false);
    setIsInitialized(false);
    setHasDraftRestored(false);
    setIsDraftSaving(false);
    setIsDraftSaved(false);
    setIsSourcesCollapsed(false);
    setRemovedSourceIds({});
    setTitle(buildDefaultTitle(project.code, format(new Date(), 'yyyy-MM-dd')));

    try {
      const savedIncluded = localStorage.getItem(`status_included_sources_${project.id}`);
      setIncludedSourceIds(savedIncluded ? JSON.parse(savedIncluded) : {});
    } catch {
      setIncludedSourceIds({});
    }
  }, [project.id, project.code, setStories]);

  useEffect(() => {
    localStorage.setItem(`status_included_sources_${project.id}`, JSON.stringify(includedSourceIds));
  }, [includedSourceIds, project.id]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const savedReports = await loadReports();
      if (!active) return;

      const today = format(new Date(), 'yyyy-MM-dd');
      const latest = savedReports[0];
      const fallbackDateTo = today;
      const fallbackDateFrom = latest?.dateTo || format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const savedTitle = localStorage.getItem(getStatusTitleKey(project.id));
      const fallbackTitle = savedTitle?.trim() || buildDefaultTitle(project.code, today);

      try {
        const rawDraft = localStorage.getItem(getStatusDraftKey(project.id));
        if (rawDraft) {
          const draft = JSON.parse(rawDraft) as Partial<StatusDraft>;
          const draftDateTo = draft.dateTo || fallbackDateTo;
          const draftDateFrom = draft.dateFrom || fallbackDateFrom;

          setDateTo(draftDateTo);
          setDateFrom(draftDateFrom);
          setTitle(draft.title?.trim() || buildDefaultTitle(project.code, draftDateTo));
          setEditorContent(draft.editorContent || '');
          setRemovedSourceIds(draft.removedSourceIds || {});
          setIsDirty(!!draft.editorContent?.trim());
          setIsDraftSaved(!!draft.editorContent || !!draft.title);
          setHasDraftRestored(true);
          setIsInitialized(true);
          return;
        }
      } catch (draftError) {
        console.error('Status draft restore failed:', draftError);
      }

      setDateTo(fallbackDateTo);
      setDateFrom(fallbackDateFrom);
      setTitle(fallbackTitle);
      setIsInitialized(true);
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [project.id, project.code]);

  const loadSources = async () => refreshStories({
    project,
    dateFrom,
    dateTo,
    youtrackBaseUrl: settings?.youtrackBaseUrl,
    youtrackToken: settings?.youtrackToken
  });

  const regenerateCanvas = async (replaceExisting: boolean) => {
    const fetchedStories = await loadSources();

    if (!fetchedStories.length && !replaceExisting) {
      return;
    }

    if (replaceExisting || !editorContent.trim()) {
      const nextTitle = title.trim() || buildDefaultTitle(project.code, dateTo);
      setEditorContent(buildStatusEditorHtml(project.code, nextTitle, dateFrom, dateTo, fetchedStories));
      setRemovedSourceIds({});
      setIsDirty(false);
    }
  };

  const refreshSourcesOnly = async () => {
    await loadSources();
  };

  useEffect(() => {
    if (isInitialized) {
      if (hasDraftRestored) {
        void refreshSourcesOnly();
      } else {
        void regenerateCanvas(true);
      }
    }
  }, [hasDraftRestored, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    setIsDraftSaving(true);
    setIsDraftSaved(false);

    let savedIndicatorTimer: number | undefined;

    const saveTimer = window.setTimeout(() => {
      const draft: StatusDraft = {
        title,
        dateFrom,
        dateTo,
        editorContent,
        removedSourceIds,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(getStatusDraftKey(project.id), JSON.stringify(draft));
      setIsDraftSaving(false);
      setIsDraftSaved(true);
      savedIndicatorTimer = window.setTimeout(() => {
        setIsDraftSaved(false);
      }, 2200);
    }, 350);

    return () => {
      window.clearTimeout(saveTimer);
      if (savedIndicatorTimer) {
        window.clearTimeout(savedIndicatorTimer);
      }
    };
  }, [dateFrom, dateTo, editorContent, isInitialized, project.id, removedSourceIds, title]);

  useEffect(() => {
    localStorage.setItem(getStatusTitleKey(project.id), title.trim() || buildDefaultTitle(project.code, dateTo));
  }, [dateTo, project.code, project.id, title]);

  useEffect(() => {
    if (!activePreview) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || !previewRef.current || selection.rangeCount === 0) {
        setSelectionText('');
        return;
      }

      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
      setSelectionText(element && previewRef.current.contains(element) ? selection.toString().trim() : '');
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [activePreview]);

  const handleManualRefresh = async () => {
    if (isDirty && editorContent.trim() && !window.confirm('Odświeżenie nadpisze bieżącą kanwę. Kontynuować?')) {
      return;
    }
    setActiveRefreshAction('canvas');
    try {
      await regenerateCanvas(true);
    } finally {
      setActiveRefreshAction(null);
    }
  };

  const handleRefreshSourcesOnly = async () => {
    setActiveRefreshAction('sources');
    try {
      await refreshSourcesOnly();
    } finally {
      setActiveRefreshAction(null);
    }
  };

  const saveReportsLocal = (nextReports: StatusReport[]) => {
    localStorage.setItem(`status_reports_${project.id}`, JSON.stringify(nextReports));
  };

  const handleSaveReport = async () => {
    if (!editorContent.trim()) return;

    const now = new Date().toISOString();
    const report: StatusReport = {
      id: createReportId(),
      projectId: project.id,
      title: title.trim() || buildDefaultTitle(project.code, dateTo),
      dateFrom,
      dateTo,
      content: editorContent,
      stories,
      createdAt: now,
      updatedAt: now
    };

    setIsSaving(true);
    try {
      if (window.electron?.saveStatusReport) {
        await window.electron.saveStatusReport({ projectId: project.id, data: report });
      } else {
        saveReportsLocal([report, ...reports]);
      }
      await loadReports();
      setIsDirty(false);
      localStorage.removeItem(getStatusDraftKey(project.id));
      setIsDraftSaved(false);
    } catch (saveError) {
      console.error('Status history save failed:', saveError);
      alert('Nie udało się zapisać historii statusu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Usunąć zapisany raport statusowy?')) return;

    try {
      if (window.electron?.deleteStatusReport) {
        await window.electron.deleteStatusReport(reportId);
      } else {
        saveReportsLocal(reports.filter(report => report.id !== reportId));
      }
      await loadReports();
      if (activePreview?.id === reportId) {
        setActivePreview(null);
        setSelectionText('');
      }
    } catch (deleteError) {
      console.error('Status history delete failed:', deleteError);
      alert('Nie udało się usunąć raportu.');
    }
  };

  const openIssue = async (url: string) => {
    if (window.electron?.openExternal) {
      await window.electron.openExternal(url);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const appendHtmlToCanvas = (html: string) => {
    setEditorContent(prev => `${prev}${html}`);
    setIsDirty(true);
  };

  const toggleIncludedSource = (sourceId: string) => {
    setIncludedSourceIds(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId]
    }));
  };

  const removeStoryFromCanvas = (sourceId: string, issueReadableId: string) => {
    if (typeof window === 'undefined') return;

    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(editorContent, 'text/html');
    const headings = Array.from(documentFragment.querySelectorAll('h2'));
    const targetHeading = headings.find((heading) => {
      const text = heading.textContent?.trim() || '';
      return text.startsWith(issueReadableId);
    });

    if (!targetHeading) {
      setRemovedSourceIds(prev => ({
        ...prev,
        [sourceId]: true
      }));
      return;
    }

    let current: Element | null = targetHeading;
    while (current) {
      const next = current.nextElementSibling;
      current.remove();
      if (!next || next.tagName.toLowerCase() === 'h2') {
        break;
      }
      current = next;
    }

    setEditorContent(documentFragment.body.innerHTML.trim());
    setRemovedSourceIds(prev => ({
      ...prev,
      [sourceId]: true
    }));
    setIsDirty(true);
  };

  const restoreStoryToCanvas = (storyId: string) => {
    const story = stories.find(item => item.id === storyId);
    if (!story) return;

    appendHtmlToCanvas(buildStatusStoryHtml(story));
    setRemovedSourceIds(prev => ({
      ...prev,
      [storyId]: false
    }));
  };

  const scrollToStoryInCanvas = (issueReadableId: string) => {
    const editorRoot = editorContainerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
    if (!editorRoot) return;

    const escapedIssueId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(issueReadableId) : issueReadableId;
    const section = editorRoot.querySelector(`section[data-issue-id="${escapedIssueId}"]`) as HTMLElement | null;

    const highlightTarget = (element: HTMLElement) => {
      const previousTransition = element.style.transition;
      const previousBoxShadow = element.style.boxShadow;
      const previousBackground = element.style.backgroundColor;

      element.style.transition = 'box-shadow 180ms ease, background-color 180ms ease';
      element.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.45)';
      element.style.backgroundColor = 'rgba(224, 231, 255, 0.55)';
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      window.setTimeout(() => {
        element.style.boxShadow = previousBoxShadow;
        element.style.backgroundColor = previousBackground;
        element.style.transition = previousTransition;
      }, 1800);
    };

    if (section) {
      highlightTarget(section);
      return;
    }

    const candidates = Array.from(
      editorRoot.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, div')
    ) as HTMLElement[];

    const directMatch = candidates.find((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      return text.startsWith(issueReadableId) || text.includes(` ${issueReadableId} `) || text.includes(issueReadableId);
    });

    if (directMatch) {
      highlightTarget(directMatch);
      return;
    }

    const walker = document.createTreeWalker(editorRoot, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();

    while (currentNode) {
      const text = currentNode.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (text.includes(issueReadableId)) {
        const parentElement = currentNode.parentElement?.closest('h1, h2, h3, h4, h5, h6, p, li, blockquote, div') as HTMLElement | null;
        if (parentElement) {
          highlightTarget(parentElement);
          return;
        }
      }

      currentNode = walker.nextNode();
    }
  };

  const sourceItems = useMemo(
    () => stories.map((story) => ({
      id: story.id,
      issueReadableId: story.issueReadableId,
      issueUrl: story.issueUrl,
      title: story.title,
      stateName: story.stateName || 'Brak statusu',
      parentIssueReadableId: story.parentIssueReadableId || null,
      childIssueReadableIds: story.childIssueReadableIds || [],
      isSubtask: !!story.parentIssueReadableId
    })),
    [stories]
  );

  const sourceChildrenMap = useMemo(() => {
    const childrenMap = new Map<string, typeof sourceItems>();

    sourceItems.forEach((item) => {
      if (!item.parentIssueReadableId) {
        return;
      }

      const currentChildren = childrenMap.get(item.parentIssueReadableId) || [];
      currentChildren.push(item);
      childrenMap.set(item.parentIssueReadableId, currentChildren);
    });

    return childrenMap;
  }, [sourceItems]);

  const issuesPresentInCanvas = useMemo(() => {
    if (typeof window === 'undefined' || !editorContent.trim()) {
      return new Set<string>();
    }

    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(editorContent, 'text/html');
    const issueIds = new Set<string>();

    documentFragment.querySelectorAll('section[data-issue-id]').forEach((section) => {
      const issueId = section.getAttribute('data-issue-id');
      if (issueId) {
        issueIds.add(issueId);
      }
    });

    documentFragment.querySelectorAll('h2').forEach((heading) => {
      const text = heading.textContent?.trim() || '';
      const match = text.match(/^([A-Z][A-Z0-9]+-\d+)/);
      if (match?.[1]) {
        issueIds.add(match[1]);
      }
    });

    return issueIds;
  }, [editorContent]);

  const renderSourceCard = (
    story: typeof sourceItems[number],
    options?: {
      childStories?: typeof sourceItems;
    }
  ) => {
    const isIncluded = !!includedSourceIds[story.id];
    const isRemoved = !!removedSourceIds[story.id];
    const isPresentInCanvas = issuesPresentInCanvas.has(story.issueReadableId);
    const childStories = options?.childStories || [];
    const shouldRenderAsParent = childStories.length > 0;

    return (
      <article
        key={story.id}
        className={`relative rounded-xl px-3 py-2.5 transition-all ${
          story.parentIssueReadableId && !shouldRenderAsParent
            ? 'border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/20'
            : childStories.length
              ? 'border border-indigo-300 dark:border-indigo-700 bg-white/95 dark:bg-indigo-950/20 shadow-sm'
              : 'border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/20'
        } ${isIncluded ? 'opacity-45 saturate-50' : ''}`}
      >
        {story.parentIssueReadableId && !shouldRenderAsParent && (
          <div className="mb-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
            Sub:{' '}
            {(() => {
              const parentStory = sourceItems.find((item) => item.issueReadableId === story.parentIssueReadableId);
              const parentLabel = parentStory?.title?.trim()
                ? `${story.parentIssueReadableId} - ${parentStory.title}`
                : story.parentIssueReadableId;

              return (
                <button
                  type="button"
                  onClick={() => {
                    if (parentStory) {
                      void openIssue(parentStory.issueUrl);
                    }
                  }}
                  className="text-left underline decoration-dotted underline-offset-2 whitespace-normal break-words"
                  title={parentLabel}
                >
                  {parentLabel}
                </button>
              );
            })()}
          </div>
        )}
        <div className="space-y-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => openIssue(story.issueUrl)}
              className={`text-[11px] font-black hover:underline inline-flex items-center gap-1 ${
                story.parentIssueReadableId && !shouldRenderAsParent ? 'text-amber-700 dark:text-amber-300' : 'text-sky-700 dark:text-sky-300'
              }`}
            >
              {story.issueReadableId}
              <ExternalLink size={12} />
            </button>
            <button
              type="button"
              onClick={() => scrollToStoryInCanvas(story.issueReadableId)}
              className="text-left text-[12px] leading-4 font-semibold text-gray-900 dark:text-white whitespace-normal break-words mt-1 w-full hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
              title="Przewiń kanwę do tego zadania"
            >
              {story.title}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <span
              className={`p-1.5 rounded-lg border ${
                isPresentInCanvas
                  ? 'bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
              }`}
              title={isPresentInCanvas ? 'Źródło jest obecne w treści statusu' : 'Źródło nie występuje w treści statusu'}
            >
              <FileText size={14} />
            </span>
            {isRemoved ? (
              <button
                type="button"
                onClick={() => restoreStoryToCanvas(story.id)}
                className="p-1.5 rounded-lg border bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-300 transition-colors"
                title="Przywróć zadanie do treści statusu"
              >
                <RotateCcw size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => removeStoryFromCanvas(story.id, story.issueReadableId)}
                className="p-1.5 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 hover:border-red-300 transition-colors"
                title="Usuń zadanie z przygotowanej treści"
              >
                <Trash2 size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleIncludedSource(story.id)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isIncluded
                  ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-emerald-600 hover:border-emerald-300'
              }`}
              title={isIncluded ? 'Oznaczone jako uwzględnione' : 'Oznacz jako uwzględnione'}
            >
              <CheckCircle2 size={14} />
            </button>

            <span className="shrink-0 px-2 py-1 rounded-full bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              {story.stateName}
            </span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,7.4fr)_minmax(300px,2.6fr)] gap-4 animate-in fade-in duration-300">
      <div className="space-y-6">
        <section ref={editorContainerRef} className="bg-white dark:bg-gray-800 rounded-2xl p-4 xl:p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Spotkanie statusowe</h2>
              <ProjectLinksDropdown project={project} visibleInTab="status" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[repeat(2,minmax(140px,180px))_minmax(260px,1fr)_auto_auto] gap-3 items-end">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Calendar size={14} /> Data od
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Calendar size={14} /> Data do
                </span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => {
                    const nextDateTo = e.target.value;
                    const currentDefaultTitle = buildDefaultTitle(project.code, dateTo);
                    const shouldUpdateTitle = !title.trim() || title.trim() === currentDefaultTitle;

                    setDateTo(nextDateTo);
                    if (shouldUpdateTitle) {
                      setTitle(buildDefaultTitle(project.code, nextDateTo));
                    }
                    setIsDirty(true);
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tytuł statusu</span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isLoading}
                title="Odśwież dane z YouTrack"
                className="h-11 w-11 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center"
              >
                {activeRefreshAction === 'canvas' ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              </button>
              <button
                type="button"
                onClick={handleSaveReport}
                disabled={isSaving || !editorContent.trim()}
                title="Zapisz w historii"
                className="h-11 w-11 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {isDraftSaving && (
              <span className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 inline-flex items-center justify-center" title="Zapisywanie zmian">
                <Loader2 size={14} className="animate-spin" />
              </span>
            )}
            {!isDraftSaving && isDraftSaved && (
              <span className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 inline-flex items-center justify-center" title="Zapisano zmiany">
                <CheckCircle2 size={14} />
              </span>
            )}
            {isLoading && (
              <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 font-semibold inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Pobieranie danych z YouTrack i Daily...
              </span>
            )}
            {error && (
              <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-semibold inline-flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </span>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 xl:p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          {isLoading && (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/40 px-4 py-3 text-sm text-sky-800 dark:text-sky-200 flex items-center gap-3">
              <Loader2 size={16} className="animate-spin shrink-0" />
              <span>Trwa pobieranie danych. Kanwa zostanie zaktualizowana po zakończeniu synchronizacji.</span>
            </div>
          )}
          <Editor
            content={editorContent}
            onChange={(value) => {
              setEditorContent(value);
              setIsDirty(true);
            }}
            placeholder="Wprowadź narrację statusową dla klienta..."
            openLinksOnClick
            minHeight={520}
          />
        </section>
      </div>

      <aside className="bg-white dark:bg-gray-800 rounded-2xl p-4 xl:p-5 shadow-sm border border-gray-100 dark:border-gray-800 sticky top-4 self-start max-h-[calc(100vh-2rem)] flex flex-col min-h-0">
        <div className="min-h-0 overflow-y-auto pr-1 space-y-6">
          <section>
            <div className="flex items-start justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => setIsSourcesCollapsed(prev => !prev)}
                className="flex-1 flex items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {isSourcesCollapsed ? (
                    <ChevronRight size={16} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400 shrink-0" />
                  )}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Źródła do statusu</h3>
                </div>
              </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 shrink-0">
                  {sourceItems.length}
                </span>
              </button>
              <button
                type="button"
                onClick={handleRefreshSourcesOnly}
                disabled={isLoading}
                title="Odśwież źródła"
                className="h-10 w-10 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center shrink-0"
              >
                {activeRefreshAction === 'sources' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </button>
            </div>

            {isLoading && (
              <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 inline-flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" />
                Aktualizowanie źródeł...
              </div>
            )}

            {!isSourcesCollapsed && (
              <>
                {isLoading && !sourceItems.length ? (
                  <div className="py-10 flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="animate-spin mb-3" />
                    Ładowanie źródeł...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sourceItems.map((story) => renderSourceCard(story, { childStories: sourceChildrenMap.get(story.issueReadableId) || [] }))}

                    {!sourceItems.length && !isLoading && (
                      <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                        Brak aktywności i notatek dla wybranego zakresu dat.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Historia statusów</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Podgląd poprzednich spotkań i kopiowanie do bieżącej wersji.</p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                {reports.length}
              </span>
            </div>

            {isHistoryLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mb-3" />
                Ładowanie historii...
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="group relative rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/80 dark:bg-gray-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{report.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{report.dateFrom} {'->'} {report.dateTo}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePreview(report);
                            setSelectionText('');
                          }}
                          className="p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                          title="Podgląd"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                          title="Usuń"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                      {stripRichText(report.content).slice(0, 160) || 'Brak treści podglądu.'}
                    </p>
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute right-full top-3 mr-3 hidden xl:block w-80 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4 z-20">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500 mb-2">Podgląd</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {stripRichText(report.content).slice(0, 260) || 'Brak treści.'}
                      </p>
                    </div>
                  </div>
                ))}

                {!reports.length && (
                  <div className="py-10 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                    <FileText className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Brak zapisanych raportów statusowych.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </aside>

      {activePreview && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Archiwalny status</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{activePreview.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Zakres: {activePreview.dateFrom} {'->'} {activePreview.dateTo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePreview(null);
                  setSelectionText('');
                }}
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Zamknij"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] max-h-[calc(90vh-76px)]">
              <div className="overflow-y-auto p-6">
                <div
                  ref={previewRef}
                  className="prose dark:prose-invert max-w-none prose-a:text-indigo-600"
                  dangerouslySetInnerHTML={{ __html: activePreview.content }}
                />
              </div>
              <div className="border-l border-gray-200 dark:border-gray-800 p-6 bg-gray-50/70 dark:bg-gray-950/40 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Akcje</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectionText.trim()) {
                          appendHtmlToCanvas(`<blockquote><p>${escapeHtml(selectionText)}</p><p><strong>Źródło:</strong> ${escapeHtml(activePreview.title)}</p></blockquote>`);
                        }
                      }}
                      disabled={!selectionText}
                      className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Copy size={16} />
                      Kopiuj zaznaczenie
                    </button>
                    <button
                      type="button"
                      onClick={() => appendHtmlToCanvas(`<hr /><h2>${escapeHtml(activePreview.title)}</h2>${activePreview.content}`)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-900 flex items-center justify-center gap-2"
                    >
                      <FileText size={16} />
                      Wstaw cały raport
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Zaznaczenie</p>
                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 min-h-[160px] text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {selectionText || 'Zaznacz fragment w podglądzie raportu, a potem wstaw go do bieżącego statusu.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

