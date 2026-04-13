import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';

const parseBaseDate = (baseDate?: Date | string): Date | null => {
  if (!baseDate) return null;

  if (baseDate instanceof Date) {
    return Number.isNaN(baseDate.getTime()) ? null : baseDate;
  }

  const trimmedValue = String(baseDate).trim();
  if (!trimmedValue) return null;

  const polishDateMatch = trimmedValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (polishDateMatch) {
    const [, day, month, year] = polishDateMatch;
    const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const isoDateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(trimmedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

/**
 * Parsuje token zmiennej (np. 'data', 'data+3d', 'data-1w', 'data+2m')
 * i zwraca obliczoną datę w formacie 'dd.MM.yyyy'.
 * Zwraca null, gdy token nie pasuje do dozwolonych wzorów dat.
 */
export function parseDateVariable(token: string, baseDate?: Date | string): string | null {
  const normalized = token.toLowerCase().trim();
  const referenceDate = parseBaseDate(baseDate) || new Date();

  if (normalized === 'data') {
    return format(referenceDate, 'dd.MM.yyyy');
  }

  const match = normalized.match(/^data([+-])(\d+)([dwm])$/);
  if (!match) return null;

  const sign = match[1];
  const amount = parseInt(match[2], 10);
  const unit = match[3];

  let date = referenceDate;

  if (sign === '+') {
    if (unit === 'd') date = addDays(date, amount);
    else if (unit === 'w') date = addWeeks(date, amount);
    else if (unit === 'm') date = addMonths(date, amount);
  } else if (sign === '-') {
    if (unit === 'd') date = subDays(date, amount);
    else if (unit === 'w') date = subWeeks(date, amount);
    else if (unit === 'm') date = subMonths(date, amount);
  }

  return format(date, 'dd.MM.yyyy');
}
