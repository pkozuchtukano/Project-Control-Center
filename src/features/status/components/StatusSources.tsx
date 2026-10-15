import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ExternalLink, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import type { StatusStory } from '../../../types';
import { filterStatusSources, statusSourceFilterKey } from '../utils/agendaUtils';
import { StatusActivityIcon, StatusIssueMeta } from './StatusAgendaCard';

interface Props {
  projectId: string;
  stories: StatusStory[];
  included: Set<string>;
  stale: boolean;
  onAdd: (source: StatusStory) => void;
  onPreview: (source: StatusStory) => void;
  onOpenIssue: (url: string) => void;
}

export const StatusSources = ({ projectId, stories, included, stale, onAdd, onPreview, onOpenIssue }: Props) => {
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(statusSourceFilterKey(projectId)) || '[]');
      return Array.isArray(saved) ? saved.filter(value => typeof value === 'string') : [];
    } catch { return []; }
  });
  const statuses = useMemo(() => Array.from(new Set([
    ...stories.filter(story => !story.isScopeContext).map(story => story.stateName || ''), ...visibleStatuses
  ])).sort((left, right) => left.localeCompare(right, 'pl')), [stories, visibleStatuses]);
  const updateStatuses = (next: string[]) => {
    setVisibleStatuses(next);
    setSaveError('');
    try { localStorage.setItem(statusSourceFilterKey(projectId), JSON.stringify(next)); }
    catch { setSaveError('Nie udało się zapamiętać ustawień.'); }
  };
  const all = useMemo(() => filterStatusSources(stories, query, visibleStatuses), [stories, query, visibleStatuses]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const render = (story: StatusStory, path: Set<string>): React.ReactNode => {
    if (path.has(story.issueReadableId)) return null;
    const nextPath = new Set([...path, story.issueReadableId]);
    const children = all.filter(child => child.parentIssueReadableId === story.issueReadableId && !nextPath.has(child.issueReadableId));
    const isIncluded = included.has(story.issueReadableId);
    return <div key={story.issueReadableId} className="space-y-2">
      <article className={`rounded-lg border p-3 ${children.length ? 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-800 dark:bg-indigo-950/40' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'}`}>
        <div className="flex items-start gap-2">
          {children.length > 0 && <button type="button" aria-label={collapsed[story.issueReadableId] ? 'Rozwiń podzadania' : 'Zwiń podzadania'} aria-expanded={!collapsed[story.issueReadableId]} onClick={() => setCollapsed(previous => ({ ...previous, [story.issueReadableId]: !previous[story.issueReadableId] }))} className="mt-0.5 text-indigo-500">{collapsed[story.issueReadableId] ? <ChevronRight size={17} /> : <ChevronDown size={17} />}</button>}
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => onOpenIssue(story.issueUrl)} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">{story.issueReadableId}<ExternalLink size={11} /></button>
            <button type="button" onClick={() => onPreview(story)} className="mt-1 block max-w-full break-words text-left text-sm font-semibold leading-5 text-gray-900 hover:text-indigo-600 dark:text-white">{story.title}</button>
            {story.issueId && <button type="button" disabled={stale} onClick={() => onAdd(story)} className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold disabled:opacity-40 ${isIncluded ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{isIncluded ? <Check size={13} /> : <Plus size={13} />}{isIncluded ? 'W agendzie — pokaż' : 'Dodaj do agendy'}</button>}
          </div>
          <div className="flex w-24 max-w-[40%] shrink-0 flex-col items-end gap-2">
            <StatusIssueMeta source={story} />
            <StatusActivityIcon state={stale ? 'stale' : story.isContextOnly ? 'inactive' : 'active'} label={stale ? undefined : story.isScopeContext ? 'Zadanie nadrzędne · kontekst' : story.isContextOnly ? 'Bez nowej aktywności w okresie' : story.activitySummary || `Aktywności: ${story.activityCount || 0}`} />
          </div>
        </div>
      </article>
      {!collapsed[story.issueReadableId] && children.length > 0 && <div className="ml-3 space-y-2 border-l-2 border-indigo-200 pl-3 dark:border-indigo-800">{children.map(child => render(child, nextPath))}</div>}
    </div>;
  };
  const roots = all.filter(story => !story.parentIssueReadableId || story.parentIssueReadableId === story.issueReadableId || !all.some(parent => parent.issueReadableId === story.parentIssueReadableId));
  return <div className="space-y-3">
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 dark:border-gray-700">
      <Search size={15} aria-hidden="true" className="shrink-0 text-gray-400" />
      <input type="search" value={query} onChange={event => { setQuery(event.target.value); setCollapsed({}); }} aria-label="Szukaj w źródłach statusu" placeholder="Szukaj zadania, osoby, treści..." className="min-w-0 flex-1 bg-transparent py-2 text-sm text-gray-900 outline-none dark:text-white" />
      {query && <button type="button" onClick={() => setQuery('')} aria-label="Wyczyść wyszukiwanie" className="rounded p-1 text-gray-500 hover:text-indigo-600"><X size={14} /></button>}
      <button type="button" onClick={() => setSettingsOpen(current => !current)} title="Ustawienia źródeł" aria-label="Ustawienia źródeł" aria-expanded={settingsOpen} aria-controls={`status-source-settings-${projectId}`} className={`shrink-0 rounded p-1.5 hover:bg-indigo-50 dark:hover:bg-gray-800 ${settingsOpen ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}><SlidersHorizontal size={16} /></button>
    </div>
    {settingsOpen && <fieldset id={`status-source-settings-${projectId}`} className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <legend className="px-1 text-xs font-semibold text-gray-700 dark:text-gray-200">Widoczne statusy</legend>
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Zaznaczone statusy pokazują też zadania bez aktywności. Zadania z aktywnością w okresie są widoczne zawsze.</p>
      <div className="flex gap-3 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
        <button type="button" onClick={() => updateStatuses(statuses)} disabled={!statuses.length} className="hover:underline disabled:opacity-40">Wszystkie</button>
        <button type="button" onClick={() => updateStatuses([])} className="hover:underline">Tylko z aktywnością</button>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto">{statuses.map(status => <label key={status} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input type="checkbox" checked={visibleStatuses.includes(status)} onChange={event => updateStatuses(event.target.checked ? [...visibleStatuses, status] : visibleStatuses.filter(value => value !== status))} />{status || 'Brak statusu'}
      </label>)}</div>
      {!statuses.length && <p className="text-xs text-gray-500 dark:text-gray-400">Odśwież źródła, aby wczytać statusy projektu.</p>}
      <p className="text-xs text-gray-500 dark:text-gray-400">Ustawienie dotyczy tylko tego projektu. Zadania nadrzędne pozostają jako kontekst.</p>
    </fieldset>}
    {saveError && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{saveError}</p>}
    {stories.length > 0 && <p role="status" className="text-xs text-gray-500 dark:text-gray-400">{all.length ? `Widoczne zadania: ${all.filter(story => story.issueId).length}` : query.trim() ? 'Brak pasujących zadań.' : 'Brak aktywności w okresie. W ustawieniach wybierz statusy, aby pokazać także zadania bez zmian.'}</p>}
    {(roots.length ? roots : all.slice(0, 1)).map(story => render(story, new Set()))}
  </div>;
};
