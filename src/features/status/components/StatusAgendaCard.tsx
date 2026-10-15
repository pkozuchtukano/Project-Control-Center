import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Activity, Check, ChevronDown, ChevronRight, CircleMinus, ExternalLink, FileText, GitBranch, GripVertical, History, Pencil, RefreshCw, StickyNote, Trash2, UserRound } from 'lucide-react';
import type { StatusAgendaItem, StatusStory } from '../../../types';
import { Editor } from '../../meeting-notes/components/Editor';
import { stripRichText } from '../utils/statusUtils';

export const StatusIssueMeta = ({ source }: { source: StatusStory }) => (
  <div className="flex min-w-0 w-full flex-col items-end gap-2 text-right text-xs">
    <span style={source.stateColor ? { backgroundColor: source.stateColor.background, color: source.stateColor.foreground } : undefined} className="max-w-full break-words rounded-md bg-indigo-100 px-2 py-1 font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
      {source.stateName || 'Brak statusu'}
    </span>
    <span className="inline-flex max-w-full items-start justify-end gap-1 text-gray-600 dark:text-gray-300"><UserRound size={13} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{source.assigneeName || 'Nieprzypisane'}</span></span>
  </div>
);

const activityIndicators = {
  active: { icon: Activity, label: 'Nowa aktywność w okresie', color: 'text-emerald-600 dark:text-emerald-400' },
  inactive: { icon: CircleMinus, label: 'Bez nowej aktywności', color: 'text-gray-400 dark:text-gray-500' },
  stale: { icon: RefreshCw, label: 'Odśwież źródła dla tego okresu', color: 'text-amber-600 dark:text-amber-400' },
  missing: { icon: RefreshCw, label: 'Odśwież źródła zadania', color: 'text-amber-600 dark:text-amber-400' },
};

export const StatusActivityIcon = ({ state, label }: { state: keyof typeof activityIndicators; label?: string }) => {
  const { icon: Icon, label: defaultLabel, color } = activityIndicators[state];
  return <span role="img" aria-label={label || defaultLabel} title={label || defaultLabel} className={`inline-flex p-1 ${color}`}><Icon size={16} aria-hidden="true" /></span>;
};

interface Props {
  item: StatusAgendaItem;
  index: number;
  depth: number;
  meeting: boolean;
  initiallyEditing?: boolean;
  activityState?: keyof typeof activityIndicators;
  onChange: (item: StatusAgendaItem) => void;
  onRemove: () => void;
  onSource: (source: StatusStory) => void;
  onOpenIssue: (url: string) => void;
}

export const StatusAgendaCard = ({ item, index, depth, meeting, initiallyEditing, activityState, onChange, onRemove, onSource, onOpenIssue }: Props) => {
  const [editing, setEditing] = useState(!!initiallyEditing);
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const hasNotes = !!stripRichText(item.meetingNotesHtml || '').trim();
  const notesLabel = editingNotes ? 'Zamknij notatki' : hasNotes ? 'Edytuj notatki' : 'Dodaj notatkę';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: meeting });
  return (
    <article id={`agenda-${item.id}`} ref={setNodeRef}
      onPointerDown={event => {
        const target = event.target as Element;
        if (meeting || editing || editingNotes || target.closest('button, a, input, textarea, select, label, [contenteditable], .status-rich-text')) return;
        listeners?.onPointerDown?.(event);
      }}
      style={{ transform: CSS.Transform.toString(transform), transition, marginLeft: Math.min(depth, 4) * 24 }}
      className={`flex items-start ${meeting ? 'status-meeting-topic gap-5' : `gap-3 rounded-xl border bg-white p-4 dark:bg-gray-900 ${!editing && !editingNotes ? 'cursor-grab active:cursor-grabbing' : ''} ${depth ? 'border-l-4 border-l-indigo-300 dark:border-l-indigo-600' : 'border-gray-200 dark:border-gray-700'}`} ${isDragging ? 'relative z-20 opacity-70 shadow-xl' : ''}`}>
      <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            {!meeting && <span className="text-sm font-semibold text-gray-400">{index + 1}.</span>}
            <h3 className={`min-w-0 break-words text-gray-900 dark:text-white ${meeting ? 'text-lg font-semibold leading-relaxed' : 'text-base font-bold'}`}>{item.title}
              {item.detailsHtml && !editing && <button type="button" aria-expanded={expanded} aria-controls={`agenda-details-${item.id}`}
                aria-label={`${expanded ? 'Zwiń' : 'Rozwiń'} szczegóły: ${item.title}`} title={expanded ? 'Zwiń szczegóły' : 'Rozwiń szczegóły'}
                onClick={() => setExpanded(current => !current)} className="ml-1 inline-flex rounded p-1 align-middle text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-gray-800">
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>}
            </h3>
          </div>
      {editing ? <div className="mt-4 space-y-4">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Tytuł
          <input value={item.title} onChange={event => onChange({ ...item, title: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:text-white" />
        </label>
        <div><p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Krótki opis na spotkanie</p>
          <Editor content={item.summaryHtml} onChange={summaryHtml => onChange({ ...item, summaryHtml })} placeholder="Co chcesz omówić? Co zrobiono i co pozostało?" minHeight={110} toolbar="selection" />
        </div>
        <div><p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Szczegóły do rozwinięcia</p>
          <Editor content={item.detailsHtml} onChange={detailsHtml => onChange({ ...item, detailsHtml })} placeholder="Dodatkowe informacje na wypadek pytań..." minHeight={150} toolbar="selection" />
        </div>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Gotowe</button>
      </div> : <>
        <div className="status-rich-text prose mt-3 max-w-none break-words text-gray-900 dark:prose-invert dark:text-gray-100" dangerouslySetInnerHTML={{ __html: item.summaryHtml }} />
        {item.detailsHtml && expanded && <div id={`agenda-details-${item.id}`} className="status-rich-text prose mt-3 max-w-none break-words rounded-lg bg-gray-50 p-3 text-gray-900 dark:prose-invert dark:bg-gray-950 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: item.detailsHtml }} />}
      </>}
      {(editingNotes || hasNotes) && <div id={`agenda-notes-${item.id}`} className="mt-3 border-l-2 border-amber-300 pl-3 dark:border-amber-600">
        <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Notatki ze spotkania</p>
        {editingNotes ? <>
          <Editor content={item.meetingNotesHtml || ''} onChange={html => onChange({ ...item, meetingNotesHtml: stripRichText(html).trim() ? html : '' })} placeholder="Ustalenia, decyzje i kolejne kroki dla tego zadania..." minHeight={80} toolbar="selection" />
          <button type="button" onClick={() => setEditingNotes(false)} className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Gotowe</button>
        </> : <div className="status-rich-text prose max-w-none break-words text-gray-900 dark:prose-invert dark:text-gray-100" dangerouslySetInnerHTML={{ __html: item.meetingNotesHtml || '' }} />}
      </div>}
      </div>
      <aside className={`flex w-max min-w-fit max-w-[40%] shrink-0 flex-col items-end gap-3 text-right ${meeting ? '' : 'border-l border-gray-100 pl-3 dark:border-gray-800'}`}>
        {item.source && <StatusIssueMeta source={item.source} />}
        <div className="flex items-center justify-end gap-0.5">
          {item.source && <button type="button" onClick={() => onOpenIssue(item.source!.issueUrl)} title={`Otwórz ${item.source.issueReadableId} w YouTrack`} className="mr-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded p-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">{item.source.issueReadableId}<ExternalLink size={12} aria-hidden="true" /></button>}
          {activityState && <StatusActivityIcon state={activityState} />}
          {item.originReportTitle && <span role="img" aria-label={`Kontynuacja: ${item.originReportTitle}`} title={`Kontynuacja: ${item.originReportTitle}`} className="inline-flex p-1 text-indigo-500 dark:text-indigo-300"><History size={16} aria-hidden="true" /></span>}
          {item.source?.parentIssueReadableId && <span role="img" aria-label={`Podzadanie: ${item.source.parentIssueReadableId} · ${item.source.parentIssueTitle || ''}`} title={`Podzadanie: ${item.source.parentIssueReadableId} · ${item.source.parentIssueTitle || ''}`} className="inline-flex p-1 text-indigo-500 dark:text-indigo-300"><GitBranch size={16} aria-hidden="true" /></span>}
          {!meeting && item.source && <button type="button" onClick={() => onSource(item.source!)} title="Materiał źródłowy" aria-label="Materiał źródłowy" className="rounded p-1 text-gray-500 hover:text-indigo-600 dark:text-gray-400"><FileText size={16} /></button>}
          {!meeting &&
            <button type="button" {...attributes} {...listeners} title="Przeciągnij temat" aria-label={`Przeciągnij ${item.title}`} className="cursor-grab touch-none rounded p-1 text-gray-400"><GripVertical size={15} /></button>
          }
          <button type="button" onClick={() => setEditingNotes(current => !current)} title={notesLabel} aria-label={`${notesLabel}: ${item.source?.issueReadableId || item.title}`} aria-expanded={editingNotes} aria-controls={editingNotes || hasNotes ? `agenda-notes-${item.id}` : undefined} className={`rounded p-1 hover:bg-amber-50 dark:hover:bg-gray-800 ${hasNotes || editingNotes ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}><StickyNote size={15} /></button>
          <button type="button" onClick={() => setEditing(!editing)} title={editing ? 'Zakończ edycję' : 'Edytuj temat'} aria-label={editing ? 'Zakończ edycję' : 'Edytuj temat'} className="rounded p-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-gray-800">{editing ? <Check size={15} /> : <Pencil size={15} />}</button>
          {(!meeting || !item.source) && <button type="button" onClick={onRemove} title="Usuń z agendy" aria-label="Usuń z agendy" className="rounded p-1 text-gray-500 hover:text-red-600"><Trash2 size={15} /></button>}
        </div>
      </aside>
    </article>
  );
};
