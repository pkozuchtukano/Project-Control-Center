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
  WidthType,
} from 'docx';
import type { Order, Project } from '../../../types';

export type CbcpReportRow = {
  orderNumber: string;
  title: string;
  products: string;
  systemModule: string;
  orderDate: string;
  handoverDate: string;
  acceptanceDate: string;
  totalHours: number;
};

export type CbcpReportData = {
  reportDate: string;
  periodFrom: string;
  periodTo: string;
  totalOrders: number;
  realizedOrders: number;
  remainingOrders: number;
  rows: CbcpReportRow[];
};

const formatFileDate = (value: string) => (value || new Date().toISOString().split('T')[0]).replace(/-/g, '');
const formatHours = (value: number) => value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const buildCbcpReportData = (
  orders: Order[],
  periodFrom: string,
  periodTo: string,
  reportDate: string
): CbcpReportData => {
  const filteredOrders = orders.filter((order) => {
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

  const realizedOrders = filteredOrders.filter((order) => order.acceptanceDate).length;

  return {
    reportDate,
    periodFrom,
    periodTo,
    totalOrders: filteredOrders.length,
    realizedOrders,
    remainingOrders: filteredOrders.length - realizedOrders,
    rows: filteredOrders.map((order) => ({
      orderNumber: order.orderNumber,
      title: order.title,
      products: order.items.map((item) => item.name).join(', '),
      systemModule: order.systemModule || '',
      orderDate: order.scheduleFrom || order.createdAt.split('T')[0],
      handoverDate: order.handoverDate || '',
      acceptanceDate: order.acceptanceDate || '',
      totalHours: order.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0),
    })),
  };
};

export const exportCbcpReportToExcel = (project: Project, report: CbcpReportData) => {
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    ['Raport końcowy realizacji usług'],
    ['Projekt', project.code],
    ['Numer umowy', project.contractNo],
    ['Data sporządzenia raportu', report.reportDate],
    ['Okres od', report.periodFrom],
    ['Okres do', report.periodTo],
    ['Liczba zgłoszeń', report.totalOrders],
    ['Liczba zgłoszeń zrealizowanych', report.realizedOrders],
    ['Liczba zgłoszeń pozostających w realizacji', report.remainingOrders],
    [],
    ['Nr zgł.', 'Nazwa zlecenia', 'Produkty', 'System / Moduł', 'Data zlecenia', 'Data przekazania', 'Data odbioru zlecenia', 'Czas realizacji zlecenia'],
    ...report.rows.map((row) => [
      row.orderNumber,
      row.title,
      row.products,
      row.systemModule,
      row.orderDate,
      row.handoverDate,
      row.acceptanceDate,
      row.totalHours,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 40 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];

  const dataStartRow = 12;
  for (let rowIndex = dataStartRow; rowIndex < dataStartRow + report.rows.length; rowIndex += 1) {
    const cell = worksheet[`H${rowIndex}`];
    if (cell) {
      cell.z = '0.00" h"';
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Raport CBCP');
  XLSX.writeFile(workbook, `${project.code}_Raport_CBCP_${formatFileDate(report.reportDate)}.xlsx`);
};

export const exportCbcpReportToWord = async (project: Project, report: CbcpReportData) => {
  const tableRows = [
    new TableRow({
      children: [
        'Nr zgł.',
        'Nazwa zlecenia',
        'Produkty',
        'System / Moduł',
        'Data zlecenia',
        'Data przekazania',
        'Data odbioru zlecenia',
        'Czas realizacji zlecenia',
      ].map((text) => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, size: 22 })],
          alignment: AlignmentType.CENTER,
        })],
      })),
    }),
    ...report.rows.map((row) => new TableRow({
      children: [
        row.orderNumber,
        row.title,
        row.products,
        row.systemModule,
        row.orderDate,
        row.handoverDate,
        row.acceptanceDate,
        `${formatHours(row.totalHours)}h`,
      ].map((text, index) => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: text || '', size: 20 })],
          alignment: index === 0 || index >= 4 ? AlignmentType.CENTER : AlignmentType.LEFT,
        })],
      })),
    })),
  ];

  if (!report.rows.length) {
    tableRows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 8,
          children: [new Paragraph({
            children: [new TextRun({ text: 'Brak zleceń w wybranym okresie.', italics: true, size: 20 })],
            alignment: AlignmentType.CENTER,
          })],
        }),
      ],
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Załącznik nr 14. Wzór raportu końcowego z realizacji usług.', bold: true, size: 20 })],
          spacing: { after: 240 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Raport Końcowy ', bold: true, size: 28 }),
            new TextRun({ text: `realizacji usług w ramach Umowy ${project.contractNo}`, size: 28 }),
          ],
          spacing: { after: 320 },
        }),
        new Paragraph({ children: [new TextRun({ text: `Data sporządzenia raportu: ${report.reportDate}`, size: 22 })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: `Raport za okres od ${report.periodFrom} do ${report.periodTo}`, size: 22 })], spacing: { after: 120 } }),
        new Paragraph({ children: [new TextRun({ text: `Liczba zgłoszeń w raportowanym okresie: ${report.totalOrders}`, size: 22 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Liczba zgłoszeń zrealizowanych w raportowanym okresie: ${report.realizedOrders}`, size: 22 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: `Liczba zgłoszeń pozostających w realizacji: ${report.remainingOrders}`, size: 22 })], spacing: { after: 240 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
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
  saveAs(blob, `${project.code}_Raport_CBCP_${formatFileDate(report.reportDate)}.docx`);
};
