import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';

/**
 * Parsuje token zmiennej (np. 'data', 'data+3d', 'data-1w', 'data+2m')
 * i zwraca obliczoną datę w formacie 'dd.MM.yyyy'.
 * Zwraca null, gdy token nie pasuje do dozwolonych wzorów dat.
 */
export function parseDateVariable(token: string): string | null {
  const normalized = token.toLowerCase().trim();
  
  // Domyślna dzisiejsza data
  if (normalized === 'data') {
    return format(new Date(), 'dd.MM.yyyy');
  }

  // Wyrażenie regularne do wyłapania np. data+3d, data-1m, data+2w
  const match = normalized.match(/^data([+-])(\d+)([dwm])$/);
  if (!match) return null;

  const sign = match[1];
  const amount = parseInt(match[2], 10);
  const unit = match[3];

  let date = new Date();
  
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
