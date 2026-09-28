import electron from 'electron';
import type { BrowserWindow as BrowserWindowType, IpcMainInvokeEvent } from 'electron';
import { createHash } from 'node:crypto';

const { BrowserWindow, ipcMain, session } = electron;

const httpsUrl = (value: string) => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('YouTrack i logowanie wymagaj\u0105 adresu HTTPS bez danych logowania w adresie.');
    }
    return url;
};

export function createYouTrackAuth(
    config: { youtrackBaseUrl: string; youtrackToken: string },
    getMainWindow: () => BrowserWindowType | null,
) {
    let loginWindow: BrowserWindowType | null = null;
    let authGeneration = 0;
    let lastAuthSucceeded = false;
    let pendingAuth: { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } | null = null;
    const allowedOrigins = new Set<string>();
    const baseUrl = () => httpsUrl(config.youtrackBaseUrl.trim());
    const getSession = () => {
        const key = createHash('sha256').update(baseUrl().origin).digest('hex');
        return session.fromPartition(`persist:youtrack-${key}`);
    };
    const assertSender = (event: IpcMainInvokeEvent) => {
        const main = getMainWindow();
        if (!main || event.sender !== main.webContents || event.senderFrame !== main.webContents.mainFrame) {
            throw new Error('Niedozwolony nadawca.');
        }
    };
    const close = () => {
        loginWindow?.close();
        loginWindow = null;
        allowedOrigins.clear();
    };

    const finishAuth = (success: boolean) => {
        authGeneration++;
        lastAuthSucceeded = success;
        const pending = pendingAuth;
        pendingAuth = null;
        if (success) pending?.resolve();
        else pending?.reject(new Error('[YOUTRACK_AUTH_REQUIRED] Anulowano logowanie YouTrack. Synchronizacja zosta\u0142a przerwana.'));
    };
    const waitForAuth = () => {
        if (!pendingAuth) {
            const main = getMainWindow();
            if (!main || main.isDestroyed()) {
                throw new Error('[YOUTRACK_AUTH_REQUIRED] Otw\u00f3rz aplikacj\u0119 i zaloguj si\u0119 do YouTrack.');
            }
            let resolve!: () => void;
            let reject!: (error: Error) => void;
            const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
            pendingAuth = { promise, resolve, reject };
            main.webContents.send('youtrack-auth-required');
        }
        return pendingAuth.promise;
    };

    const fetchResponse = async (value: string, options?: RequestInit, allowLogin = true): Promise<Response> => {
        const url = httpsUrl(value);
        if (url.origin !== baseUrl().origin) {
            throw new Error('Zablokowano wysy\u0142anie danych YouTrack do innego serwera.');
        }
        // Retry only reads, once. A persistent permission/token error must not loop.
        const canRetry = allowLogin && ['GET', 'HEAD'].includes((options?.method || 'GET').toUpperCase());
        for (let attempt = 0; ; attempt++) {
            if (allowLogin && pendingAuth) await pendingAuth.promise;
            const requestGeneration = authGeneration;
            // Chromium strips Authorization when a redirect changes origin.
            const response = await getSession().fetch(url.href, {
                signal: AbortSignal.timeout(30000), ...options, credentials: 'include', redirect: 'follow',
            });
            const contentType = response.headers.get('content-type') || '';
            const redirected = response.status >= 300 && response.status < 400;
            const html = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);
            if (!(redirected || html || response.status === 401 || response.status === 403)) return response;
            await response.body?.cancel();
            const failure = new Error('[YOUTRACK_AUTH_REQUIRED] ' + (redirected || html
                ? 'YouTrack: wymagane logowanie authentik.'
                : `YouTrack: brak dost\u0119pu (${response.status}). Sprawd\u017a logowanie authentik, token YouTrack i uprawnienia konta.`));
            if (!canRetry || attempt > 0) throw failure;
            if (requestGeneration !== authGeneration) {
                if (!lastAuthSucceeded) throw new Error('[YOUTRACK_AUTH_REQUIRED] Anulowano logowanie YouTrack.');
            } else {
                await waitForAuth();
            }
        }
    };

    ipcMain.handle('youtrack-auth-open', async (event) => {
        assertSender(event);
        if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.show();
            loginWindow.focus();
            return;
        }
        const start = baseUrl();
        allowedOrigins.clear();
        allowedOrigins.add(start.origin);
        const ses = getSession();
        ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
        ses.setPermissionCheckHandler(() => false);
        const win = new BrowserWindow({
            width: 900, height: 760, title: 'Logowanie YouTrack / authentik',
            autoHideMenuBar: true,
            webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false },
        });
        loginWindow = win;
        // Trust HTTPS origins reached by server redirects from the configured YouTrack,
        // but never allow a pasted link to introduce an unrelated origin.
        win.webContents.on('will-redirect', (navigation, target, _isInPlace, isMainFrame) => {
            if (!isMainFrame) return;
            try { allowedOrigins.add(httpsUrl(target).origin); }
            catch { navigation.preventDefault(); }
        });
        win.webContents.on('will-navigate', (navigation, target) => {
            try {
                if (!allowedOrigins.has(httpsUrl(target).origin)) navigation.preventDefault();
            } catch { navigation.preventDefault(); }
        });
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.on('closed', () => {
            if (loginWindow === win) loginWindow = null;
        });
        try { await win.loadURL(start.href); }
        catch {
            close();
            throw new Error('Nie uda\u0142o si\u0119 otworzy\u0107 logowania. Sprawd\u017a po\u0142\u0105czenie i adres YouTrack.');
        }
    });

    ipcMain.handle('youtrack-auth-link', async (event, value: unknown) => {
        assertSender(event);
        if (!loginWindow || loginWindow.isDestroyed()) {
            throw new Error('Najpierw otw\u00f3rz okno logowania i wpisz adres e-mail.');
        }
        let link: URL;
        try {
            if (typeof value !== 'string' || value.length > 16384) throw new Error();
            link = httpsUrl(value.trim());
            if (!allowedOrigins.has(link.origin)) throw new Error();
        } catch {
            throw new Error('Wklej link HTTPS z domeny otwartego logowania. Inne domeny s\u0105 blokowane.');
        }
        try {
            loginWindow.show();
            loginWindow.focus();
            await loginWindow.loadURL(link.href);
        } catch {
            // Do not expose a magic link (including its token) in IPC errors or logs.
            throw new Error('Nie uda\u0142o si\u0119 otworzy\u0107 linku. Sprawd\u017a okno logowania lub popro\u015b o nowy link.');
        }
    });

    ipcMain.handle('youtrack-auth-check', async (event) => {
        assertSender(event);
        if (!config.youtrackToken.trim()) throw new Error('Brak skonfigurowanego tokena API YouTrack.');
        const url = new URL(`${baseUrl().href.replace(/\/+$/, '')}/api/users/me`);
        url.searchParams.set('fields', 'id,login');
        const response = await fetchResponse(url.href, {
            headers: { Authorization: `Bearer ${config.youtrackToken}`, Accept: 'application/json' },
        }, false);
        if (!response.ok) throw new Error(`YouTrack: b\u0142\u0105d po\u0142\u0105czenia (${response.status}).`);
        const user = await response.json();
        if (!user || typeof user.id !== 'string' || typeof user.login !== 'string' || user.login === 'guest') {
            throw new Error('YouTrack nie potwierdzi\u0142 zalogowanego konta.');
        }
        await getSession().cookies.flushStore();
        close();
        finishAuth(true);
        return { login: user.login as string };
    });

    ipcMain.handle('youtrack-auth-close', (event) => {
        assertSender(event);
        close();
        if (pendingAuth) finishAuth(false);
    });
    return { fetchResponse };
}
