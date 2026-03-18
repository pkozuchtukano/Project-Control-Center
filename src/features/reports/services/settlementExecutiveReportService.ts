import type { Order, Project } from '../../../types';
import type { WorkItemRow } from '../../work-registry/types';

export type ExecutiveReportChartBar = {
  name: string;
  value: number;
  fill: string;
};

export type ExecutiveReportMetric = {
  label: string;
  hours: number;
  netValue: number;
  grossValue: number;
  accent: string;
};

export type ExecutiveReportHighlight = {
  title: string;
  body: string;
  tone: 'positive' | 'warning' | 'risk' | 'neutral';
};

export type ExecutiveReportContributor = {
  name: string;
  hours: number;
  sharePct: number;
};

export type ExecutiveReportStatusCard = {
  label: string;
  count: number;
  hours: number;
  note: string;
  fill: string;
};

export type ExecutiveSettlementReportData = {
  reportDate: string;
  projectPeriodLabel: string;
  contractUsagePct: number;
  totalOrders: number;
  settledOrders: number;
  contractedTotalHours: number;
  settledHours: number;
  pendingSettlementHours: number;
  totalWorkedHours: number;
  remainingInContract: number;
  profitabilityHours: number;
  profitabilityPct: number;
  contractedNetValue: number;
  settledNetValue: number;
  pendingNetValue: number;
  profitabilityNetValue: number;
  profitabilityGrossValue: number;
  highlights: ExecutiveReportHighlight[];
  summaryText: string;
  metrics: ExecutiveReportMetric[];
  hoursChartData: ExecutiveReportChartBar[];
  valuesChartData: ExecutiveReportChartBar[];
  categoryChartData: ExecutiveReportChartBar[];
  teamChartData: ExecutiveReportChartBar[];
  statusChartData: ExecutiveReportChartBar[];
  topContributors: ExecutiveReportContributor[];
  statusCards: ExecutiveReportStatusCard[];
};

const HOURS_FORMATTER = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CURRENCY_FORMATTER = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('pl-PL');

const formatHours = (value: number) => `${HOURS_FORMATTER.format(value)} h`;
const formatMoney = (value: number) => `${CURRENCY_FORMATTER.format(value)} zł`;

const formatDateLabel = (value?: string) => {
  if (!value) return 'brak';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return DATE_FORMATTER.format(date);
};

const hasOrderDateValue = (value?: string) => Boolean(value && value.trim());
const sumOrderHours = (order: Order) =>
  order.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
const isCancelledOrder = (order: Order) =>
  !hasOrderDateValue(order.scheduleFrom)
  && !hasOrderDateValue(order.scheduleTo)
  && !hasOrderDateValue(order.handoverDate)
  && !hasOrderDateValue(order.acceptanceDate);
const isSettledOrder = (order: Order) => hasOrderDateValue(order.acceptanceDate);
const isPendingSettlementOrder = (order: Order) =>
  !isCancelledOrder(order)
  && !isSettledOrder(order)
  && hasOrderDateValue(order.scheduleFrom);
const isHandedOverPendingOrder = (order: Order) =>
  isPendingSettlementOrder(order) && hasOrderDateValue(order.handoverDate);
const isInProgressPendingOrder = (order: Order) =>
  isPendingSettlementOrder(order) && !hasOrderDateValue(order.handoverDate);

export const buildExecutiveSettlementReportData = ({
  project,
  orders,
  workItems,
  reportDate,
}: {
  project: Project;
  orders: Order[];
  workItems: WorkItemRow[];
  reportDate: string;
}): ExecutiveSettlementReportData => {
  const settledOrders = orders.filter(isSettledOrder);
  const cancelledOrders = orders.filter(isCancelledOrder);
  const pendingOrders = orders.filter(isPendingSettlementOrder);
  const inProgressOrders = pendingOrders.filter(isInProgressPendingOrder);
  const handedOverPendingOrders = pendingOrders.filter(isHandedOverPendingOrder);

  const settledHours = settledOrders.reduce((sum, order) => sum + sumOrderHours(order), 0);
  const pendingSettlementHours = pendingOrders.reduce((sum, order) => sum + sumOrderHours(order), 0);
  const contractedTotalHours = settledHours + pendingSettlementHours;
  const remainingInContract = project.maxHours - contractedTotalHours;
  const contractUsagePct = project.maxHours > 0
    ? (contractedTotalHours / project.maxHours) * 100
    : 0;

  const contractedNetValue = contractedTotalHours * project.rateNetto;
  const contractedGrossValue = contractedTotalHours * project.rateBrutto;
  const settledNetValue = settledHours * project.rateNetto;
  const settledGrossValue = settledHours * project.rateBrutto;
  const pendingNetValue = pendingSettlementHours * project.rateNetto;
  const pendingGrossValue = pendingSettlementHours * project.rateBrutto;

  const categoryHours: Record<string, number> = {
    Programistyczne: 0,
    'Obsługa projektu': 0,
    Inne: 0,
  };

  workItems.forEach((item) => {
    const category = item.category || 'Inne';
    categoryHours[category] = (categoryHours[category] || 0) + ((item.minutes || 0) / 60);
  });

  const totalWorkedHours = Object.values(categoryHours).reduce((sum, value) => sum + value, 0);
  const workedNetValue = totalWorkedHours * project.rateNetto;
  const workedGrossValue = totalWorkedHours * project.rateBrutto;
  const profitabilityHours = contractedTotalHours - totalWorkedHours;
  const profitabilityNetValue = profitabilityHours * project.rateNetto;
  const profitabilityGrossValue = profitabilityHours * project.rateBrutto;
  const profitabilityPct = contractedTotalHours > 0
    ? (profitabilityHours / contractedTotalHours) * 100
    : 0;

  const contributorHours = Object.entries(
    workItems.reduce<Record<string, number>>((acc, item) => {
      const authorName = item.authorName || 'Nieznana osoba';
      acc[authorName] = (acc[authorName] || 0) + ((item.minutes || 0) / 60);
      return acc;
    }, {})
  )
    .map(([name, hours]) => ({
      name,
      hours,
      sharePct: totalWorkedHours > 0 ? (hours / totalWorkedHours) * 100 : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  const inProgressHours = inProgressOrders.reduce((sum, order) => sum + sumOrderHours(order), 0);
  const handedOverPendingHours = handedOverPendingOrders.reduce((sum, order) => sum + sumOrderHours(order), 0);
  const cancelledHours = cancelledOrders.reduce((sum, order) => sum + sumOrderHours(order), 0);
  const topContributor = contributorHours[0];

  const highlights: ExecutiveReportHighlight[] = [
    remainingInContract >= 0
      ? {
          title: 'Projekt mieści się w limicie umowy',
          body: `Wykorzystano ${formatHours(contractedTotalHours)} z ${formatHours(project.maxHours)} zapisanych w umowie. Do dyspozycji pozostaje ${formatHours(remainingInContract)}.`,
          tone: contractUsagePct > 85 ? 'warning' : 'positive',
        }
      : {
          title: 'Projekt przekracza limit umowy',
          body: `Suma zleceń osiągnęła ${formatHours(contractedTotalHours)} przy limicie ${formatHours(project.maxHours)}. Przekroczenie wynosi ${formatHours(Math.abs(remainingInContract))}.`,
          tone: 'risk',
        },
    pendingOrders.length === 0
      ? {
          title: 'Brak nierozliczonych zleceń',
          body: 'Wszystkie zlecenia mają już uzupełniony protokół odbioru, więc część formalno-rozliczeniowa jest domknięta.',
          tone: 'positive',
        }
      : {
          title: 'Część zleceń nadal czeka na protokół odbioru',
          body: `${pendingOrders.length} zleceń odpowiada za ${formatHours(pendingSettlementHours)} i ${formatMoney(pendingNetValue)} netto. W tym ${handedOverPendingOrders.length} po przekazaniu protokołu przekazania, ${inProgressOrders.length} w trakcie oraz ${cancelledOrders.length} anulowanych poza rozliczeniem.`,
          tone: handedOverPendingOrders.length > 0 ? 'warning' : 'neutral',
        },
    profitabilityHours >= 0
      ? {
          title: 'Projekt utrzymuje dodatnią zyskowność godzinową',
          body: `Zakontraktowane godziny przewyższają rzeczywiście przepracowane o ${formatHours(profitabilityHours)}. Bufor odpowiada ${formatMoney(profitabilityNetValue)} netto.`,
          tone: 'positive',
        }
      : {
          title: 'Projekt pracuje ponad zakontraktowaną pulę',
          body: `Zespół przepracował o ${formatHours(Math.abs(profitabilityHours))} więcej niż wynika z zakontraktowanych godzin. Oznacza to odchylenie ${formatMoney(Math.abs(profitabilityNetValue))} netto.`,
          tone: 'risk',
        },
    topContributor
      ? {
          title: 'Aktywność zespołu jest skoncentrowana',
          body: `Pracę w projekcie logowało ${contributorHours.length} osób. Największy udział ma ${topContributor.name}: ${formatHours(topContributor.hours)} (${topContributor.sharePct.toFixed(1)}% całej pracy).`,
          tone: topContributor.sharePct > 45 ? 'warning' : 'neutral',
        }
      : {
          title: 'Brak wpisów pracy w YouTrack',
          body: 'W raporcie nie znaleziono zalogowanych roboczogodzin, więc ocena obciążenia zespołu wymaga uzupełnienia rejestru pracy.',
          tone: 'warning',
        },
  ];

  const riskFlags = [
    remainingInContract < 0 ? 'przekroczenie limitu godzin' : null,
    profitabilityHours < 0 ? 'ujemna zyskowność godzinowa' : null,
    pendingOrders.length > 0 ? 'zlecenia do rozliczenia' : null,
    cancelledOrders.length > 0 ? 'anulowane zlecenia bez dat' : null,
  ].filter(Boolean) as string[];

  const summaryText = riskFlags.length > 0
    ? `Raport wskazuje obszary wymagające uwagi zarządczej: ${riskFlags.join(', ')}. Największy wpływ na sytuację projektu mają bieżące godziny zakontraktowane, rozliczenie zleceń oraz realne obciążenie zespołu widoczne w YouTrack.`
    : 'Projekt pozostaje pod kontrolą: limit godzin nie jest przekroczony, zyskowność godzinowa pozostaje dodatnia, a rozliczenia nie pokazują zaległości wymagających interwencji.';

  const metrics: ExecutiveReportMetric[] = [
    {
      label: 'Umowa max godzin',
      hours: project.maxHours,
      netValue: project.maxHours * project.rateNetto,
      grossValue: project.maxHours * project.rateBrutto,
      accent: '#475569',
    },
    {
      label: 'Zakontraktowane',
      hours: contractedTotalHours,
      netValue: contractedNetValue,
      grossValue: contractedGrossValue,
      accent: '#4f46e5',
    },
    {
      label: 'Rozliczone',
      hours: settledHours,
      netValue: settledNetValue,
      grossValue: settledGrossValue,
      accent: '#059669',
    },
    {
      label: 'Do rozliczenia',
      hours: pendingSettlementHours,
      netValue: pendingNetValue,
      grossValue: pendingGrossValue,
      accent: '#d97706',
    },
    {
      label: 'Rzeczywiście przepracowane',
      hours: totalWorkedHours,
      netValue: workedNetValue,
      grossValue: workedGrossValue,
      accent: '#7c3aed',
    },
    {
      label: remainingInContract >= 0 ? 'Pozostało w umowie' : 'Przekroczenie umowy',
      hours: Math.abs(remainingInContract),
      netValue: Math.abs(remainingInContract * project.rateNetto),
      grossValue: Math.abs(remainingInContract * project.rateBrutto),
      accent: remainingInContract >= 0 ? '#c026d3' : '#dc2626',
    },
    {
      label: 'Anulowane',
      hours: cancelledHours,
      netValue: cancelledHours * project.rateNetto,
      grossValue: cancelledHours * project.rateBrutto,
      accent: '#64748b',
    },
  ];

  const hoursChartData: ExecutiveReportChartBar[] = [
    { name: 'Limit umowy', value: project.maxHours, fill: '#475569' },
    { name: 'Zakontraktowane', value: contractedTotalHours, fill: '#4f46e5' },
    { name: 'Rozliczone', value: settledHours, fill: '#059669' },
    { name: 'Do rozliczenia', value: pendingSettlementHours, fill: '#d97706' },
    { name: 'Przepracowane', value: totalWorkedHours, fill: '#7c3aed' },
    {
      name: remainingInContract >= 0 ? 'Pozostało' : 'Przekroczenie',
      value: Math.abs(remainingInContract),
      fill: remainingInContract >= 0 ? '#c026d3' : '#dc2626',
    },
  ];

  const valuesChartData: ExecutiveReportChartBar[] = [
    { name: 'Limit netto', value: project.maxHours * project.rateNetto, fill: '#475569' },
    { name: 'Zakontraktowane', value: contractedNetValue, fill: '#4f46e5' },
    { name: 'Rozliczone', value: settledNetValue, fill: '#059669' },
    { name: 'Do rozliczenia', value: pendingNetValue, fill: '#d97706' },
    {
      name: profitabilityNetValue >= 0 ? 'Zysk netto' : 'Strata netto',
      value: profitabilityNetValue,
      fill: profitabilityNetValue >= 0 ? '#10b981' : '#dc2626',
    },
  ];

  const categoryChartData: ExecutiveReportChartBar[] = [
    { name: 'Programistyczne', value: categoryHours.Programistyczne || 0, fill: '#2563eb' },
    { name: 'Obsługa projektu', value: categoryHours['Obsługa projektu'] || 0, fill: '#0f766e' },
    { name: 'Inne', value: categoryHours.Inne || 0, fill: '#7c3aed' },
  ];

  const teamChartData = contributorHours
    .slice(0, 6)
    .map((contributor, index) => ({
      name: contributor.name,
      value: contributor.hours,
      fill: ['#2563eb', '#4f46e5', '#0891b2', '#7c3aed', '#0f766e', '#ea580c'][index] || '#64748b',
    }));

  const statusChartData: ExecutiveReportChartBar[] = [
    { name: 'Rozliczone protokołem odbioru', value: settledHours, fill: '#059669' },
    { name: 'Po protokole przekazania bez protokołu odbioru', value: handedOverPendingHours, fill: '#0284c7' },
    { name: 'W trakcie', value: inProgressHours, fill: '#d97706' },
    { name: 'Anulowane', value: cancelledHours, fill: '#64748b' },
  ];

  const statusCards: ExecutiveReportStatusCard[] = [
    {
      label: 'Rozliczone',
      count: settledOrders.length,
      hours: settledHours,
      note: 'Zlecenia z uzupełnionym protokołem odbioru.',
      fill: '#059669',
    },
    {
      label: 'Po protokole przekazania',
      count: handedOverPendingOrders.length,
      hours: handedOverPendingHours,
      note: 'Zlecenia po protokole przekazania, nadal bez protokołu odbioru.',
      fill: '#0284c7',
    },
    {
      label: 'W trakcie',
      count: inProgressOrders.length,
      hours: inProgressHours,
      note: 'Mają datę realizacji od, bez przekazania i bez odbioru.',
      fill: '#d97706',
    },
    {
      label: 'Anulowane',
      count: cancelledOrders.length,
      hours: cancelledHours,
      note: 'Nie mają uzupełnionej żadnej daty.',
      fill: '#64748b',
    },
  ];

  return {
    reportDate,
    projectPeriodLabel: `${formatDateLabel(project.dateFrom)} - ${formatDateLabel(project.dateTo)}`,
    contractUsagePct,
    totalOrders: orders.length,
    settledOrders: settledOrders.length,
    contractedTotalHours,
    settledHours,
    pendingSettlementHours,
    totalWorkedHours,
    remainingInContract,
    profitabilityHours,
    profitabilityPct,
    contractedNetValue,
    settledNetValue,
    pendingNetValue,
    profitabilityNetValue,
    profitabilityGrossValue,
    highlights,
    summaryText,
    metrics,
    hoursChartData,
    valuesChartData,
    categoryChartData,
    teamChartData,
    statusChartData,
    topContributors: contributorHours,
    statusCards,
  };
};
