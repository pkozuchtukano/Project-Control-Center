import electron from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
const { app, BrowserWindow, ipcMain } = electron;
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

// Odnalezienie prawidłowego miejsca na bazę (obok .exe jeśli zbudowana)
const dbPath = isDev
    ? path.join(__dirname, '../../baza_danych.json')
    : path.join(path.dirname(app.getPath('exe')), 'baza_danych.json');

let mainWindow: BrowserWindowType | null = null;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoHideMenuBar: true,
    });

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
// IPC DATABASE HANDLERS (Portable JSON)
// ==========================================

ipcMain.handle('read-db', async () => {
    try {
        const data = await fs.readFile(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // Jeśli plik nie istnieje, zwróć pusty stan bazy z upewnieniem, że stworzone zostaną pliki po pierwszym zapisie
            return { projects: [], orders: [] };
        }
        console.error('Błąd odczytu bazy JSON:', error);
        throw error;
    }
});

ipcMain.handle('write-db', async (_, data) => {
    try {
        await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu bazy JSON:', error);
        throw error;
    }
});
