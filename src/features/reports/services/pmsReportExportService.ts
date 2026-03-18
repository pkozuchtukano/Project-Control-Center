import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalMergeType,
  WidthType,
} from 'docx';
import type { Order, Project } from '../../../types';

export type PmsReportLine = {
  name: string;
  hours: number;
  rateNetto: number;
  amountNetto: number;
};

export type PmsReportOrderRow = {
  orderId: string;
  orderNumber: string;
  from: string;
  to: string;
  handoverDate: string;
  acceptanceDate: string;
  title: string;
  lines: PmsReportLine[];
  totalHours: number;
  totalNetto: number;
  totalBrutto: number;
};

export type PmsReportData = {
  reportDate: string;
  periodFrom: string;
  periodTo: string;
  totalOrders: number;
  realizedOrders: number;
  remainingOrders: number;
  rows: PmsReportOrderRow[];
  grandTotalHours: number;
  grandTotalNetto: number;
  grandTotalBrutto: number;
};

const formatFileDate = (value: string) => (value || new Date().toISOString().split('T')[0]).replace(/-/g, '');
const formatHours = (value: number) => value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrency = (value: number) => value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const filterOrdersForReport = (orders: Order[], periodFrom: string, periodTo: string) => {
  return orders.filter((order) => {
    const from = periodFrom ? new Date(periodFrom) : new Date(0);
    const to = periodTo ? new Date(periodTo) : new Date(8640000000000000);
    to.setHours(23, 59, 59, 999);

    if (order.acceptanceDate) {
      const acceptance = new Date(order.acceptanceDate);
      return acceptance >= from && acceptance <= to;
    }

    const created = new Date(order.createdAt);
    return created >= from && created <= to;
  }).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true }));
};

export const buildPmsReportData = (
  orders: Order[],
  project: Project,
  periodFrom: string,
  periodTo: string,
  reportDate: string
): PmsReportData => {
  const filteredOrders = filterOrdersForReport(orders, periodFrom, periodTo);
  const realizedOrders = filteredOrders.filter((order) => order.acceptanceDate).length;

  const rows = filteredOrders.map((order) => {
    const lines = order.items.length > 0
      ? order.items.map((item) => ({
          name: item.name || '',
          hours: Number(item.hours) || 0,
          rateNetto: project.rateNetto || 0,
          amountNetto: (Number(item.hours) || 0) * (project.rateNetto || 0),
        }))
      : [{
          name: '',
          hours: 0,
          rateNetto: project.rateNetto || 0,
          amountNetto: 0,
        }];

    const totalHours = lines.reduce((sum, line) => sum + line.hours, 0);
    const totalNetto = lines.reduce((sum, line) => sum + line.amountNetto, 0);
    const totalBrutto = totalHours * (project.rateBrutto || 0);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      from: order.scheduleFrom || order.createdAt.split('T')[0],
      to: order.scheduleTo || '',
      handoverDate: order.handoverDate || '',
      acceptanceDate: order.acceptanceDate || '',
      title: order.title,
      lines,
      totalHours,
      totalNetto,
      totalBrutto,
    };
  });

  const grandTotalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);
  const grandTotalNetto = rows.reduce((sum, row) => sum + row.totalNetto, 0);
  const grandTotalBrutto = rows.reduce((sum, row) => sum + row.totalBrutto, 0);

  return {
    reportDate,
    periodFrom,
    periodTo,
    totalOrders: filteredOrders.length,
    realizedOrders,
    remainingOrders: filteredOrders.length - realizedOrders,
    rows,
    grandTotalHours,
    grandTotalNetto,
    grandTotalBrutto,
  };
};

export const exportPmsReportToExcel = (project: Project, report: PmsReportData) => {
  const workbook = XLSX.utils.book_new();
  const sheetRows: (string | number)[][] = [
    ['Raport PMS'],
    ['Projekt', project.code],
    ['Numer umowy', project.contractNo],
    ['Data sporządzenia raportu', report.reportDate],
    ['Okres od', report.periodFrom],
    ['Okres do', report.periodTo],
    ['Liczba zgłoszeń', report.totalOrders],
    ['Liczba zgłoszeń zrealizowanych', report.realizedOrders],
    ['Liczba zgłoszeń pozostających w realizacji', report.remainingOrders],
    [],
    ['Nr zlecenia', 'Od', 'Do', 'Protokół przekazania', 'Protokół odbioru', 'Tytuł zlecenia', 'Produkty zlecenia', 'Liczba godzin zleconych', 'Stawka (netto)', 'Kwota (netto)', 'Łącznie zrealizowano (h)', 'Łącznie kwota (netto)', 'Łącznie brutto'],
  ];

  const merges: XLSX.Range[] = [];
  let currentRowIndex = sheetRows.length;

  report.rows.forEach((row) => {
    const startRow = currentRowIndex;

    row.lines.forEach((line, lineIndex) => {
      sheetRows.push([
        lineIndex === 0 ? row.orderNumber : '',
        lineIndex === 0 ? row.from : '',
        lineIndex === 0 ? row.to : '',
        lineIndex === 0 ? row.handoverDate : '',
        lineIndex === 0 ? row.acceptanceDate : '',
        lineIndex === 0 ? row.title : '',
        line.name,
        line.hours,
        line.rateNetto,
        line.amountNetto,
        lineIndex === 0 ? row.totalHours : '',
        lineIndex === 0 ? row.totalNetto : '',
        lineIndex === 0 ? row.totalBrutto : '',
      ]);
      currentRowIndex += 1;
    });

    if (row.lines.length > 1) {
      [0, 1, 2, 3, 4, 5, 10, 11, 12].forEach((column) => {
        merges.push({
          s: { r: startRow, c: column },
          e: { r: currentRowIndex - 1, c: column },
        });
      });
    }
  });

  sheetRows.push(['', '', '', '', '', '', '', '', '', 'Suma', report.grandTotalHours, report.grandTotalNetto, report.grandTotalBrutto]);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 42 },
    { wch: 24 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
  ];
  worksheet['!merges'] = merges;

  for (let rowIndex = 12; rowIndex <= sheetRows.length; rowIndex += 1) {
    const hoursCells = [`H${rowIndex}`, `K${rowIndex}`];
    const amountCells = [`I${rowIndex}`, `J${rowIndex}`, `L${rowIndex}`, `M${rowIndex}`];

    hoursCells.forEach((cellRef) => {
      const cell = worksheet[cellRef];
      if (cell && typeof cell.v === 'number') {
        cell.z = '0.00" h"';
      }
    });

    amountCells.forEach((cellRef) => {
      const cell = worksheet[cellRef];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00" zł"';
      }
    });
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Raport PMS');
  XLSX.writeFile(workbook, `${project.code}_Raport_PMS_${formatFileDate(report.reportDate)}.xlsx`);
};

const buildWordCell = (text: string, alignment: any = AlignmentType.LEFT, verticalMerge?: any) => (
  new TableCell({
    verticalMerge,
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, bold: false })],
      alignment,
    })],
  })
);

export const exportPmsReportToWord = async (project: Project, report: PmsReportData) => {
  const headerRow = new TableRow({
    children: [
      'Nr zlecenia',
      'Od',
      'Do',
      'Protokół przekazania',
      'Protokół odbioru',
      'Tytuł zlecenia',
      'Produkty zlecenia',
      'Liczba godzin zleconych',
      'Stawka (netto)',
      'Kwota (netto)',
      'Łącznie zrealizowano (h)',
      'Łącznie kwota (netto)',
      'Łącznie brutto',
    ].map((text) => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20 })],
        alignment: AlignmentType.CENTER,
      })],
    })),
  });

  const dataRows = report.rows.flatMap((row) =>
    row.lines.map((line, index) => {
      const mergeState = index === 0 ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;

      return new TableRow({
        children: [
          buildWordCell(index === 0 ? row.orderNumber : '', AlignmentType.CENTER, mergeState),
          buildWordCell(index === 0 ? row.from : '', AlignmentType.CENTER, mergeState),
          buildWordCell(index === 0 ? row.to : '', AlignmentType.CENTER, mergeState),
          buildWordCell(index === 0 ? row.handoverDate : '', AlignmentType.CENTER, mergeState),
          buildWordCell(index === 0 ? row.acceptanceDate : '', AlignmentType.CENTER, mergeState),
          buildWordCell(index === 0 ? row.title : '', AlignmentType.LEFT, mergeState),
          buildWordCell(line.name),
          buildWordCell(formatHours(line.hours), AlignmentType.RIGHT),
          buildWordCell(`${formatCurrency(line.rateNetto)} zł`, AlignmentType.RIGHT),
          buildWordCell(`${formatCurrency(line.amountNetto)} zł`, AlignmentType.RIGHT),
          buildWordCell(index === 0 ? formatHours(row.totalHours) : '', AlignmentType.RIGHT, mergeState),
          buildWordCell(index === 0 ? `${formatCurrency(row.totalNetto)} zł` : '', AlignmentType.RIGHT, mergeState),
          buildWordCell(index === 0 ? `${formatCurrency(row.totalBrutto)} zł` : '', AlignmentType.RIGHT, mergeState),
        ],
      });
    })
  );

  const summaryRow = new TableRow({
    children: [
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('', AlignmentType.CENTER),
      buildWordCell('Suma', AlignmentType.RIGHT),
      buildWordCell(formatHours(report.grandTotalHours), AlignmentType.RIGHT),
      buildWordCell(`${formatCurrency(report.grandTotalNetto)} zł`, AlignmentType.RIGHT),
      buildWordCell(`${formatCurrency(report.grandTotalBrutto)} zł`, AlignmentType.RIGHT),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Raport PMS', bold: true, size: 22 })],
          spacing: { after: 240 },
        }),
        new Paragraph({ children: [new TextRun({ text: `Projekt: ${project.code}`, size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Numer umowy: ${project.contractNo}`, size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Data sporządzenia raportu: ${report.reportDate}`, size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Raport za okres od ${report.periodFrom} do ${report.periodTo}`, size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Liczba zgłoszeń: ${report.totalOrders}`, size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Liczba zgłoszeń zrealizowanych: ${report.realizedOrders}`, size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Liczba zgłoszeń pozostających w realizacji: ${report.remainingOrders}`, size: 20 })], spacing: { after: 240 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows, summaryRow],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${project.code}_Raport_PMS_${formatFileDate(report.reportDate)}.docx`);
};
