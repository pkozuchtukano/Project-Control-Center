import { format } from 'date-fns';
import type { StatusStory, StatusStoryComment } from '@/types/domain';
import type { IssueWithHistory } from '@/types/youtrack';
import { formatMinutesToDuration } from '@/services/youtrackApi';

const stripHtml = (value?: string | null) =>
  (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

export const stripRichText = stripHtml;

export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const summarizeTechnicalContext = (issue: IssueWithHistory, fromTime: number, toTime: number) => {
  const description = stripHtml(issue.description);
  const fieldChanges = (issue.timeline || [])
    .filter((item) => item.type === 'field-change' && item.timestamp >= fromTime && item.timestamp <= toTime)
    .slice(-3)
    .map((item) => `${item.field}: ${String(item.added || 'zmiana')}`);

  return [
    issue.state?.name ? `Status: ${issue.state.name}` : '',
    issue.assignee?.name ? `Assignee: ${issue.assignee.name}` : '',
    description ? `Opis: ${description.slice(0, 280)}` : '',
    fieldChanges.length ? `Ostatnie zmiany: ${fieldChanges.join('; ')}` : '',
  ].filter(Boolean).join('\n');
};

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();
const childPatterns = ['subtask', 'sub-task', 'sub task', 'child', 'podzadanie'];
const parentPatterns = ['parent', 'parent for', 'parent of', 'rodzic'];
const hasPattern = (value: string, patterns: string[]) => patterns.some((entry) => value.includes(entry));

const getLabels = (link: NonNullable<IssueWithHistory['links']>[number]) => {
  const direction = normalize(link.direction);
  const outward = normalize(link.linkType?.outwardName);
  const inward = normalize(link.linkType?.inwardName);
  const typeName = normalize(link.linkType?.name);
  if (direction === 'outward') return { current: inward || outward || typeName, typeName };
  if (direction === 'inward') return { current: outward || inward || typeName, typeName };
  return { current: outward || inward || typeName, typeName };
};

const getParentLink = (issue: IssueWithHistory) => {
  for (const link of issue.links || []) {
    const direction = normalize(link.direction);
    const labels = getLabels(link);
    const linked = link.issues?.[0];
    if (!linked) continue;
    if (labels.typeName.includes('subtask')) {
      if (direction === 'inward') return linked;
      continue;
    }
    if (hasPattern(labels.current, childPatterns) && !hasPattern(labels.current, parentPatterns)) return linked;
  }
  return null;
};

const getChildLinks = (issue: IssueWithHistory) =>
  (issue.links || [])
    .filter((link) => {
      const direction = normalize(link.direction);
      const labels = getLabels(link);
      if (labels.typeName.includes('subtask')) return direction === 'outward';
      return hasPattern(labels.current, parentPatterns) && !hasPattern(labels.current, childPatterns);
    })
    .flatMap((link) => link.issues || [])
    .filter((linked, index, all) => all.findIndex((entry) => entry.idReadable === linked.idReadable) === index);

export const buildStatusStories = (
  issues: IssueWithHistory[],
  dailyComments: Record<string, string>,
  baseUrl: string,
  dateFrom: string,
  dateTo: string
): StatusStory[] => {
  const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
  const toTime = new Date(`${dateTo}T23:59:59`).getTime();
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return issues
    .map((issue) => {
      const comments: StatusStoryComment[] = (issue.timeline || [])
        .filter((item) => item.timestamp >= fromTime && item.timestamp <= toTime)
        .flatMap<StatusStoryComment>((item) => {
          if (item.type === 'comment' && item.text?.trim()) {
            return [{
              id: item.id,
              author: item.author?.name || item.author?.login || 'YouTrack',
              timestamp: item.timestamp,
              text: item.text.trim(),
              source: 'youtrack-comment',
            }];
          }

          if (item.type === 'work-item' && item.minutes) {
            return [{
              id: item.id,
              author: item.author?.name || item.author?.login || 'YouTrack',
              timestamp: item.timestamp,
              text: [
                `Zalogowano ${formatMinutesToDuration(item.minutes)}`,
                item.workItemType ? `(${item.workItemType})` : '',
                item.workComments?.join('; ') || '',
              ].filter(Boolean).join(' '),
              source: 'work-item',
            }];
          }

          return [];
        });

      const dailyNote = dailyComments[issue.idReadable]?.trim();
      if (dailyNote) {
        comments.push({
          id: `daily-${issue.idReadable}`,
          author: 'Daily',
          timestamp: issue.updated || issue.created || Date.now(),
          text: dailyNote,
          source: 'daily-note',
        });
      }

      const parentLink = getParentLink(issue);
      const childLinks = getChildLinks(issue);
      const issueUrl = normalizedBaseUrl ? `${normalizedBaseUrl}/issue/${issue.idReadable}` : `/issue/${issue.idReadable}`;

      return {
        id: issue.id,
        issueId: issue.id,
        issueReadableId: issue.idReadable,
        issueUrl,
        title: issue.summary,
        parentIssueId: parentLink?.id || null,
        parentIssueReadableId: parentLink?.idReadable || null,
        parentIssueTitle: parentLink?.summary || null,
        childIssueReadableIds: childLinks.map((child) => child.idReadable),
        childIssues: childLinks.map((child) => ({ issueReadableId: child.idReadable, title: child.summary || child.idReadable })),
        startedAt: issue.created ? new Date(issue.created).toISOString() : new Date().toISOString(),
        updatedAt: issue.updated ? new Date(issue.updated).toISOString() : new Date().toISOString(),
        technicalSummary: summarizeTechnicalContext(issue, fromTime, toTime),
        comments: comments.sort((left, right) => right.timestamp - left.timestamp),
        dailyNote,
        projectCode: issue.project?.shortName,
        stateName: issue.state?.name,
        assigneeName: issue.assignee?.name || null,
      } satisfies StatusStory;
    })
    .filter((story) => story.comments.length > 0 || story.technicalSummary || story.title)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
};

export const buildStatusStoryHtml = (story: StatusStory) => {
  const commentsHtml = story.comments.length
    ? `<ul style="margin:6px 0 0 18px;padding:0;">${[...story.comments].sort((left, right) => left.timestamp - right.timestamp).map((comment) => `<li style="margin:0 0 4px 0;"><strong>${escapeHtml(comment.author)}:</strong> ${escapeHtml(comment.text)}</li>`).join('')}</ul>`
    : '<p style="margin:6px 0 0 0;">Brak komentarzy w wybranym zakresie.</p>';

  const technicalHtml = (story.technicalSummary || 'Brak dodatkowego opisu technicznego.')
    .split('\n')
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 4px 0;">${escapeHtml(line)}</p>`)
    .join('');

  return `
    <section data-issue-id="${escapeHtml(story.issueReadableId)}" style="margin: 0 0 12px 0; padding: 12px 14px; border: 1px solid #dbeafe; background: linear-gradient(180deg, rgba(239,246,255,0.95), rgba(255,255,255,0.98)); border-radius: 14px;">
      <h2 style="margin:0 0 6px 0;font-size:16px;line-height:1.35;"><a href="${escapeHtml(story.issueUrl)}" target="_blank" rel="noreferrer">${escapeHtml(story.issueReadableId)}</a> ${escapeHtml(story.title)}</h2>
      ${technicalHtml}
      ${story.dailyNote ? `<blockquote style="margin:6px 0;padding-left:10px;border-left:3px solid #d1d5db;color:#6b7280;"><p style="margin:0;">${escapeHtml(story.dailyNote)}</p></blockquote>` : ''}
      ${commentsHtml}
    </section>
  `;
};

export const buildDefaultStatusTitle = (projectCode: string, dateTo: string) => `Status projektu ${projectCode} - ${format(new Date(`${dateTo}T00:00:00`), 'dd.MM.yyyy')}`;
