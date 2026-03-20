import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { type Estimation, type Project } from '../../../types';

const BORDER_STYLE = {
  style: 'thin' as const,
  color: { argb: 'FF000000' },
};

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFF3F4F6' },
};

const TOTAL_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFF9FAFB' },
};

const getHoursFormat = (value: number) => (Number.isInteger(value) ? '0' : '0.00');
const formatScheduleDate = (value?: string) => {
  if (!value) return '...';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : format(date, 'dd.MM.yyyy');
};

const buildScheduleRows = (estimation: Estimation) => {
  if (estimation.scheduleMode === 'simple') {
    return [
      ['Rozpoczęcie', formatScheduleDate(estimation.scheduleData.simple.start)],
      ['Zakończenie', formatScheduleDate(estimation.scheduleData.simple.end)],
    ];
  }

  return estimation.scheduleData.milestones.map((milestone) => [
    milestone.name || 'Etap',
    formatScheduleDate(milestone.date),
  ]);
};

const applyBorder = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: BORDER_STYLE,
    right: BORDER_STYLE,
    bottom: BORDER_STYLE,
    left: BORDER_STYLE,
  };
};

const styleHeaderCell = (cell: ExcelJS.Cell) => {
  applyBorder(cell);
  cell.fill = HEADER_FILL;
  cell.font = { bold: true };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
};

const styleBodyCell = (cell: ExcelJS.Cell, horizontal: ExcelJS.Alignment['horizontal'] = 'left') => {
  applyBorder(cell);
  cell.alignment = { vertical: 'middle', horizontal };
};

const styleTotalCell = (cell: ExcelJS.Cell, horizontal: ExcelJS.Alignment['horizontal']) => {
  applyBorder(cell);
  cell.fill = TOTAL_FILL;
  cell.font = { bold: true };
  cell.alignment = { vertical: 'middle', horizontal };
};

export const exportEstimationToExcel = async (estimation: Estimation, project: Project, isBrutto: boolean) => {
  const timestamp = format(new Date(), 'yyyyMMddHHmm');
  const fileName = `${project.code}_${timestamp}_kalkukacja zlecenia.xlsx`;
  const rateValue = isBrutto ? project.rateBrutto : project.rateNetto;
  const rateLabel = `Stawka za h (${isBrutto ? 'brutto' : 'netto'})`;
  const amountLabel = `Kwota razem (${isBrutto ? 'brutto' : 'netto'})`;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Wycena', {
    views: [{ showGridLines: true }],
  });

  worksheet.columns = [
    { width: 8 },
    { width: 28 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
    { width: 8 },
    { width: 18 },
    { width: 16 },
  ];

  const estimationItems = estimation.items.map((item, index) => ({ item, displayIndex: index + 1 }));
  const totalHours = estimationItems.reduce((sum, entry) => sum + entry.item.finalHours, 0);
  const totalAmount = totalHours * rateValue;
  const scheduleRows = buildScheduleRows(estimation);
  const rowCount = Math.max(estimationItems.length, scheduleRows.length);

  worksheet.addRow(['Lp.', 'Przedmiot wyceny', 'Liczba Godzin', rateLabel, amountLabel, '', 'Zadanie / Etap', 'Termin']);
  worksheet.getRow(1).height = 24;

  for (let index = 0; index < rowCount; index += 1) {
    const itemEntry = estimationItems[index];
    const item = itemEntry?.item;
    const schedule = scheduleRows[index];

    worksheet.addRow([
      itemEntry ? itemEntry.displayIndex : '',
      item?.name || '',
      item ? item.finalHours : '',
      item ? rateValue : '',
      item ? item.finalHours * rateValue : '',
      '',
      schedule?.[0] || '',
      schedule?.[1] || '',
    ]);
  }

  worksheet.addRow(['', 'RAZEM:', totalHours, '', totalAmount, '', '', '']);

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber === 6) {
        return;
      }

      if (rowNumber === 1) {
        styleHeaderCell(cell);
        return;
      }

      const isTotalRow = rowNumber === rowCount + 2;
      const isEstimationSide = colNumber >= 1 && colNumber <= 5;
      const isScheduleSide = colNumber >= 7 && colNumber <= 8;

      if (!isEstimationSide && !isScheduleSide) {
        return;
      }

      if (isTotalRow && isEstimationSide) {
        const totalAlignment = colNumber === 2 ? 'right' : colNumber === 5 ? 'right' : 'center';
        styleTotalCell(cell, totalAlignment);
        return;
      }

      const alignment =
        colNumber === 1 ? 'center'
        : colNumber === 3 ? 'right'
        : colNumber === 4 ? 'right'
        : colNumber === 5 ? 'right'
        : colNumber === 8 ? 'center'
        : 'left';

      styleBodyCell(cell, alignment);
    });
  });

  for (let rowNumber = 2; rowNumber <= rowCount + 1; rowNumber += 1) {
    const hoursCell = worksheet.getCell(`C${rowNumber}`);
    const rateCell = worksheet.getCell(`D${rowNumber}`);
    const amountCell = worksheet.getCell(`E${rowNumber}`);

    if (typeof hoursCell.value === 'number') {
      hoursCell.numFmt = getHoursFormat(hoursCell.value);
    }

    if (typeof rateCell.value === 'number') {
      rateCell.numFmt = '#,##0.00 "zł"';
    }

    if (typeof amountCell.value === 'number') {
      amountCell.numFmt = '#,##0.00 "zł"';
    }
  }

  const totalHoursCell = worksheet.getCell(`C${rowCount + 2}`);
  const totalAmountCell = worksheet.getCell(`E${rowCount + 2}`);

  if (typeof totalHoursCell.value === 'number') {
    totalHoursCell.numFmt = getHoursFormat(totalHoursCell.value);
  }

  if (typeof totalAmountCell.value === 'number') {
    totalAmountCell.numFmt = '#,##0.00 "zł"';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
};
