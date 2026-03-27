import type { Order, Project } from '../../../types';
import type { WorkItemRow } from '../../work-registry/types';

export type SuccessMetricPoint = {
  label: string;
  value: number;
};

export type SuccessMetricKpi = {
  key: 'hourly-burn-rate' | 'expected-margin-index' | 'order-to-log-ratio';
  label: string;
  shortLabel: string;
  value: number | null;
  status: 'good' | 'warning' | 'risk' | 'neutral';
  unit: 'hoursPerDay' | 'currencyPerDay' | 'index' | 'ratio' | 'percent';
  definition: string;
  interpretation: string;
  detail: string;
  auxiliaryLabel?: string;
  auxiliaryValue?: number | null;
  auxiliaryUnit?: 'hoursPerDay' | 'currencyPerDay' | 'index' | 'ratio' | 'percent';
};

export type SettlementSuccessMetrics = {
  analysis: string[];
  marginStrategy: string[];
  chartData: SuccessMetricPoint[];
  projectedMarginPct: number | null;
  targetMarginPct: number;
  forecastWorkedHours: number | null;
  totalWorkedHours: number;
  contractedTotalHours: number;
  remainingHoursToContract: number;
  elapsedDays: number;
  totalProjectDays: number;
  dailyBurnRateNet: number | null;
  dailyBurnRateGross: number | null;
  projectedProfitNet: number | null;
  projectedProfitGross: number | null;
  kpis: SuccessMetricKpi[];
};

const HOURS_PER_DAY = 24 * 60 * 60 * 1000;

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

const calculateDaySpan = (from?: string, to?: string, fallbackDate?: Date) => {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const endCandidate = to ? new Date(`${to}T23:59:59`) : fallbackDate ?? new Date();

  if (!start || Number.isNaN(start.getTime()) || Number.isNaN(endCandidate.getTime())) {
    return 0;
  }

  return Math.max(1, Math.ceil((endCandidate.getTime() - start.getTime()) / HOURS_PER_DAY));
};

const buildStatus = (value: number | null, warningThreshold: number, riskThreshold: number, inverse = false) => {
  if (value === null || Number.isNaN(value)) return 'neutral' as const;
  if (inverse) {
    if (value <= riskThreshold) return 'good' as const;
    if (value <= warningThreshold) return 'warning' as const;
    return 'risk' as const;
  }

  if (value >= warningThreshold) return 'good' as const;
  if (value >= riskThreshold) return 'warning' as const;
  return 'risk' as const;
};

export const buildSettlementSuccessMetrics = ({
  project,
  orders,
  workItems,
  analysisRange,
  now = new Date(),
}: {
  project: Project;
  orders: Order[];
  workItems: WorkItemRow[];
  analysisRange?: { start: string; end: string } | null;
  now?: Date;
}): SettlementSuccessMetrics => {
  const settledOrders = orders.filter(isSettledOrder);
  const pendingOrders = orders.filter(isPendingSettlementOrder);
  const settledHours = settledOrders.reduce((sum, order) => sum + sumOrderHours(order), 0);
  const pendingSettlementHours = pendingOrders.reduce((sum, order) => sum + sumOrderHours(order), 0);
  const contractedTotalHours = settledHours + pendingSettlementHours;
  const totalWorkedHours = workItems.reduce((sum, item) => sum + ((item.minutes || 0) / 60), 0);
  const remainingHoursToContract = Math.max(0, project.maxHours - contractedTotalHours);

  const effectiveProjectEnd = project.dateTo ? new Date(`${project.dateTo}T23:59:59`) : now;
  const analysisEnd = analysisRange?.end
    ? new Date(`${analysisRange.end}T23:59:59`)
    : (effectiveProjectEnd.getTime() < now.getTime() ? effectiveProjectEnd : now);
  const analysisStart = analysisRange?.start || project.dateFrom;
  const elapsedDays = calculateDaySpan(analysisStart, analysisRange?.end, analysisEnd);
  const totalProjectDays = calculateDaySpan(project.dateFrom, project.dateTo, analysisEnd);
  const remainingDays = Math.max(0, totalProjectDays - elapsedDays);

  const hourlyBurnRate = elapsedDays > 0 ? totalWorkedHours / elapsedDays : null;
  const financialBurnRateNet = hourlyBurnRate !== null ? hourlyBurnRate * project.rateNetto : null;
  const financialBurnRateGross = hourlyBurnRate !== null ? hourlyBurnRate * project.rateBrutto : null;
  const forecastWorkedHours = hourlyBurnRate !== null ? totalWorkedHours + (hourlyBurnRate * remainingDays) : null;

  const targetMarginPct = project.targetProfitPct ?? 20;
  const projectedRevenueHours = project.maxHours > 0 ? project.maxHours : contractedTotalHours;
  const projectedMarginPct = projectedRevenueHours > 0 && forecastWorkedHours !== null
    ? ((projectedRevenueHours - forecastWorkedHours) / projectedRevenueHours) * 100
    : null;
  const expectedMarginIndex = projectedMarginPct !== null && targetMarginPct > 0
    ? projectedMarginPct / targetMarginPct
    : null;
  const projectedProfitHours = projectedRevenueHours > 0 && forecastWorkedHours !== null
    ? projectedRevenueHours - forecastWorkedHours
    : null;
  const projectedProfitNet = projectedProfitHours !== null ? projectedProfitHours * project.rateNetto : null;
  const projectedProfitGross = projectedProfitHours !== null ? projectedProfitHours * project.rateBrutto : null;
  const orderToLogRatio = totalWorkedHours > 0 ? contractedTotalHours / totalWorkedHours : null;
  const loggedCoveragePct = contractedTotalHours > 0 ? (totalWorkedHours / contractedTotalHours) * 100 : null;

  const projectedMarginGap = projectedMarginPct !== null ? projectedMarginPct - targetMarginPct : null;
  const allowedWorkedHoursForTarget = projectedRevenueHours > 0
    ? projectedRevenueHours * (1 - (targetMarginPct / 100))
    : null;
  const hoursOverTarget = allowedWorkedHoursForTarget !== null && forecastWorkedHours !== null
    ? forecastWorkedHours - allowedWorkedHoursForTarget
    : null;

  const analysis: string[] = [
    elapsedDays > 0
      ? `Analiza opiera się na ${totalWorkedHours.toFixed(1)}h zalogowanych w YouTrack oraz ${contractedTotalHours.toFixed(1)}h zakontraktowanych w zleceniach w ciągu ${elapsedDays} dni projektu.`
      : 'Brak wiarygodnego zakresu czasu projektu do policzenia tempa spalania budżetu.',
    hourlyBurnRate !== null
      ? `Bieżące tempo pracy wynosi ${hourlyBurnRate.toFixed(2)}h/dzień. Przy tej dynamice projekt do końca okresu wygeneruje około ${forecastWorkedHours?.toFixed(1)}h pracy.`
      : 'Hourly Burn Rate nie został policzony, bo brakuje poprawnego początku lub zakresu projektu.',
    expectedMarginIndex !== null
      ? `Projected margin to ${projectedMarginPct?.toFixed(1)}% przy celu ${targetMarginPct}%. EMI = ${expectedMarginIndex.toFixed(2)} pokazuje, jaka część celu marżowego jest dziś zabezpieczona.`
      : 'EMI nie został policzony, bo brakuje podstaw do wiarygodnej prognozy końca projektu.',
    orderToLogRatio !== null
      ? `Relacja godzin zakontraktowanych do godzin zalogowanych wynosi ${orderToLogRatio.toFixed(2)}. Pokazuje to, ile godzin zakontraktowanych przypada na 1 godzinę realnie zalogowaną.`
      : 'Relacja godzin zleceń do logów nie została policzona, bo w wybranym zakresie brak zalogowanych godzin.',
  ];

  const marginStrategy: string[] = [
    projectedMarginGap === null
      ? 'Brak pełnych danych do strategii marży.'
      : projectedMarginGap >= 0
        ? `Prognoza przekracza cel marżowy o ${projectedMarginGap.toFixed(1)} p.p. Można utrzymać obecny miks pracy, pilnując aby nowe logi nie rosły szybciej niż pula godzin umownych.`
        : `Do celu ${targetMarginPct}% brakuje ${Math.abs(projectedMarginGap).toFixed(1)} p.p. Przy obecnym tempie pracy marża domknie się poniżej założenia.`,
    hoursOverTarget === null
      ? 'Nie da się policzyć bufora godzinowego do celu marży.'
      : hoursOverTarget <= 0
        ? `Prognoza mieści się w limicie kosztowym dla marży ${targetMarginPct}% z zapasem ${Math.abs(hoursOverTarget).toFixed(1)}h.`
        : `Aby domknąć marżę ${targetMarginPct}%, należy ograniczyć przyszłe logowania o około ${hoursOverTarget.toFixed(1)}h względem obecnej trajektorii albo zwiększyć pulę godzin zakontraktowanych.`,
    orderToLogRatio === null
      ? 'Najpierw trzeba uzupełnić logi czasu, aby porównać godziny zakontraktowane w zleceniach do godzin realnie przepracowanych.'
      : orderToLogRatio >= 1
        ? `Na każdą 1h zalogowaną przypada obecnie ${orderToLogRatio.toFixed(2)}h pracy zakontraktowanej. To utrzymuje dodatni bufor godzinowy.`
        : `Na każdą 1h zalogowaną przypada tylko ${orderToLogRatio.toFixed(2)}h pracy zakontraktowanej. Zakres pokazuje szybsze zużycie budżetu niż tempo kontraktowania godzin.`,
  ];

  const kpis: SuccessMetricKpi[] = [
    {
      key: 'hourly-burn-rate',
      label: 'Hourly Burn Rate',
      shortLabel: 'HBR',
      value: hourlyBurnRate,
      status: buildStatus(hourlyBurnRate, 6, 4, true),
      unit: 'hoursPerDay',
      definition: 'Średnia liczba godzin zalogowanych w YouTrack na 1 dzień trwania projektu.',
      interpretation: 'Im wyższy HBR przy stałej puli godzin zakontraktowanych, tym szybciej projekt konsumuje budżet.',
      detail: `Wzór: godziny zalogowane / dni projektu = ${totalWorkedHours.toFixed(1)}h / ${elapsedDays || 0} dni.`,
      auxiliaryLabel: 'Koszt dzienny netto',
      auxiliaryValue: financialBurnRateNet,
      auxiliaryUnit: 'currencyPerDay',
    },
    {
      key: 'expected-margin-index',
      label: 'Expected Margin Index',
      shortLabel: 'EMI',
      value: expectedMarginIndex,
      status: buildStatus(expectedMarginIndex, 1, 0.85),
      unit: 'index',
      definition: 'Relacja prognozowanej marży końcowej do celu marży projektu.',
      interpretation: 'EMI >= 1 oznacza dowiezienie celu, EMI < 1 oznacza ryzyko niedowiezienia marży.',
      detail: projectedMarginPct !== null
        ? `Wzór: prognozowana marża / cel = ${projectedMarginPct.toFixed(1)}% / ${targetMarginPct.toFixed(1)}%.`
        : 'Brak danych do wyliczenia prognozy marży.',
      auxiliaryLabel: 'Prognozowana marża',
      auxiliaryValue: projectedMarginPct,
      auxiliaryUnit: 'percent',
    },
    {
      key: 'order-to-log-ratio',
      label: 'Order-to-Log Ratio',
      shortLabel: 'O/L',
      value: orderToLogRatio,
      status: buildStatus(orderToLogRatio, 1, 0.9),
      unit: 'ratio',
      definition: 'Relacja godzin zakontraktowanych w zleceniach do godzin rzeczywiście zalogowanych w YouTrack.',
      interpretation: 'Wskaźnik powyżej 1 oznacza, że godzin zakontraktowanych jest więcej niż zalogowanych; wartość poniżej 1 wskazuje nadkonsumpcję budżetu godzinowego.',
      detail: totalWorkedHours > 0
        ? `Wzór: zlecenia / logi = ${contractedTotalHours.toFixed(1)}h / ${totalWorkedHours.toFixed(1)}h.`
        : 'Brak zalogowanych godzin w wybranym zakresie.',
      auxiliaryLabel: 'Zużycie puli zleceń przez logi',
      auxiliaryValue: loggedCoveragePct,
      auxiliaryUnit: 'percent',
    },
  ];

  return {
    analysis,
    marginStrategy,
    chartData: [
      { label: 'Zakontraktowane godziny', value: contractedTotalHours },
      { label: 'Zalogowane godziny', value: totalWorkedHours },
      { label: 'Prognoza końca', value: forecastWorkedHours ?? 0 },
      { label: 'Limit marży 20%', value: allowedWorkedHoursForTarget ?? 0 },
    ],
    projectedMarginPct,
    targetMarginPct,
    forecastWorkedHours,
    totalWorkedHours,
    contractedTotalHours,
    remainingHoursToContract,
    elapsedDays,
    totalProjectDays,
    dailyBurnRateNet: financialBurnRateNet,
    dailyBurnRateGross: financialBurnRateGross,
    projectedProfitNet,
    projectedProfitGross,
    kpis,
  };
};
