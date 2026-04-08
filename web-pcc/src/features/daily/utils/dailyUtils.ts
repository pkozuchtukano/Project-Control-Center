import { format, isMonday, startOfToday, subDays } from 'date-fns';

export const getSmartDateRange = () => {
  const today = startOfToday();
  const to = format(today, 'yyyy-MM-dd');
  const from = isMonday(today) ? format(subDays(today, 3), 'yyyy-MM-dd') : format(subDays(today, 1), 'yyyy-MM-dd');
  return { from, to };
};

export const normalizeStatuses = (raw: string) =>
  raw
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const matched = entry.match(/\(([^)]+)\)$/);
      return (matched ? matched[1] : entry).trim().toLowerCase();
    });
