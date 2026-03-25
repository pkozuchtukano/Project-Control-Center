import { useState } from 'react';
import type { Project, StatusStory } from '../../../types';
import { fetchIssuesActivity, type IssueWithHistory } from '../../../services/youtrackApi';
import { buildStatusStories } from '../utils/statusUtils';

interface StatusStoriesParams {
  project: Project;
  dateFrom: string;
  dateTo: string;
  youtrackBaseUrl?: string;
  youtrackToken?: string;
}

export const useStatusStories = () => {
  const [stories, setStories] = useState<StatusStory[]>([]);
  const [issues, setIssues] = useState<IssueWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStories = async ({
    project,
    dateFrom,
    dateTo,
    youtrackBaseUrl,
    youtrackToken
  }: StatusStoriesParams) => {
    if (!youtrackBaseUrl || !youtrackToken) {
      setError('Brak konfiguracji YouTrack. Uzupełnij URL i token w ustawieniach.');
      setIssues([]);
      setStories([]);
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const query = project.youtrackQuery || project.code;
      const fetchedIssues = await fetchIssuesActivity(
        youtrackBaseUrl,
        youtrackToken,
        query,
        dateFrom,
        dateTo,
        'Aktywności',
        undefined,
        '',
        false
      );

      const dailyComments = window.electron?.getDailyComments
        ? await window.electron.getDailyComments()
        : {};

      const mappedStories = buildStatusStories(
        fetchedIssues,
        (dailyComments || {}) as Record<string, string>,
        youtrackBaseUrl,
        dateFrom,
        dateTo
      );

      setIssues(fetchedIssues);
      setStories(mappedStories);
      return mappedStories;
    } catch (err: unknown) {
      console.error('Status stories refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać danych statusu.');
      setIssues([]);
      setStories([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    stories,
    issues,
    isLoading,
    error,
    refreshStories,
    setStories,
    setIssues
  };
};
