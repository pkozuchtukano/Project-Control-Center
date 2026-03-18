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
