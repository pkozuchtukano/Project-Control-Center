import * as XLSX from 'xlsx';
import { type Estimation, type Project } from '../../../App';
import { format } from 'date-fns';

export const exportEstimationToExcel = (estimation: Estimation, project: Project, isBrutto: boolean) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const fileName = `${project.code}_${today}_Wycena`;

    const data = estimation.items.map((item, index) => {
        return {
            'LP': index + 1,
            'Przedmiot wyceny': item.name,
            'Est. Zespół (h)': item.baseHours,
            'Wsp.': item.multiplier,
            'Finał (h)': { f: `C${index + 2}*D${index + 2}` },
            [`Kwota ${isBrutto ? 'Brutto' : 'Netto'} (PLN)`]: { f: `E${index + 2}*$H$2` }
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Add summary row with formulas
    const lastRow = data.length + 1;
    const summaryRow = lastRow + 1;
    
    // LP (A), Name (B), Base (C), Multiplier (D), Final (E), Cost (F)
    const finalHoursRange = `E2:E${lastRow}`;
    const costRange = `F2:F${lastRow}`;

    XLSX.utils.sheet_add_aoa(worksheet, [[
        null,
        'SUMA',
        null,
        null,
        { f: `SUM(${finalHoursRange})` },
        { f: `SUM(${costRange})` }
    ]], { origin: `A${summaryRow}` });

    // Set number formatting for columns C, D, E, F and H (Rate)
    const colsToFormat = ['C', 'D', 'E', 'F'];
    for (let i = 2; i <= summaryRow; i++) {
        colsToFormat.forEach(col => {
            const cell = worksheet[`${col}${i}`];
            if (cell) {
                cell.z = '#,##0.00';
            }
        });
    }

    // Add Rate info to column H
    const rateLabel = `Stawka ${isBrutto ? 'Brutto' : 'Netto'} (PLN)`;
    const rateValue = isBrutto ? project.rateBrutto : project.rateNetto;
    
    XLSX.utils.sheet_add_aoa(worksheet, [
        [rateLabel],
        [rateValue]
    ], { origin: 'H1' });

    // Format H2
    if (worksheet['H2']) {
        worksheet['H2'].z = '#,##0.00';
        worksheet['H2'].t = 'n'; // Explicitly set as number
    }
    
    // Set column widths
    const wscols = [
        { wch: 5 },  // LP
        { wch: 40 }, // Przedmiot wyceny
        { wch: 15 }, // Est. Zespół (h)
        { wch: 8 },  // Wsp.
        { wch: 12 }, // Finał (h)
        { wch: 20 }, // Kwota
        { wch: 2 },  // Spacer (G)
        { wch: 25 }, // Stawka (H)
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Wycena');

    // Generate buffer and trigger download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
