import { format } from 'date-fns';
import type { StatusStory } from '../../../types';
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

const getCurrentIssueRelationLabel = (link: NonNullable<IssueWithHistory['links']>[number]) => {
  const direction = normalizeRelationLabel(link.direction);
  const outwardName = normalizeRelationLabel(link.linkType?.outwardName);
  const inwardName = normalizeRelationLabel(link.linkType?.inwardName);
  const typeName = normalizeRelationLabel(link.linkType?.name);

  if (direction === 'outward') {
    return outwardName || typeName || inwardName;
  }

  if (direction === 'inward') {
    return inwardName || typeName || outwardName;
  }

  return outwardName || inwardName || typeName;
};

const getParentLink = (issue: IssueWithHistory) => {
  for (const link of issue.links || []) {
    const directionBasedLabel = getCurrentIssueRelationLabel(link);
    const outwardName = normalizeRelationLabel(link.linkType?.outwardName);
    const inwardName = normalizeRelationLabel(link.linkType?.inwardName);
    const typeName = normalizeRelationLabel(link.linkType?.name);
    const fallbackLabel =
      directionBasedLabel === outwardName
        ? inwardName || typeName
        : outwardName || typeName;
    const linkedIssue = link.issues?.[0];

    if (!linkedIssue) continue;

    const isChildByPrimaryLabel = childRelationPatterns.some(pattern => directionBasedLabel.includes(pattern));
    const isParentByPrimaryLabel = parentRelationPatterns.some(pattern => directionBasedLabel.includes(pattern));
    const isChildByFallbackLabel = childRelationPatterns.some(pattern => fallbackLabel.includes(pattern));
    const isParentByFallbackLabel = parentRelationPatterns.some(pattern => fallbackLabel.includes(pattern));

    if (isChildByPrimaryLabel && !isParentByPrimaryLabel) {
      return linkedIssue;
    }

    if (!isChildByPrimaryLabel && isParentByPrimaryLabel && isChildByFallbackLabel && !isParentByFallbackLabel) {
      return linkedIssue;
    }

    if (!isChildByPrimaryLabel && !isParentByPrimaryLabel && isChildByFallbackLabel) {
      return linkedIssue;
    }

    if (isParentByPrimaryLabel) {
      continue;
    }
  }

  return null;
};

const getChildLinks = (issue: IssueWithHistory) => {
  return (issue.links || [])
    .filter((link) => {
      const directionBasedLabel = getCurrentIssueRelationLabel(link);
      const outwardName = normalizeRelationLabel(link.linkType?.outwardName);
      const inwardName = normalizeRelationLabel(link.linkType?.inwardName);
      const typeName = normalizeRelationLabel(link.linkType?.name);
      const labels = [directionBasedLabel, outwardName, inwardName, typeName].filter(Boolean);

      const hasParentSignal = labels.some(label => parentRelationPatterns.some(pattern => label.includes(pattern)));
      const hasChildSignal = labels.some(label => childRelationPatterns.some(pattern => label.includes(pattern)));

      return hasParentSignal || (typeName.includes('subtask') && !hasChildSignal);
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

  return standaloneStories.flatMap((story) => {
    const children = [...(childrenByGroup.get(story.issueReadableId) || [])].sort(sortByRecentUpdate);
    return [story, ...children];
  });
};

const summarizeTechnicalContext = (issue: IssueWithHistory, fromTime: number, toTime: number) => {
  const description = stripHtml(issue.description);
  const fieldChanges = (issue.timeline || [])
    .filter(item => item.type === 'field-change' && item.timestamp >= fromTime && item.timestamp <= toTime)
    .slice(-3)
    .map(item => `${item.field}: ${item.added || 'zmiana'}`);

  const firstLineParts = [
    issue.state?.name ? `Status: ${issue.state.name}` : '',
    issue.assignee?.name ? `Assignee: ${issue.assignee.name}` : '',
  ].filter(Boolean);

  const lines = [
    firstLineParts.join(' | '),
    description ? `Opis: ${description.slice(0, 280)}` : '',
    fieldChanges.length ? `Ostatnie zmiany: ${fieldChanges.join('; ')}` : '',
  ].filter(Boolean);

  return applyStatusNarrativeTransforms(lines.join('\n'));
};

export const buildStatusStories = (
  issues: IssueWithHistory[],
  dailyComments: Record<string, string>,
  baseUrl: string,
  dateFrom: string,
  dateTo: string
): StatusStory[] => {
  const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
  const toTime = new Date(`${dateTo}T23:59:59`).getTime();
  const baseStories = issues
    .map((issue) => {
      const youTrackComments = (issue.timeline || [])
        .filter(item => item.timestamp >= fromTime && item.timestamp <= toTime)
        .flatMap((item) => {
          if (item.type === 'comment' && item.text?.trim()) {
            return [{
              id: item.id,
              author: item.author?.name || item.author?.login || 'YouTrack',
              timestamp: item.timestamp,
              text: item.text.trim(),
              source: 'youtrack-comment' as const
            }];
          }

          if (item.type === 'work-item' && item.minutes) {
            const note = [
              `Zalogowano ${formatMinutesToDuration(item.minutes)}`,
              item.workItemType ? `(${item.workItemType})` : '',
              item.workComments?.filter(Boolean).join('; ')
            ].filter(Boolean).join(' ');

            return [{
              id: item.id,
              author: item.author?.name || item.author?.login || 'YouTrack',
              timestamp: item.timestamp,
              text: note,
              source: 'work-item' as const
            }];
          }

          return [];
        });

      const dailyNote = dailyComments[issue.idReadable]?.trim();
      const dailyNoteComment = dailyNote ? [{
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
        assigneeName: issue.assignee?.name || null
      } satisfies StatusStory;
    })
    .filter(story => story.comments.length > 0 || story.technicalSummary || story.title);

  const childrenByParent = new Map<string, string[]>();
  const storyByReadableId = new Map(baseStories.map((story) => [story.issueReadableId, story]));

  for (const story of baseStories) {
    if (!story.parentIssueReadableId) continue;
    const group = childrenByParent.get(story.parentIssueReadableId) || [];
    group.push(story.issueReadableId);
    childrenByParent.set(story.parentIssueReadableId, group);
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
    }))
  );
};

export const buildStatusStoryHtml = (story: StatusStory) => {
  const commentsHtml = story.comments.length
    ? `<ul>${story.comments.map(comment => `<li><strong>${escapeHtml(comment.author)}:</strong> ${escapeHtml(comment.text)}</li>`).join('')}</ul>`
    : '<p>Brak komentarzy w wybranym zakresie.</p>';
  const technicalSummaryHtml = (story.technicalSummary || 'Brak dodatkowego opisu technicznego.')
    .split('\n')
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
  const childTitles = (story.childIssues || [])
    .map((child) => child.title?.trim() || child.issueReadableId)
    .filter(Boolean);
  const relationInfoParts = [
    story.parentIssueTitle || story.parentIssueReadableId
      ? `Subtask zadania: ${story.parentIssueTitle || story.parentIssueReadableId}.`
      : '',
    childTitles.length ? `Powi?zane podzadania: ${childTitles.join(', ')}.` : ''
  ].filter(Boolean);
  const relationInfoHtml = relationInfoParts.length
    ? `<p style="margin:0 0 12px 0;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.72);font-size:13px;color:#6b7280;"><strong>Powi?zania:</strong> ${escapeHtml(relationInfoParts.join(' '))}</p>`
    : '';
  const sectionStyle = story.parentIssueReadableId
    ? 'position: relative; margin: 0 0 18px 34px; padding: 18px 20px; border-left: 3px solid #f59e0b; background: linear-gradient(180deg, rgba(255,251,235,0.95), rgba(255,255,255,0.95)); border-radius: 18px;'
    : 'margin: 0 0 24px 0; padding: 22px 24px; border: 1px solid #dbeafe; background: linear-gradient(180deg, rgba(239,246,255,0.95), rgba(255,255,255,0.98)); border-radius: 22px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);';
  const relationLineHtml = story.parentIssueReadableId
    ? '<div style="position:absolute; left:-22px; top:-18px; width:18px; height:24px; border-left:2px solid #f59e0b; border-bottom:2px solid #f59e0b; border-bottom-left-radius:12px;"></div>'
    : '';

  return `
    <section data-issue-id="${escapeHtml(story.issueReadableId)}" data-parent-issue-id="${escapeHtml(story.parentIssueReadableId || '')}" style="${sectionStyle}">
      ${relationLineHtml}
      <h2><a href="${escapeHtml(story.issueUrl)}" target="_blank" rel="noreferrer">${escapeHtml(story.issueReadableId)}</a> ${escapeHtml(story.title)}</h2>
      ${relationInfoHtml}
      ${technicalSummaryHtml}
      ${story.dailyNote ? `<blockquote><p>${escapeHtml(story.dailyNote)}</p></blockquote>` : ''}
      ${commentsHtml}
    </section>
  `;
};

export const buildStatusEditorHtml = (
  projectCode: string,
  title: string,
  dateFrom: string,
  dateTo: string,
  stories: StatusStory[]
) => {
  const dateLabel = `${format(new Date(`${dateFrom}T00:00:00`), 'dd.MM.yyyy')} - ${format(new Date(`${dateTo}T00:00:00`), 'dd.MM.yyyy')}`;

  return `
    <h1>${escapeHtml(title)}</h1>
    <p><strong>Projekt:</strong> ${escapeHtml(projectCode)}<br /><strong>Zakres:</strong> ${escapeHtml(dateLabel)}</p>
    ${sortStatusStories(stories).map(buildStatusStoryHtml).join('') || '<p>Brak danych dla wybranego zakresu.</p>'}
  `;
};

export const stripRichText = stripHtml;
