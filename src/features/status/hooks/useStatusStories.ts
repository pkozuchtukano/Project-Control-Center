import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, StatusStory } from '../../../types';
import { fetchIssuesActivity } from '../../../services/youtrackApi';
import { buildStatusStories } from '../utils/statusUtils';

interface StatusStoriesParams {
  project: Project;
  dateFrom: string;
  dateTo: string;
  youtrackBaseUrl?: string;
  youtrackToken?: string;
  additionalIssueIds: string[];
}

export const useStatusStories = () => {
  const [stories, setStories] = useState<StatusStory[]>([]);
  const [allStories, setAllStories] = useState<StatusStory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState('');
  const [loadedRange, setLoadedRange] = useState('');
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current++; }, []);

  const refreshStories = useCallback(async ({ project, dateFrom, dateTo, youtrackBaseUrl, youtrackToken, additionalIssueIds }: StatusStoriesParams) => {
    const request = ++requestId.current;
    setLoadedRange('');
    if (!youtrackBaseUrl || !youtrackToken) {
      setError('Uzupełnij połączenie z YouTrack w ustawieniach.');
      setIsLoading(false);
      return null;
    }
    setIsLoading(true);
    setError(null);
    setWarning('');
    try {
      const missing: string[] = [];
      const issues = await fetchIssuesActivity(
        youtrackBaseUrl, youtrackToken, project.youtrackQuery || project.code,
        dateFrom, dateTo, 'Aktywności', undefined, '', false, {
          additionalIssueIds, projectCode: project.code, onMissingIssue: id => missing.push(id), includeInactive: true
        }
      );
      const notes = window.electron?.getDailyComments ? await window.electron.getDailyComments() : {};
      if (request !== requestId.current) return null;
      const mapped = buildStatusStories(issues, (notes || {}) as Record<string, string>, youtrackBaseUrl, dateFrom, dateTo, true);
      setAllStories(mapped);
      setStories(buildStatusStories(issues, (notes || {}) as Record<string, string>, youtrackBaseUrl, dateFrom, dateTo));
      setLoadedRange(`${dateFrom}/${dateTo}`);
      setWarning(missing.length ? `Nie odświeżono części zadań z historii lub powiązań: ${missing.join(', ')}. Zachowano wcześniejsze dane tych tematów.` : '');
      return mapped;
    } catch (err) {
      if (request === requestId.current) setError(err instanceof Error ? err.message : 'Nie udało się pobrać źródeł.');
      return null;
    } finally {
      if (request === requestId.current) setIsLoading(false);
    }
  }, []);

  return { stories, allStories, isLoading, error, warning, loadedRange, refreshStories };
};
