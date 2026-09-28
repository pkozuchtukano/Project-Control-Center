const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('YouTrack login shares a persistent session, protects tokens and verifies API access', async () => {
    const handlers = new Map();
    const windows = [];
    const requests = [];
    const partitions = [];
    const notifications = [];
    let flushed = false;
    let reply = () => new Response('', { status: 302, headers: { location: 'https://auth.example/login' } });
    const ses = {
        fetch: async (url, options) => { requests.push({ url, options }); return reply(); },
        cookies: { flushStore: async () => { flushed = true; } },
        setPermissionRequestHandler: () => {},
        setPermissionCheckHandler: () => {},
    };
    class LoginWindow extends EventEmitter {
        constructor(options) {
            super();
            this.options = options;
            this.webContents = new EventEmitter();
            this.webContents.setWindowOpenHandler = (callback) => { this.popupHandler = callback; };
            this.urls = [];
            windows.push(this);
        }
        async loadURL(url) {
            this.urls.push(url);
            if (url === 'https://yt.example/youtrack') {
                this.webContents.emit('will-redirect', {}, 'https://auth.example/if/flow/login/', false, true);
            }
        }
        show() {}
        focus() {}
        isDestroyed() { return !!this.destroyed; }
        close() { this.destroyed = true; this.emit('closed'); }
    }
    const main = { isDestroyed: () => false, webContents: { mainFrame: {}, send: (name) => notifications.push(name) } };
    const event = { sender: main.webContents, senderFrame: main.webContents.mainFrame };
    const electron = {
        BrowserWindow: LoginWindow,
        ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
        session: { fromPartition: (key) => { partitions.push(key); return ses; } },
    };
    const source = fs.readFileSync(path.join(__dirname, '../electron/youtrackAuth.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(compiled, {
        module, exports: module.exports, URL, AbortSignal,
        require: (name) => name === 'electron' ? electron : require(name),
    });
    const client = module.exports.createYouTrackAuth({
        youtrackBaseUrl: 'https://yt.example/youtrack', youtrackToken: 'private-youtrack-token',
    }, () => main);
    const invoke = (name, ...args) => handlers.get(`youtrack-auth-${name}`)(event, ...args);

    const tick = () => new Promise(resolve => setImmediate(resolve));
    let completed = false;
    const firstRead = client.fetchResponse('https://yt.example/youtrack/api/issues', {
        headers: { Authorization: 'Bearer private-youtrack-token' },
    }).then(response => { completed = true; return response; });
    await tick();
    assert.equal(completed, false, 'sync waits for login instead of failing');
    assert.equal(requests.length, 1, 'must not follow a redirect with the API token');
    assert.equal(requests[0].options.redirect, 'follow');
    assert.equal(requests[0].options.credentials, 'include');
    assert.deepEqual(notifications, ['youtrack-auth-required']);
    await assert.rejects(client.fetchResponse('https://evil.example/api'), /innego serwera/);
    assert.equal(requests.length, 1);
    const parallelRead = client.fetchResponse('https://yt.example/youtrack/api/workItems');
    await tick();
    assert.equal(requests.length, 1, 'new reads wait behind the same login');
    assert.equal(notifications.length, 1, 'one modal for all pending reads');
    await assert.rejects(handlers.get('youtrack-auth-open')({ sender: {} }), /nadawca/);
    await assert.rejects(invoke('link', 'https://auth.example/link?token=secret'), /Najpierw/);

    await invoke('open');
    const win = windows[0];
    assert.equal(win.options.webPreferences.session, ses);
    assert.equal(win.options.webPreferences.preload, undefined);
    assert.equal(win.options.webPreferences.sandbox, true);
    assert.equal(win.options.webPreferences.nodeIntegration, false);
    assert.equal(win.popupHandler().action, 'deny');
    win.webContents.emit('will-redirect', {}, 'https://iframe.example/link', false, false);
    await assert.rejects(invoke('link', 'https://iframe.example/link'), /Wklej link HTTPS/);
    for (const link of ['file:///secret', 'javascript:alert(1)', 'http://auth.example/link',
        'https://auth.example.evil.test/link', 'https://user:pass@auth.example/link']) {
        await assert.rejects(invoke('link', link), /Wklej link HTTPS/);
    }
    const magicLink = 'https://auth.example/if/flow/login/?token=secret';
    await invoke('link', magicLink);
    assert.equal(win.urls.at(-1), magicLink);
    let blocked = false;
    win.webContents.emit('will-navigate', { preventDefault: () => { blocked = true; } }, 'file:///secret');
    assert.equal(blocked, true);

    reply = () => new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } });
    await assert.rejects(invoke('check'), /YOUTRACK_AUTH_REQUIRED/);
    assert.equal(win.isDestroyed(), false, 'HTML is not a successful login');
    reply = () => new Response('{}', { headers: { 'content-type': 'application/json' } });
    await assert.rejects(invoke('check'), /potwierdzi/);
    reply = () => new Response(JSON.stringify({ id: '1-1', login: 'piotr' }), {
        headers: { 'content-type': 'application/json' },
    });
    assert.equal((await invoke('check')).login, 'piotr');
    assert.equal((await firstRead).status, 200);
    assert.equal((await parallelRead).status, 200);
    assert.equal(flushed, true);
    assert.equal(win.isDestroyed(), true);
    const checkRequest = requests.find(request => /\/users\/me\?/.test(request.url));
    assert.match(checkRequest.url, /\/youtrack\/api\/users\/me\?fields=id%2Clogin$/);
    assert.equal(checkRequest.options.headers.Authorization, 'Bearer private-youtrack-token');
    assert.equal(requests.filter(request => request.url.endsWith('/api/issues')).length, 2, 'retry the interrupted page only');
    assert.equal(new Set(partitions).size, 1);
    assert.match(partitions[0], /^persist:youtrack-/);
    reply = () => new Response('', { status: 401 });
    const cancelled = assert.rejects(client.fetchResponse('https://yt.example/youtrack/api/issues'), /Anulowano/);
    await tick();
    assert.equal(notifications.length, 2, 'expired session prompts again after successful verification');

    await invoke('open');
    windows[1].loadURL = async () => { throw new Error(magicLink); };
    await assert.rejects(invoke('link', magicLink), (error) => !error.message.includes('token=secret'));
    await invoke('close');
    await cancelled;
    assert.equal(windows[1].isDestroyed(), true);

    // A new sync must offer login again after a previous cancellation.
    const denied = assert.rejects(client.fetchResponse('https://yt.example/youtrack/api/issues'), /403/);
    await tick();
    assert.equal(notifications.length, 3);
    reply = () => new Response(JSON.stringify({ id: '1-1', login: 'piotr' }), {
        headers: { 'content-type': 'application/json' },
    });
    const checking = invoke('check');
    // The check already received valid JSON, but the resumed resource stays forbidden.
    reply = () => new Response('', { status: 403 });
    await checking;
    await denied;
    assert.equal(notifications.length, 3, 'do not loop on a persistent permission error');

    // Two requests already in flight before cancellation must not reopen the modal.
    let releaseLate;
    let count = 0;
    reply = () => ++count === 1 ? new Response('', { status: 401 })
        : new Promise(resolve => { releaseLate = resolve; });
    const cancelledFirst = assert.rejects(client.fetchResponse('https://yt.example/youtrack/api/issues'), /Anulowano/);
    const cancelledLate = assert.rejects(client.fetchResponse('https://yt.example/youtrack/api/workItems'), /Anulowano/);
    await tick();
    await invoke('close');
    releaseLate(new Response('', { status: 401 }));
    await Promise.all([cancelledFirst, cancelledLate]);
    assert.equal(notifications.length, 4);
});
