import type { Estimation } from '../../../App';

export const DEFAULT_PHASES = [
  'Projekt zmian',
  'Kodowanie',
  'Testy',
  'Implementacja',
  'Szkolenia',
  'Aktualizacja dokumentacji',
  'Inne'
];

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const createDefaultEstimation = (projectId: string): Estimation => ({
  projectId,
  items: DEFAULT_PHASES.map(name => ({
    id: generateId(),
    name,
    baseHours: 0,
    multiplier: 1.2,
    finalHours: 0,
    isOverridden: false
  })),
  scheduleMode: 'simple',
  scheduleData: {
    simple: { start: '', end: '' },
    milestones: DEFAULT_PHASES.slice(1, 5).map(name => ({
      id: generateId(),
      name,
      date: ''
    }))
  },
  lastModified: new Date().toISOString()
});

export const formatEstimationToHTML = (estimation: Estimation, rate: number, isBrutto: boolean = false): string => {
  const taxMult = isBrutto ? 1.23 : 1;
  const currentRate = rate * taxMult;
  const totalHours = estimation.items.reduce((sum, item) => sum + item.finalHours, 0);
  const totalCost = totalHours * currentRate;

  let html = `
    <table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #000;">Lp.</th>
          <th style="padding: 8px; border: 1px solid #000;">Przedmiot wyceny</th>
          <th style="padding: 8px; border: 1px solid #000; text-align: center;">Liczba Godzin</th>
          <th style="padding: 8px; border: 1px solid #000; text-align: right;">Stawka za h (${isBrutto ? 'brutto' : 'netto'})</th>
          <th style="padding: 8px; border: 1px solid #000; text-align: right;">Kwota razem (${isBrutto ? 'brutto' : 'netto'})</th>
        </tr>
      </thead>
      <tbody>
  `;

  estimation.items.forEach((item, index) => {
    if (item.finalHours > 0) {
      const itemCost = item.finalHours * currentRate;
      html += `
        <tr>
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">${index + 1}</td>
          <td style="padding: 8px; border: 1px solid #000;">${item.name}</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.finalHours.toFixed(2)}</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: right;">${currentRate.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: right;">${itemCost.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</td>
        </tr>
      `;
    }
  });

  html += `
      </tbody>
      <tfoot>
        <tr style="font-bold: true; background-color: #f9fafb;">
          <td colspan="2" style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: bold;">RAZEM:</td>
          <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${totalHours.toFixed(2)}</td>
          <td style="padding: 8px; border: 1px solid #000;"></td>
          <td style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: bold;">${totalCost.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</td>
        </tr>
      </tfoot>
    </table>
  `;

  return html;
};

export const formatScheduleToHTML = (estimation: Estimation): string => {
  if (estimation.scheduleMode === 'simple') {
    return `
      <p>Termin realizacji: od ${estimation.scheduleData.simple.start || '...'} do ${estimation.scheduleData.simple.end || '...'}</p>
    `;
  }

  let html = `
    <table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #000;">Zadanie / Etap</th>
          <th style="padding: 8px; border: 1px solid #000; text-align: center;">Termin</th>
        </tr>
      </thead>
      <tbody>
  `;

  estimation.scheduleData.milestones.forEach(m => {
    html += `
      <tr>
        <td style="padding: 8px; border: 1px solid #000;">${m.name}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: center;">${m.date || '...'}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  return html;
};
