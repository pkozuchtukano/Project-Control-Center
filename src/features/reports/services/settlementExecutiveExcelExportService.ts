import * as XLSX from 'xlsx';
import type { Project } from '../../../types';
import type { ExecutiveSettlementReportData } from './settlementExecutiveReportService';

const formatFileDate = (value: string) => (value || new Date().toISOString().split('T')[0]).replace(/-/g, '');

const removeFinancialSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/zł/i.test(sentence))
    .join(' ')
    .trim();

export const exportExecutiveSettlementReportToExcel = (
  project: Project,
  report: ExecutiveSettlementReportData,
  options?: { includeFinancialData?: boolean },
) => {
  const includeFinancialData = options?.includeFinancialData ?? true;
  const workbook = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ['Raport zarządczy projektu'],
    ['Projekt', project.code],
    ['Nazwa projektu', project.name],
    ['Umowa', project.contractNo || 'brak'],
    ['Data raportu', report.reportDate],
    ['Okres projektu', report.projectPeriodLabel],
    ['Stawka netto za roboczogodzinę', project.rateNetto],
    ['Stawka brutto za roboczogodzinę', project.rateBrutto],
    ['Liczba zleceń', report.totalOrders],
    ['Rozliczone zlecenia', report.settledOrders],
    ['Podsumowanie', report.summaryText],
    [],
  ];

  summaryRows.push(
    includeFinancialData
      ? ['KPI', 'Godziny', 'Netto', 'Brutto']
      : ['KPI', 'Godziny'],
  );

  report.metrics.forEach((metric) => {
    summaryRows.push(
      includeFinancialData
        ? [metric.label, metric.hours, metric.netValue, metric.grossValue]
        : [metric.label, metric.hours],
    );
  });

  summaryRows.push([]);
  summaryRows.push(['Komentarze zarządcze']);
  report.highlights.forEach((highlight) => {
    summaryRows.push([
      highlight.title,
      includeFinancialData ? highlight.body : removeFinancialSentences(highlight.body),
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = includeFinancialData
    ? [{ wch: 36 }, { wch: 16 }, { wch: 18 }, { wch: 18 }]
    : [{ wch: 36 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Podsumowanie');

  const statusSheet = XLSX.utils.aoa_to_sheet([
    ['Status', 'Liczba', 'Godziny', 'Opis'],
    ...report.statusCards.map((status) => [status.label, status.count, status.hours, status.note]),
  ]);
  statusSheet['!cols'] = [{ wch: 34 }, { wch: 10 }, { wch: 14 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(workbook, statusSheet, 'Statusy');

  const hoursSheet = XLSX.utils.aoa_to_sheet([
    ['Sekcja', 'Pozycja', 'Wartość'],
    ...report.hoursChartData.map((item) => ['Kontrakt i rozliczenia', item.name, item.value]),
    ...report.statusChartData.map((item) => ['Status formalny', item.name, item.value]),
    ...report.categoryChartData.map((item) => ['Kategorie pracy', item.name, item.value]),
  ]);
  hoursSheet['!cols'] = [{ wch: 24 }, { wch: 40 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, hoursSheet, 'Godziny');

  if (report.orderVsWork) {
    const workedHours = report.orderVsWork.workedHours;
    const pct = (value: number) => workedHours > 0 ? Number(((value / workedHours) * 100).toFixed(1)) : 0;
    const orderVsWorkSheet = XLSX.utils.aoa_to_sheet([
      ['Zlecenia vs Praca'],
      ['Zakres', report.orderVsWork.rangeLabel],
      ['Wykorzystane w zleceniach', report.orderVsWork.usedHours],
      ['Przepracowane w zleceniach', report.orderVsWork.workedHours],
      ['Różnica godzin', report.orderVsWork.differenceHours],
      ['Różnica %', Number(report.orderVsWork.differencePct.toFixed(1))],
      ['Status', report.orderVsWork.differenceLabel],
      [],
      ['Kategoria', 'Godziny', 'Udział %'],
      ['Programistyczne', report.orderVsWork.categoryHours.development, pct(report.orderVsWork.categoryHours.development)],
      ['Obsługa projektu', report.orderVsWork.categoryHours.management, pct(report.orderVsWork.categoryHours.management)],
      ['Inne', report.orderVsWork.categoryHours.other, pct(report.orderVsWork.categoryHours.other)],
      [],
      ['BUG / reszta', 'Godziny', 'Udział %'],
      ['BUG', report.orderVsWork.bugHours.bug, pct(report.orderVsWork.bugHours.bug)],
      ['Reszta', report.orderVsWork.bugHours.other, pct(report.orderVsWork.bugHours.other)],
    ]);
    orderVsWorkSheet['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, orderVsWorkSheet, 'Zlecenia vs Praca');
  }

  if (report.burnUp) {
    const burnUpRows: (string | number)[][] = [
      ['Narastanie godzin'],
      ['Zakres', report.burnUp.rangeLabel],
      ['Plan godzin zleceń narastająco', report.burnUp.estimateHours],
      ['Godziny zalogowane narastająco', report.burnUp.actualHours],
      ['Różnica planu do logów', report.burnUp.deltaHours],
      ['Relacja zleceń do logów', report.burnUp.trendRatio ?? 'brak'],
      ['Trend 30 dni', report.burnUp.rollingTrendRatio ?? 'brak'],
      [],
      ['Data', 'Przyrost planu zleceń', 'Przyrost godzin zalogowanych', 'Plan godzin zleceń narastająco', 'Godziny zalogowane narastająco', 'Różnica planu do logów'],
      ...report.burnUp.points.map((point) => [
        point.date,
        point.dailyEstimate,
        point.dailyActual,
        point.cumulativeEstimate,
        point.cumulativeActual,
        point.deltaHours,
      ]),
    ];
    const burnUpSheet = XLSX.utils.aoa_to_sheet(burnUpRows);
    burnUpSheet['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 32 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, burnUpSheet, 'Narastanie godzin');
  }

  if (includeFinancialData) {
    const valuesSheet = XLSX.utils.aoa_to_sheet([
      ['Pozycja', 'Netto'],
      ...report.valuesChartData.map((item) => [item.name, item.value]),
    ]);
    valuesSheet['!cols'] = [{ wch: 36 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, valuesSheet, 'Wartości');
  }

  const teamSheet = XLSX.utils.aoa_to_sheet([
    ['Osoba', 'Godziny', 'Udział %'],
    ...report.topContributors.map((person) => [person.name, person.hours, Number(person.sharePct.toFixed(1))]),
  ]);
  teamSheet['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, teamSheet, 'Zespół');

  XLSX.writeFile(workbook, `${project.code}_Raport_Zarzadczy_${formatFileDate(report.reportDate)}.xlsx`);
};
