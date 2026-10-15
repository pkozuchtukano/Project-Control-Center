import type { StatusAgendaItem, StatusReport, StatusStory } from '../../../types';
import { buildStatusStoryHtml, escapeHtml, stripRichText } from './statusUtils';

export const createStatusId = () => crypto.randomUUID();
export const statusDraftKey = (projectId: string) => `status_agenda_draft_${projectId}`;
export const statusSourceFilterKey = (projectId: string) => `status_source_statuses_${projectId}`;

export const createAgendaItem = (source?: StatusStory): StatusAgendaItem => ({
  id: createStatusId(),
  title: source?.title || 'Nowy temat',
  summaryHtml: source?.description ? `<p>${escapeHtml(source.description)}</p>` : '',
  detailsHtml: source ? buildStatusStoryHtml(source) : '',
  source
});

// Older reports have one edited HTML document. Keep it intact instead of guessing boundaries.
export const getReportAgenda = (report: StatusReport): StatusAgendaItem[] => report.agenda || (
  report.content.trim() ? [{
    id: `legacy-${report.id}`, title: report.title, summaryHtml: report.content, detailsHtml: ''
  }] : []
);

export const orderAgenda = (items: StatusAgendaItem[]) => {
  const byIssue = new Map(items.filter(item => item.source).map(item => [item.source!.issueReadableId, item]));
  const children = new Map<string, StatusAgendaItem[]>();
  const roots: StatusAgendaItem[] = [];
  for (const item of items) {
    const parent = byIssue.get(item.source?.parentIssueReadableId || '');
    if (!parent || parent.id === item.id) roots.push(item);
    else children.set(parent.id, [...(children.get(parent.id) || []), item]);
  }
  const result: StatusAgendaItem[] = [];
  const visited = new Set<string>();
  const visit = (item: StatusAgendaItem) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    result.push(item);
    (children.get(item.id) || []).forEach(visit);
  };
  roots.forEach(visit);
  items.forEach(visit);
  return result;
};

export const agendaDepth = (item: StatusAgendaItem, items: StatusAgendaItem[]) => {
  const visited = new Set([item.id]);
  let current = item;
  let depth = 0;
  while (current.source?.parentIssueReadableId) {
    const parent = items.find(candidate => candidate.source?.issueReadableId === current.source?.parentIssueReadableId);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    current = parent;
    depth++;
  }
  return depth;
};

export const moveAgenda = (input: StatusAgendaItem[], id: string, targetId: string) => {
  const items = orderAgenda(input);
  const start = items.findIndex(item => item.id === id);
  let target = items.findIndex(item => item.id === targetId);
  if (start < 0 || target < 0 || start === target) return input;
  const depth = agendaDepth(items[start], items);
  while (target >= 0 && agendaDepth(items[target], items) > depth) target--;
  if (target < 0 || target === start || agendaDepth(items[target], items) !== depth) return input;
  const parentKey = (item: StatusAgendaItem) => depth ? item.source?.parentIssueReadableId : undefined;
  if (parentKey(items[start]) !== parentKey(items[target])) return input;
  const endOfGroup = (index: number) => {
    let end = index + 1;
    while (end < items.length && agendaDepth(items[end], items) > depth) end++;
    return end;
  };
  const end = endOfGroup(start);
  const insertAt = start < target ? endOfGroup(target) : target;
  const block = items.slice(start, end);
  const remaining = items.filter((_, index) => index < start || index >= end);
  remaining.splice(insertAt > start ? insertAt - block.length : insertAt, 0, ...block);
  return remaining;
};

export const mergeAgenda = (current: StatusAgendaItem[], incoming: StatusAgendaItem[], report?: StatusReport) => {
  const result = [...current];
  for (const item of incoming) {
    const exists = result.some(existing => item.source
      ? existing.source?.issueReadableId === item.source.issueReadableId
      : existing.id === item.id || (existing.originReportId === report?.id && existing.originItemId === item.id));
    if (exists) continue;
    result.push(report ? {
      ...item, id: createStatusId(), originItemId: item.id,
      originReportId: report.id, originReportTitle: report.title
    } : item);
  }
  return orderAgenda(result);
};

export const refreshAgendaSources = (items: StatusAgendaItem[], sources: StatusStory[]) => items.map(item => {
  const source = sources.find(story => story.issueReadableId === item.source?.issueReadableId);
  return source ? { ...item, source } : item;
});

export const buildAgendaHtml = (items: StatusAgendaItem[]) => items.map(item => (
  `<section><h2>${item.source ? `<a href="${escapeHtml(item.source.issueUrl)}">${escapeHtml(item.source.issueReadableId)}</a> ` : ''}${escapeHtml(item.title)}</h2>` +
  (item.source ? `<p>${escapeHtml(item.source.stateName || 'Brak statusu')} · ${escapeHtml(item.source.assigneeName || 'Nieprzypisane')}</p>` : '') +
  `${item.summaryHtml}${item.detailsHtml ? `<details><summary>Szczegóły</summary>${item.detailsHtml}</details>` : ''}` +
  (stripRichText(item.meetingNotesHtml || '').trim() ? `<h3>Notatki ze spotkania</h3>${item.meetingNotesHtml}` : '') + '</section>'
)).join('');

export const buildSourceTree = (stories: StatusStory[]) => {
  const all = [...stories];
  for (const story of stories) {
    if (!story.parentIssueReadableId || all.some(parent => parent.issueReadableId === story.parentIssueReadableId)) continue;
    all.push({
      ...story, id: `context-${story.parentIssueReadableId}`, issueId: '',
      issueReadableId: story.parentIssueReadableId,
      title: story.parentIssueTitle || story.parentIssueReadableId,
      issueUrl: story.issueUrl.replace(/\/issue\/[^/]+$/, `/issue/${story.parentIssueReadableId}`),
      parentIssueReadableId: null, parentIssueTitle: null,
      stateName: undefined, assigneeName: null, activityCount: 0,
      isContextOnly: true, isScopeContext: true, comments: [], technicalSummary: '', description: ''
    });
  }
  return all;
};

export const filterStatusSources = (stories: StatusStory[], query: string, visibleStatuses?: string[]) => {
  const all = buildSourceTree(stories);
  const byId = new Map(all.map(story => [story.issueReadableId, story]));
  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const visible = new Set<string>();
  for (const story of all) {
    const active = !story.isContextOnly && (story.activityCount || 0) > 0;
    if (story.isScopeContext || (visibleStatuses && !active && !visibleStatuses.includes(story.stateName || ''))) continue;
    const text = normalize([
      story.issueReadableId, story.title, story.description, story.stateName,
      story.assigneeName, story.technicalSummary, ...story.comments.map(comment => `${comment.author} ${comment.text}`)
    ].filter(Boolean).join(' '));
    if (!terms.every(term => text.includes(term))) continue;
    let current: StatusStory | undefined = story;
    const visited = new Set<string>();
    while (current && !visited.has(current.issueReadableId)) {
      visited.add(current.issueReadableId);
      visible.add(current.issueReadableId);
      current = byId.get(current.parentIssueReadableId || '');
    }
  }
  return all.filter(story => visible.has(story.issueReadableId));
};
