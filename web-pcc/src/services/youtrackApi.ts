import axios from 'axios';
import type { IssueWithHistory } from '@/types/youtrack';

export const formatMinutesToDuration = (minutesStr: string | number): string => {
  const mins = typeof minutesStr === 'string' ? parseInt(minutesStr, 10) : minutesStr;
  if (Number.isNaN(mins)) return String(minutesStr);
  if (mins === 0) return '0m';
  const minutesInHour = 60;
  const minutesInDay = 8 * minutesInHour;
  const minutesInWeek = 5 * minutesInDay;
  let remaining = mins;
  const weeks = Math.floor(remaining / minutesInWeek);
  remaining %= minutesInWeek;
  const days = Math.floor(remaining / minutesInDay);
  remaining %= minutesInDay;
  const hours = Math.floor(remaining / minutesInHour);
  remaining %= minutesInHour;
  const parts = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (remaining > 0) parts.push(`${remaining}m`);
  return parts.join(' ');
};

export interface FetchIssuesPayload {
  projectName: string;
  dateFrom: string;
  dateTo: string;
  tab: 'Aktywno\u015Bci' | 'Do zrobienia';
  customStatuses?: string[];
  tabName?: string;
  includeFilters?: boolean;
}

export const fetchIssuesActivity = async (payload: FetchIssuesPayload): Promise<IssueWithHistory[]> => {
  const response = await axios.post('/api/youtrack', payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data as IssueWithHistory[];
};

export const testYouTrackConnection = async () => {
  const response = await axios.post('/api/youtrack', { action: 'healthcheck' }, { headers: { 'Content-Type': 'application/json' } });
  return response.data as { success: boolean; baseUrlDetected: boolean; message: string };
};

