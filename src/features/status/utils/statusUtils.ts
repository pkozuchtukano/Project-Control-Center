import type { StatusStory, StatusStoryComment } from '../../../types';
import type { IssueWithHistory } from '../../../services/youtrackApi';
import { formatMinutesToDuration } from '../../../services/youtrackApi';

const stripHtml = (value?: string | null) => {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const applyStatusNarrativeTransforms = (value: string) =>
  value
    .replace(/\bEstimation:\s*([^\s|;][^|;]*)/gi, (_match, estimation) => `Zaplanowano pracę na: ${String(estimation).trim()}`)
    .replace(/\bAssignee:\s*([^\s|;][^|;]*)/gi, (_match, assignee) => `Przypisano: ${String(assignee).trim()}`);

const childRelationPatterns = [
  'subtask',
  'sub task',
  'sub-task',
  'subtask of',
  'sub-task of',
  'child',
  'child of',
  'is child of',
  'depends on parent',
  'podzadanie'
];

const parentRelationPatterns = [
  'parent',
  'parent for',
  'has subtask',
  'parent of',
  'is parent for',
  'contains subtask',
  'rodzic'
];

const normalizeRelationLabel = (value?: string | null) => (value || '').trim().toLowerCase();
const hasChildRelationSignal = (value: string) => childRelationPatterns.some(pattern => value.includes(pattern));
const hasParentRelationSignal = (value: string) => parentRelationPatterns.some(pattern => value.includes(pattern));

const getRelationLabels = (link: NonNullable<IssueWithHistory['links']>[number]) => {
  const direction = normalizeRelationLabel(link.direction);
  const outwardName = normalizeRelationLabel(link.linkType?.outwardName);
  const inwardName = normalizeRelationLabel(link.linkType?.inwardName);
  const typeName = normalizeRelationLabel(link.linkType?.name);

  // YouTrack zwraca direction z perspektywy relacji technicznej, a nie tekstu
  // widocznego dla aktualnie oglądanego issue. Dla linków parent/subtask etykietę
  // "bieżącego" issue trzeba więc odczytać z przeciwnej nazwy relacji.
  if (direction === 'outward') {
    return {
      currentIssueLabel: inwardName || outwardName || typeName,
      oppositeIssueLabel: outwardName || typeName || inwardName,
      outwardName,
      inwardName,
      typeName
    };
  }

  if (direction === 'inward') {
    return {
      currentIssueLabel: outwardName || inwardName || typeName,
      oppositeIssueLabel: inwardName || typeName || outwardName,
      outwardName,
      inwardName,
      typeName
    };
  }

  return {
    currentIssueLabel: outwardName || inwardName || typeName,
    oppositeIssueLabel: inwardName || outwardName || typeName,
    outwardName,
    inwardName,
    typeName
  };
};

const getParentLink = (issue: IssueWithHistory) => {
  for (const link of issue.links || []) {
    const direction = normalizeRelationLabel(link.direction);
    const {
      currentIssueLabel,
      typeName
    } = getRelationLabels(link);
    const linkedIssue = link.issues?.[0];

    if (!linkedIssue) continue;

    // W realnym payloadzie YouTrack dla typu "Subtask" kierunek rozstrzyga semantykę:
    // - OUTWARD  => bieżące issue jest parentem i lista `issues` to dzieci
    // - INWARD   => bieżące issue jest subtaskiem, a `issues` zawiera parenta
    if (typeName.includes('subtask')) {
      if (direction === 'inward') {
        return linkedIssue;
      }
      continue;
    }

    const isChildByPrimaryLabel = hasChildRelationSignal(currentIssueLabel);
    const isParentByPrimaryLabel = hasParentRelationSignal(currentIssueLabel);

    if (isChildByPrimaryLabel && !isParentByPrimaryLabel) {
      return linkedIssue;
    }
  }

  return null;
};

const getChildLinks = (issue: IssueWithHistory) => {
  return (issue.links || [])
    .filter((link) => {
      const direction = normalizeRelationLabel(link.direction);
      const { currentIssueLabel, oppositeIssueLabel, outwardName, inwardName, typeName } = getRelationLabels(link);
      const labels = [currentIssueLabel, oppositeIssueLabel, outwardName, inwardName, typeName].filter(Boolean);

      if (typeName.includes('subtask')) {
        return direction === 'outward';
      }

      const hasParentSignal = labels.some(label => hasParentRelationSignal(label));
      const hasChildSignal = labels.some(label => hasChildRelationSignal(label));

      const currentIssueActsAsParent = hasParentRelationSignal(currentIssueLabel) && !hasChildRelationSignal(currentIssueLabel);

      return currentIssueActsAsParent || (typeName.includes('subtask') && hasParentSignal && !hasChildSignal);
    })
    .flatMap((link) => link.issues || [])
    .filter((linkedIssue, index, array) => array.findIndex(item => item.idReadable === linkedIssue.idReadable) === index);
};

export const sortStatusStories = (stories: StatusStory[]) => {
  const byReadableId = new Map(stories.map(story => [story.issueReadableId, story]));
  const childrenByGroup = new Map<string, StatusStory[]>();
  const standaloneStories: StatusStory[] = [];

  for (const story of stories) {
    const parentReadableId = story.parentIssueReadableId;
    if (parentReadableId && byReadableId.has(parentReadableId)) {
      const group = childrenByGroup.get(parentReadableId) || [];
      group.push(story);
      childrenByGroup.set(parentReadableId, group);
      continue;
    }

    standaloneStories.push(story);
  }

  const sortByRecentUpdate = (left: StatusStory, right: StatusStory) =>
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

  standaloneStories.sort((left, right) => {
    const leftChildren = childrenByGroup.get(left.issueReadableId) || [];
    const rightChildren = childrenByGroup.get(right.issueReadableId) || [];
    const leftTimestamp = Math.max(
      new Date(left.updatedAt).getTime(),
      ...leftChildren.map(child => new Date(child.updatedAt).getTime())
    );
    const rightTimestamp = Math.max(
      new Date(right.updatedAt).getTime(),
      ...rightChildren.map(child => new Date(child.updatedAt).getTime())
    );

    return rightTimestamp - leftTimestamp;
  });

  const result: StatusStory[] = [];
  const visited = new Set<string>();
  const visit = (story: StatusStory) => {
    if (visited.has(story.issueReadableId)) return;
    visited.add(story.issueReadableId);
    result.push(story);
    [...(childrenByGroup.get(story.issueReadableId) || [])].sort(sortByRecentUpdate).forEach(visit);
  };
  standaloneStories.forEach(visit);
  stories.forEach(visit);
  return result;
};

const summarizeTechnicalContext = (issue: IssueWithHistory, fromTime: number, toTime: number) => {
  const description = stripHtml(issue.description);
  const fieldChanges = (issue.timeline || [])
    .filter(item => item.type === 'field-change' && item.timestamp >= fromTime && item.timestamp <= toTime)
    .map(item => `${item.field}: ${item.added || 'zmiana'}`);

  const firstLineParts = [
    issue.state?.name ? `Status: ${issue.state.name}` : '',
    issue.assignee?.name ? `Assignee: ${issue.assignee.name}` : '',
  ].filter(Boolean);

  const lines = [
    firstLineParts.join(' | '),
    description ? `Opis: ${description}` : '',
    fieldChanges.length ? `Ostatnie zmiany: ${fieldChanges.join('; ')}` : '',
  ].filter(Boolean);

  return applyStatusNarrativeTransforms(lines.join('\n'));
};

export const buildStatusStories = (
  issues: IssueWithHistory[],
  dailyComments: Record<string, string>,
  baseUrl: string,
  dateFrom: string,
  dateTo: string,
  includeInactive = false
): StatusStory[] => {
  const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
  const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();
  const baseStories = issues
    .map((issue) => {
      const youTrackComments: StatusStoryComment[] = [];
      (issue.timeline || [])
        .filter(item => item.timestamp >= fromTime && item.timestamp <= toTime)
        .forEach((item) => {
          if (item.type === 'comment' && item.text?.trim()) {
            youTrackComments.push({
              id: item.id,
              author: item.author?.name || item.author?.login || 'YouTrack',
              timestamp: item.timestamp,
              text: item.text.trim(),
              source: 'youtrack-comment' as const
            });
            return;
          }

          if (item.type === 'work-item') {
            const note = [
              item.minutes ? `Wpis pracy: ${formatMinutesToDuration(item.minutes)}` : 'Zmieniono wpis pracy',
              item.workItemType ? `(${item.workItemType})` : '',
              item.workComments?.filter(Boolean).join('; ')
            ].filter(Boolean).join(' ');

            youTrackComments.push({
              id: item.id,
              author: item.author?.name || item.author?.login || 'YouTrack',
              timestamp: item.timestamp,
              text: note,
              source: 'work-item' as const
            });
            return;
          }

          if (item.type === 'comment') return;
          const text = item.type === 'issue-created'
            ? 'Utworzono zadanie.'
            : `${item.field || 'Zmiana'}: ${String(item.removed || 'Brak')} → ${String(item.added || 'Brak')}`;
          youTrackComments.push({
            id: item.id,
            author: item.author?.name || item.author?.login || 'YouTrack',
            timestamp: item.timestamp,
            text,
            source: item.type
          });
        });

      const dailyNote = dailyComments[issue.idReadable]?.trim();
      const dailyNoteComment: StatusStoryComment[] = dailyNote ? [{
        id: `daily-${issue.idReadable}`,
        author: 'Daily',
        timestamp: issue.updated || issue.created || Date.now(),
        text: dailyNote,
        source: 'daily-note' as const
      }] : [];

      const comments = [...youTrackComments, ...dailyNoteComment].sort((a, b) => b.timestamp - a.timestamp);
      const parentLink = getParentLink(issue);
      const childLinks = getChildLinks(issue);

      return {
        id: issue.id,
        issueId: issue.id,
        issueReadableId: issue.idReadable,
        issueUrl: `${baseUrl.replace(/\/$/, '')}/issue/${issue.idReadable}`,
        title: issue.summary,
        parentIssueId: parentLink?.id || null,
        parentIssueReadableId: parentLink?.idReadable || null,
        parentIssueTitle: parentLink?.summary || null,
        childIssueReadableIds: childLinks.map((child) => child.idReadable),
        childIssues: childLinks.map((child) => ({
          issueReadableId: child.idReadable,
          title: child.summary || child.idReadable
        })),
        startedAt: issue.created ? new Date(issue.created).toISOString() : new Date().toISOString(),
        updatedAt: issue.updated ? new Date(issue.updated).toISOString() : new Date().toISOString(),
        technicalSummary: summarizeTechnicalContext(issue, fromTime, toTime),
        comments,
        dailyNote,
        projectCode: issue.project?.shortName,
        stateName: issue.state?.name,
        assigneeName: issue.assignee?.name || null,
        description: stripHtml(issue.description),
        stateColor: issue.state?.color,
        activityCount: youTrackComments.length,
        activitySummary: [
          youTrackComments.filter(item => item.source === 'youtrack-comment').length ? `Komentarze: ${youTrackComments.filter(item => item.source === 'youtrack-comment').length}` : '',
          youTrackComments.some(item => item.source === 'work-item') ? 'Wpisy pracy' : '',
          youTrackComments.some(item => item.source === 'field-change' || item.source === 'description-change') ? 'Zmiany zadania' : '',
          youTrackComments.some(item => item.source === 'issue-created') ? 'Nowe zadanie' : ''
        ].filter(Boolean).join(' · '),
        isContextOnly: youTrackComments.length === 0 || issue.statusScopeMember === false,
        isScopeContext: issue.statusScopeMember === false
      } satisfies StatusStory;
    });

  const childrenByParent = new Map<string, string[]>();
  const storyByReadableId = new Map(baseStories.map((story) => [story.issueReadableId, story]));

  for (const story of baseStories) {
    if (!story.parentIssueReadableId) continue;
    const group = childrenByParent.get(story.parentIssueReadableId) || [];
    group.push(story.issueReadableId);
    childrenByParent.set(story.parentIssueReadableId, group);
  }

  const includedIds = new Set(baseStories.filter(story => !story.isContextOnly).map(story => story.issueReadableId));
  for (const story of baseStories) {
    if (!includedIds.has(story.issueReadableId)) continue;
    let current = story;
    const visited = new Set<string>();
    while (current.parentIssueReadableId && !visited.has(current.parentIssueReadableId)) {
      visited.add(current.parentIssueReadableId);
      includedIds.add(current.parentIssueReadableId);
      const parent = storyByReadableId.get(current.parentIssueReadableId);
      if (!parent) break;
      current = parent;
    }
  }

  return sortStatusStories(
    baseStories.map((story) => ({
      ...story,
      childIssueReadableIds: Array.from(new Set([
        ...(story.childIssueReadableIds || []),
        ...(childrenByParent.get(story.issueReadableId) || [])
      ])),
      childIssues: Array.from(
        new Map(
          [
            ...(story.childIssues || []),
            ...(childrenByParent.get(story.issueReadableId) || []).map((issueReadableId) => ({
              issueReadableId,
              title: storyByReadableId.get(issueReadableId)?.title || issueReadableId
            }))
          ].map((child) => [child.issueReadableId, child])
        ).values()
      )
    })).filter(story => includeInactive || includedIds.has(story.issueReadableId))
  );
};

export const buildStatusStoryHtml = (story: StatusStory) => {
  const commentsForCanvas = [...story.comments].sort((a, b) => a.timestamp - b.timestamp);
  const commentsHtml = commentsForCanvas.length
    ? `<ul>${commentsForCanvas.map(comment => `<li><strong>${escapeHtml(comment.author)} · ${comment.source === 'daily-note' ? 'kontekst Daily' : escapeHtml(new Date(comment.timestamp).toLocaleString('pl-PL'))}:</strong> ${escapeHtml(comment.text)}</li>`).join('')}</ul>`
    : '<p>Brak aktywności w wybranym okresie.</p>';
  const descriptionHtml = (story.description || story.technicalSummary || '').split('\n').filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`).join('');
  return `
    <section data-issue-id="${escapeHtml(story.issueReadableId)}">
      <h2><a href="${escapeHtml(story.issueUrl)}" target="_blank" rel="noreferrer">${escapeHtml(story.issueReadableId)}</a> ${escapeHtml(story.title)}</h2>
      ${story.parentIssueReadableId ? `<p><strong>Zadanie nadrzędne:</strong> ${escapeHtml(story.parentIssueReadableId)} ${escapeHtml(story.parentIssueTitle || '')}</p>` : ''}
      <p><strong>Status:</strong> ${escapeHtml(story.stateName || 'Brak statusu')} · <strong>Przypisano:</strong> ${escapeHtml(story.assigneeName || 'Nieprzypisane')}</p>
      ${descriptionHtml}
      <h3>Aktywność i notatki</h3>
      ${commentsHtml}
    </section>
  `.replace(/>\s+</g, '><').trim();
};

export const stripRichText = stripHtml;
