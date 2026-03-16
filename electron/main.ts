import electron from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
const { app, BrowserWindow, ipcMain, shell } = electron;
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { GoogleDocsService } from './googleDocsService.js';

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
    CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        issueId TEXT,
        issueReadableId TEXT,
        issueSummary TEXT,
        author TEXT,
        authorName TEXT,
        date TEXT,
        minutes INTEGER,
        description TEXT,
        lastModified TEXT,
        projectId TEXT
    );
    CREATE TABLE IF NOT EXISTS estimations (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meeting_notes (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_hubs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        projectCodes TEXT NOT NULL -- Komenda rozdzielona przecinkami
    );
    CREATE TABLE IF NOT EXISTS daily_sections (
        id TEXT PRIMARY KEY,
        hubId TEXT NOT NULL,
        name TEXT NOT NULL,
        youtrackStatuses TEXT NOT NULL, -- Statusy rozdzielone przecinkami
        orderIndex INTEGER NOT NULL,
        respectDates INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_comments (
        issueId TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        lastModified TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_issue_states (
        issueId TEXT PRIMARY KEY,
        isCollapsed INTEGER NOT NULL DEFAULT 0
    );
`);

// Initialization of Google Docs Service
const gDocsService = new GoogleDocsService(path.dirname(dbPath));

// Migracja dla istniejących tabel
try { db.exec('ALTER TABLE work_items ADD COLUMN issueReadableId TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE work_items ADD COLUMN issueSummary TEXT'); } catch (e) { }
try {
    const columns = db.prepare('PRAGMA table_info(daily_sections)').all() as { name: string }[];
    const hasRespectDates = columns.some(col => col.name === 'respectDates');
    if (!hasRespectDates) {
        db.prepare('ALTER TABLE daily_sections ADD COLUMN respectDates INTEGER NOT NULL DEFAULT 0').run();
    }
} catch (error) {
    console.error('Błąd migracji kolumny respectDates:', error);
}

db.exec(`
    CREATE TABLE IF NOT EXISTS issue_categories (
        issueId TEXT PRIMARY KEY,
        category TEXT NOT NULL
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
        } catch (e) { }
        try {
            db.exec('ALTER TABLE youtrack_tabs ADD COLUMN orderIndex INTEGER DEFAULT 0');
        } catch (e) { }
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
        } catch (e) { }
        try {
            db.exec('ALTER TABLE youtrack_tabs ADD COLUMN orderIndex INTEGER DEFAULT 0');
        } catch (e) { }
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

// ==========================================
// IPC WORK ITEMS & CATEGORIES HANDLERS
// ==========================================

ipcMain.handle('get-work-items', async (_, projectId: string) => {
    try {
        const rows = db.prepare('SELECT * FROM work_items WHERE projectId = ?').all(projectId);
        return rows;
    } catch (error) {
        console.error('Błąd pobierania work_items:', error);
        throw error;
    }
});

ipcMain.handle('upsert-work-items', async (_, { items, projectId }: { items: any[], projectId: string }) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO work_items (id, issueId, issueReadableId, issueSummary, author, authorName, date, minutes, description, lastModified, projectId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                    issueId = excluded.issueId,
                    issueReadableId = excluded.issueReadableId,
                    issueSummary = excluded.issueSummary,
                    author = excluded.author,
                    authorName = excluded.authorName,
                    date = excluded.date,
                    minutes = excluded.minutes,
                    description = excluded.description,
                    lastModified = excluded.lastModified,
                    projectId = excluded.projectId
            `);
            for (const item of items) {
                stmt.run(
                    item.id,
                    item.issueId,
                    item.issueReadableId,
                    item.issueSummary,
                    item.author,
                    item.authorName,
                    item.date,
                    item.minutes,
                    item.description,
                    item.lastModified,
                    projectId
                );
            }
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu work_items:', error);
        throw error;
    }
});

ipcMain.handle('import-work-items', async (_, { items, projectId }: { items: any[], projectId: string }) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO work_items (id, issueId, issueReadableId, issueSummary, author, authorName, date, minutes, description, lastModified, projectId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const item of items) {
                stmt.run(
                    item.id,
                    item.issueId,
                    item.issueReadableId,
                    item.issueSummary,
                    item.author,
                    item.authorName,
                    item.date,
                    item.minutes,
                    item.description,
                    item.lastModified,
                    projectId
                );
            }
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error('Błąd importu work_items:', error);
        throw error;
    }
});

ipcMain.handle('import-orders', async (_, { orders, projectId }: { orders: any[], projectId: string }) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO orders (id, data)
                VALUES (?, ?)
            `);
            for (const order of orders) {
                stmt.run(order.id, JSON.stringify({ ...order, projectId }));
            }
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error('Błąd importu zleceń:', error);
        throw error;
    }
});

ipcMain.handle('get-issue-categories', async () => {
    try {
        const rows = db.prepare('SELECT * FROM issue_categories').all();
        const map: Record<string, string> = {};
        for (const row of rows as { issueId: string, category: string }[]) {
            map[row.issueId] = row.category;
        }
        return map;
    } catch (error) {
        console.error('Błąd pobierania kategorii zgłoszeń:', error);
        throw error;
    }
});

ipcMain.handle('set-issue-category', async (_, { issueId, category }: { issueId: string, category: string }) => {
    try {
        db.prepare(`
            INSERT INTO issue_categories (issueId, category)
            VALUES (?, ?)
            ON CONFLICT(issueId) DO UPDATE SET category = excluded.category
        `).run(issueId, category);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu kategorii zgłoszenia:', error);
        throw error;
    }
});

ipcMain.handle('set-issue-categories-bulk', async (_, { issueIds, category }: { issueIds: string[], category: string }) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO issue_categories (issueId, category)
                VALUES (?, ?)
                ON CONFLICT(issueId) DO UPDATE SET category = excluded.category
            `);
            for (const id of issueIds) {
                stmt.run(id, category);
            }
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error('Błąd masowego zapisu kategorii:', error);
        throw error;
    }
});

ipcMain.handle('get-estimation', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM estimations WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('Błąd pobierania wyceny:', error);
        throw error;
    }
});

ipcMain.handle('save-estimation', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO estimations (projectId, data)
            VALUES (?, ?)
            ON CONFLICT(projectId) DO UPDATE SET data = excluded.data
        `).run(projectId, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu wyceny:', error);
        throw error;
    }
});

ipcMain.handle('write-clipboard-html', async (_, html: string) => {
    try {
        const { clipboard } = electron;
        clipboard.writeHTML(html);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu do schowka HTML:', error);
        throw error;
    }
});

// ==========================================
// IPC MEETING NOTES HANDLERS
// ==========================================

async function ensureGoogleCredentials() {
    console.log('Main: ensureGoogleCredentials starting...');
    const settingsRow = db.prepare(`SELECT data FROM settings WHERE id = 'default'`).get() as { data: string } | undefined;
    if (settingsRow) {
        console.log('Main: Found settings row');
        const settings = JSON.parse(settingsRow.data);
        console.log('Main: Settings keys:', Object.keys(settings));
        if (settings.googleClientId && settings.googleClientSecret) {
            console.log('Main: Google credentials found in settings, calling gDocsService.setCredentials');
            await gDocsService.setCredentials(settings.googleClientId, settings.googleClientSecret);
            return true;
        } else {
            console.log('Main: Google credentials missing in settings keys');
        }
    } else {
        console.log('Main: Settings row not found');
    }
    return false;
}

ipcMain.handle('get-meeting-notes', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM meeting_notes WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('Błąd pobierania notatek:', error);
        throw error;
    }
});

ipcMain.handle('save-meeting-notes', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO meeting_notes (projectId, data)
            VALUES (?, ?)
            ON CONFLICT(projectId) DO UPDATE SET data = excluded.data
        `).run(projectId, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu notatek:', error);
        throw error;
    }
});

ipcMain.handle('append-google-doc', async (_, { docLink, content, title, participants }: { docLink: string, content: string, title: string, participants: string[] }) => {
    try {
        await ensureGoogleCredentials();
        return await gDocsService.appendNote(docLink, title, participants, content);
    } catch (error) {
        console.error('Błąd synchronizacji z Google Docs:', error);
        throw error;
    }
});

ipcMain.handle('get-google-auth-status', async () => {
    try {
        await ensureGoogleCredentials();
        return await gDocsService.getAuthStatus();
    } catch (error) {
        console.error('Błąd statusu Google:', error);
        throw error;
    }
});

ipcMain.handle('get-google-auth-url', async () => {
    const hasCreds = await ensureGoogleCredentials();
    if (!hasCreds) {
        throw new Error('Brak skonfigurowanych danych Client ID / Secret w ustawieniach głównych.');
    }
    return gDocsService.getAuthUrl();
});

ipcMain.handle('authorize-google', async (_, code: string) => {
    return await gDocsService.authorize(code);
});

ipcMain.handle('logout-google', async () => {
    return await gDocsService.logout();
});

ipcMain.handle('open-external', async (_, url: string) => {
    await shell.openExternal(url);
    return { success: true };
});

// ==========================================
// IPC DAILY HANDLERS
// ==========================================

ipcMain.handle('get-daily-hubs', async () => {
    try {
        const rows = db.prepare('SELECT * FROM daily_hubs').all();
        return rows;
    } catch (error) {
        console.error('Błąd pobierania daily_hubs:', error);
        throw error;
    }
});

ipcMain.handle('save-daily-hub', async (_, hub: any) => {
    try {
        db.prepare(`
            INSERT INTO daily_hubs (id, name, description, projectCodes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name,
                description = excluded.description,
                projectCodes = excluded.projectCodes
        `).run(hub.id, hub.name, hub.description || '', hub.projectCodes);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu daily_hub:', error);
        throw error;
    }
});

ipcMain.handle('delete-daily-hub', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM daily_hubs WHERE id = ?').run(id);
        db.prepare('DELETE FROM daily_sections WHERE hubId = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd usuwania daily_hub:', error);
        throw error;
    }
});

ipcMain.handle('get-daily-sections', async (_, hubId: string) => {
    try {
        const rows = db.prepare('SELECT * FROM daily_sections WHERE hubId = ? ORDER BY orderIndex ASC').all(hubId) as any[];
        return rows.map(row => ({
            ...row,
            respectDates: row.respectDates === 1
        }));
    } catch (error) {
        console.error('Błąd pobierania daily_sections:', error);
        throw error;
    }
});

ipcMain.handle('save-daily-section', async (_, section: any) => {
    try {
        db.prepare(`
            INSERT INTO daily_sections (id, hubId, name, youtrackStatuses, orderIndex, respectDates)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name,
                youtrackStatuses = excluded.youtrackStatuses,
                orderIndex = excluded.orderIndex,
                respectDates = excluded.respectDates
        `).run(section.id, section.hubId, section.name, section.youtrackStatuses, section.orderIndex, section.respectDates ? 1 : 0);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu daily_section:', error);
        throw error;
    }
});

ipcMain.handle('delete-daily-section', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM daily_sections WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd usuwania daily_section:', error);
        throw error;
    }
});

ipcMain.handle('reorder-daily-sections', async (_, sections: { id: string, orderIndex: number }[]) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare('UPDATE daily_sections SET orderIndex = ? WHERE id = ?');
            for (const s of sections) {
                stmt.run(s.orderIndex, s.id);
            }
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error('Błąd reorder daily_sections:', error);
        throw error;
    }
});

ipcMain.handle('get-daily-comments', async () => {
    try {
        const rows = db.prepare('SELECT * FROM daily_comments').all();
        const map: Record<string, string> = {};
        for (const row of rows as { issueId: string, content: string }[]) {
            map[row.issueId] = row.content;
        }
        return map;
    } catch (error) {
        console.error('Błąd pobierania daily_comments:', error);
        throw error;
    }
});

ipcMain.handle('save-daily-comment', async (_, { issueId, content }: { issueId: string, content: string }) => {
    try {
        db.prepare(`
            INSERT INTO daily_comments (issueId, content, lastModified)
            VALUES (?, ?, ?)
            ON CONFLICT(issueId) DO UPDATE SET 
                content = excluded.content,
                lastModified = excluded.lastModified
        `).run(issueId, content, new Date().toISOString());
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu daily_comment:', error);
        throw error;
    }
});

ipcMain.handle('get-daily-issue-states', async () => {
    try {
        const rows = db.prepare('SELECT * FROM daily_issue_states').all();
        const map: Record<string, boolean> = {};
        for (const row of rows as { issueId: string, isCollapsed: number }[]) {
            map[row.issueId] = row.isCollapsed === 1;
        }
        return map;
    } catch (error) {
        console.error('Błąd pobierania daily_issue_states:', error);
        throw error;
    }
});

ipcMain.handle('save-daily-issue-state', async (_, { issueId, isCollapsed }: { issueId: string, isCollapsed: boolean }) => {
    try {
        db.prepare(`
            INSERT INTO daily_issue_states (issueId, isCollapsed)
            VALUES (?, ?)
            ON CONFLICT(issueId) DO UPDATE SET isCollapsed = excluded.isCollapsed
        `).run(issueId, isCollapsed ? 1 : 0);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu daily_issue_state:', error);
        throw error;
    }
});
