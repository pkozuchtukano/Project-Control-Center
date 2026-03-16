import { useState } from 'react';
import type { Project, StatusStory } from '../../../types';
import { fetchIssuesActivity } from '../../../services/youtrackApi';
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
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const query = project.youtrackQuery || project.code;
      const issues = await fetchIssuesActivity(
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
        issues,
        (dailyComments || {}) as Record<string, string>,
        youtrackBaseUrl,
        dateFrom,
        dateTo
      );

      setStories(mappedStories);
      return mappedStories;
    } catch (err: any) {
      console.error('Status stories refresh failed:', err);
      setError(err?.message || 'Nie udało się pobrać danych statusu.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    stories,
    isLoading,
    error,
    refreshStories,
    setStories
  };
};
