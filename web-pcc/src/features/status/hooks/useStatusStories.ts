import { useState } from 'react';
import type { Project, StatusStory } from '@/types/domain';
import type { IssueWithHistory } from '@/types/youtrack';
import { fetchIssuesActivity } from '@/services/youtrackApi';
import { buildStatusStories } from '@/features/status/utils/statusUtils';

export const useStatusStories = () => {
  const [stories, setStories] = useState<StatusStory[]>([]);
  const [issues, setIssues] = useState<IssueWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStories = async ({
    project,
    dateFrom,
    dateTo,
    dailyComments,
    youtrackBaseUrl,
  }: {
    project: Project;
    dateFrom: string;
    dateTo: string;
    dailyComments: Record<string, string>;
    youtrackBaseUrl: string;
  }): Promise<StatusStory[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const query = project.youtrackQuery || project.code;
      const fetchedIssues = await fetchIssuesActivity({
        projectName: query,
        dateFrom,
        dateTo,
        tab: 'Aktywno\u015Bci',
        tabName: 'Aktywno\u015Bci',
      });
      const mappedStories = buildStatusStories(fetchedIssues, dailyComments, youtrackBaseUrl, dateFrom, dateTo);
      setIssues(fetchedIssues);
      setStories(mappedStories);
      return mappedStories;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Nie udało się pobrać danych statusu.');
      setIssues([]);
      setStories([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return { stories, issues, isLoading, error, refreshStories, setStories, setIssues };
};

