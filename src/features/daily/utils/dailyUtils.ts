import { format, subDays, startOfToday, isMonday } from 'date-fns';

/**
 * Returns a "Smart" date range for Daily Stand-up.
 * If today is Monday, returns range [Friday, Today].
 * Otherwise returns range [Yesterday, Today].
 */
export const getSmartDateRange = () => {
  const today = startOfToday();
  const dateTo = format(today, 'yyyy-MM-dd');
  
  if (isMonday(today)) {
    const friday = subDays(today, 3);
    return {
      from: format(friday, 'yyyy-MM-dd'),
      to: dateTo
    };
  } else {
    const yesterday = subDays(today, 1);
    return {
      from: format(yesterday, 'yyyy-MM-dd'),
      to: dateTo
    };
  }
};

/**
 * Builds a YouTrack query for multiple projects and a date range.
 * Example outcome: "project: IOS, ANDROID, SWIFT AND updated: 2024-03-08..2024-03-11"
 */
export const buildMultiProjectQuery = (projectCodes: string, dateFrom: string, dateTo: string) => {
  const projects = projectCodes.split(',').map(p => p.trim()).join(', ');
  return `project: ${projects} updated: ${dateFrom} .. ${dateTo}`;
};
