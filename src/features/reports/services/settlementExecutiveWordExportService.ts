import { saveAs } from 'file-saver';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Project } from '../../../types';
import type { ExecutiveSettlementReportData } from './settlementExecutiveReportService';

const formatFileDate = (value: string) => (value || new Date().toISOString().split('T')[0]).replace(/-/g, '');
const formatHours = (value: number) => value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value: number) => value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const removeFinancialSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/zł/i.test(sentence))
    .join(' ')
    .trim();

const buildTable = (headers: string[], rows: string[][]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((text) => new TableCell({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, size: 20 })],
          })],
        })),
      }),
      ...rows.map((row) => new TableRow({
        children: row.map((text, index) => new TableCell({
          children: [new Paragraph({
            alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
            children: [new TextRun({ text: text || '', size: 20 })],
          })],
        })),
      })),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    },
  });

const sectionHeading = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: '0F172A' })],
  });

export const exportExecutiveSettlementReportToWord = async (
  project: Project,
  report: ExecutiveSettlementReportData,
  options?: { includeFinancialData?: boolean },
) => {
  const includeFinancialData = options?.includeFinancialData ?? true;

  const metricHeaders = includeFinancialData
    ? ['Pozycja', 'Godziny', 'Netto', 'Brutto']
    : ['Pozycja', 'Godziny'];
  const metricRows = report.metrics.map((metric) => (
    includeFinancialData
      ? [metric.label, `${formatHours(metric.hours)} h`, `${formatMoney(metric.netValue)} zł`, `${formatMoney(metric.grossValue)} zł`]
      : [metric.label, `${formatHours(metric.hours)} h`]
  ));

  const statusRows = report.statusCards.map((status) => [
    status.label,
    String(status.count),
    `${formatHours(status.hours)} h`,
    status.note,
  ]);

  const hoursRows = report.hoursChartData.map((item) => [item.name, `${formatHours(item.value)} h`]);
  const statusHoursRows = report.statusChartData.map((item) => [item.name, `${formatHours(item.value)} h`]);
  const categoryRows = report.categoryChartData.map((item) => [item.name, `${formatHours(item.value)} h`]);
  const teamRows = report.topContributors.map((person) => [person.name, `${formatHours(person.hours)} h`, `${person.sharePct.toFixed(1)}%`]);
  const valueRows = report.valuesChartData.map((item) => [item.name, `${formatMoney(item.value)} zł`]);
  const burnUpSummaryRows = report.burnUp
    ? [
        ['Zakres', report.burnUp.rangeLabel],
        ['Plan godzin zleceń narastająco', `${formatHours(report.burnUp.estimateHours)} h`],
        ['Godziny zalogowane narastająco', `${formatHours(report.burnUp.actualHours)} h`],
        ['Różnica planu do logów', `${formatHours(report.burnUp.deltaHours)} h`],
        ['Relacja zleceń do logów', report.burnUp.trendRatio !== null ? report.burnUp.trendRatio.toFixed(2) : 'brak'],
        ['Trend 30 dni', report.burnUp.rollingTrendRatio !== null ? report.burnUp.rollingTrendRatio.toFixed(2) : 'brak'],
      ]
    : [];
  const burnUpPointRows = report.burnUp
    ? report.burnUp.points.map((point) => [
        point.date,
        `${formatHours(point.dailyEstimate)} h`,
        `${formatHours(point.dailyActual)} h`,
        `${formatHours(point.cumulativeEstimate)} h`,
        `${formatHours(point.cumulativeActual)} h`,
        `${formatHours(point.deltaHours)} h`,
      ])
    : [];
  const orderVsWorkRows = report.orderVsWork
    ? [
        ['Zakres', report.orderVsWork.rangeLabel],
        ['Wykorzystane w zleceniach', `${formatHours(report.orderVsWork.usedHours)} h`],
        ['Przepracowane w zleceniach', `${formatHours(report.orderVsWork.workedHours)} h`],
        ['Różnica godzin', `${formatHours(report.orderVsWork.differenceHours)} h`],
        ['Różnica %', `${report.orderVsWork.differencePct.toFixed(1)}%`],
        ['Status', report.orderVsWork.differenceLabel],
      ]
    : [];
  const orderVsWorkCategoryRows = report.orderVsWork
    ? [
        ['Programistyczne', `${formatHours(report.orderVsWork.categoryHours.development)} h`],
        ['Obsługa projektu', `${formatHours(report.orderVsWork.categoryHours.management)} h`],
        ['Inne', `${formatHours(report.orderVsWork.categoryHours.other)} h`],
        ['BUG', `${formatHours(report.orderVsWork.bugHours.bug)} h`],
        ['Reszta', `${formatHours(report.orderVsWork.bugHours.other)} h`],
      ]
    : [];

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [new TextRun({ text: 'Raport zarządczy projektu', bold: true, size: 34 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 320 },
          children: [new TextRun({ text: `${project.code} - ${project.name}`, size: 24 })],
        }),
        buildTable(
          ['Pole', 'Wartość'],
          [
            ['Data raportu', report.reportDate],
            ['Umowa', project.contractNo || 'brak'],
            ['Okres projektu', report.projectPeriodLabel],
            ['Stawka netto za roboczogodzinę', `${formatMoney(project.rateNetto)} zł`],
            ['Stawka brutto za roboczogodzinę', `${formatMoney(project.rateBrutto)} zł`],
            ['Liczba zleceń', String(report.totalOrders)],
            ['Rozliczone zlecenia', String(report.settledOrders)],
          ],
        ),
        sectionHeading('Podsumowanie'),
        new Paragraph({
          spacing: { after: 180 },
          children: [new TextRun({ text: report.summaryText, size: 22 })],
        }),
        buildTable(metricHeaders, metricRows),
        sectionHeading('Komentarze zarządcze'),
        ...report.highlights.map((highlight) => new Paragraph({
          spacing: { after: 120 },
          bullet: { level: 0 },
          children: [
            new TextRun({ text: `${highlight.title}: `, bold: true, size: 22 }),
            new TextRun({
              text: includeFinancialData ? highlight.body : removeFinancialSentences(highlight.body),
              size: 22,
            }),
          ],
        })),
        sectionHeading('Status zleceń'),
        buildTable(['Status', 'Liczba', 'Godziny', 'Opis'], statusRows),
        sectionHeading('Zestawienia godzinowe'),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Kontrakt, rozliczenia i praca zespołu', bold: true, size: 22 })] }),
        buildTable(['Pozycja', 'Wartość'], hoursRows),
        ...(report.orderVsWork
          ? [
              sectionHeading('Zlecenia vs Praca'),
              buildTable(['Pozycja', 'Wartość'], orderVsWorkRows),
              new Paragraph({ spacing: { before: 220, after: 120 }, children: [new TextRun({ text: 'Podział przepracowanych godzin', bold: true, size: 22 })] }),
              buildTable(['Pozycja', 'Godziny'], orderVsWorkCategoryRows),
            ]
          : []),
        ...(report.burnUp
          ? [
              sectionHeading('Narastanie godzin'),
              new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Dane nagłówkowe wykresu', bold: true, size: 22 })] }),
              buildTable(['Pozycja', 'Wartość'], burnUpSummaryRows),
              new Paragraph({ spacing: { before: 220, after: 120 }, children: [new TextRun({ text: 'Dane wykresu narastania godzin', bold: true, size: 22 })] }),
              buildTable(
                ['Data', 'Przyrost planu zleceń', 'Przyrost logów', 'Plan zleceń narastająco', 'Logi narastająco', 'Różnica'],
                burnUpPointRows,
              ),
            ]
          : []),
        new Paragraph({ spacing: { before: 220, after: 120 }, children: [new TextRun({ text: 'Godziny według etapu formalnego', bold: true, size: 22 })] }),
        buildTable(['Status', 'Godziny'], statusHoursRows),
        new Paragraph({ spacing: { before: 220, after: 120 }, children: [new TextRun({ text: 'Kategorie pracy z YouTrack', bold: true, size: 22 })] }),
        buildTable(['Kategoria', 'Godziny'], categoryRows),
        ...(includeFinancialData
          ? [
              sectionHeading('Zestawienie wartości'),
              buildTable(['Pozycja', 'Netto'], valueRows),
            ]
          : []),
        sectionHeading('Zespół projektowy'),
        buildTable(['Osoba', 'Godziny', 'Udział'], teamRows.length > 0 ? teamRows : [['Brak danych', '-', '-']]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${project.code}_Raport_Zarzadczy_${formatFileDate(report.reportDate)}.docx`);
};
