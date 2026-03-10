import * as XLSX from 'xlsx';
import { type WorkItemRow } from '../types';

export const exportToExcel = (items: WorkItemRow[], fileName: string) => {
    const data = items.map(item => ({
        'Data': item.date.split('T')[0],
        'ID': item.issueReadableId,
        'Zadanie': item.issueSummary,
        'Autor': item.authorName,
        'Czas (min)': item.minutes,
        'Czas (h)': (item.minutes / 60).toFixed(2),
        'Kategoria': item.category,
        'Opis': item.description,
        'YouTrack ID': item.issueId,
        'ID Logu': item.id
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rejestr Pracy');

    // Generate buffer and trigger download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const importFromExcel = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                const items = jsonData.map(row => ({
                    id: row['ID Logu'] || row['id'] || `ext-${Math.random().toString(36).substr(2, 9)}`,
                    issueId: row['YouTrack ID'] || row['issueId'] || '',
                    issueReadableId: row['ID'] || row['issueReadableId'] || '',
                    issueSummary: row['Zadanie'] || row['issueSummary'] || '',
                    author: row['author'] || '',
                    authorName: row['Autor'] || row['authorName'] || '',
                    date: row['Data'] || row['date'] || new Date().toISOString(),
                    minutes: parseInt(row['Czas (min)'] || row['minutes'] || '0', 10),
                    description: row['Opis'] || row['description'] || '',
                    lastModified: new Date().toISOString()
                })).filter(item => item.issueReadableId && item.minutes > 0);

                resolve(items);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};

export const exportOrdersToExcel = (orders: any[], project: any, fileName: string) => {
    const data = orders.map(order => {
        const totalHours = order.items.reduce((sum: number, item: any) => sum + (Number(item.hours) || 0), 0);
        return {
            'Nr Zlecenia': order.orderNumber,
            'Tytuł': order.title,
            'Priorytet': order.priority,
            'Status': order.acceptanceDate ? 'Zakończone' : 'W realizacji',
            'Suma Godzin': totalHours,
            'Kwota Netto (zł)': (totalHours * project.rateNetto).toFixed(2),
            'Kwota Brutto (zł)': (totalHours * project.rateBrutto).toFixed(2),
            'Planowany Start': order.scheduleFrom,
            'Planowany Koniec': order.scheduleTo,
            'Data Przekazania': order.handoverDate || '',
            'Data Odbioru': order.acceptanceDate || '',
            'System/Moduł': order.systemModule,
            'Lokalizacja': order.location,
            'Metodyka': order.methodologyRequired ? 'TAK' : 'NIE',
            'Zakres Metodyki': order.methodologyScope || '',
            'Opis Problemu': order.problemDescription,
            'Stan Oczekiwany': order.expectedStateDescription,
            'Uwagi': order.notes || '',
            'Data Utworzenia': order.createdAt.split('T')[0],
            'ID': order.id
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rejestr Zleceń');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const importOrdersFromExcel = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                const orders = jsonData.map(row => {
                    const totalHours = parseFloat(row['Suma Godzin'] || row['totalHours'] || '0');
                    return {
                        id: row['ID'] || row['id'] || `ext-ord-${Math.random().toString(36).substr(2, 9)}`,
                        orderNumber: row['Nr Zlecenia'] || row['orderNumber'] || '',
                        title: row['Tytuł'] || row['title'] || '',
                        priority: row['Priorytet'] || row['priority'] || 'niski',
                        problemDescription: row['Opis Problemu'] || row['problemDescription'] || '',
                        expectedStateDescription: row['Stan Oczekiwany'] || row['expectedStateDescription'] || '',
                        location: row['Lokalizacja'] || row['location'] || 'zdalnie',
                        methodologyRequired: (row['Metodyka'] === 'TAK' || row['methodologyRequired'] === true),
                        methodologyScope: row['Zakres Metodyki'] || row['methodologyScope'] || '',
                        scheduleFrom: row['Planowany Start'] || row['scheduleFrom'] || '',
                        scheduleTo: row['Planowany Koniec'] || row['scheduleTo'] || '',
                        handoverDate: row['Data Przekazania'] || row['handoverDate'] || '',
                        acceptanceDate: row['Data Odbioru'] || row['acceptanceDate'] || '',
                        systemModule: row['System/Moduł'] || row['systemModule'] || '',
                        notes: row['Uwagi'] || row['notes'] || '',
                        createdAt: row['Data Utworzenia'] || row['createdAt'] || new Date().toISOString(),
                        items: [{
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            name: 'Import z Excel',
                            date: row['Planowany Koniec'] || row['scheduleTo'] || new Date().toISOString().split('T')[0],
                            hours: totalHours
                        }]
                    };
                }).filter(order => order.orderNumber && order.title);

                resolve(orders);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};
