import electron from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
const { app, BrowserWindow, ipcMain, shell } = electron;
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// To address '__filename is not defined' in built ESM Vite-Electron environments,
// we use app.getAppPath() to reliably locate resources instead of __dirname
const isDev = !app.isPackaged;
const appDir = app.getAppPath();

// Odnalezienie prawidłowego miejsca na bazę
const dbPath = isDev
    ? path.join(appDir, 'baza_danych.db')
    : path.join(path.dirname(app.getPath('exe')), 'baza_danych.db');

// Inicjalizacja SQLite
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Wydajniejszy tryb zapisu

// Tworzenie tabel Key-Value dla projektów, zgłoszeń i ustawień
db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS excluded_issues (
        id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS youtrack_tabs (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        name TEXT NOT NULL,
        statuses TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS youtrack_issue_task_types (
        issueId TEXT PRIMARY KEY,
        taskTypeId TEXT NOT NULL
    );
`);

let mainWindow: BrowserWindowType | null = null;

// Re-implementing __dirname safely for ESM context in Electron
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false, // Don't show immediately to prevent flickering
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        autoHideMenuBar: true,
    });

    // Przechwytuj kliknięcia w linki (jak target="_blank") i odsyłaj do "zewnętrznej" pełnoprawnej przeglądarki użytkownika
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' }; // zablokuj otwieranie sub-okienka Electronowego
    });

    mainWindow.maximize();
    mainWindow.show();

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ==========================================
// IPC DATABASE HANDLERS (SQLite)
// ==========================================

ipcMain.handle('read-db', async () => {
    try {
        const fetchAll = (table: string) => db.prepare(`SELECT data FROM ${table}`).all().map((r: any) => JSON.parse(r.data));

        const projects = fetchAll('projects');
        const orders = fetchAll('orders');

        // Settings are stored as a single object but technically could be multiple rows. For now, we take row 'default'
        const settingsRow = db.prepare(`SELECT data FROM settings WHERE id = 'default'`).get() as { data: string } | undefined;
        let settings = undefined;
        if (settingsRow && settingsRow.data) {
            settings = JSON.parse(settingsRow.data);
        }

        return { projects, orders, settings };
    } catch (error) {
        console.error('Błąd odczytu bazy SQLite:', error);
        throw error;
    }
});

// Stary zapis całego pliku zastępujemy transakcją czyszczenia i wstawiania na nowo, 
// lub optymalniej UPSERT-ami, ale aby zachować kompatybilność z pełnym zapisem `writeDb`, zrobimy transakcję kasująco-wstawiającą.
ipcMain.handle('write-db', async (_, data: { projects?: any[]; orders?: any[]; settings?: any }) => {
    try {
        const transaction = db.transaction(() => {
            // Nadpisywanie projektów
            if (data.projects) {
                db.prepare('DELETE FROM projects').run();
                const insertProject = db.prepare('INSERT INTO projects (id, data) VALUES (?, ?)');
                for (const proj of data.projects) {
                    insertProject.run(proj.id, JSON.stringify(proj));
                }
            }

            // Nadpisywanie zamówień
            if (data.orders) {
                db.prepare('DELETE FROM orders').run();
                const insertOrder = db.prepare('INSERT INTO orders (id, data) VALUES (?, ?)');
                for (const ord of data.orders) {
                    insertOrder.run(ord.id, JSON.stringify(ord));
                }
            }

            // Zapis settings jako id "default"
            if (data.settings) {
                const insertSettings = db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)');
                insertSettings.run('default', JSON.stringify(data.settings));
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu bazy SQLite:', error);
        throw error;
    }
});

// ==========================================
// IPC EXCLUDED ISSUES HANDLERS
// ==========================================

ipcMain.handle('get-excluded-issues', async () => {
    try {
        const rows = db.prepare('SELECT id FROM excluded_issues').all() as { id: string }[];
        return rows.map(r => r.id);
    } catch (error) {
        console.error('Błąd odczytu excluded_issues:', error);
        throw error;
    }
});

ipcMain.handle('set-issue-excluded', async (_, { id, excluded }: { id: string; excluded: boolean }) => {
    try {
        if (excluded) {
            db.prepare('INSERT OR IGNORE INTO excluded_issues (id) VALUES (?)').run(id);
        } else {
            db.prepare('DELETE FROM excluded_issues WHERE id = ?').run(id);
        }
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu excluded_issues:', error);
        throw error;
    }
});

// ==========================================
// IPC YOUTRACK TABS HANDLERS
// ==========================================

ipcMain.handle('get-youtrack-tabs', async (_, projectId: string) => {
    try {
        try {
            db.exec('ALTER TABLE youtrack_tabs ADD COLUMN includeFilters INTEGER DEFAULT 0');
        } catch (e) {}
        try {
            db.exec('ALTER TABLE youtrack_tabs ADD COLUMN orderIndex INTEGER DEFAULT 0');
        } catch (e) {}
        const rows = db.prepare('SELECT * FROM youtrack_tabs WHERE projectId = ? ORDER BY orderIndex ASC, rowid ASC').all(projectId) as { id: string; projectId: string; name: string; statuses: string; includeFilters?: number; orderIndex?: number }[];
        return rows.map(r => ({ ...r, statuses: JSON.parse(r.statuses), includeFilters: r.includeFilters === 1 }));
    } catch (error) {
        console.error('Błąd odczytu youtrack_tabs:', error);
        throw error;
    }
});

ipcMain.handle('save-youtrack-tab', async (_, tab: { id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }) => {
    try {
        try {
            db.exec('ALTER TABLE youtrack_tabs ADD COLUMN includeFilters INTEGER DEFAULT 0');
        } catch (e) {}
        try {
            db.exec('ALTER TABLE youtrack_tabs ADD COLUMN orderIndex INTEGER DEFAULT 0');
        } catch (e) {}
        db.prepare(`
            INSERT INTO youtrack_tabs (id, projectId, name, statuses, includeFilters, orderIndex)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, statuses = excluded.statuses, includeFilters = excluded.includeFilters, orderIndex = COALESCE(excluded.orderIndex, youtrack_tabs.orderIndex)
        `).run(tab.id, tab.projectId, tab.name, JSON.stringify(tab.statuses), tab.includeFilters ? 1 : 0, tab.orderIndex ?? 0);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu youtrack_tabs:', error);
        throw error;
    }
});

ipcMain.handle('delete-youtrack-tab', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM youtrack_tabs WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd usuwania youtrack_tabs:', error);
        throw error;
    }
});

ipcMain.handle('reorder-youtrack-tabs', async (_, tabs: { id: string; orderIndex: number }[]) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare('UPDATE youtrack_tabs SET orderIndex = ? WHERE id = ?');
            for (const tab of tabs) {
                stmt.run(tab.orderIndex, tab.id);
            }
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error('Błąd aktualizacji kolejności youtrack_tabs:', error);
        throw error;
    }
});

ipcMain.handle('get-issue-task-types', async (event, issueIds: string[]) => {
    try {
        if (!issueIds || issueIds.length === 0) return {};
        
        const placeholders = issueIds.map(() => '?').join(',');
        const rows = db.prepare(`SELECT issueId, taskTypeId FROM youtrack_issue_task_types WHERE issueId IN (${placeholders})`).all(...issueIds);
        
        const map: Record<string, string> = {};
        for (const row of rows as { issueId: string, taskTypeId: string }[]) {
            map[row.issueId] = row.taskTypeId;
        }
        return map;
    } catch (error) {
        console.error('Błąd pobierania rodzajów zadań ze zgłoszeń:', error);
        throw error;
    }
});

ipcMain.handle('set-issue-task-type', async (event, issueId: string, taskTypeId: string) => {
    try {
        db.prepare(`
            INSERT INTO youtrack_issue_task_types (issueId, taskTypeId) 
            VALUES (?, ?) 
            ON CONFLICT(issueId) DO UPDATE SET taskTypeId = excluded.taskTypeId
        `).run(issueId, taskTypeId);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu rodzaju zadania dla zgłoszenia:', error);
        throw error;
    }
});

// ==========================================
// IPC YOUTRACK API HANDLERS (Bypass CORS)
// ==========================================

ipcMain.handle('fetch-youtrack', async (_, { url, method = 'GET', headers, params, data, responseType }) => {
    try {
        // Build URL with query params
        const urlObj = new URL(url);
        if (params) {
            Object.keys(params).forEach(key => urlObj.searchParams.append(key, params[key]));
        }

        const fetchOptions: RequestInit = {
            method,
            headers: headers as HeadersInit,
        };

        if (data) {
            fetchOptions.body = JSON.stringify(data);
        }

        const response = await fetch(urlObj.toString(), fetchOptions);

        if (!response.ok) {
            // Throw an object we can catch on the other side
            throw {
                status: response.status,
                statusText: response.statusText,
                message: await response.text()
            };
        }

        if (responseType === 'arraybuffer') {
            const buffer = await response.arrayBuffer();
            return Buffer.from(buffer);
        }

        return await response.json();
    } catch (error: any) {
        console.error(`Błąd zapytania fetch-youtrack do ${url}:`, error);
        throw error;
    }
});
