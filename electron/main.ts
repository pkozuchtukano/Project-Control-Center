import electron from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = electron;
import path from 'path';
import fs from 'fs/promises';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { GoogleDocsService } from './googleDocsService.js';
import { getEnvSettings } from './envConfig.js';
import type { ScheduledTask, DailyHub, DailySection, ScheduledTaskContentSource } from '../src/types.js';

// To address '__filename is not defined' in built ESM Vite-Electron environments,
// we use app.getAppPath() to reliably locate resources instead of __dirname
const isDev = !app.isPackaged;
const appDir = app.getAppPath();
const executableDir = path.dirname(app.getPath('exe'));
const envSettings = getEnvSettings(appDir, executableDir);

// Odnalezienie prawidĹ‚owego miejsca na bazÄ™
const dbPath = isDev
    ? path.join(appDir, 'baza_danych.db')
    : path.join(executableDir, 'baza_danych.db');
const dbWalPath = `${dbPath}-wal`;
const dbShmPath = `${dbPath}-shm`;
const remoteDatabaseFileNamePrefix = 'pcc-baza_danych';
const googleDriveSharedFolderLink = envSettings.googleDriveSharedFolderLink?.trim() || '';

// Inicjalizacja SQLite
let db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Wydajniejszy tryb zapisu

// Tworzenie tabel Key-Value dla projektĂłw, zgĹ‚oszeĹ„ i ustawieĹ„
db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
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
        issueType TEXT,
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
    CREATE TABLE IF NOT EXISTS order_protocol_email_templates (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_acceptance_email_templates (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS maintenance_settlement_email_templates (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_links (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        visibleInTabs TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS status_reports (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        dateFrom TEXT NOT NULL,
        dateTo TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS maintenance_entries (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        month TEXT NOT NULL,
        netAmount REAL NOT NULL,
        vatRate REAL NOT NULL,
        grossAmount REAL NOT NULL,
        notes TEXT,
        settlementFlow TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
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
db.exec('DROP TABLE IF EXISTS settings');

// Initialization of Google Docs Service
const gDocsService = new GoogleDocsService(path.dirname(dbPath));

// Migracja dla istniejÄ…cych tabel
try { db.exec('ALTER TABLE work_items ADD COLUMN issueReadableId TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE work_items ADD COLUMN issueSummary TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE work_items ADD COLUMN issueType TEXT'); } catch (e) { }
try { db.exec(`ALTER TABLE project_links ADD COLUMN visibleInTabs TEXT NOT NULL DEFAULT '[]'`); } catch (e) { }
try {
    const columns = db.prepare('PRAGMA table_info(daily_sections)').all() as { name: string }[];
    const hasRespectDates = columns.some(col => col.name === 'respectDates');
    if (!hasRespectDates) {
        db.prepare('ALTER TABLE daily_sections ADD COLUMN respectDates INTEGER NOT NULL DEFAULT 0').run();
    }
} catch (error) {
    console.error('BĹ‚Ä…d migracji kolumny respectDates:', error);
}

db.exec(`
    CREATE TABLE IF NOT EXISTS issue_categories (
        issueId TEXT PRIMARY KEY,
        category TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issue_maintenance_flags (
        issueId TEXT PRIMARY KEY,
        isMaintenance INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS order_item_templates (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );
`);

const initializeDatabase = () => {
    db.pragma('journal_mode = WAL');
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
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
            issueType TEXT,
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
        CREATE TABLE IF NOT EXISTS order_protocol_email_templates (
            projectId TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS order_acceptance_email_templates (
            projectId TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS maintenance_settlement_email_templates (
            projectId TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS project_links (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            visibleInTabs TEXT NOT NULL DEFAULT '[]',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS status_reports (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            title TEXT NOT NULL,
            dateFrom TEXT NOT NULL,
            dateTo TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS maintenance_entries (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            month TEXT NOT NULL,
            netAmount REAL NOT NULL,
            vatRate REAL NOT NULL,
            grossAmount REAL NOT NULL,
            notes TEXT,
            settlementFlow TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS daily_hubs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            projectCodes TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS daily_sections (
            id TEXT PRIMARY KEY,
            hubId TEXT NOT NULL,
            name TEXT NOT NULL,
            youtrackStatuses TEXT NOT NULL,
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
        CREATE TABLE IF NOT EXISTS issue_categories (
            issueId TEXT PRIMARY KEY,
            category TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS issue_maintenance_flags (
            issueId TEXT PRIMARY KEY,
            isMaintenance INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS order_item_templates (
            projectId TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
    `);
    db.exec('DROP TABLE IF EXISTS settings');

    try { db.exec('ALTER TABLE work_items ADD COLUMN issueReadableId TEXT'); } catch { }
    try { db.exec('ALTER TABLE work_items ADD COLUMN issueSummary TEXT'); } catch { }
    try { db.exec('ALTER TABLE work_items ADD COLUMN issueType TEXT'); } catch { }
    try { db.exec(`ALTER TABLE project_links ADD COLUMN visibleInTabs TEXT NOT NULL DEFAULT '[]'`); } catch { }
    try {
        const columns = db.prepare('PRAGMA table_info(daily_sections)').all() as { name: string }[];
        const hasRespectDates = columns.some(col => col.name === 'respectDates');
        if (!hasRespectDates) {
            db.prepare('ALTER TABLE daily_sections ADD COLUMN respectDates INTEGER NOT NULL DEFAULT 0').run();
        }
    } catch (error) {
        console.error('BĹ‚Ä…d migracji kolumny respectDates:', error);
    }
    try {
        const columns = db.prepare('PRAGMA table_info(maintenance_entries)').all() as { name: string }[];
        const hasSettlementFlow = columns.some(col => col.name === 'settlementFlow');
        if (!hasSettlementFlow) {
            db.prepare('ALTER TABLE maintenance_entries ADD COLUMN settlementFlow TEXT').run();
        }
    } catch (error) {
        console.error('BÄąâ€šĂ„â€¦d migracji kolumny settlementFlow:', error);
    }
};

const reopenDatabase = () => {
    db = new Database(dbPath);
    initializeDatabase();
};

const closeDatabase = () => {
    try {
        db.close();
    } catch {
        // ignore
    }
};

const removeFileIfExists = async (filePath: string) => {
    try {
        await fs.unlink(filePath);
    } catch {
        // ignore
    }
};

const formatBackupTimestamp = (date: Date) => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
};

const buildRemoteDatabaseBackupFileName = (date = new Date()) =>
    `${remoteDatabaseFileNamePrefix}_${formatBackupTimestamp(date)}.db`;

const getTimestampLabel = (date: Date) =>
    date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

const checkpointDatabase = () => {
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (error) {
        console.error('BĹ‚Ä…d checkpoint WAL:', error);
    }
};

const createDatabaseSnapshot = async (targetPath: string) => {
    checkpointDatabase();
    await removeFileIfExists(targetPath);
    await db.backup(targetPath);
    return targetPath;
};

const getLocalDatabaseTimestamp = async () => {
    const timestamps: number[] = [];
    for (const candidate of [dbPath, dbWalPath, dbShmPath]) {
        try {
            const stats = await fs.stat(candidate);
            timestamps.push(stats.mtimeMs);
        } catch {
            // ignore
        }
    }

    return timestamps.length > 0 ? Math.max(...timestamps) : 0;
};

const replaceLocalDatabaseFromFile = async (sourcePath: string) => {
    const rollbackPath = path.join(app.getPath('temp'), `pcc-db-rollback-${Date.now()}.db`);
    await createDatabaseSnapshot(rollbackPath);

    closeDatabase();

    try {
        await removeFileIfExists(dbWalPath);
        await removeFileIfExists(dbShmPath);
        await fs.copyFile(sourcePath, dbPath);
        reopenDatabase();
        await removeFileIfExists(rollbackPath);
    } catch (error) {
        await removeFileIfExists(dbWalPath);
        await removeFileIfExists(dbShmPath);
        await fs.copyFile(rollbackPath, dbPath);
        reopenDatabase();
        await removeFileIfExists(rollbackPath);
        throw error;
    }
};

let mainWindow: BrowserWindowType | null = null;
let appTray: InstanceType<typeof Tray> | null = null;

// Re-implementing __dirname safely for ESM context in Electron
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createWindow() {
    allowMainWindowClose = false;
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

    // Przechwytuj klikniÄ™cia w linki (jak target="_blank") i odsyĹ‚aj do "zewnÄ™trznej" peĹ‚noprawnej przeglÄ…darki uĹĽytkownika
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' }; // zablokuj otwieranie sub-okienka Electronowego
    });

    mainWindow.on('close', (event) => {
        if (allowMainWindowClose) return;
        event.preventDefault();
        void handleMainWindowCloseRequestWithTrayChoice();
    });

    mainWindow.maximize();
    mainWindow.show();

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

const createTrayIcon = () => {
    const trayIconCandidates = [
        path.join(appDir, 'electron', 'tray-icon.png'),
        path.join(__dirname, '../electron/tray-icon.png'),
        path.join(__dirname, 'tray-icon.png'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'tray-icon.png'),
    ];

    for (const trayIconPath of trayIconCandidates) {
        const icon = nativeImage.createFromPath(trayIconPath);
        if (!icon.isEmpty()) {
            return icon.resize({ width: 16, height: 16 });
        }
    }

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="16" fill="#1f2937"/>
            <rect x="6" y="6" width="52" height="52" rx="12" fill="none" stroke="#9cc45a" stroke-width="4"/>
            <rect x="18" y="18" width="10" height="28" rx="3" fill="#ffffff"/>
            <rect x="32" y="18" width="14" height="10" rx="3" fill="#9cc45a"/>
            <rect x="32" y="32" width="14" height="14" rx="3" fill="#ffffff"/>
            <circle cx="50" cy="50" r="6" fill="#9cc45a"/>
        </svg>
    `.trim();

    return nativeImage
        .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
        .resize({ width: 16, height: 16 });
};

const showMainWindow = () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
};

const hideMainWindowToTray = () => {
    if (!mainWindow) return;
    mainWindow.hide();
};

const ensureTray = () => {
    if (appTray) return appTray;

    appTray = new Tray(createTrayIcon());
    appTray.setToolTip('PCC');
    appTray.setContextMenu(Menu.buildFromTemplate([
        {
            label: 'PokaĹĽ',
            click: () => showMainWindow(),
        },
        {
            type: 'separator',
        },
        {
            label: 'WyjdĹş',
            click: () => {
                if (!mainWindow) {
                    app.quit();
                    return;
                }
                allowMainWindowClose = true;
                mainWindow.destroy();
            },
        },
    ]));
    appTray.on('double-click', () => showMainWindow());

    return appTray;
};

app.whenReady().then(async () => {
    await maybeOfferRemoteDatabaseImport();
    await createWindow();
    ensureTray();
    startScheduledTaskRunner();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            showMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopScheduledTaskRunner();
    closeDatabase();
});

// ==========================================
// IPC DATABASE HANDLERS (SQLite)
// ==========================================

ipcMain.handle('read-db', async () => {
    try {
        const fetchAll = (table: string) => db.prepare(`SELECT data FROM ${table}`).all().map((r: any) => JSON.parse(r.data));

        const projects = fetchAll('projects');
        const orders = fetchAll('orders');
        const settings = (
            envSettings.youtrackBaseUrl ||
            envSettings.youtrackToken ||
            envSettings.googleClientId ||
            envSettings.googleClientSecret ||
            envSettings.googleDriveSharedFolderLink
        )
            ? { ...envSettings }
            : undefined;

        return { projects, orders, settings };
    } catch (error) {
        console.error('BĹ‚Ä…d odczytu bazy SQLite:', error);
        throw error;
    }
});

// Stary zapis caĹ‚ego pliku zastÄ™pujemy transakcjÄ… czyszczenia i wstawiania na nowo, 
// lub optymalniej UPSERT-ami, ale aby zachowaÄ‡ kompatybilnoĹ›Ä‡ z peĹ‚nym zapisem `writeDb`, zrobimy transakcjÄ™ kasujÄ…co-wstawiajÄ…cÄ….
ipcMain.handle('write-db', async (_, data: { projects?: any[]; orders?: any[] }) => {
    try {
        const transaction = db.transaction(() => {
            // Nadpisywanie projektĂłw
            if (data.projects) {
                db.prepare('DELETE FROM projects').run();
                const insertProject = db.prepare('INSERT INTO projects (id, data) VALUES (?, ?)');
                for (const proj of data.projects) {
                    insertProject.run(proj.id, JSON.stringify(proj));
                }
            }

            // Nadpisywanie zamĂłwieĹ„
            if (data.orders) {
                db.prepare('DELETE FROM orders').run();
                const insertOrder = db.prepare('INSERT INTO orders (id, data) VALUES (?, ?)');
                for (const ord of data.orders) {
                    insertOrder.run(ord.id, JSON.stringify(ord));
                }
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu bazy SQLite:', error);
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
        console.error('BĹ‚Ä…d odczytu excluded_issues:', error);
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
        console.error('BĹ‚Ä…d zapisu excluded_issues:', error);
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
        console.error('BĹ‚Ä…d odczytu youtrack_tabs:', error);
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
        console.error('BĹ‚Ä…d zapisu youtrack_tabs:', error);
        throw error;
    }
});

ipcMain.handle('delete-youtrack-tab', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM youtrack_tabs WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d usuwania youtrack_tabs:', error);
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
        console.error('BĹ‚Ä…d aktualizacji kolejnoĹ›ci youtrack_tabs:', error);
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
        console.error('BĹ‚Ä…d pobierania rodzajĂłw zadaĹ„ ze zgĹ‚oszeĹ„:', error);
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
        console.error('BĹ‚Ä…d zapisu rodzaju zadania dla zgĹ‚oszenia:', error);
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
        console.error(`BĹ‚Ä…d zapytania fetch-youtrack do ${url}:`, error);
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
        console.error('BĹ‚Ä…d pobierania work_items:', error);
        throw error;
    }
});

ipcMain.handle('upsert-work-items', async (_, { items, projectId }: { items: any[], projectId: string }) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO work_items (id, issueId, issueReadableId, issueSummary, issueType, author, authorName, date, minutes, description, lastModified, projectId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                    issueId = excluded.issueId,
                    issueReadableId = excluded.issueReadableId,
                    issueSummary = excluded.issueSummary,
                    issueType = excluded.issueType,
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
                    item.issueType || null,
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
        console.error('BĹ‚Ä…d zapisu work_items:', error);
        throw error;
    }
});

ipcMain.handle('import-work-items', async (_, { items, projectId }: { items: any[], projectId: string }) => {
    try {
        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO work_items (id, issueId, issueReadableId, issueSummary, issueType, author, authorName, date, minutes, description, lastModified, projectId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const item of items) {
                stmt.run(
                    item.id,
                    item.issueId,
                    item.issueReadableId,
                    item.issueSummary,
                    item.issueType || null,
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
        console.error('BĹ‚Ä…d importu work_items:', error);
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
        console.error('BĹ‚Ä…d importu zleceĹ„:', error);
        throw error;
    }
});

ipcMain.handle('get-order-item-template', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM order_item_templates WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania szablonu pozycji zlecenia:', error);
        throw error;
    }
});

ipcMain.handle('save-order-item-template', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO order_item_templates (projectId, data, updatedAt)
            VALUES (?, ?, ?)
            ON CONFLICT(projectId) DO UPDATE SET
                data = excluded.data,
                updatedAt = excluded.updatedAt
        `).run(projectId, JSON.stringify(data), new Date().toISOString());
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu szablonu pozycji zlecenia:', error);
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
        console.error('BĹ‚Ä…d pobierania kategorii zgĹ‚oszeĹ„:', error);
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
        console.error('BĹ‚Ä…d zapisu kategorii zgĹ‚oszenia:', error);
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
        console.error('BĹ‚Ä…d masowego zapisu kategorii:', error);
        throw error;
    }
});

ipcMain.handle('get-issue-maintenance-flags', async () => {
    try {
        const rows = db.prepare('SELECT issueId, isMaintenance FROM issue_maintenance_flags').all() as { issueId: string; isMaintenance: number }[];
        const map: Record<string, boolean> = {};
        for (const row of rows) {
            map[row.issueId] = row.isMaintenance === 1;
        }
        return map;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania flag utrzymania zgĹ‚oszeĹ„:', error);
        throw error;
    }
});

ipcMain.handle('set-issue-maintenance-flag', async (_, { issueId, isMaintenance }: { issueId: string; isMaintenance: boolean }) => {
    try {
        db.prepare(`
            INSERT INTO issue_maintenance_flags (issueId, isMaintenance)
            VALUES (?, ?)
            ON CONFLICT(issueId) DO UPDATE SET isMaintenance = excluded.isMaintenance
        `).run(issueId, isMaintenance ? 1 : 0);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu flagi utrzymania zgĹ‚oszenia:', error);
        throw error;
    }
});

ipcMain.handle('get-estimation', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM estimations WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania wyceny:', error);
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
        console.error('BĹ‚Ä…d zapisu wyceny:', error);
        throw error;
    }
});

ipcMain.handle('write-clipboard-html', async (_, html: string) => {
    try {
        const { clipboard } = electron;
        clipboard.writeHTML(html);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu do schowka HTML:', error);
        throw error;
    }
});

// ==========================================
// IPC MEETING NOTES HANDLERS
// ==========================================

async function ensureGoogleCredentials() {
    console.log('Main: ensureGoogleCredentials starting...');
    if (envSettings.googleClientId && envSettings.googleClientSecret) {
        await gDocsService.setCredentials(envSettings.googleClientId, envSettings.googleClientSecret);
        return true;
    }
    return false;
}

const exportDatabaseBackupToGoogleDrive = async () => {
    if (!googleDriveSharedFolderLink) {
        throw new Error('Brak GOOGLE_DRIVE_SHARED_FOLDER_LINK w pliku .env.');
    }

    const hasCreds = await ensureGoogleCredentials();
    if (!hasCreds) {
        throw new Error('Brak skonfigurowanych danych Google Client ID / Secret.');
    }

    const authStatus = await gDocsService.getAuthStatus();
    if (!authStatus.isAuthenticated) {
        throw new Error('Brak aktywnej autoryzacji Google. Zaloguj siÄ™ ponownie w ustawieniach aplikacji.');
    }

    const backupFileName = buildRemoteDatabaseBackupFileName(new Date());
    const tempBackupPath = path.join(app.getPath('temp'), backupFileName);
    try {
        await createDatabaseSnapshot(tempBackupPath);
        return await gDocsService.uploadDatabaseBackup(googleDriveSharedFolderLink, tempBackupPath, backupFileName);
    } finally {
        await removeFileIfExists(tempBackupPath);
    }
};

const isInsufficientScopeError = (error: unknown) => {
    if (!(error instanceof Error)) return false;
    return error.message.includes('insufficient authentication scopes')
        || error.message.includes('Request had insufficient authentication scopes');
};

const buildGoogleDriveScopeErrorMessage = () =>
    'Aktualny token Google nie ma uprawnieĹ„ do Google Drive. Wyloguj siÄ™ z Google w ustawieniach aplikacji i zaloguj ponownie, aby nadaÄ‡ nowe uprawnienia.';

const scheduledTaskCheckIntervalMs = 30 * 1000;
let scheduledTaskRunner: NodeJS.Timeout | null = null;
let scheduledTaskRunnerInProgress = false;

const padTimePart = (value: number) => String(value).padStart(2, '0');

const getDateKey = (date: Date) =>
    `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;

const getTimeKey = (date: Date) =>
    `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;

const normalizeScheduledTask = (task: ScheduledTask): ScheduledTask => ({
    ...task,
    isActive: task.isActive ?? true,
    actionType: 'email',
    schedule: {
        type: task.schedule?.type || 'daily',
        time: task.schedule?.time || '22:00',
        dayOfWeek: task.schedule?.dayOfWeek ?? 1,
        dayOfMonth: task.schedule?.dayOfMonth ?? 1,
        dateTime: task.schedule?.dateTime || '',
    },
    emailTemplate: {
        to: task.emailTemplate?.to || '',
        cc: task.emailTemplate?.cc || '',
        subject: task.emailTemplate?.subject || '',
        body: task.emailTemplate?.body || '',
        variables: task.emailTemplate?.variables || {},
    },
    contentSources: (task.contentSources || []).map((source) => ({
        ...source,
        type: 'daily',
        hubId: source.hubId || '',
        sectionIds: Array.isArray(source.sectionIds) ? source.sectionIds : [],
    })),
});

const getScheduledTasks = (): ScheduledTask[] => {
    const rows = db.prepare(`
        SELECT data
        FROM scheduled_tasks
        ORDER BY updatedAt DESC, id DESC
    `).all() as { data: string }[];

    return rows.map((row) => normalizeScheduledTask(JSON.parse(row.data)));
};

const saveScheduledTaskRecord = (task: ScheduledTask) => {
    db.prepare(`
        INSERT INTO scheduled_tasks (id, data, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updatedAt = excluded.updatedAt
    `).run(task.id, JSON.stringify(task), task.updatedAt);
};

const deleteScheduledTaskRecord = (id: string) => {
    db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
};

const getDailyHubById = (hubId: string): DailyHub | null => {
    const row = db.prepare('SELECT * FROM daily_hubs WHERE id = ?').get(hubId) as DailyHub | undefined;
    return row || null;
};

const getDailySectionsByHubId = (hubId: string): DailySection[] => {
    const rows = db.prepare('SELECT * FROM daily_sections WHERE hubId = ? ORDER BY orderIndex ASC').all(hubId) as (DailySection & { respectDates?: number | boolean })[];
    return rows.map((row) => ({
        ...row,
        respectDates: row.respectDates === true || row.respectDates === 1,
    }));
};

const getDailyCommentsMap = (): Record<string, string> => {
    const rows = db.prepare('SELECT issueId, content FROM daily_comments').all() as { issueId: string; content: string }[];
    return rows.reduce<Record<string, string>>((acc, row) => {
        acc[row.issueId] = row.content;
        return acc;
    }, {});
};

const normalizeDailyStatuses = (raw: string) => {
    if (!raw) return [];
    return raw
        .split(/[\n,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const parenMatch = entry.match(/\(([^)]+)\)$/);
            const value = parenMatch ? parenMatch[1] : entry;
            return value.trim().toLowerCase();
        });
};

const formatDateInputValue = (date: Date) =>
    `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;

const resolveScheduledTaskDateRange = (task: ScheduledTask, executionDate: Date) => {
    const end = new Date(executionDate);
    end.setHours(0, 0, 0, 0);

    let start = new Date(end);
    switch (task.schedule.type) {
        case 'weekly':
            start.setDate(start.getDate() - 7);
            break;
        case 'monthly':
            start.setDate(start.getDate() - 30);
            break;
        case 'daily':
        case 'weekdays':
        case 'custom':
        default:
            break;
    }

    return {
        from: formatDateInputValue(start),
        to: formatDateInputValue(end),
    };
};

const fetchYouTrackJson = async (baseUrl: string, token: string, endpoint: string, params: Record<string, string | number>) => {
    const url = new URL(endpoint, baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
    });

    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
};

type DailyReportIssue = {
    id: string;
    idReadable: string;
    summary: string;
    project?: { id: string; shortName: string };
    assignee?: { name: string; login: string; fullName?: string } | null;
    state?: { name: string; color: { background: string; foreground: string } } | null;
    type?: { name: string; color: { background: string; foreground: string } } | null;
    priority?: { name: string; color: { background: string; foreground: string } } | null;
    spentTime?: { presentation: string; minutes: number } | null;
    estimation?: { presentation: string; minutes: number } | null;
    timeline: {
        type: 'comment' | 'field-change' | 'work-item' | 'issue-created' | 'description-change';
        timestamp: number;
        author: { name: string; login: string };
        field?: string;
        added?: string;
        removed?: string;
        text?: string;
        minutes?: number;
        workComments?: string[];
    }[];
};

const formatDailyMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
};

const buildYouTrackIssueUrl = (issueIdReadable: string) => {
    if (!envSettings.youtrackBaseUrl) return '';
    return `${envSettings.youtrackBaseUrl.replace(/\/$/, '')}/issue/${issueIdReadable}`;
};

const resolveDailyProjectCode = (issue: Pick<DailyReportIssue, 'idReadable' | 'project'>) => {
    const explicitCode = issue.project?.shortName?.trim().toUpperCase();
    if (explicitCode) return explicitCode;

    const readablePrefix = issue.idReadable?.split('-')?.[0]?.trim().toUpperCase();
    if (readablePrefix) return readablePrefix;

    return 'BEZ PROJEKTU';
};

const formatDailyDateTime = (timestamp: number) => {
    if (!Number.isFinite(timestamp)) return String(timestamp);
    return new Date(timestamp).toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatDailyFieldValue = (fieldName: string, value: string) => {
    if (!value || value === 'Brak') return value;

    const normalizedField = fieldName.toLowerCase();
    const trimmedValue = value.trim();
    const numericValue = Number(trimmedValue);

    if ((normalizedField.includes('spent time') || normalizedField.includes('estimation') || normalizedField.includes('estymacja'))
        && Number.isFinite(numericValue)
        && trimmedValue !== '') {
        return formatDailyMinutes(numericValue);
    }

    if ((normalizedField.includes('date') || normalizedField.includes('data') || normalizedField.includes('termin'))
        && Number.isFinite(numericValue)
        && Math.abs(numericValue) > 1000000000) {
        return formatDailyDateTime(numericValue);
    }

    return value;
};

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeHtmlOptional = (value?: string | null) => escapeHtml(value || '');

const textToSimpleHtml = (value: string) => {
    const normalized = value.replace(/\r\n/g, '\n').trim();
    if (!normalized) return '';

    return normalized
        .split(/\n{2,}/)
        .map((paragraph) => `<p style="margin:0 0 16px 0; font-size:14px; line-height:1.7; color:#334155;">${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
        .join('');
};

const sanitizeScheduledEmailIntro = (value?: string | null) => {
    const normalized = value?.replace(/\r\n/g, '\n').trim();
    if (!normalized) return '';

    const cleaned = normalized
        .split('\n')
        .filter((line) => !/!\[[^\]]*\]\([^)]+\)(\{[^}]+\})?/i.test(line.trim()))
        .join('\n')
        .trim();

    return cleaned;
};

const sanitizeDailyCommentText = (value?: string | null) => {
    if (!value) return '';

    return value
        .replace(/\r\n/g, '\n')
        .replace(/!\[[^\]]*\]\([^)]+\)(\{[^}]+\})?/gi, '[obraz]')
        .replace(/<img\b[^>]*>/gi, '[obraz]')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const buildEmailBadgeHtml = (
    label: string,
    colors?: { background?: string; foreground?: string } | null,
    options?: { compact?: boolean },
) => {
    const compact = options?.compact ?? false;
    const background = colors?.background || '#e5e7eb';
    const foreground = colors?.foreground || '#111827';

    return `<span style="display:inline-block; margin-right:6px; margin-bottom:6px; padding:${compact ? '4px 7px' : '5px 8px'}; border-radius:${compact ? '8px' : '10px'}; background:${background}; color:${foreground}; font-size:${compact ? '10px' : '11px'}; font-weight:800; line-height:1; border:1px solid rgba(15,23,42,0.06);">${escapeHtml(label)}</span>`;
};

const buildEmailProgressBarHtml = (percent: number) => {
    const progressPercent = Math.max(0, Math.min(percent, 100));
    const progressColor = progressPercent >= 100 ? '#ef4444' : progressPercent >= 80 ? '#f59e0b' : '#10b981';
    const progressTextColor = progressPercent >= 100 ? '#dc2626' : progressPercent >= 80 ? '#d97706' : '#059669';

    return {
        barHtml: `
            <div style="margin-top:6px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:8px; margin-bottom:6px;">
                    <span style="font-size:10px; color:#94a3b8;">Postep czasu</span>
                    <span style="font-size:11px; font-weight:900; color:${progressTextColor};">${progressPercent}%</span>
                </div>
                <div style="height:6px; border-radius:999px; overflow:hidden; background:#e2e8f0;">
                    <div style="width:${progressPercent}%; height:100%; border-radius:999px; background:${progressColor};"></div>
                </div>
            </div>
        `,
        progressTextColor,
    };
};

const writeScheduledEmailDebugOutput = async (
    task: ScheduledTask,
    executionDate: Date,
    textBody: string,
    htmlBody: string,
) => {
    const debugDir = path.join(appDir, 'debug-email-output');
    const safeTaskId = (task.id || 'scheduled-task').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = executionDate.toISOString().replace(/[:.]/g, '-');
    const baseName = `${safeTaskId}-${timestamp}`;

    await fs.mkdir(debugDir, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(debugDir, 'last-scheduled-email.html'), htmlBody || '', 'utf8'),
        fs.writeFile(path.join(debugDir, 'last-scheduled-email.txt'), textBody || '', 'utf8'),
        fs.writeFile(
            path.join(debugDir, 'last-scheduled-email.json'),
            JSON.stringify({
                taskId: task.id,
                taskName: task.name,
                executionDate: executionDate.toISOString(),
                to: task.emailTemplate.to,
                cc: task.emailTemplate.cc,
                subject: task.emailTemplate.subject,
                hasHtmlBody: Boolean(htmlBody),
                htmlLength: htmlBody.length,
                textLength: textBody.length,
            }, null, 2),
            'utf8',
        ),
        fs.writeFile(path.join(debugDir, `${baseName}.html`), htmlBody || '', 'utf8'),
        fs.writeFile(path.join(debugDir, `${baseName}.txt`), textBody || '', 'utf8'),
    ]);
};

const formatTimelineActivityHtml = (activity: DailyReportIssue['timeline'][number]) => {
    if (activity.type === 'comment') {
        return `${escapeHtmlOptional(activity.author.name)}: ${escapeHtml(sanitizeDailyCommentText(activity.text))}`;
    }
    if (activity.type === 'field-change') {
        return `${escapeHtmlOptional(activity.author.name)}: ${escapeHtmlOptional(activity.field || 'Pole')}: ${escapeHtmlOptional(activity.added || 'Brak')}`;
    }
    if (activity.type === 'work-item') {
        const sanitizedWorkComments = (activity.workComments || [])
            .map((comment) => sanitizeDailyCommentText(comment))
            .filter(Boolean);
        const suffix = sanitizedWorkComments.length > 0
            ? ` <span style="color:#94a3b8;">- ${escapeHtml(sanitizedWorkComments.join(', '))}</span>`
            : '';
        return `${escapeHtmlOptional(activity.author.name)}: Dodal log czasu ${escapeHtml(formatDailyMinutes(activity.minutes || 0))}${suffix}`;
    }
    if (activity.type === 'issue-created') {
        return `${escapeHtmlOptional(activity.author.name)}: Utworzono zadanie`;
    }
    return `${escapeHtmlOptional(activity.author.name)}: ${escapeHtmlOptional(activity.added || activity.text || 'Aktualizacja')}`;
};

const formatTimelineActivity = (activity: DailyReportIssue['timeline'][number]) => {
    if (activity.type === 'comment') {
        return `${activity.author.name}: ${sanitizeDailyCommentText(activity.text)}`;
    }
    if (activity.type === 'field-change') {
        return `${activity.author.name}: ${activity.field || 'Pole'}: ${activity.added || 'Brak'}`;
    }
    if (activity.type === 'work-item') {
        const sanitizedWorkComments = (activity.workComments || [])
            .map((comment) => sanitizeDailyCommentText(comment))
            .filter(Boolean);
        const commentSuffix = sanitizedWorkComments.length > 0
            ? ` â€” ${sanitizedWorkComments.join(', ')}`
            : '';
        return `${activity.author.name}: Dodał log czasu ${formatDailyMinutes(activity.minutes || 0)}${commentSuffix}`;
    }
    if (activity.type === 'issue-created') {
        return `${activity.author.name}: Utworzono zadanie`;
    }
    return `${activity.author.name}: ${activity.added || activity.text || 'Aktualizacja'}`;
};

const mapWithConcurrency = async <T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const runWorker = async () => {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            if (currentIndex >= items.length) {
                return;
            }

            results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
    };

    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, () => runWorker());
    await Promise.all(workers);
    return results;
};

const fetchDailyReportIssues = async (
    youTrackBaseUrl: string,
    youTrackToken: string,
    projectCodes: string,
    dateFrom: string,
    dateTo: string,
    options?: { customStatuses?: string[]; includeFilters?: boolean; tabName?: string },
): Promise<DailyReportIssue[]> => {
    const apiBase = `${youTrackBaseUrl.replace(/\/$/, '')}/api/`;
    const customStatuses = options?.customStatuses;

    let query: string;
    if (customStatuses && customStatuses.length > 0) {
        const stateFilter = customStatuses.map((state) => `{${state}}`).join(', ');
        query = `project: ${projectCodes} updated: ${dateFrom} .. ${dateTo} or project: ${projectCodes} State: ${stateFilter}`;
    } else {
        query = `project: ${projectCodes} updated: ${dateFrom} .. ${dateTo}`;
    }

    const issues: any[] = [];
    const issueFields = 'id,idReadable,summary,project(id,shortName),customFields(name,value(presentation,name,login,fullName,id,minutes,color(id,background,foreground))),assignee(name,login,fullName)';
    const pageSize = 100;
    let issueSkip = 0;

    while (true) {
        const page = await fetchYouTrackJson(youTrackBaseUrl, youTrackToken, `${apiBase}issues`, {
            query,
            fields: issueFields,
            $top: pageSize,
            $skip: issueSkip,
        }) as any[];

        if (!Array.isArray(page) || page.length === 0) break;
        issues.push(...page);
        if (page.length < pageSize) break;
        issueSkip += pageSize;
    }

    const reportIssues = await mapWithConcurrency(issues, 5, async (issue) => {
        const activities = await fetchYouTrackJson(youTrackBaseUrl, youTrackToken, `${apiBase}issues/${issue.id}/activities`, {
            categories: 'CommentsCategory,IssueCreatedCategory,ProjectCategory,IssueResolvedCategory,CustomFieldCategory,SummaryCategory,DescriptionCategory,WorkItemCategory',
            fields: 'id,timestamp,author(name,login),category(id),added(name,text,presentation,duration(minutes,presentation),date,type(name),author(name,login)),removed(name,text,presentation,duration(minutes,presentation),date,type(name),author(name,login)),field(customField(name),name)',
        }) as any[];

        const timeline: DailyReportIssue['timeline'] = [];
        const workAggregator: Record<string, DailyReportIssue['timeline'][number]> = {};

        activities.forEach((activity) => {
            const author = activity.author || { name: 'System', login: 'system' };
            const categoryId = activity.category?.id;

            if (categoryId === 'CommentsCategory') {
                const commentText = activity.added?.[0]?.text;
                if (commentText) {
                    timeline.push({
                        type: 'comment',
                        timestamp: activity.timestamp,
                        author,
                        text: commentText,
                    });
                }
                return;
            }

            if (categoryId === 'CustomFieldCategory' || categoryId === 'ProjectCategory' || categoryId === 'IssueResolvedCategory') {
                const fieldName = activity.field?.customField?.name || activity.field?.name || 'Pole';
                const firstAdded = Array.isArray(activity.added) ? activity.added[0] : activity.added;
                const firstRemoved = Array.isArray(activity.removed) ? activity.removed[0] : activity.removed;
                const added = formatDailyFieldValue(
                    fieldName,
                    firstAdded?.presentation || firstAdded?.name || firstAdded?.text || firstAdded?.duration?.presentation || String(firstAdded || 'Brak'),
                );
                const removed = formatDailyFieldValue(
                    fieldName,
                    firstRemoved?.presentation || firstRemoved?.name || firstRemoved?.text || firstRemoved?.duration?.presentation || String(firstRemoved || 'Brak'),
                );

                timeline.push({
                    type: 'field-change',
                    timestamp: activity.timestamp,
                    author,
                    field: fieldName,
                    added,
                    removed,
                });
                return;
            }

            if (categoryId === 'WorkItemCategory') {
                const workItem = activity.added?.[0];
                if (!workItem?.duration?.minutes) return;

                const actualAuthor = workItem.author || author;
                const dateKey = workItem.date ? new Date(workItem.date).toISOString().split('T')[0] : new Date(activity.timestamp).toISOString().split('T')[0];
                const aggregateKey = `${actualAuthor.login || actualAuthor.name}-${dateKey}`;
                const comment = workItem.text || '';

                if (!workAggregator[aggregateKey]) {
                    workAggregator[aggregateKey] = {
                        type: 'work-item',
                        timestamp: workItem.date ? new Date(workItem.date).getTime() : activity.timestamp,
                        author: actualAuthor,
                        minutes: 0,
                        workComments: [],
                    };
                }

                workAggregator[aggregateKey].minutes = (workAggregator[aggregateKey].minutes || 0) + workItem.duration.minutes;
                if (comment) {
                    workAggregator[aggregateKey].workComments = workAggregator[aggregateKey].workComments || [];
                    workAggregator[aggregateKey].workComments?.push(comment);
                }
                return;
            }

            if (categoryId === 'IssueCreatedCategory') {
                timeline.push({
                    type: 'issue-created',
                    timestamp: activity.timestamp,
                    author,
                });
            }
        });

        Object.values(workAggregator).forEach((item) => timeline.push(item));
        timeline.sort((a, b) => a.timestamp - b.timestamp);

        let state = null;
        let type = null;
        let priority = null;
        let estimation = null;
        let spentTime = null;
        let assignee = issue.assignee || null;

        (issue.customFields || []).forEach((field: any) => {
            const fieldName = field.name?.toLowerCase?.() || '';
            const value = field.value;
            if (!value) return;

            if (fieldName === 'state') {
                state = {
                    name: value.name,
                    color: value.color ? { background: value.color.background, foreground: value.color.foreground } : { background: '#e5e7eb', foreground: '#111827' },
                };
            } else if (fieldName === 'type') {
                type = {
                    name: value.name,
                    color: value.color ? { background: value.color.background, foreground: value.color.foreground } : { background: '#e5e7eb', foreground: '#111827' },
                };
            } else if (fieldName === 'priority') {
                priority = {
                    name: value.name,
                    color: value.color ? { background: value.color.background, foreground: value.color.foreground } : { background: '#e5e7eb', foreground: '#111827' },
                };
            } else if (fieldName.includes('spent time')) {
                spentTime = {
                    presentation: value.presentation,
                    minutes: value.minutes,
                };
            } else if (fieldName.includes('estimation') || fieldName.includes('estymacja')) {
                estimation = {
                    presentation: value.presentation,
                    minutes: value.minutes,
                };
            } else if (fieldName === 'assignee') {
                assignee = value;
            }
        });

        return {
            id: issue.id,
            idReadable: issue.idReadable,
            summary: issue.summary,
            project: issue.project,
            assignee,
            state,
            type,
            priority,
            spentTime,
            estimation,
            timeline,
        } satisfies DailyReportIssue;
    });

    return reportIssues;
};

type DailyContentSourcePayload = {
    hub: DailyHub;
    sections: DailySection[];
    from: string;
    to: string;
    comments: Record<string, string>;
    activityIssues: DailyReportIssue[];
    boardIssues: DailyReportIssue[];
    activityIssueIds: Set<string>;
    projectOrder: string[];
};

const loadDailyContentSourcePayload = async (
    task: ScheduledTask,
    source: ScheduledTaskContentSource,
    executionDate: Date,
): Promise<DailyContentSourcePayload> => {
    if (source.type !== 'daily') {
        throw new Error('Nieobslugiwany typ zrodla harmonogramu.');
    }
    if (!envSettings.youtrackBaseUrl || !envSettings.youtrackToken) {
        throw new Error('Brak konfiguracji YouTrack w ustawieniach glownych aplikacji.');
    }

    const hub = getDailyHubById(source.hubId);
    if (!hub) {
        throw new Error('Wybrany Daily nie istnieje.');
    }

    const dynamicSections = getDailySectionsByHubId(hub.id);
    const includedDynamicSections = dynamicSections.filter((section) => source.sectionIds.includes(section.id));
    const sections: DailySection[] = [
        { id: 'fixed_aktywnosci', hubId: hub.id, name: 'Aktywności', youtrackStatuses: '', orderIndex: -1 },
        ...includedDynamicSections,
    ];

    const { from, to } = resolveScheduledTaskDateRange(task, executionDate);
    const boardStateFilters = Array.from(new Set(dynamicSections
        .filter((section) => !section.respectDates)
        .flatMap((section) => normalizeDailyStatuses(section.youtrackStatuses))));

    const activityIssues = await fetchDailyReportIssues(
        envSettings.youtrackBaseUrl,
        envSettings.youtrackToken,
        hub.projectCodes,
        from,
        to,
    );
    const boardIssues = await fetchDailyReportIssues(
        envSettings.youtrackBaseUrl,
        envSettings.youtrackToken,
        hub.projectCodes,
        from,
        to,
        { customStatuses: boardStateFilters.length ? boardStateFilters : undefined },
    );

    const activityIssueIds = new Set<string>();
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    const toTime = new Date(`${to}T23:59:59`).getTime();

    activityIssues.forEach((issue) => {
        if (issue.timeline.some((activity) => activity.timestamp >= fromTime && activity.timestamp <= toTime)) {
            activityIssueIds.add(issue.idReadable);
        }
    });

    return {
        hub,
        sections,
        from,
        to,
        comments: getDailyCommentsMap(),
        activityIssues,
        boardIssues,
        activityIssueIds,
        projectOrder: hub.projectCodes.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean),
    };
};

const renderDailyIssueLines = (issue: DailyReportIssue, comments: Record<string, string>, includeActivities: boolean, dateFrom: string, dateTo: string) => {
    const lines = [`- ${issue.idReadable} â€” ${issue.summary}`];
    const issueUrl = buildYouTrackIssueUrl(issue.idReadable);

    if (issueUrl) {
        lines.push(`  Link: ${issueUrl}`);
    }

    if (issue.type?.name) {
        lines.push(`  Typ: ${issue.type.name}`);
    }
    if (issue.priority?.name && issue.priority.name !== 'Normal') {
        lines.push(`  Priorytet: ${issue.priority.name}`);
    }
    if (includeActivities && issue.state?.name) {
        lines.push(`  Stan: ${issue.state.name}`);
    }

    if (issue.spentTime?.minutes || issue.estimation?.minutes) {
        const spent = issue.spentTime?.minutes || 0;
        const estimation = issue.estimation?.minutes || 0;
        const percent = estimation > 0 ? Math.min(Math.round((spent / estimation) * 100), 100) : 0;
        lines.push(`  Czas: ${spent > 0 ? formatDailyMinutes(spent) : '0m'} / ${estimation > 0 ? formatDailyMinutes(estimation) : '-'}${estimation > 0 ? ` (${percent}%)` : ''}`);
    }

    lines.push(`  Osoba: ${issue.assignee?.fullName || issue.assignee?.name || 'Nieprzypisane'}`);

    const comment = comments[issue.idReadable];
    if (comment) {
        lines.push(`  Notatka PM: ${comment}`);
    }

    if (includeActivities) {
        const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
        const toTime = new Date(`${dateTo}T23:59:59`).getTime();
        const periodActivities = issue.timeline.filter((activity) => activity.timestamp >= fromTime && activity.timestamp <= toTime);

        if (periodActivities.length > 0) {
            lines.push('  AktywnoĹ›Ä‡:');
            periodActivities.forEach((activity) => {
                lines.push(`    â€˘ ${formatTimelineActivity(activity)}`);
            });
        }
    }

    return lines.join('\n');
};

const renderDailyIssueCardHtml = (
    issue: DailyReportIssue,
    comments: Record<string, string>,
    includeActivities: boolean,
    dateFrom: string,
    dateTo: string,
) => {
    const spent = issue.spentTime?.minutes || 0;
    const estimation = issue.estimation?.minutes || 0;
    const progressPercent = estimation > 0 ? Math.min(Math.round((spent / estimation) * 100), 100) : 0;
    const progress = buildEmailProgressBarHtml(progressPercent);
    const comment = comments[issue.idReadable];
    const issueUrl = buildYouTrackIssueUrl(issue.idReadable);
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59`).getTime();
    const periodActivities = includeActivities
        ? issue.timeline.filter((activity) => {
            if (activity.timestamp < fromTime || activity.timestamp > toTime) return false;
            if (activity.type === 'comment') return true;
            if (activity.type === 'work-item') return true;
            if (activity.type === 'field-change') return !!(activity.field && (activity.added || activity.removed));
            return false;
        })
        : [];
    const commentActivities = periodActivities.filter((activity) => activity.type === 'comment');
    const visibleActivities = periodActivities.filter((activity) => activity.type !== 'comment');

    const activityHtml = includeActivities && visibleActivities.length > 0
        ? `
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(148,163,184,0.22);">
                <div style="margin-bottom:8px; font-size:10px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:#94a3b8;">
                    Aktywnosc (${visibleActivities.length})
                </div>
                ${visibleActivities.map((activity) => `
                    <div style="display:flex; gap:8px; align-items:flex-start; margin-top:0; margin-bottom:7px;">
                        <span style="display:inline-block; width:6px; height:6px; margin-top:5px; border-radius:999px; background:#818cf8;"></span>
                        <div style="font-size:11px; line-height:1.45; color:#64748b;">${formatTimelineActivityHtml(activity)}</div>
                    </div>
                `).join('')}
            </div>
        `
        : '';
    const commentsHtml = includeActivities && commentActivities.length > 0
        ? `
            <div style="margin-top:12px; padding:10px 12px; border:1px solid rgba(148,163,184,0.24); border-radius:12px; background:#f8fafc;">
                <div style="margin-bottom:8px; font-size:10px; font-weight:900; letter-spacing:0.14em; text-transform:uppercase; color:#64748b;">
                    Komentarze (${commentActivities.length})
                </div>
                ${commentActivities.map((activity) => `
                    <div style="margin-bottom:8px; padding:8px 10px; border-radius:10px; background:#ffffff; border:1px solid rgba(226,232,240,0.9);">
                        <div style="margin-bottom:4px; font-size:11px; font-weight:700; color:#475569;">${escapeHtmlOptional(activity.author.name)}</div>
                        <div style="font-size:11px; line-height:1.5; color:#64748b; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;">${escapeHtml(sanitizeDailyCommentText(activity.text)) || '[pusty komentarz]'}</div>
                    </div>
                `).join('')}
            </div>
        `
        : '';

    const assigneeLabel = issue.assignee?.fullName || issue.assignee?.name || 'Nieprzypisane';
    const assigneeInitial = (issue.assignee?.name || issue.assignee?.fullName || '?').charAt(0).toUpperCase() || '?';
    const projectLabel = resolveDailyProjectCode(issue);

    return `
        <div style="margin-bottom:16px; border:1px solid rgba(148,163,184,0.18); border-radius:16px; overflow:hidden; background:#ffffff; box-shadow:0 10px 28px rgba(15,23,42,0.08);">
            <div style="padding:10px 12px; border-bottom:1px solid rgba(148,163,184,0.18); background:#f8fafc;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                    <div>
                        <div style="margin-bottom:8px;">
                            ${issueUrl
            ? `<a href="${escapeHtml(issueUrl)}" style="display:inline-block; padding:3px 8px; border-radius:8px; background:#eef2ff; color:#4f46e5; font-family:Consolas,'Courier New',monospace; font-size:10px; font-weight:800; text-decoration:none; border:1px solid rgba(79,70,229,0.14);">${escapeHtml(issue.idReadable)}</a>`
            : `<span style="display:inline-block; padding:3px 8px; border-radius:8px; background:#eef2ff; color:#4f46e5; font-family:Consolas,'Courier New',monospace; font-size:10px; font-weight:800;">${escapeHtml(issue.idReadable)}</span>`}
                        </div>
                        <div style="line-height:0;">${[
                            projectLabel ? buildEmailBadgeHtml(projectLabel, { background: '#e2e8f0', foreground: '#334155' }, { compact: true }) : '',
                            issue.type?.name ? buildEmailBadgeHtml(issue.type.name.charAt(0).toUpperCase(), issue.type.color, { compact: true }) : '',
                            issue.priority?.name && issue.priority.name !== 'Normal' ? buildEmailBadgeHtml(issue.priority.name.charAt(0).toUpperCase(), issue.priority.color, { compact: true }) : '',
                            includeActivities && issue.state?.name ? buildEmailBadgeHtml(issue.state.name, issue.state.color, { compact: true }) : '',
                        ].join('')}</div>
                    </div>
                </div>
            </div>
            <div style="padding:14px 12px 12px 12px;">
                <div style="margin:0 0 10px 0; font-size:14px; font-weight:800; line-height:1.35; color:#0f172a;">
                    ${issueUrl
            ? `<a href="${escapeHtml(issueUrl)}" style="color:#0f172a; text-decoration:none;">${escapeHtml(issue.summary)}</a>`
            : escapeHtml(issue.summary)}
                </div>
                ${(spent > 0 || estimation > 0) ? `
                    <div style="font-size:11px; color:#64748b;">
                        Czas: ${escapeHtml(spent > 0 ? formatDailyMinutes(spent) : '0m')} / ${escapeHtml(estimation > 0 ? formatDailyMinutes(estimation) : '-')}
                    </div>
                    ${progress.barHtml}
                ` : ''}
                ${comment ? `
                    <div style="margin-top:12px; padding:10px; border:1px solid rgba(251,191,36,0.24); border-radius:12px; background:#fffbeb;">
                        <div style="margin-bottom:5px; font-size:10px; font-weight:900; letter-spacing:0.14em; text-transform:uppercase; color:#d97706;">Brudnopis PM</div>
                        <div style="font-size:12px; line-height:1.55; color:#92400e;">${escapeHtml(comment)}</div>
                    </div>
                ` : ''}
                ${activityHtml}
                ${commentsHtml}
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:14px;">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                        <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:999px; background:#eef2ff; color:#4f46e5; font-size:10px; font-weight:800;">${escapeHtml(assigneeInitial)}</span>
                        <span style="font-size:11px; font-weight:700; color:#475569;">${escapeHtml(assigneeLabel)}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:10px; font-weight:800; color:${progress.progressTextColor};">${estimation > 0 ? `${progressPercent}%` : '&nbsp;'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderDailyContentSource = async (
    task: ScheduledTask,
    source: ScheduledTaskContentSource,
    executionDate: Date,
    payload?: DailyContentSourcePayload,
) => {
    if (source.type !== 'daily') return '';
    const { hub, sections, from, to, comments, activityIssues, boardIssues, activityIssueIds, projectOrder } =
        payload || await loadDailyContentSourcePayload(task, source, executionDate);
    const renderedSections = sections.map((section) => {
        const issues = (section.id === 'fixed_aktywnosci' ? activityIssues : boardIssues).filter((issue) => {
            const hasTimelineInRange = activityIssueIds.has(issue.idReadable);

            if (section.id === 'fixed_aktywnosci') {
                return hasTimelineInRange;
            }

            const statuses = normalizeDailyStatuses(section.youtrackStatuses);
            const currentState = issue.state?.name || '';
            if (!statuses.includes(currentState.toLowerCase())) return false;
            if (section.respectDates) {
                return hasTimelineInRange;
            }
            return true;
        });

        if (issues.length === 0) {
            return `## ${section.name}\nBrak`;
        }

        const groupedByProject = new Map<string, DailyReportIssue[]>();
        issues.forEach((issue) => {
            const projectCode = resolveDailyProjectCode(issue);
            if (!groupedByProject.has(projectCode)) {
                groupedByProject.set(projectCode, []);
            }
            groupedByProject.get(projectCode)?.push(issue);
        });

        const orderedProjectCodes = [
            ...projectOrder.filter((code) => groupedByProject.has(code)),
            ...Array.from(groupedByProject.keys()).filter((code) => !projectOrder.includes(code)).sort(),
        ];

        const sectionLines = [`## ${section.name}`];
        orderedProjectCodes.forEach((projectCode) => {
            const projectIssues = groupedByProject.get(projectCode) || [];
            sectionLines.push(`### ${projectCode}`);
            projectIssues.forEach((issue) => {
                sectionLines.push(renderDailyIssueLines(issue, comments, section.id === 'fixed_aktywnosci', from, to));
            });
        });

        return sectionLines.join('\n');
    });

    return [
        `# Daily: ${hub.name}`,
        `Zakres: ${from} -> ${to}`,
        ...renderedSections,
    ].join('\n\n');
};

const renderDailyContentSourceHtml = async (
    task: ScheduledTask,
    source: ScheduledTaskContentSource,
    executionDate: Date,
    payload?: DailyContentSourcePayload,
) => {
    if (source.type !== 'daily') return '';
    const { hub, sections, from, to, comments, activityIssues, boardIssues, activityIssueIds, projectOrder } =
        payload || await loadDailyContentSourcePayload(task, source, executionDate);

    const renderedSectionsHtml = sections.map((section) => {
        const issues = (section.id === 'fixed_aktywnosci' ? activityIssues : boardIssues).filter((issue) => {
            const hasTimelineInRange = activityIssueIds.has(issue.idReadable);

            if (section.id === 'fixed_aktywnosci') {
                return hasTimelineInRange;
            }

            const statuses = normalizeDailyStatuses(section.youtrackStatuses);
            const currentState = issue.state?.name || '';
            if (!statuses.includes(currentState.toLowerCase())) return false;
            if (section.respectDates) {
                return hasTimelineInRange;
            }
            return true;
        });

        const groupedByProject = new Map<string, DailyReportIssue[]>();
        issues.forEach((issue) => {
            const projectCode = resolveDailyProjectCode(issue);
            if (!groupedByProject.has(projectCode)) {
                groupedByProject.set(projectCode, []);
            }
            groupedByProject.get(projectCode)?.push(issue);
        });

        const orderedProjectCodes = [
            ...projectOrder.filter((code) => groupedByProject.has(code)),
            ...Array.from(groupedByProject.keys()).filter((code) => !projectOrder.includes(code)).sort(),
        ];

        const cardsHtml = issues.length > 0
            ? orderedProjectCodes.map((projectCode) => {
                const projectIssues = groupedByProject.get(projectCode) || [];
                return `
                    <div style="display:block; width:100%; margin-bottom:18px; padding:14px; border:1px solid rgba(99,102,241,0.14); border-radius:18px; background:linear-gradient(180deg, rgba(238,242,255,0.92) 0%, rgba(255,255,255,0.98) 100%); box-sizing:border-box;">
                        <div style="display:block; width:100%; margin-bottom:14px; padding:12px 14px; border-radius:14px; background:linear-gradient(135deg, #4338ca 0%, #6366f1 100%); box-shadow:0 10px 24px rgba(79,70,229,0.22); box-sizing:border-box;">
                            <div style="font-size:11px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:rgba(255,255,255,0.78);">Projekt</div>
                            <div style="margin-top:4px; font-size:20px; font-weight:900; letter-spacing:0.08em; color:#ffffff;">${escapeHtml(projectCode)}</div>
                        </div>
                        <div style="height:3px; margin:0 0 14px 0; border-radius:999px; background:linear-gradient(90deg, #4338ca 0%, #a5b4fc 100%);"></div>
                        ${projectIssues.map((issue) => renderDailyIssueCardHtml(issue, comments, section.id === 'fixed_aktywnosci', from, to)).join('')}
                    </div>
                `;
            }).join('')
            : `
                <div style="padding:32px 16px; text-align:center; border:1px dashed rgba(148,163,184,0.28); border-radius:14px; background:rgba(255,255,255,0.48);">
                    <span style="font-size:10px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:#94a3b8;">Brak</span>
                </div>
            `;

        return `
            <section style="margin:0 0 28px 0;">
                ${section.id === 'fixed_aktywnosci' ? '' : `
                <div style="margin-bottom:14px;">
                    <div style="display:block; width:100%; padding:12px 14px; border-radius:14px; background:linear-gradient(135deg, #e0e7ff 0%, #eef2ff 100%); box-shadow:inset 0 0 0 1px rgba(99,102,241,0.10); box-sizing:border-box;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-size:14px; color:#6366f1;">&#9662;</span>
                                <span style="font-size:14px; font-weight:900; text-transform:uppercase; letter-spacing:0.12em; color:#312e81;">${escapeHtml(section.name)}</span>
                            </div>
                            <span style="display:inline-block; padding:4px 9px; border-radius:999px; background:#dbeafe; color:#3730a3; font-size:10px; font-weight:900;">${issues.length}</span>
                        </div>
                    </div>
                </div>
                `}
                <div style="position:relative;">
                    ${cardsHtml}
                </div>
            </section>
        `;
    }).join('');

    return `
        <section style="margin:0 0 28px 0; padding:24px; border-radius:24px; background:linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border:1px solid rgba(148,163,184,0.18); box-shadow:0 16px 44px rgba(15,23,42,0.08);">
            <div style="margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid rgba(148,163,184,0.22);">
                <div style="margin-bottom:8px; font-size:28px; font-weight:900; line-height:1.15; color:#0f172a;">Daily Stand-up Command Center</div>
                <div style="margin-bottom:10px; font-size:18px; font-weight:800; color:#334155;">${escapeHtml(hub.name)}</div>
                <div style="margin-bottom:14px; font-size:13px; color:#64748b;">Zakres: <strong style="color:#334155;">${escapeHtml(from)}</strong> -> <strong style="color:#334155;">${escapeHtml(to)}</strong></div>
            </div>
            <div style="display:block; width:100%; margin:0 0 20px 0; padding:14px 16px; border-radius:16px; background:linear-gradient(135deg, #020617 0%, #334155 100%); box-shadow:0 14px 28px rgba(15,23,42,0.22); box-sizing:border-box;">
                <div style="font-size:11px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:rgba(255,255,255,0.72);">Sekcja startowa</div>
                <div style="margin-top:4px; font-size:22px; font-weight:900; letter-spacing:0.08em; color:#ffffff;">AKTYWNOŚCI</div>
            </div>
            <div style="display:block;">
                ${renderedSectionsHtml}
            </div>
        </section>
    `;
};

const buildScheduledTaskEmailBody = async (task: ScheduledTask, executionDate: Date) => {
    const textBlocks: string[] = [];
    const htmlBlocks: string[] = [];
    const dailyPayloadCache = new Map<string, Promise<DailyContentSourcePayload>>();
    const baseBody = sanitizeScheduledEmailIntro(task.emailTemplate.body);
    if (baseBody) {
        textBlocks.push(baseBody);
        htmlBlocks.push(textToSimpleHtml(baseBody));
    }

    for (const source of task.contentSources || []) {
        if (source.type === 'daily') {
            const cacheKey = `${source.id}:${source.hubId}:${source.sectionIds.join(',')}:${executionDate.toISOString()}`;
            if (!dailyPayloadCache.has(cacheKey)) {
                dailyPayloadCache.set(cacheKey, loadDailyContentSourcePayload(task, source, executionDate));
            }
            const payload = await dailyPayloadCache.get(cacheKey)!;

            const renderedDaily = await renderDailyContentSource(task, source, executionDate, payload);
            if (renderedDaily.trim()) {
                textBlocks.push(renderedDaily);
            }

            const renderedDailyHtml = await renderDailyContentSourceHtml(task, source, executionDate, payload);
            if (renderedDailyHtml.trim()) {
                htmlBlocks.push(renderedDailyHtml);
            }
        }
    }

    const htmlBody = htmlBlocks.length > 0
        ? `<!doctype html><html lang="pl"><body style="margin:0; padding:32px; background:#eef2ff; font-family:Arial, Helvetica, sans-serif;"><div style="max-width:100%; min-width:100%; margin:0 auto;">${htmlBlocks.join('')}</div></body></html>`
        : '';

    return {
        textBody: textBlocks.join('\n\n'),
        htmlBody,
    };
};

const getScheduledTaskOccurrenceKey = (task: ScheduledTask, date: Date) => {
    const dateKey = getDateKey(date);

    switch (task.schedule.type) {
        case 'daily':
        case 'weekdays':
        case 'weekly':
        case 'monthly':
            return `${task.id}:${dateKey}:${getTimeKey(date)}`;
        case 'custom': {
            if (!task.schedule.dateTime) return null;
            const customDate = new Date(task.schedule.dateTime);
            if (Number.isNaN(customDate.getTime())) return null;
            return `${task.id}:${getDateKey(customDate)}:${getTimeKey(customDate)}`;
        }
        default:
            return null;
    }
};

const hasScheduledTaskRunForOccurrence = (task: ScheduledTask, date: Date) => {
    if (!task.lastRunAt) return false;

    const lastRunDate = new Date(task.lastRunAt);
    if (Number.isNaN(lastRunDate.getTime())) return false;

    return getScheduledTaskOccurrenceKey(task, lastRunDate) === getScheduledTaskOccurrenceKey(task, date);
};

const isScheduledTaskDue = (task: ScheduledTask, now: Date) => {
    if (!task.isActive) return false;

    switch (task.schedule.type) {
        case 'daily':
            return task.schedule.time === getTimeKey(now);
        case 'weekdays':
            return now.getDay() >= 1 && now.getDay() <= 5 && task.schedule.time === getTimeKey(now);
        case 'weekly':
            return task.schedule.dayOfWeek === now.getDay() && task.schedule.time === getTimeKey(now);
        case 'monthly':
            return task.schedule.dayOfMonth === now.getDate() && task.schedule.time === getTimeKey(now);
        case 'custom': {
            if (!task.schedule.dateTime) return false;
            const customDate = new Date(task.schedule.dateTime);
            if (Number.isNaN(customDate.getTime())) return false;
            return getDateKey(customDate) === getDateKey(now) && getTimeKey(customDate) === getTimeKey(now);
        }
        default:
            return false;
    }
};

const executeScheduledEmailTask = async (task: ScheduledTask, executionDate = new Date()) => {
    const hasCreds = await ensureGoogleCredentials();
    if (!hasCreds) {
        throw new Error('Brak skonfigurowanych danych Google Client ID / Secret.');
    }

    const authStatus = await gDocsService.getAuthStatus();
    if (!authStatus.isAuthenticated) {
        throw new Error('Brak aktywnej autoryzacji Google. Zaloguj siĂ„â„˘ ponownie w ustawieniach aplikacji.');
    }

    const to = task.emailTemplate.to.trim();
    const subject = task.emailTemplate.subject.trim();
    if (!to) {
        throw new Error('Brak odbiorcy wiadomoÄąâ€şci w harmonogramie.');
    }
    if (!subject) {
        throw new Error('Brak tytuÄąâ€šu wiadomoÄąâ€şci w harmonogramie.');
    }

    const { textBody, htmlBody } = await buildScheduledTaskEmailBody(task, executionDate);

    try {
        await writeScheduledEmailDebugOutput(task, executionDate, textBody, htmlBody);
    } catch (error) {
        console.warn('Nie udalo sie zapisac debugowego podgladu maila harmonogramu:', error);
    }

    await gDocsService.sendEmail({
        to,
        cc: task.emailTemplate.cc.trim(),
        subject,
        body: textBody,
        htmlBody,
    });
};

const executeScheduledTaskNow = async (taskId: string) => {
    const task = getScheduledTasks().find((entry) => entry.id === taskId);
    if (!task) {
        throw new Error('Nie znaleziono wskazanego zadania harmonogramu.');
    }

    const executedAt = new Date().toISOString();

    try {
        await executeScheduledEmailTask(task, new Date(executedAt));
        const updatedTask: ScheduledTask = {
            ...task,
            updatedAt: executedAt,
            lastRunAt: executedAt,
            lastRunStatus: 'success',
            lastRunError: '',
        };
        saveScheduledTaskRecord(updatedTask);
        return updatedTask;
    } catch (error) {
        const updatedTask: ScheduledTask = {
            ...task,
            updatedAt: executedAt,
            lastRunAt: executedAt,
            lastRunStatus: 'error',
            lastRunError: error instanceof Error ? error.message : 'Nieznany bĹ‚Ä…d wykonania zadania harmonogramu.',
        };
        saveScheduledTaskRecord(updatedTask);
        throw error;
    }
};

const runDueScheduledTasks = async () => {
    if (scheduledTaskRunnerInProgress) return;

    scheduledTaskRunnerInProgress = true;
    try {
        const now = new Date();
        const tasks = getScheduledTasks();

        for (const task of tasks) {
            if (!isScheduledTaskDue(task, now) || hasScheduledTaskRunForOccurrence(task, now)) {
                continue;
            }

            try {
                await executeScheduledEmailTask(task, now);
                saveScheduledTaskRecord({
                    ...task,
                    isActive: task.schedule.type === 'custom' ? false : task.isActive,
                    updatedAt: new Date().toISOString(),
                    lastRunAt: now.toISOString(),
                    lastRunStatus: 'success',
                    lastRunError: '',
                });
            } catch (error) {
                console.error('BĹ‚Ä…d wykonania zadania harmonogramu:', error);
                saveScheduledTaskRecord({
                    ...task,
                    updatedAt: new Date().toISOString(),
                    lastRunAt: now.toISOString(),
                    lastRunStatus: 'error',
                    lastRunError: error instanceof Error ? error.message : 'Nieznany bĹ‚Ä…d wykonania zadania harmonogramu.',
                });
            }
        }
    } catch (error) {
        console.error('BĹ‚Ä…d pracy globalnego harmonogramu:', error);
    } finally {
        scheduledTaskRunnerInProgress = false;
    }
};

const startScheduledTaskRunner = () => {
    if (scheduledTaskRunner) return;

    void runDueScheduledTasks();
    scheduledTaskRunner = setInterval(() => {
        void runDueScheduledTasks();
    }, scheduledTaskCheckIntervalMs);
};

const stopScheduledTaskRunner = () => {
    if (!scheduledTaskRunner) return;
    clearInterval(scheduledTaskRunner);
    scheduledTaskRunner = null;
};

const importDatabaseBackupFromGoogleDrive = async () => {
    if (!googleDriveSharedFolderLink) {
        throw new Error('Brak GOOGLE_DRIVE_SHARED_FOLDER_LINK w pliku .env.');
    }

    const hasCreds = await ensureGoogleCredentials();
    if (!hasCreds) {
        throw new Error('Brak skonfigurowanych danych Google Client ID / Secret.');
    }

    const authStatus = await gDocsService.getAuthStatus();
    if (!authStatus.isAuthenticated) {
        throw new Error('Brak aktywnej autoryzacji Google. Zaloguj siÄ™ ponownie w ustawieniach aplikacji.');
    }

    const remoteFile = await gDocsService.getLatestDatabaseBackup(googleDriveSharedFolderLink, remoteDatabaseFileNamePrefix);
    if (!remoteFile?.id) {
        throw new Error('W udostÄ™pnionym folderze Google Drive nie znaleziono kopii bazy danych.');
    }

    const importFileName = remoteFile.name || buildRemoteDatabaseBackupFileName(new Date());
    const tempImportPath = path.join(app.getPath('temp'), `${importFileName}-import-${Date.now()}`);
    try {
        await gDocsService.downloadDatabaseBackup(remoteFile.id, tempImportPath);
        await replaceLocalDatabaseFromFile(tempImportPath);
        return remoteFile;
    } finally {
        await removeFileIfExists(tempImportPath);
    }
};

const maybeOfferRemoteDatabaseImport = async () => {
    if (!googleDriveSharedFolderLink) return;

    try {
        const hasCreds = await ensureGoogleCredentials();
        if (!hasCreds) return;

        const authStatus = await gDocsService.getAuthStatus();
        if (!authStatus.isAuthenticated) return;

        const remoteFile = await gDocsService.getLatestDatabaseBackup(googleDriveSharedFolderLink, remoteDatabaseFileNamePrefix);
        if (!remoteFile?.id || !remoteFile.modifiedTime) return;

        const localTimestamp = await getLocalDatabaseTimestamp();
        const remoteTimestamp = new Date(remoteFile.modifiedTime).getTime();
        if (!Number.isFinite(remoteTimestamp) || remoteTimestamp <= localTimestamp) return;

        const response = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Tak', 'Nie'],
            defaultId: 0,
            cancelId: 1,
            message: 'Jest nowsza baza danych, pobraÄ‡?',
            detail: `Lokalna baza: ${localTimestamp > 0 ? getTimestampLabel(new Date(localTimestamp)) : 'brak lokalnej kopii'}\nZdalna baza: ${getTimestampLabel(new Date(remoteTimestamp))}`,
        });

        if (response.response !== 0) return;
        await importDatabaseBackupFromGoogleDrive();
    } catch (error) {
        console.error('BĹ‚Ä…d sprawdzania zdalnej bazy danych:', error);
        if (isInsufficientScopeError(error)) {
            await dialog.showMessageBox({
                type: 'warning',
                buttons: ['OK'],
                message: 'Brak uprawnieĹ„ Google Drive',
                detail: buildGoogleDriveScopeErrorMessage(),
            });
        }
    }
};

let allowMainWindowClose = false;
let closePromptInProgress = false;

const handleCloseExportFailure = async (error: unknown) => {
    const response = await dialog.showMessageBox(mainWindow ?? undefined, {
        type: 'error',
        buttons: ['Zamknij bez eksportu', 'Anuluj'],
        defaultId: 1,
        cancelId: 1,
        message: 'Nie udaĹ‚o siÄ™ wyeksportowaÄ‡ bazy danych.',
        detail: error instanceof Error ? error.message : 'Nieznany bĹ‚Ä…d eksportu bazy danych.',
    });

    return response.response === 0;
};

const handleMainWindowCloseRequestWithTrayChoice = async () => {
    if (!mainWindow || allowMainWindowClose || closePromptInProgress) return;

    closePromptInProgress = true;
    try {
        const response = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Zamknij i eksport bazy', 'Do Tray'],
            defaultId: 0,
            cancelId: 1,
            message: 'Co zrobi\u0107 przy zamykaniu aplikacji?',
            detail: 'Wybierz zamkni\u0119cie z eksportem bazy danych do Google Drive albo ukrycie aplikacji do traya.',
        });

        if (response.response === 1) {
            ensureTray();
            hideMainWindowToTray();
            return;
        }

        if (response.response !== 0) return;

        try {
            await exportDatabaseBackupToGoogleDrive();
        } catch (error) {
            const shouldCloseWithoutExport = await handleCloseExportFailure(error);
            if (!shouldCloseWithoutExport) return;
        }

        allowMainWindowClose = true;
        mainWindow.destroy();
    } finally {
        closePromptInProgress = false;
    }
};

const handleMainWindowCloseRequest = async () => {
    if (!mainWindow || allowMainWindowClose || closePromptInProgress) return;

    closePromptInProgress = true;
    try {
        const response = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Zamknij i eksport bazy', 'Do Tray'],
            defaultId: 0,
            cancelId: 1,
            message: 'WyeksportowaÄ‡ bazÄ™?',
            detail: 'Wybranie "Tak" zapisze aktualnÄ… bazÄ™ danych do wspĂłĹ‚dzielonego folderu Google Drive przed zamkniÄ™ciem aplikacji.',
        });

        if (response.response === 1) {
            ensureTray();
            hideMainWindowToTray();
            return;
        }

        if (response.response !== 0) return;

        try {
            await exportDatabaseBackupToGoogleDrive();
        } catch (error) {
            const shouldCloseWithoutExport = await handleCloseExportFailure(error);
            if (!shouldCloseWithoutExport) return;
        }

        allowMainWindowClose = true;
        mainWindow.destroy();
    } finally {
        closePromptInProgress = false;
    }
};

ipcMain.handle('get-meeting-notes', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM meeting_notes WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania notatek:', error);
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
        console.error('BĹ‚Ä…d zapisu notatek:', error);
        throw error;
    }
});

ipcMain.handle('get-order-protocol-email-template', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM order_protocol_email_templates WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania szablonu e-mail PP:', error);
        throw error;
    }
});

ipcMain.handle('save-order-protocol-email-template', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO order_protocol_email_templates (projectId, data)
            VALUES (?, ?)
            ON CONFLICT(projectId) DO UPDATE SET data = excluded.data
        `).run(projectId, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu szablonu e-mail PP:', error);
        throw error;
    }
});

ipcMain.handle('get-order-acceptance-email-template', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM order_acceptance_email_templates WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania szablonu e-mail PO:', error);
        throw error;
    }
});

ipcMain.handle('save-order-acceptance-email-template', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO order_acceptance_email_templates (projectId, data)
            VALUES (?, ?)
            ON CONFLICT(projectId) DO UPDATE SET data = excluded.data
        `).run(projectId, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu szablonu e-mail PO:', error);
        throw error;
    }
});

ipcMain.handle('get-maintenance-settlement-email-template', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM maintenance_settlement_email_templates WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BÄąâ€šĂ„â€¦d pobierania szablonu e-mail rozliczenia miesiĂ„â€¦ca:', error);
        throw error;
    }
});

ipcMain.handle('save-maintenance-settlement-email-template', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO maintenance_settlement_email_templates (projectId, data)
            VALUES (?, ?)
            ON CONFLICT(projectId) DO UPDATE SET data = excluded.data
        `).run(projectId, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('BÄąâ€šĂ„â€¦d zapisu szablonu e-mail rozliczenia miesiĂ„â€¦ca:', error);
        throw error;
    }
});

ipcMain.handle('get-scheduled-tasks', async () => {
    try {
        return getScheduledTasks();
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania globalnego harmonogramu:', error);
        throw error;
    }
});

ipcMain.handle('save-scheduled-task', async (_, data: ScheduledTask) => {
    try {
        const normalizedTask = normalizeScheduledTask(data);
        saveScheduledTaskRecord({
            ...normalizedTask,
            updatedAt: normalizedTask.updatedAt || new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu zadania harmonogramu:', error);
        throw error;
    }
});

ipcMain.handle('delete-scheduled-task', async (_, id: string) => {
    try {
        deleteScheduledTaskRecord(id);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d usuwania zadania harmonogramu:', error);
        throw error;
    }
});

ipcMain.handle('run-scheduled-task-now', async (_, id: string) => {
    try {
        const task = await executeScheduledTaskNow(id);
        return { success: true, task };
    } catch (error) {
        console.error('BĹ‚Ä…d rÄ™cznego wykonania zadania harmonogramu:', error);
        throw error;
    }
});

ipcMain.handle('get-project-links', async (_, projectId: string) => {
    try {
        const rows = db.prepare(`
            SELECT id, projectId, name, url, visibleInTabs, createdAt, updatedAt
            FROM project_links
            WHERE projectId = ?
            ORDER BY LOWER(name) ASC, createdAt ASC
        `).all(projectId) as {
            id: string;
            projectId: string;
            name: string;
            url: string;
            visibleInTabs?: string;
            createdAt: string;
            updatedAt: string;
        }[];

        return rows.map((row) => ({
            ...row,
            visibleInTabs: (() => {
                try {
                    return JSON.parse(row.visibleInTabs || '[]');
                } catch {
                    return [];
                }
            })()
        }));
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania linkĂłw projektu:', error);
        throw error;
    }
});

ipcMain.handle('save-project-link', async (_, data: {
    id: string;
    projectId: string;
    name: string;
    url: string;
    visibleInTabs?: string[];
    createdAt: string;
    updatedAt: string;
}) => {
    try {
        db.prepare(`
            INSERT INTO project_links (id, projectId, name, url, visibleInTabs, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                url = excluded.url,
                visibleInTabs = excluded.visibleInTabs,
                updatedAt = excluded.updatedAt
        `).run(
            data.id,
            data.projectId,
            data.name,
            data.url,
            JSON.stringify(data.visibleInTabs || []),
            data.createdAt,
            data.updatedAt
        );

        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu linku projektu:', error);
        throw error;
    }
});

ipcMain.handle('delete-project-link', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM project_links WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d usuwania linku projektu:', error);
        throw error;
    }
});

ipcMain.handle('get-status-reports', async (_, projectId: string) => {
    try {
        const rows = db.prepare(`
            SELECT data
            FROM status_reports
            WHERE projectId = ?
            ORDER BY dateTo DESC, updatedAt DESC
        `).all(projectId) as { data: string }[];
        return rows.map(row => JSON.parse(row.data));
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania status reports:', error);
        throw error;
    }
});

ipcMain.handle('save-status-report', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO status_reports (id, projectId, title, dateFrom, dateTo, createdAt, updatedAt, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                dateFrom = excluded.dateFrom,
                dateTo = excluded.dateTo,
                updatedAt = excluded.updatedAt,
                data = excluded.data
        `).run(
            data.id,
            projectId,
            data.title,
            data.dateFrom,
            data.dateTo,
            data.createdAt,
            data.updatedAt,
            JSON.stringify(data)
        );
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu status report:', error);
        throw error;
    }
});

ipcMain.handle('delete-status-report', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM status_reports WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d usuwania status report:', error);
        throw error;
    }
});

ipcMain.handle('get-maintenance-entries', async (_, projectId: string) => {
    try {
        const rows = db.prepare(`
            SELECT id, projectId, month, netAmount, vatRate, grossAmount, notes, settlementFlow, createdAt, updatedAt
            FROM maintenance_entries
            WHERE projectId = ?
            ORDER BY month DESC, createdAt DESC
        `).all(projectId) as {
            id: string;
            projectId: string;
            month: string;
            netAmount: number;
            vatRate: number;
            grossAmount: number;
            notes?: string;
            settlementFlow?: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
        return rows.map((row) => ({
            ...row,
            settlementFlow: row.settlementFlow ? JSON.parse(row.settlementFlow) : undefined,
        }));
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania wpisĂłw utrzymania:', error);
        throw error;
    }
});

ipcMain.handle('save-maintenance-entry', async (_, data: {
    id: string;
    projectId: string;
    month: string;
    netAmount: number;
    vatRate: number;
    grossAmount: number;
    notes?: string;
    settlementFlow?: any;
    createdAt: string;
    updatedAt: string;
}) => {
    try {
        db.prepare(`
            INSERT INTO maintenance_entries (id, projectId, month, netAmount, vatRate, grossAmount, notes, settlementFlow, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                month = excluded.month,
                netAmount = excluded.netAmount,
                vatRate = excluded.vatRate,
                grossAmount = excluded.grossAmount,
                notes = excluded.notes,
                settlementFlow = excluded.settlementFlow,
                updatedAt = excluded.updatedAt
        `).run(
            data.id,
            data.projectId,
            data.month,
            data.netAmount,
            data.vatRate,
            data.grossAmount,
            data.notes || '',
            data.settlementFlow ? JSON.stringify(data.settlementFlow) : null,
            data.createdAt,
            data.updatedAt
        );

        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu wpisu utrzymania:', error);
        throw error;
    }
});

ipcMain.handle('delete-maintenance-entry', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM maintenance_entries WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d usuwania wpisu utrzymania:', error);
        throw error;
    }
});

ipcMain.handle('append-google-doc', async (_, { docLink, content, title, participants }: { docLink: string, content: string, title: string, participants: string[] }) => {
    try {
        await ensureGoogleCredentials();
        return await gDocsService.appendNote(docLink, title, participants, content);
    } catch (error) {
        console.error('BĹ‚Ä…d synchronizacji z Google Docs:', error);
        throw error;
    }
});

ipcMain.handle('get-google-auth-status', async () => {
    try {
        await ensureGoogleCredentials();
        return await gDocsService.getAuthStatus();
    } catch (error) {
        console.error('BĹ‚Ä…d statusu Google:', error);
        throw error;
    }
});

ipcMain.handle('get-google-auth-url', async () => {
    const hasCreds = await ensureGoogleCredentials();
    if (!hasCreds) {
        throw new Error('Brak skonfigurowanych danych Client ID / Secret w ustawieniach gĹ‚Ăłwnych.');
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

ipcMain.handle('export-database', async () => {
    try {
        const uploaded = await exportDatabaseBackupToGoogleDrive();
        return {
            success: true,
            canceled: false,
            fileName: uploaded.name || buildRemoteDatabaseBackupFileName(new Date()),
            modifiedTime: uploaded.modifiedTime || null,
        };
    } catch (error) {
        if (isInsufficientScopeError(error)) {
            throw new Error(buildGoogleDriveScopeErrorMessage());
        }
        throw error;
    }
});

ipcMain.handle('import-database', async () => {
    try {
        const imported = await importDatabaseBackupFromGoogleDrive();
        return {
            success: true,
            canceled: false,
            fileName: imported.name || buildRemoteDatabaseBackupFileName(new Date()),
            modifiedTime: imported.modifiedTime || null,
        };
    } catch (error) {
        if (isInsufficientScopeError(error)) {
            throw new Error(buildGoogleDriveScopeErrorMessage());
        }
        throw error;
    }
});

ipcMain.handle('export-pdf', async (_, options?: { defaultFileName?: string; password?: string }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Okno aplikacji nie jest dostÄ™pne.');
    }

    const sanitizedFileName = (options?.defaultFileName || `raport-${new Date().toISOString().slice(0, 10)}.pdf`)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
        .trim();
    const finalFileName = sanitizedFileName.toLowerCase().endsWith('.pdf')
        ? sanitizedFileName
        : `${sanitizedFileName}.pdf`;

    const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: 'Zapisz raport PDF',
        defaultPath: path.join(app.getPath('documents'), finalFileName),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
    });

    if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, canceled: true };
    }

    const pdfBuffer = await mainWindow.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: 'A4',
        preferCSSPageSize: true,
    });

    const password = options?.password;
    let finalPdfBytes = new Uint8Array(pdfBuffer);

    if (password) {
        try {
            const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');
            finalPdfBytes = await encryptPDF(
                new Uint8Array(pdfBuffer),
                password,
                randomBytes(24).toString('hex'),
            );
        } catch (error) {
            console.error('BĹ‚Ä…d Ĺ‚adowania moduĹ‚u szyfrowania PDF:', error);
            throw new Error('Nie udaĹ‚o siÄ™ wĹ‚Ä…czyÄ‡ szyfrowania PDF. ModuĹ‚ szyfrowania nie jest dostÄ™pny w tej instalacji aplikacji.');
        }
    }

    await fs.writeFile(saveResult.filePath, Buffer.from(finalPdfBytes));

    return {
        success: true,
        canceled: false,
        filePath: saveResult.filePath,
    };
});

// ==========================================
// IPC DAILY HANDLERS
// ==========================================

ipcMain.handle('get-daily-hubs', async () => {
    try {
        const rows = db.prepare('SELECT * FROM daily_hubs').all();
        return rows;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania daily_hubs:', error);
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
        console.error('BĹ‚Ä…d zapisu daily_hub:', error);
        throw error;
    }
});

ipcMain.handle('delete-daily-hub', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM daily_hubs WHERE id = ?').run(id);
        db.prepare('DELETE FROM daily_sections WHERE hubId = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d usuwania daily_hub:', error);
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
        console.error('BĹ‚Ä…d pobierania daily_sections:', error);
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
        console.error('BĹ‚Ä…d zapisu daily_section:', error);
        throw error;
    }
});

ipcMain.handle('delete-daily-section', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM daily_sections WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d usuwania daily_section:', error);
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
        console.error('BĹ‚Ä…d reorder daily_sections:', error);
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
        console.error('BĹ‚Ä…d pobierania daily_comments:', error);
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
        console.error('BĹ‚Ä…d zapisu daily_comment:', error);
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
        console.error('BĹ‚Ä…d pobierania daily_issue_states:', error);
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
        console.error('BĹ‚Ä…d zapisu daily_issue_state:', error);
        throw error;
    }
});

