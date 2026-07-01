import type { Estimation, Project, OrderProtocolStep } from '../../../types';
import { parseDateVariable } from '../../../utils/dateParsing';

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
    roleId: '',
    roleName: '',
    details: '',
    baseHours: 0,
    multiplier: 1.2,
    finalHours: 0,
    isOverridden: false
  })),
  expectedHours: null,
  scheduleMode: 'simple',
  scheduleData: {
    simple: { start: '', end: '' },
    milestones: DEFAULT_PHASES.slice(1, 5).map(name => ({
      id: generateId(),
      name,
      date: ''
    }))
  },
  emailTemplate: {
    to: '',
    cc: '',
    subject: 'Wycena projektu: {{nr}}',
    body: 'Szanowni Państwo,\n\nw załączeniu przesyłam wycenę dla projektu {{nr}}.\n\nZ poważaniem,\n{{podpis}}',
    variables: {}
  },
  flow: {
    steps: [],
    completedStepIds: []
  },
  lastModified: new Date().toISOString()
});

const getRoleBasedItemRate = (item: Estimation['items'][number], project: Project) => {
  const role = (project.personnelRoles || []).find((personnelRole) => personnelRole.id === item.roleId);
  return Number(item.rate ?? role?.hourlyRate ?? 0) || 0;
};

export const formatEstimationToHTML = (estimation: Estimation, projectOrRate: Project | number, isBrutto: boolean = false): string => {
  if (typeof projectOrRate !== 'number' && projectOrRate.hasPersonnelRoles) {
    const project = projectOrRate;
    const totalHours = estimation.items.reduce((sum, item) => sum + item.finalHours, 0);
    const totalCost = estimation.items.reduce((sum, item) => sum + (item.finalHours * getRoleBasedItemRate(item, project)), 0);

    let html = `
      <table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; border: 1px solid #000;">Lp.</th>
            <th style="padding: 8px; border: 1px solid #000;">Przedmiot wyceny</th>
            <th style="padding: 8px; border: 1px solid #000;">Rola</th>
            <th style="padding: 8px; border: 1px solid #000;">Uwagi / Wyszczególnienie</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: center;">Liczba Godzin</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">Stawka za godz. brutto</th>
            <th style="padding: 8px; border: 1px solid #000; text-align: right;">Kwota razem brutto</th>
          </tr>
        </thead>
        <tbody>
    `;

    estimation.items.forEach((item, index) => {
      if (item.finalHours > 0 || item.name || item.roleName || item.details) {
        const rate = getRoleBasedItemRate(item, project);
        const itemCost = item.finalHours * rate;
        html += `
          <tr>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${index + 1}</td>
            <td style="padding: 8px; border: 1px solid #000;">${item.name || ''}</td>
            <td style="padding: 8px; border: 1px solid #000;">${item.roleName || ''}</td>
            <td style="padding: 8px; border: 1px solid #000;">${item.details || ''}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.finalHours.toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${rate.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right;">${itemCost.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</td>
          </tr>
        `;
      }
    });

    html += `
        </tbody>
        <tfoot>
          <tr style="font-bold: true; background-color: #f9fafb;">
            <td colspan="4" style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: bold;">RAZEM:</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${totalHours.toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #000;"></td>
            <td style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: bold;">${totalCost.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</td>
          </tr>
        </tfoot>
      </table>
    `;

    return html;
  }

  const rate = typeof projectOrRate === 'number' ? projectOrRate : projectOrRate.rateNetto;
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

const formatNullableNumber = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

const formatCurrencyValue = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const normalizeTemplateVariableKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const POLISH_NUMBER_UNITS = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const POLISH_NUMBER_TEENS = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const POLISH_NUMBER_TENS = ['', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const POLISH_NUMBER_HUNDREDS = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
const POLISH_NUMBER_GROUPS: [string, string, string][] = [
  ['', '', ''],
  ['tysiąc', 'tysiące', 'tysięcy'],
  ['milion', 'miliony', 'milionów'],
  ['miliard', 'miliardy', 'miliardów'],
];

const getPolishPluralForm = (value: number, forms: [string, string, string]) => {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (value === 1) return forms[0];
  if (mod100 >= 12 && mod100 <= 14) return forms[2];
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 10 && mod100 <= 19)) return forms[1];
  return forms[2];
};

const convertTripletToPolishWords = (value: number) => {
  if (value === 0) return '';

  const hundreds = Math.floor(value / 100);
  const tensUnits = value % 100;
  const tens = Math.floor(tensUnits / 10);
  const units = tensUnits % 10;
  const parts: string[] = [];

  if (hundreds > 0) parts.push(POLISH_NUMBER_HUNDREDS[hundreds]);

  if (tensUnits >= 10 && tensUnits < 20) {
    parts.push(POLISH_NUMBER_TEENS[tensUnits - 10]);
  } else {
    if (tens > 0) parts.push(POLISH_NUMBER_TENS[tens]);
    if (units > 0) parts.push(POLISH_NUMBER_UNITS[units]);
  }

  return parts.join(' ').trim();
};

const convertIntegerToPolishWords = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return 'zero';

  const parts: string[] = [];
  let remaining = Math.floor(Math.abs(value));
  let groupIndex = 0;

  while (remaining > 0) {
    const triplet = remaining % 1000;
    if (triplet > 0) {
      const groupForms = POLISH_NUMBER_GROUPS[groupIndex] || ['', '', ''];
      const words = convertTripletToPolishWords(triplet);
      const groupWord = groupIndex === 1 && triplet === 1
        ? groupForms[0]
        : groupForms[0] ? getPolishPluralForm(triplet, groupForms) : '';
      parts.unshift([words, groupWord].filter(Boolean).join(' ').trim());
    }

    remaining = Math.floor(remaining / 1000);
    groupIndex += 1;
  }

  const normalized = parts.filter(Boolean).join(' ').trim();
  return value < 0 ? `minus ${normalized}` : normalized;
};

const normalizeCurrencyStringToNumber = (value: string) => {
  const normalized = value.replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrencyAmountInWords = (value: string) => {
  const numericValue = normalizeCurrencyStringToNumber(value);
  if (numericValue === null) return '';

  const absoluteValue = Math.abs(numericValue);
  const zlotyValue = Math.floor(absoluteValue);
  const groszValue = Math.round((absoluteValue - zlotyValue) * 100);
  const carryToZloty = groszValue === 100 ? 1 : 0;
  const normalizedZlotyValue = zlotyValue + carryToZloty;
  const normalizedGroszValue = carryToZloty ? 0 : groszValue;
  const zlotyWords = convertIntegerToPolishWords(normalizedZlotyValue);
  const zlotyLabel = getPolishPluralForm(normalizedZlotyValue, ['złoty', 'złote', 'złotych']);
  const groszLabel = getPolishPluralForm(normalizedGroszValue, ['grosz', 'grosze', 'groszy']);
  const amountInWords = `${zlotyWords} ${zlotyLabel} ${String(normalizedGroszValue).padStart(2, '0')}/100 ${groszLabel}`;

  return numericValue < 0 ? `minus ${amountInWords}` : amountInWords;
};

const unwrapTemplateExpression = (value: string) => {
  const trimmedValue = value.trim();
  const wrappedMatch = trimmedValue.match(/^\{\{\s*(.+?)\s*\}\}$/);
  return wrappedMatch ? wrappedMatch[1].trim() : trimmedValue;
};

const isUnresolvedTemplateValue = (value: string) => /^\{\{.+\}\}$/.test(value.trim());

export const extractEstimationTemplateVariableReferences = (template: string) => {
  const references: string[] = [];
  const matches = template.matchAll(/{{\s*([^}]+)\s*}}/g);

  for (const match of matches) {
    const expression = unwrapTemplateExpression(match[1] || '');
    const functionMatch = expression.match(/^slownie\s*\((.*)\)$/i);
    if (functionMatch) {
      const nestedExpression = unwrapTemplateExpression(functionMatch[1] || '');
      if (nestedExpression) {
        references.push(...extractEstimationTemplateVariableReferences(`{{${nestedExpression}}}`));
      }
      continue;
    }

    if (expression) references.push(expression);
  }

  return references;
};

export const getEstimationVariableDefinitions = (
  estimation: Estimation,
  project: Project,
  overrides?: Partial<Record<string, string>>,
) => {
  const totalHours = estimation.items.reduce((sum, item) => sum + (Number(item.finalHours) || 0), 0);
  const totalBaseHours = estimation.items.reduce((sum, item) => sum + (Number(item.baseHours) || 0), 0);
  const totalNetValue = totalHours * (project.rateNetto || 0);
  const totalGrossValue = totalHours * (project.rateBrutto || 0);
  const itemNames = estimation.items.map((item) => item.name.trim()).filter(Boolean);
  const activeItemNames = estimation.items.filter((item) => item.finalHours > 0).map((item) => item.name.trim()).filter(Boolean);
  const taskTypeNames = (project.taskTypes || []).map((taskType) => taskType.name.trim()).filter(Boolean);
  const stakeholderNames = (project.stakeholders || []).map((stakeholder) => stakeholder.name.trim()).filter(Boolean);
  const stakeholderDetails = (project.stakeholders || [])
    .map((stakeholder) => [stakeholder.name, stakeholder.role].filter(Boolean).join(' - ').trim())
    .filter(Boolean);
  const resolvedDate = parseDateVariable('data', overrides?.data) || new Date().toLocaleDateString('pl-PL');
  const simpleStart = estimation.scheduleData.simple.start || '';
  const simpleEnd = estimation.scheduleData.simple.end || '';
  const milestoneNames = estimation.scheduleData.milestones.map((milestone) => milestone.name.trim()).filter(Boolean);
  const milestoneDates = estimation.scheduleData.milestones
    .map((milestone) => [milestone.name, milestone.date].filter(Boolean).join(' - ').trim())
    .filter(Boolean);

  return [
    { token: 'projekt_id', aliases: ['projectId', 'project.id', 'projekt.id'], value: project.id || estimation.projectId || '' },
    { token: 'kod_projektu', aliases: ['projectCode', 'code', 'project.code', 'projekt.kod'], value: project.code || '' },
    { token: 'nazwa_projektu', aliases: ['projectName', 'name', 'project.name', 'projekt.nazwa'], value: project.name || '' },
    { token: 'nr_umowy', aliases: ['contractNo', 'contractNumber', 'project.contractNo', 'projekt.nr_umowy'], value: project.contractNo || '' },
    { token: 'przedmiot_umowy', aliases: ['contractSubject', 'project.contractSubject', 'projekt.przedmiot_umowy'], value: project.contractSubject || '' },
    { token: 'projekt_data_od', aliases: ['projectDateFrom', 'project.dateFrom', 'projekt.data_od'], value: project.dateFrom || '' },
    { token: 'projekt_data_do', aliases: ['projectDateTo', 'project.dateTo', 'projekt.data_do'], value: project.dateTo || '' },
    { token: 'min_godzin', aliases: ['projectMinHours', 'minHours', 'project.minHours', 'projekt.min_godzin'], value: formatNullableNumber(project.minHours) },
    { token: 'max_godzin', aliases: ['projectMaxHours', 'maxHours', 'project.maxHours', 'projekt.max_godzin'], value: formatNullableNumber(project.maxHours) },
    { token: 'stawka_netto', aliases: ['projectRateNetto', 'rateNetto', 'project.rateNetto', 'projekt.stawka_netto'], value: formatNullableNumber(project.rateNetto) },
    { token: 'stawka_brutto', aliases: ['projectRateBrutto', 'rateBrutto', 'project.rateBrutto', 'projekt.stawka_brutto'], value: formatNullableNumber(project.rateBrutto) },
    { token: 'stawka_vat', aliases: ['projectVatRate', 'vatRate', 'project.vatRate', 'projekt.stawka_vat'], value: formatNullableNumber(project.vatRate) },
    { token: 'czy_utrzymanie', aliases: ['hasMaintenance', 'project.hasMaintenance', 'projekt.czy_utrzymanie'], value: project.hasMaintenance ? 'TAK' : 'NIE' },
    { token: 'utrzymanie_kwota_netto', aliases: ['maintenanceNetAmount', 'project.maintenanceNetAmount', 'projekt.utrzymanie_kwota_netto'], value: formatNullableNumber(project.maintenanceNetAmount) },
    { token: 'utrzymanie_stawka_vat', aliases: ['maintenanceVatRate', 'project.maintenanceVatRate', 'projekt.utrzymanie_stawka_vat'], value: formatNullableNumber(project.maintenanceVatRate) },
    { token: 'utrzymanie_kwota_brutto', aliases: ['maintenanceGrossAmount', 'project.maintenanceGrossAmount', 'projekt.utrzymanie_kwota_brutto'], value: formatNullableNumber(project.maintenanceGrossAmount) },
    { token: 'cel_marzy_proc', aliases: ['targetProfitPct', 'targetProfitPercent', 'project.targetProfitPct', 'projekt.cel_marzy_proc'], value: formatNullableNumber(project.targetProfitPct) },
    { token: 'youtrack_query', aliases: ['youtrackQuery', 'project.youtrackQuery', 'projekt.youtrack_query'], value: project.youtrackQuery || '' },
    { token: 'google_doc_link', aliases: ['googleDocLink', 'project.googleDocLink', 'projekt.google_doc_link'], value: project.googleDocLink || '' },
    { token: 'typy_zadan', aliases: ['taskTypes', 'taskTypeNames', 'project.taskTypes', 'projekt.typy_zadan'], value: taskTypeNames.join(', ') },
    { token: 'liczba_typow_zadan', aliases: ['taskTypesCount', 'project.taskTypesCount', 'projekt.liczba_typow_zadan'], value: String(taskTypeNames.length) },
    { token: 'interesariusze', aliases: ['stakeholders', 'stakeholderNames', 'project.stakeholders', 'projekt.interesariusze'], value: stakeholderNames.join(', ') },
    { token: 'interesariusze_szczegoly', aliases: ['stakeholderDetails', 'project.stakeholderDetails', 'projekt.interesariusze_szczegoly'], value: stakeholderDetails.join(', ') },
    { token: 'liczba_interesariuszy', aliases: ['stakeholdersCount', 'project.stakeholdersCount', 'projekt.liczba_interesariuszy'], value: String((project.stakeholders || []).length) },
    { token: 'nr', aliases: ['numer', 'estimationNumber', 'orderNumber', 'estimation.number', 'wycena.nr', 'order.orderNumber', 'zlecenie.nr'], value: project.code || '' },
    { token: 'tytul', aliases: ['tytuł', 'title', 'estimation.title', 'wycena.tytul', 'order.title', 'zlecenie.tytul'], value: project.name || '' },
    { token: 'data', aliases: ['dzis', 'today'], value: resolvedDate },
    { token: 'produkty', aliases: ['items', 'estimation.items', 'wycena.produkty'], value: activeItemNames.join(', ') || itemNames.join(', ') },
    { token: 'pozycje_wyceny', aliases: ['estimationItems', 'estimation.itemsAll', 'wycena.pozycje'], value: itemNames.join(', ') },
    { token: 'liczba_pozycji', aliases: ['itemsCount', 'estimation.itemsCount', 'wycena.liczba_pozycji'], value: String(estimation.items.length) },
    { token: 'liczba_pozycji_aktywnych', aliases: ['activeItemsCount', 'estimation.activeItemsCount', 'wycena.liczba_pozycji_aktywnych'], value: String(activeItemNames.length) },
    { token: 'suma_godzin', aliases: ['totalHours', 'estimation.totalHours', 'wycena.suma_godzin', 'order.totalHours', 'zlecenie.suma_godzin'], value: formatNullableNumber(totalHours) },
    { token: 'suma_godzin_bazowych', aliases: ['totalBaseHours', 'estimation.totalBaseHours', 'wycena.suma_godzin_bazowych'], value: formatNullableNumber(totalBaseHours) },
    { token: 'oczekiwane_godziny', aliases: ['expectedHours', 'estimation.expectedHours', 'wycena.oczekiwane_godziny'], value: formatNullableNumber(estimation.expectedHours) },
    { token: 'wartosc_netto', aliases: ['netValue', 'estimationNetValue', 'estimation.netValue', 'wycena.wartosc_netto', 'order.netValue', 'zlecenie.wartosc_netto'], value: formatCurrencyValue(totalNetValue) },
    { token: 'wartosc_brutto', aliases: ['grossValue', 'estimationGrossValue', 'estimation.grossValue', 'wycena.wartosc_brutto', 'order.grossValue', 'zlecenie.wartosc_brutto'], value: formatCurrencyValue(totalGrossValue) },
    { token: 'wartosc_netto_slownie', aliases: ['netValueWords', 'estimationNetValueWords', 'estimation.netValueWords', 'wycena.wartosc_netto_slownie'], value: formatCurrencyAmountInWords(formatCurrencyValue(totalNetValue)) },
    { token: 'wartosc_brutto_slownie', aliases: ['grossValueWords', 'estimationGrossValueWords', 'estimation.grossValueWords', 'wycena.wartosc_brutto_slownie'], value: formatCurrencyAmountInWords(formatCurrencyValue(totalGrossValue)) },
    { token: 'tryb_harmonogramu', aliases: ['scheduleMode', 'schedule.mode', 'harmonogram.tryb'], value: estimation.scheduleMode === 'simple' ? 'prosty' : 'kamienie milowe' },
    { token: 'data_realizacji_od', aliases: ['scheduleFrom', 'schedule.from', 'harmonogram.od'], value: simpleStart },
    { token: 'data_realizacji_do', aliases: ['scheduleTo', 'schedule.to', 'harmonogram.do'], value: simpleEnd },
    { token: 'kamienie_milowe', aliases: ['milestones', 'schedule.milestones', 'harmonogram.kamienie_milowe'], value: milestoneNames.join(', ') },
    { token: 'kamienie_milowe_terminy', aliases: ['milestoneDates', 'schedule.milestoneDates', 'harmonogram.kamienie_milowe_terminy'], value: milestoneDates.join(', ') },
  ];
};

const buildEstimationVariableMap = (
  estimation: Estimation,
  project: Project,
  overrides?: Partial<Record<string, string>>,
) => {
  const map: Record<string, string> = {};

  getEstimationVariableDefinitions(estimation, project, overrides).forEach(({ token, aliases, value }) => {
    [token, ...(aliases || [])].forEach((alias) => {
      map[normalizeTemplateVariableKey(alias)] = value;
    });
  });

  Object.entries(overrides || {}).forEach(([token, value]) => {
    const normalizedToken = normalizeTemplateVariableKey(token);
    if (normalizedToken) {
      map[normalizedToken] = String(value ?? '');
    }
  });

  return map;
};

const resolveTemplateExpression = (rawExpression: string, variableMap: Record<string, string>) => {
  const expression = String(rawExpression).trim();
  const functionMatch = expression.match(/^slownie\s*\((.*)\)$/i);

  if (functionMatch) {
    const argumentExpression = unwrapTemplateExpression(functionMatch[1]);
    const normalizedArgument = normalizeTemplateVariableKey(argumentExpression);
    const directArgumentValue = Object.prototype.hasOwnProperty.call(variableMap, normalizedArgument)
      ? variableMap[normalizedArgument]
      : argumentExpression;
    const recursivelyResolvedArgument = resolveTemplateExpression(argumentExpression, variableMap);
    const argumentValue = isUnresolvedTemplateValue(recursivelyResolvedArgument)
      ? directArgumentValue
      : recursivelyResolvedArgument;
    const amountInWords = formatCurrencyAmountInWords(argumentValue);
    return amountInWords || `{{${expression}}}`;
  }

  const resolvedDateVariable = parseDateVariable(expression, variableMap[normalizeTemplateVariableKey('data')]);
  if (resolvedDateVariable) {
    return resolvedDateVariable;
  }

  const normalizedToken = normalizeTemplateVariableKey(expression);
  return Object.prototype.hasOwnProperty.call(variableMap, normalizedToken)
    ? variableMap[normalizedToken]
    : `{{${expression}}}`;
};

export const resolveEstimationTemplate = (
  template: string,
  estimation: Estimation,
  project: Project,
  overrides?: Partial<Record<string, string>>,
) => {
  const variableMap = buildEstimationVariableMap(estimation, project, overrides);

  return template
    .replace(/{{\s*(slownie\s*\((?:[^()]|\([^()]*\))*\))\s*}}/gi, (_match, rawExpression) =>
      resolveTemplateExpression(String(rawExpression), variableMap)
    )
    .replace(/{{\s*([^}]+)\s*}}/g, (_match, rawExpression) =>
      resolveTemplateExpression(String(rawExpression), variableMap)
    );
};

export const getEstimationCustomVariableFields = (
  estimation: Estimation,
  project: Project,
  extraSteps: OrderProtocolStep[] = [],
) => {
  const template = estimation.emailTemplate || { to: '', cc: '', subject: '', body: '', variables: {} };
  const knownVariableKeys = new Set(
    getEstimationVariableDefinitions(estimation, project)
      .flatMap((variable) => [variable.token, ...(variable.aliases || [])])
      .map((token) => normalizeTemplateVariableKey(token))
  );
  const references = [
    ...extractEstimationTemplateVariableReferences(template.to || ''),
    ...extractEstimationTemplateVariableReferences(template.cc || ''),
    ...extractEstimationTemplateVariableReferences(template.subject || ''),
    ...extractEstimationTemplateVariableReferences(template.body || ''),
    ...extraSteps.flatMap((step) => [
      ...extractEstimationTemplateVariableReferences(step.description || ''),
      ...extractEstimationTemplateVariableReferences(step.linkLabel || ''),
      ...extractEstimationTemplateVariableReferences(step.linkUrl || ''),
    ]),
  ];

  return Array.from(
    new Map(
      references
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => !parseDateVariable(token))
        .filter((token) => !knownVariableKeys.has(normalizeTemplateVariableKey(token)))
        .map((token) => [normalizeTemplateVariableKey(token), token])
    ).values()
  ).sort((left, right) => left.localeCompare(right, 'pl', { sensitivity: 'base' }));
};
