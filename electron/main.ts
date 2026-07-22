import electron from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage, net } = electron;
import path from 'path';
import fs from 'fs/promises';
import tls from 'tls';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { addBusinessDays, addDays, addHours, addMonths } from 'date-fns';
import { GoogleDocsService } from './googleDocsService.js';
import { getEnvSettings } from './envConfig.js';
import type { ScheduledTask, DailyHub, DailySection, ScheduledTaskContentSource, ServiceObligation, ServiceTask, ServiceEvent, GeminiGenerateRequest, GeminiGenerateResponse, DailyAiAnalysis, PendingSettlementEntry, Procedure } from '../src/types.js';

// To address '__filename is not defined' in built ESM Vite-Electron environments,
// we use app.getAppPath() to reliably locate resources instead of __dirname
const isDev = !app.isPackaged;
const appDir = app.getAppPath();
const executableDir = path.dirname(app.getPath('exe'));
const envSettings = getEnvSettings(appDir, executableDir);

const configureSystemCertificateAuthorities = () => {
    try {
        const systemCertificates = tls.getCACertificates('system');
        if (!systemCertificates.length) return;

        tls.setDefaultCACertificates([
            ...tls.getCACertificates('default'),
            ...systemCertificates,
        ]);
        console.log(`Main: loaded ${systemCertificates.length} system CA certificates for Node TLS requests.`);
    } catch (error) {
        console.warn('Main: could not load system CA certificates for Node TLS requests:', error);
    }
};

configureSystemCertificateAuthorities();

const fetchYouTrackResponse = (url: string, options?: RequestInit) =>
    net.fetch(url, options);

const getNetworkErrorMessage = (error: unknown) => {
    const requestError = error as Error & { cause?: Error & { code?: string } };
    const causeCode = requestError?.cause?.code;
    const causeMessage = requestError?.cause?.message;

    if (causeCode || causeMessage) {
        return [requestError.message, causeCode, causeMessage].filter(Boolean).join(' - ');
    }

    return requestError?.message || String(error);
};

// Odnalezienie prawidĹ‚owego miejsca na bazÄ™
const dbPath = isDev
    ? path.join(appDir, 'baza_danych.db')
    : path.join(executableDir, 'baza_danych.db');
const dbWalPath = `${dbPath}-wal`;
const dbShmPath = `${dbPath}-shm`;
const remoteDatabaseFileNamePrefix = 'pcc-baza_danych';
const googleDriveSharedFolderLink = envSettings.googleDriveSharedFolderLink?.trim() || '';
const DEFAULT_GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_HIGH_DEMAND_RETRY_DELAYS_MS = [1200, 2800];
const DEFAULT_SCHEDULED_TASK_MAX_OUTPUT_TOKENS = 24000;
const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v3';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isGeminiHighDemandError = (status: number, message: string) => {
    const normalizedMessage = message.toLowerCase();
    return (
        status === 429 ||
        status === 503 ||
        normalizedMessage.includes('high demand') ||
        normalizedMessage.includes('resource exhausted') ||
        normalizedMessage.includes('try again later') ||
        normalizedMessage.includes('unavailable')
    );
};

const buildGeminiHighDemandMessage = (primaryModel: string, fallbackModel?: string | null) => {
    if (fallbackModel) {
        return `Model \`${primaryModel}\` jest chwilowo przeciążony. Aplikacja spróbowała też modelu zapasowego \`${fallbackModel}\`, ale on również nie odpowiedział. Spróbuj ponownie za chwilę albo ręcznie wybierz inny model w formularzu.`;
    }

    return `Model \`${primaryModel}\` jest chwilowo przeciążony. Spróbuj ponownie za chwilę albo wybierz lżejszy model, np. \`gemini-2.5-flash-lite\`, w formularzu analizy AI.`;
};

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;

    if (!Array.isArray(parts)) {
        return '';
    }

    return parts
        .map((part: any) => typeof part?.text === 'string' ? part.text : '')
        .filter(Boolean)
        .join('\n')
        .trim();
};

const generateGeminiContent = async ({
    prompt,
    systemInstruction,
    model,
    generationConfig,
    additionalRequestFields,
    temperature,
    topP,
    topK,
    maxOutputTokens,
}: GeminiGenerateRequest): Promise<GeminiGenerateResponse> => {
    const apiKey = envSettings.geminiApiKey?.trim();

    if (!apiKey) {
        throw new Error('Brak GEMINI_API_KEY w pliku .env.');
    }

    const resolvedModel = (model || envSettings.geminiModel || DEFAULT_GEMINI_MODEL).trim();
    const baseUrl = (envSettings.geminiApiBaseUrl || DEFAULT_GEMINI_API_BASE_URL).trim().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/models/${encodeURIComponent(resolvedModel)}:generateContent`;

    const normalizedGenerationConfig: Record<string, unknown> = {
        ...(generationConfig || {}),
    };
    if (typeof temperature === 'number') normalizedGenerationConfig.temperature = temperature;
    if (typeof topP === 'number') normalizedGenerationConfig.topP = topP;
    if (typeof topK === 'number') normalizedGenerationConfig.topK = topK;
    if (typeof maxOutputTokens === 'number') normalizedGenerationConfig.maxOutputTokens = maxOutputTokens;

    const requestBody: Record<string, unknown> = {
        ...(additionalRequestFields || {}),
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }],
            },
        ],
    };

    if (systemInstruction?.trim()) {
        requestBody.system_instruction = {
            parts: [{ text: systemInstruction.trim() }],
        };
    }

    if (Object.keys(normalizedGenerationConfig).length > 0) {
        requestBody.generationConfig = normalizedGenerationConfig;
    }

    const sendRequest = async (targetModel: string): Promise<GeminiGenerateResponse> => {
        const targetEndpoint = `${baseUrl}/models/${encodeURIComponent(targetModel)}:generateContent`;

        for (let attempt = 0; attempt <= GEMINI_HIGH_DEMAND_RETRY_DELAYS_MS.length; attempt += 1) {
            const response = await fetch(targetEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify(requestBody),
            });

            const payload = await response.json().catch(async () => ({
                message: await response.text().catch(() => response.statusText),
            }));

            if (!response.ok) {
                const message =
                    payload?.error?.message ||
                    payload?.message ||
                    `Gemini API zwróciło błąd ${response.status}.`;

                if (isGeminiHighDemandError(response.status, message) && attempt < GEMINI_HIGH_DEMAND_RETRY_DELAYS_MS.length) {
                    await sleep(GEMINI_HIGH_DEMAND_RETRY_DELAYS_MS[attempt]);
                    continue;
                }

                const error = new Error(message) as Error & { status?: number; isHighDemand?: boolean };
                error.status = response.status;
                error.isHighDemand = isGeminiHighDemandError(response.status, message);
                throw error;
            }

            const text = extractGeminiText(payload);
            const finishReason = payload?.candidates?.[0]?.finishReason;

            if (!text && !finishReason) {
                throw new Error('Gemini API nie zwróciło tekstowej odpowiedzi.');
            }

            return {
                text,
                model: targetModel,
                usageMetadata: payload?.usageMetadata,
                finishReason,
                responseId: payload?.responseId,
            };
        }

        throw new Error(`Nie udało się pobrać odpowiedzi z modelu \`${targetModel}\`.`);
    };

    try {
        return await sendRequest(resolvedModel);
    } catch (error: any) {
        const shouldFallback =
            resolvedModel !== GEMINI_FALLBACK_MODEL &&
            isGeminiHighDemandError(error?.status || 0, error?.message || '');

        if (!shouldFallback) {
            throw error;
        }

        try {
            return await sendRequest(GEMINI_FALLBACK_MODEL);
        } catch (fallbackError: any) {
            if (isGeminiHighDemandError(fallbackError?.status || 0, fallbackError?.message || '')) {
                throw new Error(buildGeminiHighDemandMessage(resolvedModel, GEMINI_FALLBACK_MODEL));
            }
            throw fallbackError;
        }
    }
};

type ClickUpDailyExportRequest = {
    docUrl: string;
    title: string;
    content: string;
};

type ClickUpPageResponse = {
    id?: string;
    name?: string;
    content?: string;
    page?: {
        id?: string;
        name?: string;
        content?: string;
    };
};

const encodeClickUpPathPart = (value: string) => encodeURIComponent(value);

const extractClickUpDailyTarget = (docUrl: string) => {
    const trimmedUrl = docUrl.trim();
    if (!trimmedUrl) {
        throw new Error('Brak adresu dokumentu ClickUp w konfiguracji projektu.');
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmedUrl);
    } catch {
        throw new Error('Niepoprawny adres dokumentu ClickUp w konfiguracji projektu.');
    }

    const segments = parsed.pathname
        .split('/')
        .map((segment) => decodeURIComponent(segment.trim()))
        .filter(Boolean);

    const workspaceId =
        parsed.searchParams.get('workspace_id') ||
        parsed.searchParams.get('workspaceId') ||
        segments.find((segment) => /^\d+$/.test(segment));

    let docId =
        parsed.searchParams.get('doc_id') ||
        parsed.searchParams.get('docId') ||
        '';
    let pageId =
        parsed.searchParams.get('page_id') ||
        parsed.searchParams.get('pageId') ||
        parsed.searchParams.get('page') ||
        '';

    const docMarkerIndex = segments.findIndex((segment) => ['dc', 'docs', 'doc'].includes(segment.toLowerCase()));
    if (docMarkerIndex >= 0) {
        const afterMarker = segments.slice(docMarkerIndex + 1);
        const docIdIndex = afterMarker.findIndex((segment) => segment && !/^\d+$/.test(segment));
        if (!docId && docIdIndex >= 0) {
            docId = afterMarker[docIdIndex];
        }
        if (!pageId && docIdIndex >= 0 && afterMarker[docIdIndex + 1]) {
            pageId = afterMarker[docIdIndex + 1];
        }
    }

    if (!workspaceId) {
        throw new Error('Nie udało się odczytać workspace_id z adresu ClickUp. Użyj pełnego URL dokumentu z ClickUp.');
    }

    if (!docId) {
        throw new Error('Nie udało się odczytać doc_id z adresu ClickUp. Użyj pełnego URL dokumentu z ClickUp.');
    }

    return { workspaceId, docId, pageId: pageId || null, sourceUrl: trimmedUrl };
};

const sendClickUpRequest = async (endpoint: string, init: RequestInit) => {
    const apiToken = envSettings.clickupApiToken?.trim();
    if (!apiToken) {
        throw new Error('Brak CLICKUP_API_TOKEN w pliku .env.');
    }

    const response = await fetch(`${CLICKUP_API_BASE_URL}${endpoint}`, {
        ...init,
        headers: {
            Authorization: apiToken,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`ClickUp API zwróciło błąd ${response.status}${errorBody ? `: ${errorBody}` : ''}`);
    }

    const text = await response.text();
    if (!text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
};

const getClickUpPage = async (workspaceId: string, docId: string, pageId: string) =>
    sendClickUpRequest(
        `/workspaces/${encodeClickUpPathPart(workspaceId)}/docs/${encodeClickUpPathPart(docId)}/pages/${encodeClickUpPathPart(pageId)}?content_format=text/md`,
        { method: 'GET' },
    ) as Promise<ClickUpPageResponse>;

const getClickUpPageContent = (page: ClickUpPageResponse) =>
    typeof page.content === 'string'
        ? page.content
        : typeof page.page?.content === 'string'
            ? page.page.content
            : '';

const assertClickUpPageContainsExport = async (workspaceId: string, docId: string, pageId: string, title: string, content: string) => {
    const page = await getClickUpPage(workspaceId, docId, pageId);
    const pageContent = getClickUpPageContent(page);
    const contentProbe = content.slice(0, 80).trim();

    if (!pageContent.includes(title) && (!contentProbe || !pageContent.includes(contentProbe))) {
        throw new Error(
            `ClickUp przyjął zapis, ale pobrana treść strony ${pageId} nie zawiera eksportu. ` +
            'Sprawdź, czy URL wskazuje właściwą stronę dokumentu i czy token ma uprawnienia edycji tej strony.',
        );
    }
};

const describeClickUpTarget = (target: ReturnType<typeof extractClickUpDailyTarget>) =>
    `workspace_id=${target.workspaceId}, doc_id=${target.docId}, page_id=${target.pageId || 'brak'}, url=${target.sourceUrl}`;

const buildYouTrackIssueUrlForExport = (issueId: string) => {
    const baseUrl = envSettings.youtrackBaseUrl?.trim().replace(/\/+$/, '');
    if (!baseUrl) return null;
    return `${baseUrl}/issue/${encodeURIComponent(issueId)}`;
};

const linkifyYouTrackIssueCodesForMarkdown = (content: string) =>
    content.replace(/(?<![\w\[\]\)/-])\b([A-Z][A-Z0-9]+-\d+)\b(?![\w\]/-])/g, (match, issueId: string, offset: number, source: string) => {
        const before = source.slice(Math.max(0, offset - 2), offset);
        if (before === '](') return match;

        const issueUrl = buildYouTrackIssueUrlForExport(issueId);
        if (!issueUrl) return match;

        return `[${issueId}](${issueUrl})`;
    });

const exportDailyAiToClickUp = async ({ docUrl, title, content }: ClickUpDailyExportRequest) => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
        throw new Error('Brak treści analizy AI do eksportu.');
    }

    const target = extractClickUpDailyTarget(docUrl);
    const exportTitle = title.trim() || `Daily AI ${new Date().toLocaleString('pl-PL')}`;
    const linkedContent = linkifyYouTrackIssueCodesForMarkdown(normalizedContent);
    const markdownContent = [`---`, `# ${exportTitle}`, '', linkedContent].join('\n');

    if (target.pageId) {
        try {
            await sendClickUpRequest(
                `/workspaces/${encodeClickUpPathPart(target.workspaceId)}/docs/${encodeClickUpPathPart(target.docId)}/pages/${encodeClickUpPathPart(target.pageId)}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        content: `\n\n${markdownContent}`,
                        content_edit_mode: 'append',
                        content_format: 'text/md',
                    }),
                },
            );

            await assertClickUpPageContainsExport(target.workspaceId, target.docId, target.pageId, exportTitle, linkedContent);
        } catch (error: any) {
            throw new Error(`${error?.message || 'Nie udało się dopisać treści do strony ClickUp.'} Odczytany cel: ${describeClickUpTarget(target)}`);
        }

        return {
            success: true,
            mode: 'append' as const,
            workspaceId: target.workspaceId,
            docId: target.docId,
            pageId: target.pageId,
            verified: true,
        };
    }

    let createdPage: { id?: string; page?: { id?: string } };
    try {
        createdPage = await sendClickUpRequest(
            `/workspaces/${encodeClickUpPathPart(target.workspaceId)}/docs/${encodeClickUpPathPart(target.docId)}/pages`,
            {
                method: 'POST',
                body: JSON.stringify({
                    name: exportTitle,
                    content: linkedContent,
                    content_format: 'text/md',
                }),
            },
        ) as { id?: string; page?: { id?: string } };
    } catch (error: any) {
        throw new Error(`${error?.message || 'Nie udało się utworzyć strony ClickUp.'} Odczytany cel: ${describeClickUpTarget(target)}`);
    }

    const createdPageId = createdPage.id || createdPage.page?.id;
    if (createdPageId) {
        try {
            await assertClickUpPageContainsExport(target.workspaceId, target.docId, createdPageId, exportTitle, linkedContent);
        } catch (error: any) {
            throw new Error(`${error?.message || 'Nie udało się zweryfikować strony ClickUp.'} Odczytany cel: ${describeClickUpTarget(target)}`);
        }
    }

    return {
        success: true,
        mode: 'create_page' as const,
        workspaceId: target.workspaceId,
        docId: target.docId,
        pageId: createdPageId,
        verified: Boolean(createdPageId),
    };
};

// Inicjalizacja SQLite
let db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Wydajniejszy tryb zapisu

const ensureMaintenanceEntryFlowColumns = () => {
    const columns = db.prepare('PRAGMA table_info(maintenance_entries)').all() as { name: string }[];
    if (!columns.some(col => col.name === 'settlementFlow')) {
        db.prepare('ALTER TABLE maintenance_entries ADD COLUMN settlementFlow TEXT').run();
    }
    if (!columns.some(col => col.name === 'invoiceFlow')) {
        db.prepare('ALTER TABLE maintenance_entries ADD COLUMN invoiceFlow TEXT').run();
    }
    if (!columns.some(col => col.name === 'periodMonths')) {
        db.prepare('ALTER TABLE maintenance_entries ADD COLUMN periodMonths INTEGER NOT NULL DEFAULT 1').run();
    }
};

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
    CREATE TABLE IF NOT EXISTS work_registry_sync_meta (
        projectId TEXT PRIMARY KEY,
        lastSyncDate TEXT NOT NULL,
        updatedAt TEXT NOT NULL
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
    CREATE TABLE IF NOT EXISTS order_invoice_email_templates (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS maintenance_settlement_email_templates (
        projectId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS maintenance_invoice_email_templates (
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
    CREATE TABLE IF NOT EXISTS procedures (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        data TEXT NOT NULL
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
        periodMonths INTEGER NOT NULL DEFAULT 1,
        netAmount REAL NOT NULL,
        vatRate REAL NOT NULL,
        grossAmount REAL NOT NULL,
        notes TEXT,
        settlementFlow TEXT,
        invoiceFlow TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_settlement_entries (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        externalId TEXT NOT NULL,
        requester TEXT NOT NULL,
        requestDate TEXT NOT NULL,
        requestChannel TEXT,
        module TEXT,
        title TEXT NOT NULL,
        youtrackIssueUrl TEXT,
        details TEXT,
        priority TEXT NOT NULL,
        teamEstimatedHours REAL NOT NULL DEFAULT 0,
        marginPercent REAL NOT NULL DEFAULT 0,
        estimatedHours REAL NOT NULL DEFAULT 0,
        isEstimated INTEGER NOT NULL DEFAULT 0,
        estimationDate TEXT,
        isAccepted INTEGER NOT NULL DEFAULT 0,
        acceptanceDate TEXT,
        acceptedBy TEXT,
        acceptanceChannel TEXT,
        preAcceptanceWorkHours REAL NOT NULL DEFAULT 0,
        preAcceptanceWorkDescription TEXT,
        isInProgress INTEGER NOT NULL DEFAULT 0,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        isSentToSettlement INTEGER NOT NULL DEFAULT 0,
        isSettled INTEGER NOT NULL DEFAULT 0,
        evidenceImageDataUrl TEXT,
        evidenceImageName TEXT,
        notes TEXT,
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
    CREATE TABLE IF NOT EXISTS daily_ai_skipped_issue_states (
        issueId TEXT PRIMARY KEY,
        skipInAi INTEGER NOT NULL DEFAULT 0,
        updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_ai_analyses (
        id TEXT PRIMARY KEY,
        hubId TEXT NOT NULL,
        projectCodes TEXT NOT NULL DEFAULT '[]',
        dateFrom TEXT NOT NULL,
        dateTo TEXT NOT NULL,
        originalContent TEXT NOT NULL,
        currentContent TEXT NOT NULL,
        issueTitles TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
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
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN isInProgress INTEGER NOT NULL DEFAULT 0'); } catch (e) { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN youtrackIssueUrl TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN teamEstimatedHours REAL NOT NULL DEFAULT 0'); } catch (e) { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN marginPercent REAL NOT NULL DEFAULT 0'); } catch (e) { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN acceptedBy TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN evidenceImageDataUrl TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN evidenceImageName TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE procedures ADD COLUMN projectId TEXT'); } catch (e) { }
try { db.exec(`ALTER TABLE daily_ai_analyses ADD COLUMN issueTitles TEXT NOT NULL DEFAULT '{}'`); } catch (e) { }
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

db.exec(`
    CREATE TABLE IF NOT EXISTS service_obligations (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        kind TEXT NOT NULL,
        scheduleType TEXT NOT NULL,
        intervalValue INTEGER,
        relativeValue INTEGER,
        relativeUnit TEXT,
        fixedDate TEXT,
        anchorDate TEXT,
        triggerLabel TEXT,
        owner TEXT,
        evidenceHint TEXT,
        notes TEXT,
        sourceRequirement TEXT,
        requiresProtocol INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_tasks (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        obligationId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        dueDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        completedAt TEXT,
        sourceType TEXT NOT NULL,
        sourceEventId TEXT,
        notes TEXT,
        notifiedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_events (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        obligationId TEXT,
        eventType TEXT NOT NULL,
        title TEXT NOT NULL,
        occurredAt TEXT NOT NULL,
        dueDate TEXT,
        reference TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_service_obligations_project ON service_obligations(projectId, isActive);
    CREATE INDEX IF NOT EXISTS idx_service_tasks_project_due ON service_tasks(projectId, dueDate);
    CREATE INDEX IF NOT EXISTS idx_service_tasks_status ON service_tasks(status, dueDate);
    CREATE INDEX IF NOT EXISTS idx_service_events_project_date ON service_events(projectId, occurredAt);
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
        CREATE TABLE IF NOT EXISTS work_registry_sync_meta (
            projectId TEXT PRIMARY KEY,
            lastSyncDate TEXT NOT NULL,
            updatedAt TEXT NOT NULL
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
        CREATE TABLE IF NOT EXISTS order_invoice_email_templates (
            projectId TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS maintenance_settlement_email_templates (
            projectId TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS maintenance_invoice_email_templates (
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
        CREATE TABLE IF NOT EXISTS procedures (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            title TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            data TEXT NOT NULL
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
            periodMonths INTEGER NOT NULL DEFAULT 1,
            netAmount REAL NOT NULL,
            vatRate REAL NOT NULL,
            grossAmount REAL NOT NULL,
            notes TEXT,
            settlementFlow TEXT,
            invoiceFlow TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pending_settlement_entries (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            externalId TEXT NOT NULL,
            requester TEXT NOT NULL,
            requestDate TEXT NOT NULL,
            requestChannel TEXT,
            module TEXT,
            title TEXT NOT NULL,
            youtrackIssueUrl TEXT,
            details TEXT,
            priority TEXT NOT NULL,
            teamEstimatedHours REAL NOT NULL DEFAULT 0,
            marginPercent REAL NOT NULL DEFAULT 0,
            estimatedHours REAL NOT NULL DEFAULT 0,
            isEstimated INTEGER NOT NULL DEFAULT 0,
            estimationDate TEXT,
            isAccepted INTEGER NOT NULL DEFAULT 0,
            acceptanceDate TEXT,
            acceptedBy TEXT,
            acceptanceChannel TEXT,
            preAcceptanceWorkHours REAL NOT NULL DEFAULT 0,
            preAcceptanceWorkDescription TEXT,
            isInProgress INTEGER NOT NULL DEFAULT 0,
            isCompleted INTEGER NOT NULL DEFAULT 0,
            isSentToSettlement INTEGER NOT NULL DEFAULT 0,
            isSettled INTEGER NOT NULL DEFAULT 0,
            evidenceImageDataUrl TEXT,
            evidenceImageName TEXT,
            notes TEXT,
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
        CREATE TABLE IF NOT EXISTS daily_ai_skipped_issue_states (
            issueId TEXT PRIMARY KEY,
            skipInAi INTEGER NOT NULL DEFAULT 0,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS daily_ai_analyses (
            id TEXT PRIMARY KEY,
            hubId TEXT NOT NULL,
            projectCodes TEXT NOT NULL DEFAULT '[]',
            dateFrom TEXT NOT NULL,
            dateTo TEXT NOT NULL,
            originalContent TEXT NOT NULL,
            currentContent TEXT NOT NULL,
            issueTitles TEXT NOT NULL DEFAULT '{}',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
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
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN isInProgress INTEGER NOT NULL DEFAULT 0'); } catch { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN youtrackIssueUrl TEXT'); } catch { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN teamEstimatedHours REAL NOT NULL DEFAULT 0'); } catch { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN marginPercent REAL NOT NULL DEFAULT 0'); } catch { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN acceptedBy TEXT'); } catch { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN evidenceImageDataUrl TEXT'); } catch { }
try { db.exec('ALTER TABLE pending_settlement_entries ADD COLUMN evidenceImageName TEXT'); } catch { }
try { db.exec('ALTER TABLE procedures ADD COLUMN projectId TEXT'); } catch { }
try { db.exec(`ALTER TABLE daily_ai_analyses ADD COLUMN issueTitles TEXT NOT NULL DEFAULT '{}'`); } catch { }
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
        ensureMaintenanceEntryFlowColumns();
    } catch (error) {
        console.error('BÄąâ€šĂ„â€¦d migracji kolumn flow utrzymania:', error);
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS service_obligations (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            kind TEXT NOT NULL,
            scheduleType TEXT NOT NULL,
            intervalValue INTEGER,
            relativeValue INTEGER,
            relativeUnit TEXT,
            fixedDate TEXT,
            anchorDate TEXT,
            triggerLabel TEXT,
            owner TEXT,
            evidenceHint TEXT,
            notes TEXT,
            sourceRequirement TEXT,
            requiresProtocol INTEGER NOT NULL DEFAULT 0,
            isActive INTEGER NOT NULL DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS service_tasks (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            obligationId TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            dueDate TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            completedAt TEXT,
            sourceType TEXT NOT NULL,
            sourceEventId TEXT,
            notes TEXT,
            notifiedAt TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS service_events (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            obligationId TEXT,
            eventType TEXT NOT NULL,
            title TEXT NOT NULL,
            occurredAt TEXT NOT NULL,
            dueDate TEXT,
            reference TEXT,
            notes TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_service_obligations_project ON service_obligations(projectId, isActive);
        CREATE INDEX IF NOT EXISTS idx_service_tasks_project_due ON service_tasks(projectId, dueDate);
        CREATE INDEX IF NOT EXISTS idx_service_tasks_status ON service_tasks(status, dueDate);
        CREATE INDEX IF NOT EXISTS idx_service_events_project_date ON service_events(projectId, occurredAt);
    `);
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
            label: 'Poka\u017c',
            click: () => showMainWindow(),
        },
        {
            type: 'separator',
        },
        {
            label: 'Wyjd\u017a',
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
    startServiceTaskRunner();

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
    stopServiceTaskRunner();
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

        const response = await fetchYouTrackResponse(urlObj.toString(), fetchOptions);

        if (!response.ok) {
            const responseText = await response.text();
            const error = new Error(`YouTrack API ${response.status} ${response.statusText}: ${responseText}`);
            (error as Error & { status?: number; statusText?: string }).status = response.status;
            (error as Error & { status?: number; statusText?: string }).statusText = response.statusText;
            throw error;
        }

        if (responseType === 'arraybuffer') {
            const buffer = await response.arrayBuffer();
            return Buffer.from(buffer);
        }

        return await response.json();
    } catch (error: unknown) {
        const message = getNetworkErrorMessage(error);
        console.error(`BĹ‚Ä…d zapytania fetch-youtrack do ${url}:`, error);
        throw new Error(message);
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

ipcMain.handle('get-work-registry-sync-meta', async (_, projectId: string) => {
    try {
        return db.prepare('SELECT projectId, lastSyncDate, updatedAt FROM work_registry_sync_meta WHERE projectId = ?').get(projectId) || null;
    } catch (error) {
        console.error('Błąd pobierania metadanych synchronizacji rejestru pracy:', error);
        throw error;
    }
});

ipcMain.handle('save-work-registry-sync-meta', async (_, { projectId, lastSyncDate }: { projectId: string; lastSyncDate: string }) => {
    try {
        const updatedAt = new Date().toISOString();
        db.prepare(`
            INSERT INTO work_registry_sync_meta (projectId, lastSyncDate, updatedAt)
            VALUES (?, ?, ?)
            ON CONFLICT(projectId) DO UPDATE SET
                lastSyncDate = excluded.lastSyncDate,
                updatedAt = excluded.updatedAt
        `).run(projectId, lastSyncDate, updatedAt);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu metadanych synchronizacji rejestru pracy:', error);
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

ipcMain.handle('replace-work-items-for-period', async (_, { items, projectId, dateFrom, dateTo }: { items: any[], projectId: string, dateFrom: string, dateTo: string }) => {
    try {
        const fromDate = new Date(`${dateFrom}T00:00:00`);
        const toDate = new Date(`${dateTo}T23:59:59.999`);
        const fromIso = fromDate.toISOString();
        const toIso = toDate.toISOString();
        const fromMs = fromDate.getTime();
        const toMs = toDate.getTime();

        const transaction = db.transaction(() => {
            db.prepare(`
                DELETE FROM work_items
                WHERE projectId = ?
                  AND (
                    (date >= ? AND date <= ?)
                    OR (datetime(date) IS NOT NULL AND datetime(date) >= datetime(?) AND datetime(date) <= datetime(?))
                    OR (CAST(date AS INTEGER) >= ? AND CAST(date AS INTEGER) <= ?)
                    OR (substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?)
                  )
            `).run(projectId, fromIso, toIso, fromIso, toIso, fromMs, toMs, dateFrom, dateTo);

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
        console.error('Błąd zastępowania work_items dla zakresu:', error);
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

ipcMain.handle('write-clipboard-html', async (_, payload: { html: string; text?: string; imageDataUrl?: string }) => {
    try {
        const { clipboard } = electron;
        clipboard.write({
            html: payload?.html || '',
            text: payload?.text || '',
        });
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
const serviceTaskCheckIntervalMs = 15 * 60 * 1000;
const serviceUpcomingAlertWindowDays = 7;
let serviceTaskRunner: NodeJS.Timeout | null = null;
let serviceTaskRunnerInProgress = false;

const padTimePart = (value: number) => String(value).padStart(2, '0');

const createEntityId = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;
const serviceObligationTemplateFileName = 'obowiazki-szablon.json';
const defaultServiceObligationTemplate: Array<Partial<ServiceObligation>> = [
    {
        code: 'OB-001',
        title: 'Comiesięczny raport obsługi',
        description: 'Przygotowanie i przekazanie raportu z wykonanych działań w projekcie.',
        kind: 'recurring',
        scheduleType: 'monthly',
        anchorDate: '2026-01-01',
        owner: 'PM / Service Manager',
        evidenceHint: 'Raport przekazany do klienta',
        sourceRequirement: 'Przykładowy obowiązek cykliczny',
        requiresProtocol: false,
        isActive: true,
    },
    {
        code: 'OB-002',
        title: 'Przegląd kwartalny dokumentacji',
        description: 'Weryfikacja zgodności dokumentacji projektowej z aktualnym stanem rozwiązania.',
        kind: 'recurring',
        scheduleType: 'quarterly',
        anchorDate: '2026-01-01',
        owner: 'Lider techniczny',
        evidenceHint: 'Checklist / protokół przeglądu',
        sourceRequirement: 'Przykładowy obowiązek okresowy',
        requiresProtocol: true,
        isActive: true,
    },
    {
        code: 'OB-003',
        title: 'Instalacja poprawki bezpieczeństwa',
        description: 'Realizacja działania w określonym terminie od momentu wydania poprawki przez producenta.',
        kind: 'event',
        scheduleType: 'relative',
        relativeValue: 3,
        relativeUnit: 'business_days',
        triggerLabel: 'Wydanie poprawki bezpieczeństwa',
        owner: 'Administrator / DevOps',
        evidenceHint: 'Potwierdzenie wdrożenia poprawki',
        sourceRequirement: 'Przykładowy obowiązek od zdarzenia',
        requiresProtocol: false,
        isActive: true,
    },
];

const getDateKey = (date: Date) =>
    `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;

const getTimeKey = (date: Date) =>
    `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;

const normalizeOptionalScheduledTaskNumber = (value: unknown, fallback: number | null = null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return value;
};

const normalizeScheduledTask = (task: ScheduledTask): ScheduledTask => ({
    ...task,
    isActive: task.isActive ?? true,
    actionType: task.actionType === 'daily_ai' ? 'daily_ai' : 'email',
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
    aiSystemInstruction: task.aiSystemInstruction || '',
    aiSettings: {
        model: task.aiSettings?.model || '',
        temperature: normalizeOptionalScheduledTaskNumber(task.aiSettings?.temperature, 0.2),
        topP: normalizeOptionalScheduledTaskNumber(task.aiSettings?.topP),
        topK: normalizeOptionalScheduledTaskNumber(task.aiSettings?.topK),
        maxOutputTokens: normalizeOptionalScheduledTaskNumber(task.aiSettings?.maxOutputTokens, DEFAULT_SCHEDULED_TASK_MAX_OUTPUT_TOKENS),
        generationConfigText: task.aiSettings?.generationConfigText || '',
        additionalRequestFieldsText: task.aiSettings?.additionalRequestFieldsText || '',
    },
    contentSources: (task.contentSources || []).map((source) => ({
        ...source,
        type: 'daily',
        hubId: source.hubId || '',
        sectionIds: Array.isArray(source.sectionIds) ? source.sectionIds : [],
    })),
});

ipcMain.handle('ask-gemini', async (_, request: GeminiGenerateRequest) => {
    try {
        if (!request?.prompt?.trim()) {
            throw new Error('Prompt do Gemini nie może być pusty.');
        }

        return await generateGeminiContent({
            ...request,
            prompt: request.prompt.trim(),
            systemInstruction: request.systemInstruction?.trim(),
        });
    } catch (error: any) {
        console.error('Błąd zapytania ask-gemini:', error);
        throw error;
    }
});

ipcMain.handle('export-daily-ai-to-clickup', async (_, request: ClickUpDailyExportRequest) => {
    try {
        return await exportDailyAiToClickUp(request);
    } catch (error: any) {
        console.error('Błąd eksportu Daily AI do ClickUp:', error);
        throw error;
    }
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

const getProjectDailyHubId = (projectId: string) => `project_daily_${projectId}`;

const getDailyProjectHubById = (hubId: string): DailyHub | null => {
    const projectId = hubId.startsWith('project_daily_')
        ? hubId.slice('project_daily_'.length)
        : '';
    if (!projectId) return null;

    const row = db.prepare('SELECT data FROM projects WHERE id = ?').get(projectId) as { data: string } | undefined;
    if (!row) return null;

    try {
        const project = JSON.parse(row.data) as { id?: string; code?: string; name?: string };
        const projectCode = String(project.code || '').trim().toUpperCase();
        if (!projectCode) return null;

        return {
            id: getProjectDailyHubId(projectId),
            name: `Projekt: ${projectCode}${project.name ? ` — ${project.name}` : ''}`,
            description: 'Projektowe Daily dostępne z zakładki projektu.',
            projectCodes: projectCode,
        };
    } catch {
        return null;
    }
};

const getDailyHubById = (hubId: string): DailyHub | null => {
    const projectDailyHub = getDailyProjectHubById(hubId);
    if (projectDailyHub) return projectDailyHub;

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

const getDailyAiSkippedIssueMap = (): Record<string, boolean> => {
    const rows = db.prepare('SELECT issueId, skipInAi FROM daily_ai_skipped_issue_states WHERE skipInAi = 1').all() as { issueId: string; skipInAi: number }[];
    return rows.reduce<Record<string, boolean>>((acc, row) => {
        acc[row.issueId] = row.skipInAi === 1;
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

    const response = await fetchYouTrackResponse(url.toString(), {
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

const linkifyScheduledEmailText = (value: string, issueTitles?: Record<string, string>) => {
    const escaped = escapeHtml(value);
    return escaped
        .replace(/\b[A-Z][A-Z0-9]+-\d+\b/g, (issueCode) => {
            const issueUrl = buildYouTrackIssueUrl(issueCode);
            const title = issueTitles?.[issueCode] || issueTitles?.[issueCode.toUpperCase()];
            const label = title ? `${issueCode} - ${title}` : issueCode;
            if (!issueUrl) return escapeHtml(label);
            return `<a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5; font-weight:800; text-decoration:none;">${escapeHtml(label)}</a>`;
        })
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code style="padding:1px 5px; border-radius:6px; background:#eef2ff; color:#3730a3; font-family:Consolas,monospace; font-size:12px;">$1</code>');
};

const parseScheduledIssueListItem = (value: string, issueTitles?: Record<string, string>) => {
    const trimmed = value.trim();
    const match = trimmed.match(/^([A-Z][A-Z0-9]+-\d+)(?:\s*[-–—:]\s*([^:]+?))?(?::|\s-\s)?\s*(.*)$/);
    if (!match) return null;

    const issueCode = match[1];
    const titleFromText = (match[2] || '').trim();
    const mappedTitle = issueTitles?.[issueCode] || issueTitles?.[issueCode.toUpperCase()] || '';
    const title = titleFromText || mappedTitle;
    const duplicatedPrefix = title ? `${issueCode} - ${title}` : issueCode;
    let description = (match[3] || '').trim();

    if (description.startsWith(duplicatedPrefix)) {
        description = description.slice(duplicatedPrefix.length).replace(/^[:\s-]+/, '').trim();
    }
    if (title && description.startsWith(title)) {
        description = description.slice(title.length).replace(/^[:\s-]+/, '').trim();
    }

    return {
        issueCode,
        title,
        description,
    };
};

const renderScheduledIssueListItemHtml = (value: string, issueTitles?: Record<string, string>) => {
    const parsed = parseScheduledIssueListItem(value, issueTitles);
    if (!parsed) {
        return `<li style="margin:0 0 10px 0; font-size:14px; line-height:1.65;">${linkifyScheduledEmailText(value, issueTitles)}</li>`;
    }

    const issueUrl = buildYouTrackIssueUrl(parsed.issueCode);
    const codeHtml = issueUrl
        ? `<a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:4px 8px; border-radius:8px; background:#eef2ff; color:#4f46e5; font-family:Consolas,'Courier New',monospace; font-size:12px; font-weight:900; text-decoration:none; border:1px solid rgba(79,70,229,0.14);">${escapeHtml(parsed.issueCode)}</a>`
        : `<span style="display:inline-block; padding:4px 8px; border-radius:8px; background:#eef2ff; color:#4f46e5; font-family:Consolas,'Courier New',monospace; font-size:12px; font-weight:900; border:1px solid rgba(79,70,229,0.14);">${escapeHtml(parsed.issueCode)}</span>`;

    return `
        <li style="display:block; margin:0 0 12px 0; padding:12px 14px; border:1px solid #e2e8f0; border-radius:12px; background:#ffffff; box-shadow:0 6px 18px rgba(15,23,42,0.05); list-style:none;">
            <div style="display:flex; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:${parsed.description ? '8px' : '0'};">
                ${codeHtml}
                <div style="flex:1; min-width:220px; font-size:14px; line-height:1.45; font-weight:900; color:#0f172a;">
                    ${escapeHtml(parsed.title || parsed.issueCode)}
                </div>
            </div>
            ${parsed.description ? `<div style="font-size:13px; line-height:1.65; color:#475569;">${linkifyScheduledEmailText(parsed.description, issueTitles)}</div>` : ''}
        </li>
    `;
};

const markdownToScheduledEmailHtml = (value: string, issueTitles?: Record<string, string>) => {
    const lines = value.replace(/\r\n/g, '\n').split('\n');
    const blocks: string[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushParagraph = () => {
        if (!paragraphLines.length) return;
        blocks.push(`<p style="margin:0 0 14px 0; font-size:14px; line-height:1.7; color:#334155;">${paragraphLines.map((line) => linkifyScheduledEmailText(line, issueTitles)).join('<br />')}</p>`);
        paragraphLines = [];
    };

    const flushList = () => {
        if (!listType || !listItems.length) return;
        const tag = listType;
        blocks.push(`<${tag} style="margin:0 0 16px 0; padding-left:0; color:#334155; list-style:none;">${listItems.join('')}</${tag}>`);
        listItems = [];
        listType = null;
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();

        if (!line) {
            flushParagraph();
            flushList();
            return;
        }

        if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
            flushParagraph();
            flushList();
            blocks.push('<hr style="margin:18px 0; border:0; border-top:1px solid #e2e8f0;" />');
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            const fontSize = level <= 2 ? 18 : 15;
            const color = level <= 2 ? '#0f172a' : '#334155';
            blocks.push(`<h${Math.min(level + 1, 6)} style="margin:18px 0 10px 0; font-size:${fontSize}px; line-height:1.35; font-weight:900; color:${color};">${linkifyScheduledEmailText(headingMatch[2], issueTitles)}</h${Math.min(level + 1, 6)}>`);
            return;
        }

        const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (orderedMatch) {
            flushParagraph();
            if (listType && listType !== 'ol') flushList();
            listType = 'ol';
            listItems.push(renderScheduledIssueListItemHtml(orderedMatch[2], issueTitles));
            return;
        }

        const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
        if (unorderedMatch) {
            flushParagraph();
            if (listType && listType !== 'ul') flushList();
            listType = 'ul';
            listItems.push(renderScheduledIssueListItemHtml(unorderedMatch[1], issueTitles));
            return;
        }

        flushList();
        paragraphLines.push(line);
    });

    flushParagraph();
    flushList();

    return blocks.join('');
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
                actionType: task.actionType,
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
            ? ` - ${sanitizedWorkComments.join(', ')}`
            : '';
        return `${activity.author.name}: Dodał log czasu ${formatDailyMinutes(activity.minutes || 0)}${commentSuffix}`;
    }
    if (activity.type === 'issue-created') {
        return `${activity.author.name}: Utworzono zadanie`;
    }
    return `${activity.author.name}: ${activity.added || activity.text || 'Aktualizacja'}`;
};

const anonymizeDailyDisplayName = (value?: string | null) => {
    if (!value) return null;
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const pruneScheduledDailyJson = (value: unknown): unknown => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        const next = value
            .map((item) => pruneScheduledDailyJson(item))
            .filter((item) => item !== undefined);
        return next.length ? next : undefined;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .map(([key, item]) => [key, pruneScheduledDailyJson(item)] as const)
            .filter(([, item]) => item !== undefined);
        return entries.length ? Object.fromEntries(entries) : undefined;
    }
    return value;
};

const pendingSettlementEntrySelectSql = `
    SELECT
        id,
        projectId,
        externalId,
        requester,
        requestDate,
        requestChannel,
        module,
        title,
        youtrackIssueUrl,
        details,
        priority,
        teamEstimatedHours,
        marginPercent,
        estimatedHours,
        isEstimated,
        estimationDate,
        isAccepted,
        acceptanceDate,
        acceptedBy,
        acceptanceChannel,
        preAcceptanceWorkHours,
        preAcceptanceWorkDescription,
        isInProgress,
        isCompleted,
        isSentToSettlement,
        isSettled,
        evidenceImageDataUrl,
        evidenceImageName,
        notes,
        createdAt,
        updatedAt
    FROM pending_settlement_entries
`;

const mapPendingSettlementEntryRow = (row: any): PendingSettlementEntry => ({
    ...row,
    teamEstimatedHours: Number(row.teamEstimatedHours) || 0,
    marginPercent: Number(row.marginPercent) || 0,
    estimatedHours: Number(row.estimatedHours) || 0,
    isEstimated: row.isEstimated === 1,
    isAccepted: row.isAccepted === 1,
    preAcceptanceWorkHours: Number(row.preAcceptanceWorkHours) || 0,
    isInProgress: row.isInProgress === 1,
    isCompleted: row.isCompleted === 1,
    isSentToSettlement: row.isSentToSettlement === 1,
    isSettled: row.isSettled === 1,
});

const extractYouTrackIssueId = (value?: string | null) => {
    const match = value?.match(/\b[A-Z][A-Z0-9]+-\d+\b/i);
    return match ? match[0].toUpperCase() : null;
};

const resolvePendingSettlementStatus = (entry: PendingSettlementEntry) => {
    if (entry.isSettled) return 'settled';
    if (entry.isSentToSettlement) return 'sentToSettlement';
    if (entry.isCompleted) return 'completed';
    if (entry.isInProgress) return 'inProgress';
    if (entry.isAccepted) return 'accepted';
    if (entry.isEstimated) return 'estimated';
    return 'new';
};

const serializePendingSettlementEntryForDailyAi = (entry: PendingSettlementEntry) => ({
    id: entry.id,
    externalId: entry.externalId,
    title: entry.title,
    module: entry.module,
    priority: entry.priority,
    status: resolvePendingSettlementStatus(entry),
    request: {
        requester: anonymizeDailyDisplayName(entry.requester),
        date: entry.requestDate,
        channel: entry.requestChannel,
    },
    estimation: {
        isEstimated: entry.isEstimated,
        teamEstimatedHours: entry.teamEstimatedHours,
        marginPercent: entry.marginPercent,
        estimatedHours: entry.estimatedHours,
        date: entry.estimationDate || null,
    },
    acceptance: {
        isAccepted: entry.isAccepted,
        acceptedBy: anonymizeDailyDisplayName(entry.acceptedBy || null),
        date: entry.acceptanceDate || null,
        channel: entry.acceptanceChannel || null,
    },
    preAcceptanceWork: {
        hours: entry.preAcceptanceWorkHours,
        description: entry.preAcceptanceWorkDescription,
    },
    flags: {
        isInProgress: entry.isInProgress,
        isCompleted: entry.isCompleted,
        isSentToSettlement: entry.isSentToSettlement,
        isSettled: entry.isSettled,
    },
    notes: entry.notes || null,
});

const getPendingSettlementEntriesByIssueId = () => {
    const entries = db.prepare(`${pendingSettlementEntrySelectSql} ORDER BY requestDate DESC, createdAt DESC`)
        .all()
        .map(mapPendingSettlementEntryRow);
    const entriesByIssueId = new Map<string, PendingSettlementEntry[]>();

    entries.forEach((entry) => {
        const issueId = extractYouTrackIssueId(entry.youtrackIssueUrl || entry.externalId || entry.title);
        if (!issueId) return;
        entriesByIssueId.set(issueId, [...(entriesByIssueId.get(issueId) || []), entry]);
    });

    return entriesByIssueId;
};

const shouldIncludeDailyActivity = (activity: DailyReportIssue['timeline'][number]) => {
    if (activity.type === 'comment') return true;
    if (activity.type === 'work-item') return true;
    if (activity.type === 'field-change') {
        const fieldName = (activity.field || '').trim().toLowerCase();
        if (!fieldName || !(activity.added || activity.removed)) return false;
        if (fieldName.includes('spent time')) return false;
        return true;
    }
    return activity.type === 'issue-created';
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
    skippedInAiIssues: Record<string, boolean>;
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
        skippedInAiIssues: getDailyAiSkippedIssueMap(),
        activityIssues,
        boardIssues,
        activityIssueIds,
        projectOrder: hub.projectCodes.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean),
    };
};

const renderDailyIssueLines = (issue: DailyReportIssue, comments: Record<string, string>, includeActivities: boolean, dateFrom: string, dateTo: string) => {
    const lines = [`- ${issue.idReadable} - ${issue.summary}`];
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
        const periodActivities = issue.timeline.filter((activity) =>
            activity.timestamp >= fromTime
            && activity.timestamp <= toTime
            && shouldIncludeDailyActivity(activity),
        );

        if (periodActivities.length > 0) {
            lines.push('  Aktywność:');
            periodActivities.forEach((activity) => {
                lines.push(`    - ${formatTimelineActivity(activity)}`);
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
            return shouldIncludeDailyActivity(activity);
        })
        : [];
    const commentActivities = periodActivities.filter((activity) => activity.type === 'comment');
    const visibleActivities = periodActivities.filter((activity) => activity.type !== 'comment');

    const activityHtml = includeActivities && visibleActivities.length > 0
        ? `
            <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(148,163,184,0.22);">
                <div style="margin-bottom:8px; font-size:10px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:#94a3b8;">
                    Aktywnosc (${visibleActivities.length})
                </div>
                ${visibleActivities.map((activity) => `
                    <div style="display:flex; gap:7px; align-items:flex-start; margin-top:0; margin-bottom:6px;">
                        <span style="display:inline-block; width:6px; height:6px; margin-top:5px; border-radius:999px; background:#818cf8;"></span>
                        <div style="font-size:11px; line-height:1.45; color:#64748b;">${formatTimelineActivityHtml(activity)}</div>
                    </div>
                `).join('')}
            </div>
        `
        : '';
    const commentsHtml = includeActivities && commentActivities.length > 0
        ? `
            <div style="margin-top:10px; padding:8px 10px; border:1px solid rgba(148,163,184,0.24); border-radius:10px; background:#f8fafc;">
                <div style="margin-bottom:8px; font-size:10px; font-weight:900; letter-spacing:0.14em; text-transform:uppercase; color:#64748b;">
                    Komentarze (${commentActivities.length})
                </div>
                ${commentActivities.map((activity) => `
                    <div style="margin-bottom:6px; padding:7px 8px; border-radius:9px; background:#ffffff; border:1px solid rgba(226,232,240,0.9);">
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
        <div style="margin-bottom:12px; border:1px solid rgba(148,163,184,0.18); border-radius:14px; overflow:hidden; background:#ffffff; box-shadow:0 10px 28px rgba(15,23,42,0.08);">
            <div style="padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.18); background:#f8fafc;">
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
            <div style="padding:10px 10px 10px 10px;">
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
                    <div style="margin-top:10px; padding:8px; border:1px solid rgba(251,191,36,0.24); border-radius:10px; background:#fffbeb;">
                        <div style="margin-bottom:5px; font-size:10px; font-weight:900; letter-spacing:0.14em; text-transform:uppercase; color:#d97706;">Brudnopis PM</div>
                        <div style="font-size:12px; line-height:1.55; color:#92400e;">${escapeHtml(comment)}</div>
                    </div>
                ` : ''}
                ${activityHtml}
                ${commentsHtml}
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px;">
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
                    <div style="display:block; width:100%; margin-bottom:12px; padding:10px; border:1px solid rgba(99,102,241,0.14); border-radius:14px; background:linear-gradient(180deg, rgba(238,242,255,0.92) 0%, rgba(255,255,255,0.98) 100%); box-sizing:border-box;">
                        <div style="display:block; width:100%; margin-bottom:10px; padding:10px 12px; border-radius:12px; background:linear-gradient(135deg, #4338ca 0%, #6366f1 100%); box-shadow:0 10px 24px rgba(79,70,229,0.22); box-sizing:border-box;">
                            <div style="font-size:11px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:rgba(255,255,255,0.78);">Projekt</div>
                            <div style="margin-top:4px; font-size:20px; font-weight:900; letter-spacing:0.08em; color:#ffffff;">${escapeHtml(projectCode)}</div>
                        </div>
                        <div style="height:3px; margin:0 0 10px 0; border-radius:999px; background:linear-gradient(90deg, #4338ca 0%, #a5b4fc 100%);"></div>
                        ${projectIssues.map((issue) => renderDailyIssueCardHtml(issue, comments, section.id === 'fixed_aktywnosci', from, to)).join('')}
                    </div>
                `;
            }).join('')
            : `
                <div style="padding:20px 12px; text-align:center; border:1px dashed rgba(148,163,184,0.28); border-radius:12px; background:rgba(255,255,255,0.48);">
                    <span style="font-size:10px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:#94a3b8;">Brak</span>
                </div>
            `;

        return `
            <section style="margin:0 0 20px 0;">
                ${section.id === 'fixed_aktywnosci' ? '' : `
                <div style="margin-bottom:10px;">
                    <div style="display:block; width:100%; padding:10px 12px; border-radius:12px; background:linear-gradient(135deg, #e0e7ff 0%, #eef2ff 100%); box-shadow:inset 0 0 0 1px rgba(99,102,241,0.10); box-sizing:border-box;">
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
        <section style="margin:0 0 20px 0; padding:14px; border-radius:18px; background:linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border:1px solid rgba(148,163,184,0.18); box-shadow:0 16px 44px rgba(15,23,42,0.08);">
            <div style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid rgba(148,163,184,0.22);">
                <div style="margin-bottom:8px; font-size:28px; font-weight:900; line-height:1.15; color:#0f172a;">Daily Stand-up Command Center</div>
                <div style="margin-bottom:10px; font-size:18px; font-weight:800; color:#334155;">${escapeHtml(hub.name)}</div>
                <div style="margin-bottom:14px; font-size:13px; color:#64748b;">Zakres: <strong style="color:#334155;">${escapeHtml(from)}</strong> -> <strong style="color:#334155;">${escapeHtml(to)}</strong></div>
            </div>
            <div style="display:block; width:100%; margin:0 0 14px 0; padding:10px 12px; border-radius:14px; background:linear-gradient(135deg, #020617 0%, #334155 100%); box-shadow:0 14px 28px rgba(15,23,42,0.22); box-sizing:border-box;">
                <div style="font-size:11px; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; color:rgba(255,255,255,0.72);">Sekcja startowa</div>
                <div style="margin-top:4px; font-size:22px; font-weight:900; letter-spacing:0.08em; color:#ffffff;">AKTYWNOŚCI</div>
            </div>
            <div style="display:block;">
                ${renderedSectionsHtml}
            </div>
        </section>
    `;
};

const getScheduledDailySectionIssues = (
    section: DailySection,
    activityIssues: DailyReportIssue[],
    boardIssues: DailyReportIssue[],
    activityIssueIds: Set<string>,
    skippedInAiIssues: Record<string, boolean>,
) => {
    return (section.id === 'fixed_aktywnosci' ? activityIssues : boardIssues).filter((issue) => {
        if (skippedInAiIssues[issue.idReadable]) return false;
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
};

const buildScheduledDailyAiPayload = (
    task: ScheduledTask,
    source: ScheduledTaskContentSource,
    executionDate: Date,
    payload: DailyContentSourcePayload,
) => {
    const { hub, sections, from, to, comments, skippedInAiIssues, activityIssues, boardIssues, activityIssueIds } = payload;
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    const toTime = new Date(`${to}T23:59:59`).getTime();
    const issuesById = new Map<string, DailyReportIssue>();
    const currentSectionByIssue = new Map<string, DailySection>();
    const pendingSettlementEntriesByIssueId = getPendingSettlementEntriesByIssueId();

    const sectionSummaries = sections.map((section) => {
        const issues = getScheduledDailySectionIssues(section, activityIssues, boardIssues, activityIssueIds, skippedInAiIssues);

        issues.forEach((issue) => {
            if (!issuesById.has(issue.idReadable)) {
                issuesById.set(issue.idReadable, issue);
                currentSectionByIssue.set(issue.idReadable, section);
            }
        });

        return {
            id: section.id,
            name: section.name,
            type: section.id === 'fixed_aktywnosci' ? 'activity' : 'board',
            respectDates: !!section.respectDates,
            configuredStatuses: normalizeDailyStatuses(section.youtrackStatuses),
            issueCount: issues.length,
            issueIds: issues.map((issue) => issue.idReadable),
            issueRefs: issues.map((issue) => ({
                id: issue.idReadable,
                title: issue.summary,
                displayName: `${issue.idReadable} - ${issue.summary}`,
            })),
        };
    });

    const serializedIssues = Array.from(issuesById.values()).map((issue) => {
        const currentSection = currentSectionByIssue.get(issue.idReadable) || null;
        const activitiesInRange = issue.timeline
            .filter((activity) =>
                activity.timestamp >= fromTime
                && activity.timestamp <= toTime
                && shouldIncludeDailyActivity(activity),
            )
            .map((activity) => ({
                type: activity.type,
                timestamp: new Date(activity.timestamp).toISOString(),
                author: anonymizeDailyDisplayName(activity.author?.name || activity.author?.login || null),
                ...(activity.type === 'comment' ? { text: sanitizeDailyCommentText(activity.text) } : {}),
                ...(activity.type === 'field-change'
                    ? { field: activity.field || null, from: activity.removed || null, to: activity.added || null }
                    : {}),
                ...(activity.type === 'work-item'
                    ? { minutes: activity.minutes || 0, comments: activity.workComments || [] }
                    : {}),
            }));

        const pmNote = comments[issue.idReadable]?.trim() || null;
        const pendingSettlementEntries = (pendingSettlementEntriesByIssueId.get(issue.idReadable.toUpperCase()) || [])
            .map(serializePendingSettlementEntryForDailyAi);

        return {
            id: issue.idReadable,
            title: issue.summary,
            displayName: `${issue.idReadable} - ${issue.summary}`,
            projectCode: resolveDailyProjectCode(issue),
            summary: issue.summary,
            currentSection: currentSection
                ? {
                    id: currentSection.id,
                    name: currentSection.name,
                    respectDates: !!currentSection.respectDates,
                    configuredStatuses: normalizeDailyStatuses(currentSection.youtrackStatuses),
                }
                : null,
            state: issue.state?.name || null,
            type: issue.type?.name || null,
            priority: issue.priority?.name || null,
            assignee: anonymizeDailyDisplayName(issue.assignee?.fullName || issue.assignee?.name || issue.assignee?.login || null),
            spentTime: issue.spentTime || null,
            estimation: issue.estimation || null,
            ...(pendingSettlementEntries.length
                ? {
                    settlement: {
                        isReportedForSettlement: true,
                        count: pendingSettlementEntries.length,
                        isEstimated: pendingSettlementEntries.some((entry) => entry.estimation.isEstimated),
                        isAccepted: pendingSettlementEntries.some((entry) => entry.acceptance.isAccepted),
                        pendingSettlementEntries,
                    },
                }
                : {}),
            isActiveInRange: activityIssueIds.has(issue.idReadable),
            ...(pmNote ? { hasPmNote: true, pmNote } : {}),
            activitiesInRange,
            ...(activitiesInRange.length ? { activityCountInRange: activitiesInRange.length } : {}),
            ...(activitiesInRange.length ? { latestActivityAt: activitiesInRange[activitiesInRange.length - 1].timestamp } : {}),
            url: buildYouTrackIssueUrl(issue.idReadable),
        };
    });

    return pruneScheduledDailyJson({
        generatedAt: executionDate.toISOString(),
        generatedAtLocal: executionDate.toLocaleString('pl-PL'),
        source: {
            id: source.id,
            type: source.type,
        },
        task: {
            id: task.id,
            name: task.name,
            actionType: task.actionType,
        },
        hub: {
            id: hub.id,
            name: hub.name,
            projectCodes: hub.projectCodes.split(',').map((code) => code.trim()).filter(Boolean),
        },
        filters: {
            dateFrom: from,
            dateTo: to,
            selectedSectionIds: source.sectionIds,
            skippedInAiIssueIds: Object.entries(skippedInAiIssues)
                .filter(([, skipped]) => skipped)
                .map(([issueId]) => issueId),
        },
        summary: {
            sections: sectionSummaries.length,
            issues: serializedIssues.length,
            activeIssuesInRange: serializedIssues.filter((issue) => issue.isActiveInRange).length,
            issuesWithPmNotes: serializedIssues.filter((issue) => issue.hasPmNote).length,
            issuesWithPendingSettlement: serializedIssues.filter((issue) => Boolean(issue.settlement)).length,
        },
        issueTitles: Object.fromEntries(serializedIssues.map((issue) => [issue.id, issue.title])),
        sections: sectionSummaries,
        issues: serializedIssues,
    });
};

const appendScheduledDailyAiSystemRules = (systemInstruction: string) => [
    systemInstruction.trim(),
    'W każdej odpowiedzi, gdy wymieniasz zadanie z YouTrack, podawaj kod razem z tytułem w formacie `KOD-123 - Tytuł zadania`. Nie wypisuj samego kodu bez tytułu.',
    'Pisz raport w krótkich sekcjach projektowych. Dla każdego zadania użyj osobnego punktu listy, zaczynając punkt od `KOD-123 - Tytuł zadania:`, a po dwukropku dodaj krótki opis statusu i najważniejszych aktywności. Unikaj bardzo długich akapitów.',
    'Nie pomijaj zadań przekazanych w JSON. Jeżeli zadanie jest widoczne tylko w sekcji planowania lub nie ma aktywności w zakresie dat, nadal uwzględnij je w odpowiedniej sekcji raportu.',
    'Jeżeli zadanie ma pole `settlement`, uwzględnij w opisie informacje z zakładki Do rozliczenia: kto i kiedy zgłosił zadanie, czy zostało wycenione oraz czy zaakceptowano je do realizacji. Nie deanonimizuj osób.',
    'Nie analizuj i nie wspominaj zadań, których nie ma w przekazanym JSON. Zadania oznaczone jako pominięte w AI są usunięte z JSON i mają być traktowane jako niewidoczne.',
].filter(Boolean).join('\n\n');

const parseScheduledTaskJsonObject = (rawValue: string | undefined, fieldLabel: string) => {
    const raw = rawValue?.trim();
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Wartość musi być obiektem JSON.');
        }

        return parsed as Record<string, unknown>;
    } catch (error: any) {
        throw new Error(`Nieprawidłowy JSON w polu "${fieldLabel}": ${error?.message || 'nieznany błąd'}`);
    }
};

const getScheduledTaskAiNumber = (value: unknown, fallback?: number) => (
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const buildScheduledTaskEmailBody = async (task: ScheduledTask, executionDate: Date) => {
    const textBlocks: string[] = [];
    const htmlBlocks: string[] = [];
    const dailyPayloadCache = new Map<string, Promise<DailyContentSourcePayload>>();
    const baseBody = sanitizeScheduledEmailIntro(task.emailTemplate.body);
    if (baseBody) {
        textBlocks.push(baseBody);
        htmlBlocks.push(textToSimpleHtml(baseBody));
    }

    if (task.actionType === 'daily_ai' && !task.aiSystemInstruction?.trim()) {
        throw new Error('Brak promptu systemowego AI w zadaniu harmonogramu.');
    }

    const aiSettings = task.aiSettings || {};
    const aiGenerationConfig = task.actionType === 'daily_ai'
        ? parseScheduledTaskJsonObject(aiSettings.generationConfigText, 'Dodatkowe generationConfig JSON')
        : {};
    const aiAdditionalRequestFields = task.actionType === 'daily_ai'
        ? parseScheduledTaskJsonObject(aiSettings.additionalRequestFieldsText, 'Dodatkowe pola request JSON')
        : {};

    for (const source of task.contentSources || []) {
        if (source.type === 'daily') {
            const cacheKey = `${source.id}:${source.hubId}:${source.sectionIds.join(',')}:${executionDate.toISOString()}`;
            if (!dailyPayloadCache.has(cacheKey)) {
                dailyPayloadCache.set(cacheKey, loadDailyContentSourcePayload(task, source, executionDate));
            }
            const payload = await dailyPayloadCache.get(cacheKey)!;

            if (task.actionType === 'daily_ai') {
                const aiPayload = buildScheduledDailyAiPayload(task, source, executionDate, payload);
                const issueTitles = ((aiPayload as Record<string, unknown>).issueTitles || {}) as Record<string, string>;
                const response = await generateGeminiContent({
                    prompt: JSON.stringify(aiPayload, null, 2),
                    systemInstruction: appendScheduledDailyAiSystemRules(task.aiSystemInstruction || ''),
                    model: aiSettings.model?.trim() || envSettings.geminiModel || DEFAULT_GEMINI_MODEL,
                    generationConfig: aiGenerationConfig,
                    additionalRequestFields: aiAdditionalRequestFields,
                    temperature: getScheduledTaskAiNumber(aiSettings.temperature, 0.2),
                    topP: getScheduledTaskAiNumber(aiSettings.topP),
                    topK: getScheduledTaskAiNumber(aiSettings.topK),
                    maxOutputTokens: getScheduledTaskAiNumber(aiSettings.maxOutputTokens, 12000),
                });
                const analysisText = response.text.trim();
                if (analysisText) {
                    const heading = `Analiza AI: ${payload.hub.name}`;
                    textBlocks.push(`# ${heading}\n\n${analysisText}`);
                    htmlBlocks.push(`
                        <section style="margin:0 auto 20px auto; padding:22px; max-width:960px; color:#0f172a;">
                            <div style="margin-bottom:12px; padding-bottom:14px; border-bottom:1px solid #e2e8f0;">
                                <div style="font-size:22px; font-weight:900; color:#0f172a; line-height:1.25;">${escapeHtml(heading)}</div>
                                <div style="margin-top:8px; font-size:13px; color:#64748b;">Zakres: <strong>${escapeHtml(payload.from)}</strong> -> <strong>${escapeHtml(payload.to)}</strong></div>
                            </div>
                            ${markdownToScheduledEmailHtml(analysisText, issueTitles)}
                        </section>
                    `);
                }

                if (response.finishReason === 'MAX_TOKENS') {
                    const warningText = 'Uwaga: odpowiedź AI osiągnęła limit tokenów. Pełne Daily znajduje się poniżej w wiadomości.';
                    textBlocks.push(warningText);
                    htmlBlocks.push(`
                        <section style="margin:0 auto 20px auto; padding:12px 14px; max-width:960px; border:1px solid #fbbf24; border-radius:10px; background:#fffbeb; color:#92400e; font-size:13px; line-height:1.55;">
                            ${escapeHtml(warningText)}
                        </section>
                    `);
                }

                const fullDailyText = await renderDailyContentSource(task, source, executionDate, payload);
                if (fullDailyText.trim()) {
                    textBlocks.push(`# Pełne Daily: ${payload.hub.name}\n\n${fullDailyText}`);
                }

                const fullDailyHtml = await renderDailyContentSourceHtml(task, source, executionDate, payload);
                if (fullDailyHtml.trim()) {
                    htmlBlocks.push(`
                        <section style="margin:0 auto 20px auto; padding:22px; max-width:960px; color:#0f172a;">
                            <div style="margin-bottom:12px; padding-bottom:14px; border-bottom:1px solid #e2e8f0;">
                                <div style="font-size:22px; font-weight:900; color:#0f172a; line-height:1.25;">Pełne Daily: ${escapeHtml(payload.hub.name)}</div>
                                <div style="margin-top:8px; font-size:13px; color:#64748b;">Zakres: <strong>${escapeHtml(payload.from)}</strong> -> <strong>${escapeHtml(payload.to)}</strong></div>
                            </div>
                            ${fullDailyHtml}
                        </section>
                    `);
                }
            } else {
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
    }

    const htmlBody = htmlBlocks.length > 0
        ? `<!doctype html><html lang="pl"><body style="margin:0; padding:18px; font-family:Arial, Helvetica, sans-serif;"><div style="max-width:1020px; width:100%; margin:0 auto;">${htmlBlocks.join('')}</div></body></html>`
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
        throw new Error('Brak aktywnej autoryzacji Google. Zaloguj się ponownie w ustawieniach aplikacji.');
    }

    const to = task.emailTemplate.to.trim();
    const subject = task.emailTemplate.subject.trim();
    if (!to) {
        throw new Error('Brak odbiorcy wiadomości w harmonogramie.');
    }
    if (!subject) {
        throw new Error('Brak tytułu wiadomości w harmonogramie.');
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

const normalizeServiceObligation = (obligation: ServiceObligation): ServiceObligation => {
    const kind = obligation.kind || 'continuous';
    const scheduleType = kind === 'continuous'
        ? 'none'
        : obligation.scheduleType || 'none';

    return {
        ...obligation,
        code: obligation.code?.trim() || '',
        title: obligation.title?.trim() || '',
        description: obligation.description?.trim() || '',
        kind,
        scheduleType,
        intervalValue: Number(obligation.intervalValue) || 1,
        relativeValue: scheduleType === 'relative' ? (Number(obligation.relativeValue) || 0) : 0,
        relativeUnit: scheduleType === 'relative' ? (obligation.relativeUnit || 'business_days') : 'business_days',
        fixedDate: scheduleType === 'fixed_date' ? (obligation.fixedDate || '') : '',
        anchorDate: ['monthly', 'quarterly', 'semiannual', 'annual'].includes(scheduleType) ? (obligation.anchorDate || '') : '',
        triggerLabel: scheduleType === 'relative' ? (obligation.triggerLabel || '') : '',
        owner: obligation.owner || '',
        evidenceHint: obligation.evidenceHint || '',
        notes: obligation.notes || '',
        sourceRequirement: obligation.sourceRequirement || '',
        requiresProtocol: Boolean(obligation.requiresProtocol),
        isActive: obligation.isActive !== false,
        createdAt: obligation.createdAt || new Date().toISOString(),
        updatedAt: obligation.updatedAt || new Date().toISOString(),
    };
};

const normalizeServiceTask = (task: ServiceTask): ServiceTask => ({
    ...task,
    title: task.title?.trim() || '',
    description: task.description || '',
    status: task.status || 'pending',
    sourceType: task.sourceType || 'schedule',
    notes: task.notes || '',
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
});

const normalizeServiceEvent = (event: ServiceEvent): ServiceEvent => ({
    ...event,
    obligationId: event.obligationId || '',
    eventType: event.eventType || 'other',
    title: event.title?.trim() || '',
    occurredAt: event.occurredAt || new Date().toISOString(),
    dueDate: event.dueDate || '',
    reference: event.reference || '',
    notes: event.notes || '',
    createdAt: event.createdAt || new Date().toISOString(),
    updatedAt: event.updatedAt || new Date().toISOString(),
});

const getProjectLookup = () => {
    const rows = db.prepare('SELECT id, data FROM projects').all() as { id: string; data: string }[];
    return rows.reduce<Record<string, { code?: string; name?: string }>>((acc, row) => {
        try {
            const parsed = JSON.parse(row.data);
            acc[row.id] = { code: parsed.code, name: parsed.name };
        } catch {
            acc[row.id] = {};
        }
        return acc;
    }, {});
};

const getServiceObligations = (projectId: string): ServiceObligation[] => {
    const rows = db.prepare(`
        SELECT *
        FROM service_obligations
        WHERE projectId = ?
        ORDER BY isActive DESC, code COLLATE NOCASE ASC, createdAt ASC
    `).all(projectId) as any[];

    return rows.map((row) => normalizeServiceObligation({
        ...row,
        requiresProtocol: row.requiresProtocol === 1,
        isActive: row.isActive === 1,
    }));
};

const getServiceTasks = (projectId: string): ServiceTask[] => {
    const rows = db.prepare(`
        SELECT *
        FROM service_tasks
        WHERE projectId = ? AND status <> 'canceled'
        ORDER BY
            CASE status
                WHEN 'overdue' THEN 0
                WHEN 'pending' THEN 1
                WHEN 'completed' THEN 2
                ELSE 3
            END,
            dueDate ASC,
            createdAt DESC
    `).all(projectId) as any[];

    return rows.map((row) => normalizeServiceTask(row));
};

const getServiceEvents = (projectId: string): ServiceEvent[] => {
    const rows = db.prepare(`
        SELECT *
        FROM service_events
        WHERE projectId = ?
        ORDER BY occurredAt DESC, createdAt DESC
    `).all(projectId) as any[];

    return rows.map((row) => normalizeServiceEvent(row));
};

const refreshServiceTaskStatuses = (projectId?: string) => {
    const nowIso = new Date().toISOString();
    db.prepare(projectId
        ? `UPDATE service_tasks SET status = 'overdue', updatedAt = ? WHERE projectId = ? AND status = 'pending' AND dueDate < ?`
        : `UPDATE service_tasks SET status = 'overdue', updatedAt = ? WHERE status = 'pending' AND dueDate < ?`)
        .run(...(projectId ? [nowIso, projectId, nowIso] : [nowIso, nowIso]));
};

const addSchedulePeriod = (date: Date, scheduleType: ServiceObligation['scheduleType']) => {
    switch (scheduleType) {
        case 'monthly':
            return addMonths(date, 1);
        case 'quarterly':
            return addMonths(date, 3);
        case 'semiannual':
            return addMonths(date, 6);
        case 'annual':
            return addMonths(date, 12);
        default:
            return date;
    }
};

const calculateRelativeDueDate = (occurredAt: string, obligation: ServiceObligation) => {
    const baseDate = new Date(occurredAt);
    const relativeValue = Number(obligation.relativeValue) || 0;

    if (Number.isNaN(baseDate.getTime()) || relativeValue <= 0) {
        return '';
    }

    if (obligation.relativeUnit === 'months') {
        return addMonths(baseDate, relativeValue).toISOString();
    }

    if (obligation.relativeUnit === 'hours') {
        return addHours(baseDate, relativeValue).toISOString();
    }

    if (obligation.relativeUnit === 'calendar_days') {
        return addDays(baseDate, relativeValue).toISOString();
    }

    return addBusinessDays(baseDate, relativeValue).toISOString();
};

const buildCurrentRecurringDueDate = (obligation: ServiceObligation) => {
    const anchorCandidate = obligation.anchorDate || new Date().toISOString().slice(0, 10);
    let dueDate = new Date(anchorCandidate);
    if (Number.isNaN(dueDate.getTime())) {
        dueDate = new Date();
    }

    const now = new Date();
    let guard = 0;
    while (guard < 240) {
        const nextDate = addSchedulePeriod(dueDate, obligation.scheduleType);
        if (nextDate.getTime() > now.getTime()) {
            break;
        }
        dueDate = nextDate;
        guard += 1;
    }

    return dueDate.toISOString();
};

const upsertServiceTask = (task: ServiceTask) => {
    const normalizedTask = normalizeServiceTask(task);
    db.prepare(`
        INSERT INTO service_tasks (
            id, projectId, obligationId, title, description, dueDate, status, completedAt, sourceType,
            sourceEventId, notes, notifiedAt, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            projectId = excluded.projectId,
            obligationId = excluded.obligationId,
            title = excluded.title,
            description = excluded.description,
            dueDate = excluded.dueDate,
            status = excluded.status,
            completedAt = excluded.completedAt,
            sourceType = excluded.sourceType,
            sourceEventId = excluded.sourceEventId,
            notes = excluded.notes,
            notifiedAt = excluded.notifiedAt,
            updatedAt = excluded.updatedAt
    `).run(
        normalizedTask.id,
        normalizedTask.projectId,
        normalizedTask.obligationId,
        normalizedTask.title,
        normalizedTask.description || '',
        normalizedTask.dueDate,
        normalizedTask.status,
        normalizedTask.completedAt || null,
        normalizedTask.sourceType,
        normalizedTask.sourceEventId || null,
        normalizedTask.notes || '',
        normalizedTask.notifiedAt || null,
        normalizedTask.createdAt,
        normalizedTask.updatedAt,
    );
};

const ensureServiceTaskForObligation = (obligation: ServiceObligation) => {
    if (!obligation.isActive || obligation.kind === 'continuous' || obligation.scheduleType === 'none' || obligation.scheduleType === 'relative') {
        db.prepare(`
            UPDATE service_tasks
            SET status = 'canceled', updatedAt = ?
            WHERE obligationId = ? AND status IN ('pending', 'overdue')
        `).run(new Date().toISOString(), obligation.id);
        return;
    }

    const latestTask = db.prepare(`
        SELECT *
        FROM service_tasks
        WHERE obligationId = ?
        ORDER BY dueDate DESC, createdAt DESC
        LIMIT 1
    `).get(obligation.id) as any;

    const openTasks = db.prepare(`
        SELECT *
        FROM service_tasks
        WHERE obligationId = ? AND status IN ('pending', 'overdue')
        ORDER BY dueDate DESC, createdAt DESC
    `).all(obligation.id) as any[];

    const openTask = openTasks[0];
    if (openTasks.length > 1) {
        const timestamp = new Date().toISOString();
        const cancelStatement = db.prepare(`
            UPDATE service_tasks
            SET status = 'canceled', updatedAt = ?
            WHERE id = ?
        `);
        openTasks.slice(1).forEach((task) => cancelStatement.run(timestamp, task.id));
    }

    const timestamp = new Date().toISOString();
    const fixedDueDate = obligation.fixedDate ? new Date(obligation.fixedDate).toISOString() : '';

    if (openTask) {
        db.prepare(`
            UPDATE service_tasks
            SET title = ?, description = ?, dueDate = ?, updatedAt = ?
            WHERE id = ?
        `).run(
            obligation.title,
            obligation.description || '',
            obligation.scheduleType === 'fixed_date' && fixedDueDate ? fixedDueDate : openTask.dueDate,
            timestamp,
            openTask.id,
        );
        return;
    }

    let dueDate = '';

    if (obligation.scheduleType === 'fixed_date') {
        if (latestTask) {
            return;
        }
        dueDate = fixedDueDate;
    } else if (latestTask?.dueDate) {
        const latestDueDate = new Date(latestTask.dueDate);
        if (!Number.isNaN(latestDueDate.getTime())) {
            dueDate = addSchedulePeriod(latestDueDate, obligation.scheduleType).toISOString();
        }
    } else {
        dueDate = buildCurrentRecurringDueDate(obligation);
    }

    if (!dueDate) {
        return;
    }

    upsertServiceTask({
        id: createEntityId('service_task'),
        projectId: obligation.projectId,
        obligationId: obligation.id,
        title: obligation.title,
        description: obligation.description || '',
        dueDate,
        status: 'pending',
        sourceType: 'schedule',
        sourceEventId: '',
        notes: '',
        notifiedAt: '',
        createdAt: timestamp,
        updatedAt: timestamp,
    });
};

const ensureServiceTasksForProject = (projectId: string) => {
    const obligations = getServiceObligations(projectId);
    obligations.forEach((obligation) => {
        if (!obligation.isActive) {
            db.prepare(`
                UPDATE service_tasks
                SET status = 'canceled', updatedAt = ?
                WHERE obligationId = ? AND status IN ('pending', 'overdue')
            `).run(new Date().toISOString(), obligation.id);
            return;
        }
        ensureServiceTaskForObligation(obligation);
    });

    refreshServiceTaskStatuses(projectId);
};

const saveServiceObligationRecord = (obligation: ServiceObligation) => {
    const normalizedObligation = normalizeServiceObligation(obligation);
    db.prepare(`
        INSERT INTO service_obligations (
            id, projectId, code, title, description, kind, scheduleType, intervalValue, relativeValue, relativeUnit,
            fixedDate, anchorDate, triggerLabel, owner, evidenceHint, notes, sourceRequirement, requiresProtocol, isActive, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            projectId = excluded.projectId,
            code = excluded.code,
            title = excluded.title,
            description = excluded.description,
            kind = excluded.kind,
            scheduleType = excluded.scheduleType,
            intervalValue = excluded.intervalValue,
            relativeValue = excluded.relativeValue,
            relativeUnit = excluded.relativeUnit,
            fixedDate = excluded.fixedDate,
            anchorDate = excluded.anchorDate,
            triggerLabel = excluded.triggerLabel,
            owner = excluded.owner,
            evidenceHint = excluded.evidenceHint,
            notes = excluded.notes,
            sourceRequirement = excluded.sourceRequirement,
            requiresProtocol = excluded.requiresProtocol,
            isActive = excluded.isActive,
            updatedAt = excluded.updatedAt
    `).run(
        normalizedObligation.id,
        normalizedObligation.projectId,
        normalizedObligation.code,
        normalizedObligation.title,
        normalizedObligation.description,
        normalizedObligation.kind,
        normalizedObligation.scheduleType,
        normalizedObligation.intervalValue || 1,
        normalizedObligation.relativeValue || 0,
        normalizedObligation.relativeUnit || null,
        normalizedObligation.fixedDate || null,
        normalizedObligation.anchorDate || null,
        normalizedObligation.triggerLabel || null,
        normalizedObligation.owner || null,
        normalizedObligation.evidenceHint || null,
        normalizedObligation.notes || null,
        normalizedObligation.sourceRequirement || null,
        normalizedObligation.requiresProtocol ? 1 : 0,
        normalizedObligation.isActive ? 1 : 0,
        normalizedObligation.createdAt,
        normalizedObligation.updatedAt,
    );

    ensureServiceTasksForProject(normalizedObligation.projectId);
};

const deleteServiceObligationRecord = (obligationId: string) => {
    const obligation = db.prepare('SELECT projectId FROM service_obligations WHERE id = ?').get(obligationId) as { projectId: string } | undefined;
    db.prepare('DELETE FROM service_tasks WHERE obligationId = ?').run(obligationId);
    db.prepare('DELETE FROM service_events WHERE obligationId = ?').run(obligationId);
    db.prepare('DELETE FROM service_obligations WHERE id = ?').run(obligationId);
    if (obligation?.projectId) {
        ensureServiceTasksForProject(obligation.projectId);
    }
};

const buildServiceObligationTemplatePayload = (baseDate: string, endDate: string) => ({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    baseDate,
    endDate,
    description: 'Przykładowy schemat obowiązków do przygotowania i ponownego importu do zakładki Obowiązki.',
    obligations: defaultServiceObligationTemplate,
});

const parseImportedServiceObligations = (rawContent: string): Array<Partial<ServiceObligation>> => {
    const parsed = JSON.parse(rawContent);
    const obligations = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.obligations)
            ? parsed.obligations
            : null;

    if (!obligations) {
        throw new Error('Plik JSON nie zawiera listy obowiązków w polu "obligations".');
    }

    return obligations
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            const candidate = item as Partial<ServiceObligation>;
            return {
                code: candidate.code || '',
                title: candidate.title || '',
                description: candidate.description || '',
                kind: candidate.kind || 'continuous',
                scheduleType: candidate.scheduleType || 'none',
                intervalValue: candidate.intervalValue,
                relativeValue: candidate.relativeValue,
                relativeUnit: candidate.relativeUnit || 'business_days',
                fixedDate: candidate.fixedDate || '',
                anchorDate: candidate.anchorDate || '',
                triggerLabel: candidate.triggerLabel || '',
                owner: candidate.owner || '',
                evidenceHint: candidate.evidenceHint || '',
                notes: candidate.notes || '',
                sourceRequirement: candidate.sourceRequirement || '',
                requiresProtocol: candidate.requiresProtocol === true,
                isActive: candidate.isActive !== false,
            };
        })
        .filter((item) => item.title?.trim());
};

const replaceServiceObligationsForProject = (projectId: string, obligations: Array<Partial<ServiceObligation>>) => {
    const timestamp = new Date().toISOString();
    const deleteTasks = db.prepare('DELETE FROM service_tasks WHERE projectId = ?');
    const deleteEvents = db.prepare('DELETE FROM service_events WHERE projectId = ?');
    const deleteObligations = db.prepare('DELETE FROM service_obligations WHERE projectId = ?');

    const transaction = db.transaction(() => {
        deleteTasks.run(projectId);
        deleteEvents.run(projectId);
        deleteObligations.run(projectId);

        obligations.forEach((item) => {
            saveServiceObligationRecord({
                id: createEntityId('service_obligation'),
                projectId,
                code: item.code?.trim() || '',
                title: item.title?.trim() || '',
                description: item.description?.trim() || '',
                kind: item.kind || 'continuous',
                scheduleType: item.scheduleType || 'none',
                intervalValue: Number(item.intervalValue) || 1,
                relativeValue: Number(item.relativeValue) || 0,
                relativeUnit: item.relativeUnit || 'business_days',
                fixedDate: item.fixedDate || '',
                anchorDate: item.anchorDate || '',
                triggerLabel: item.triggerLabel || '',
                owner: item.owner || '',
                evidenceHint: item.evidenceHint || '',
                notes: item.notes || '',
                sourceRequirement: item.sourceRequirement || '',
                requiresProtocol: item.requiresProtocol === true,
                isActive: item.isActive !== false,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        });
    });

    transaction();
    ensureServiceTasksForProject(projectId);
};

const saveServiceEventRecord = (event: ServiceEvent) => {
    const normalizedEvent = normalizeServiceEvent(event);
    db.prepare(`
        INSERT INTO service_events (
            id, projectId, obligationId, eventType, title, occurredAt, dueDate, reference, notes, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            projectId = excluded.projectId,
            obligationId = excluded.obligationId,
            eventType = excluded.eventType,
            title = excluded.title,
            occurredAt = excluded.occurredAt,
            dueDate = excluded.dueDate,
            reference = excluded.reference,
            notes = excluded.notes,
            updatedAt = excluded.updatedAt
    `).run(
        normalizedEvent.id,
        normalizedEvent.projectId,
        normalizedEvent.obligationId || null,
        normalizedEvent.eventType,
        normalizedEvent.title,
        normalizedEvent.occurredAt,
        normalizedEvent.dueDate || null,
        normalizedEvent.reference || null,
        normalizedEvent.notes || null,
        normalizedEvent.createdAt,
        normalizedEvent.updatedAt,
    );

    db.prepare(`
        DELETE FROM service_tasks
        WHERE sourceEventId = ? AND sourceType = 'event' AND status IN ('pending', 'overdue')
    `).run(normalizedEvent.id);

    if (normalizedEvent.obligationId) {
        const obligation = db.prepare('SELECT * FROM service_obligations WHERE id = ?').get(normalizedEvent.obligationId) as any;
        if (obligation) {
            const normalizedObligation = normalizeServiceObligation({
                ...obligation,
                requiresProtocol: obligation.requiresProtocol === 1,
                isActive: obligation.isActive === 1,
            });
            const dueDate = calculateRelativeDueDate(normalizedEvent.occurredAt, normalizedObligation);
            if (dueDate) {
                const timestamp = new Date().toISOString();
                upsertServiceTask({
                    id: createEntityId('service_task'),
                    projectId: normalizedEvent.projectId,
                    obligationId: normalizedObligation.id,
                    title: normalizedObligation.title,
                    description: normalizedEvent.title,
                    dueDate,
                    status: 'pending',
                    sourceType: 'event',
                    sourceEventId: normalizedEvent.id,
                    notes: normalizedEvent.notes || '',
                    notifiedAt: '',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });

                db.prepare('UPDATE service_events SET dueDate = ?, updatedAt = ? WHERE id = ?').run(dueDate, timestamp, normalizedEvent.id);
            }
        }
    }

    ensureServiceTasksForProject(normalizedEvent.projectId);
};

const deleteServiceEventRecord = (eventId: string) => {
    const event = db.prepare('SELECT projectId FROM service_events WHERE id = ?').get(eventId) as { projectId: string } | undefined;
    db.prepare('DELETE FROM service_events WHERE id = ?').run(eventId);
    if (event?.projectId) {
        ensureServiceTasksForProject(event.projectId);
    }
};

const completeServiceTaskRecord = (taskId: string) => {
    const task = db.prepare('SELECT * FROM service_tasks WHERE id = ?').get(taskId) as any;
    if (!task) {
        throw new Error('Nie znaleziono zadania obsługi.');
    }

    const completedAt = new Date().toISOString();
    db.prepare(`
        UPDATE service_tasks
        SET status = 'completed', completedAt = ?, updatedAt = ?, notifiedAt = ?
        WHERE id = ?
    `).run(completedAt, completedAt, completedAt, taskId);

    const obligation = db.prepare('SELECT * FROM service_obligations WHERE id = ?').get(task.obligationId) as any;
    if (obligation) {
        const normalizedObligation = normalizeServiceObligation({
            ...obligation,
            requiresProtocol: obligation.requiresProtocol === 1,
            isActive: obligation.isActive === 1,
        });
        if (['monthly', 'quarterly', 'semiannual', 'annual'].includes(normalizedObligation.scheduleType)) {
            ensureServiceTaskForObligation(normalizedObligation);
        }
    }

    ensureServiceTasksForProject(task.projectId);
};

const reopenServiceTaskRecord = (taskId: string) => {
    const task = db.prepare('SELECT * FROM service_tasks WHERE id = ?').get(taskId) as any;
    if (!task) {
        throw new Error('Nie znaleziono zadania obsługi.');
    }

    const timestamp = new Date().toISOString();
    db.prepare(`
        UPDATE service_tasks
        SET status = 'pending', completedAt = NULL, notifiedAt = NULL, updatedAt = ?
        WHERE id = ?
    `).run(timestamp, taskId);

    ensureServiceTasksForProject(task.projectId);
};

const buildServiceAlertPayload = () => {
    const upcomingTarget = addDays(new Date(), serviceUpcomingAlertWindowDays).toISOString();
    const projectLookup = getProjectLookup();
    const rows = db.prepare(`
        SELECT
            t.id as taskId,
            t.projectId,
            t.title,
            t.dueDate,
            t.status,
            o.code as obligationCode
        FROM service_tasks t
        JOIN service_obligations o ON o.id = t.obligationId
        WHERE t.notifiedAt IS NULL
          AND t.status IN ('pending', 'overdue')
          AND (
              t.status = 'overdue'
              OR (t.status = 'pending' AND t.dueDate <= ?)
          )
        ORDER BY
            CASE t.status WHEN 'overdue' THEN 0 ELSE 1 END,
            t.dueDate ASC
    `).all(upcomingTarget) as {
        taskId: string;
        projectId: string;
        title: string;
        dueDate: string;
        status: 'pending' | 'overdue';
        obligationCode?: string;
    }[];

    return rows.map((row) => ({
        ...row,
        projectCode: projectLookup[row.projectId]?.code || '',
        projectName: projectLookup[row.projectId]?.name || '',
    }));
};

const runServiceTaskChecks = () => {
    if (serviceTaskRunnerInProgress) return;
    serviceTaskRunnerInProgress = true;

    try {
        const projectIds = db.prepare('SELECT id FROM projects').all() as { id: string }[];
        projectIds.forEach(({ id }) => ensureServiceTasksForProject(id));

        const alerts = buildServiceAlertPayload();
        if (alerts.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('service:alerts', alerts);
            const timestamp = new Date().toISOString();
            const updateStatement = db.prepare('UPDATE service_tasks SET notifiedAt = ?, updatedAt = ? WHERE id = ?');
            alerts.forEach((alert) => {
                updateStatement.run(timestamp, timestamp, alert.taskId);
            });
        }
    } catch (error) {
        console.error('Błąd pracy modułu obsługi umowy:', error);
    } finally {
        serviceTaskRunnerInProgress = false;
    }
};

const startServiceTaskRunner = () => {
    if (serviceTaskRunner) return;
    runServiceTaskChecks();
    serviceTaskRunner = setInterval(() => {
        runServiceTaskChecks();
    }, serviceTaskCheckIntervalMs);
};

const stopServiceTaskRunner = () => {
    if (!serviceTaskRunner) return;
    clearInterval(serviceTaskRunner);
    serviceTaskRunner = null;
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

ipcMain.handle('get-order-invoice-email-template', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM order_invoice_email_templates WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania szablonu e-mail FV:', error);
        throw error;
    }
});

ipcMain.handle('save-order-invoice-email-template', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO order_invoice_email_templates (projectId, data)
            VALUES (?, ?)
            ON CONFLICT(projectId) DO UPDATE SET data = excluded.data
        `).run(projectId, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu szablonu e-mail FV:', error);
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

ipcMain.handle('get-maintenance-invoice-email-template', async (_, projectId: string) => {
    try {
        const row = db.prepare('SELECT data FROM maintenance_invoice_email_templates WHERE projectId = ?').get(projectId) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('BĹ‚Ä…d pobierania szablonu e-mail FV utrzymania:', error);
        throw error;
    }
});

ipcMain.handle('save-maintenance-invoice-email-template', async (_, { projectId, data }: { projectId: string, data: any }) => {
    try {
        db.prepare(`
            INSERT INTO maintenance_invoice_email_templates (projectId, data)
            VALUES (?, ?)
            ON CONFLICT(projectId) DO UPDATE SET data = excluded.data
        `).run(projectId, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('BĹ‚Ä…d zapisu szablonu e-mail FV utrzymania:', error);
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

ipcMain.handle('get-procedures', async (_, projectId: string) => {
    try {
        const rows = db.prepare(`
            SELECT data
            FROM procedures
            WHERE projectId = ?
            ORDER BY updatedAt DESC, title COLLATE NOCASE ASC
        `).all(projectId) as { data: string }[];
        return rows.map(row => JSON.parse(row.data));
    } catch (error) {
        console.error('Blad pobierania procedur:', error);
        throw error;
    }
});

ipcMain.handle('save-procedure', async (_, { projectId, data }: { projectId: string, data: Procedure }) => {
    try {
        db.prepare(`
            INSERT INTO procedures (id, projectId, title, updatedAt, data)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                projectId = excluded.projectId,
                title = excluded.title,
                updatedAt = excluded.updatedAt,
                data = excluded.data
        `).run(
            data.id,
            projectId,
            data.title,
            data.updatedAt,
            JSON.stringify({ ...data, projectId })
        );
        return { success: true };
    } catch (error) {
        console.error('Blad zapisu procedury:', error);
        throw error;
    }
});

ipcMain.handle('delete-procedure', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM procedures WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('Blad usuwania procedury:', error);
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
        ensureMaintenanceEntryFlowColumns();
        const rows = db.prepare(`
            SELECT id, projectId, month, periodMonths, netAmount, vatRate, grossAmount, notes, settlementFlow, invoiceFlow, createdAt, updatedAt
            FROM maintenance_entries
            WHERE projectId = ?
            ORDER BY month DESC, createdAt DESC
        `).all(projectId) as {
            id: string;
            projectId: string;
            month: string;
            periodMonths: number;
            netAmount: number;
            vatRate: number;
            grossAmount: number;
            notes?: string;
            settlementFlow?: string | null;
            invoiceFlow?: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
        return rows.map((row) => ({
            ...row,
            settlementFlow: row.settlementFlow ? JSON.parse(row.settlementFlow) : undefined,
            invoiceFlow: row.invoiceFlow ? JSON.parse(row.invoiceFlow) : undefined,
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
    periodMonths?: number;
    netAmount: number;
    vatRate: number;
    grossAmount: number;
    notes?: string;
    settlementFlow?: any;
    invoiceFlow?: any;
    createdAt: string;
    updatedAt: string;
}) => {
    try {
        ensureMaintenanceEntryFlowColumns();
        db.prepare(`
            INSERT INTO maintenance_entries (id, projectId, month, periodMonths, netAmount, vatRate, grossAmount, notes, settlementFlow, invoiceFlow, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                month = excluded.month,
                periodMonths = excluded.periodMonths,
                netAmount = excluded.netAmount,
                vatRate = excluded.vatRate,
                grossAmount = excluded.grossAmount,
                notes = excluded.notes,
                settlementFlow = excluded.settlementFlow,
                invoiceFlow = excluded.invoiceFlow,
                updatedAt = excluded.updatedAt
        `).run(
            data.id,
            data.projectId,
            data.month,
            [1, 2, 3, 12].includes(data.periodMonths || 1) ? data.periodMonths || 1 : 1,
            data.netAmount,
            data.vatRate,
            data.grossAmount,
            data.notes || '',
            data.settlementFlow ? JSON.stringify(data.settlementFlow) : null,
            data.invoiceFlow ? JSON.stringify(data.invoiceFlow) : null,
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

ipcMain.handle('get-service-overview', async (_, projectId: string) => {
    try {
        ensureServiceTasksForProject(projectId);
        return {
            obligations: getServiceObligations(projectId),
            tasks: getServiceTasks(projectId),
            events: getServiceEvents(projectId),
        };
    } catch (error) {
        console.error('Błąd pobierania danych obsługi umowy:', error);
        throw error;
    }
});

ipcMain.handle('save-service-obligation', async (_, data: ServiceObligation) => {
    try {
        saveServiceObligationRecord(data);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu obowiązku obsługi umowy:', error);
        throw error;
    }
});

ipcMain.handle('delete-service-obligation', async (_, id: string) => {
    try {
        deleteServiceObligationRecord(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd usuwania obowiązku obsługi umowy:', error);
        throw error;
    }
});

ipcMain.handle('save-service-event', async (_, data: ServiceEvent) => {
    try {
        saveServiceEventRecord(data);
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu zdarzenia obsługi umowy:', error);
        throw error;
    }
});

ipcMain.handle('delete-service-event', async (_, id: string) => {
    try {
        deleteServiceEventRecord(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd usuwania zdarzenia obsługi umowy:', error);
        throw error;
    }
});

ipcMain.handle('complete-service-task', async (_, id: string) => {
    try {
        completeServiceTaskRecord(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd zamykania zadania obsługi umowy:', error);
        throw error;
    }
});

ipcMain.handle('reopen-service-task', async (_, id: string) => {
    try {
        reopenServiceTaskRecord(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd ponownego otwierania zadania obsługi umowy:', error);
        throw error;
    }
});

ipcMain.handle('export-service-obligation-template', async (_, data?: { baseDate?: string; endDate?: string }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Okno aplikacji nie jest dostępne.');
    }

    const baseDate = data?.baseDate?.trim() || new Date().toISOString().slice(0, 10);
    const endDate = data?.endDate?.trim() || '';

    const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: 'Zapisz przykładowy szablon obowiązków',
        defaultPath: path.join(app.getPath('documents'), serviceObligationTemplateFileName),
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
    });

    if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, canceled: true };
    }

    await fs.writeFile(saveResult.filePath, JSON.stringify(buildServiceObligationTemplatePayload(baseDate, endDate), null, 2), 'utf-8');

    return {
        success: true,
        canceled: false,
        filePath: saveResult.filePath,
    };
});

ipcMain.handle('read-service-obligation-template', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Okno aplikacji nie jest dostępne.');
    }

    const openResult = await dialog.showOpenDialog(mainWindow, {
        title: 'Wczytaj schemat obowiązków',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
    });

    if (openResult.canceled || openResult.filePaths.length === 0) {
        return { canceled: true, obligations: [] };
    }

    const filePath = openResult.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    const obligations = parseImportedServiceObligations(content);

    return {
        canceled: false,
        fileName: path.basename(filePath),
        obligations,
    };
});

ipcMain.handle('import-service-obligations', async (_, data: { projectId: string; replaceExisting: boolean; obligations: Array<Partial<ServiceObligation>> }) => {
    try {
        const projectId = data?.projectId?.trim();
        if (!projectId) {
            throw new Error('Brakuje identyfikatora projektu dla importu obowiązków.');
        }

        const obligations = Array.isArray(data?.obligations) ? data.obligations : [];
        if (obligations.length === 0) {
            throw new Error('Plik nie zawiera żadnych obowiązków do importu.');
        }

        if (data.replaceExisting) {
            replaceServiceObligationsForProject(projectId, obligations);
        } else {
            const timestamp = new Date().toISOString();
            obligations.forEach((item) => {
                saveServiceObligationRecord({
                    id: createEntityId('service_obligation'),
                    projectId,
                    code: item.code?.trim() || '',
                    title: item.title?.trim() || '',
                    description: item.description?.trim() || '',
                    kind: item.kind || 'continuous',
                    scheduleType: item.scheduleType || 'none',
                    intervalValue: Number(item.intervalValue) || 1,
                    relativeValue: Number(item.relativeValue) || 0,
                    relativeUnit: item.relativeUnit || 'business_days',
                    fixedDate: item.fixedDate || '',
                    anchorDate: item.anchorDate || '',
                    triggerLabel: item.triggerLabel || '',
                    owner: item.owner || '',
                    evidenceHint: item.evidenceHint || '',
                    notes: item.notes || '',
                    sourceRequirement: item.sourceRequirement || '',
                    requiresProtocol: item.requiresProtocol === true,
                    isActive: item.isActive !== false,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });
            });
        }

        return { success: true, importedCount: obligations.length };
    } catch (error) {
        console.error('Błąd importu obowiązków z pliku JSON:', error);
        throw error;
    }
});

ipcMain.handle('get-pending-settlement-entries', async (_, projectId: string) => {
    try {
        return db.prepare(`
            ${pendingSettlementEntrySelectSql}
            WHERE projectId = ?
            ORDER BY requestDate DESC, createdAt DESC
        `).all(projectId).map(mapPendingSettlementEntryRow);
    } catch (error) {
        console.error('Błąd pobierania wpisów do rozliczenia:', error);
        throw error;
    }
});

ipcMain.handle('save-pending-settlement-entry', async (_, data: any) => {
    try {
        db.prepare(`
            INSERT INTO pending_settlement_entries (
                id,
                projectId,
                externalId,
                requester,
                requestDate,
                requestChannel,
                module,
                title,
                youtrackIssueUrl,
                details,
                priority,
                teamEstimatedHours,
                marginPercent,
                estimatedHours,
                isEstimated,
                estimationDate,
                isAccepted,
                acceptanceDate,
                acceptedBy,
                acceptanceChannel,
                preAcceptanceWorkHours,
                preAcceptanceWorkDescription,
                isInProgress,
                isCompleted,
                isSentToSettlement,
                isSettled,
                evidenceImageDataUrl,
                evidenceImageName,
                notes,
                createdAt,
                updatedAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                externalId = excluded.externalId,
                requester = excluded.requester,
                requestDate = excluded.requestDate,
                requestChannel = excluded.requestChannel,
                module = excluded.module,
                title = excluded.title,
                youtrackIssueUrl = excluded.youtrackIssueUrl,
                details = excluded.details,
                priority = excluded.priority,
                teamEstimatedHours = excluded.teamEstimatedHours,
                marginPercent = excluded.marginPercent,
                estimatedHours = excluded.estimatedHours,
                isEstimated = excluded.isEstimated,
                estimationDate = excluded.estimationDate,
                isAccepted = excluded.isAccepted,
                acceptanceDate = excluded.acceptanceDate,
                acceptedBy = excluded.acceptedBy,
                acceptanceChannel = excluded.acceptanceChannel,
                preAcceptanceWorkHours = excluded.preAcceptanceWorkHours,
                preAcceptanceWorkDescription = excluded.preAcceptanceWorkDescription,
                isInProgress = excluded.isInProgress,
                isCompleted = excluded.isCompleted,
                isSentToSettlement = excluded.isSentToSettlement,
                isSettled = excluded.isSettled,
                evidenceImageDataUrl = excluded.evidenceImageDataUrl,
                evidenceImageName = excluded.evidenceImageName,
                notes = excluded.notes,
                updatedAt = excluded.updatedAt
        `).run(
            data.id,
            data.projectId,
            data.externalId,
            data.requester,
            data.requestDate,
            data.requestChannel || '',
            data.module || '',
            data.title,
            data.youtrackIssueUrl || '',
            data.details || '',
            data.priority,
            Number(data.teamEstimatedHours) || 0,
            Number(data.marginPercent) || 0,
            Number(data.estimatedHours) || 0,
            data.isEstimated ? 1 : 0,
            data.estimationDate || null,
            data.isAccepted ? 1 : 0,
            data.acceptanceDate || null,
            data.acceptedBy || '',
            data.acceptanceChannel || '',
            Number(data.preAcceptanceWorkHours) || 0,
            data.preAcceptanceWorkDescription || '',
            data.isInProgress ? 1 : 0,
            data.isCompleted ? 1 : 0,
            data.isSentToSettlement ? 1 : 0,
            data.isSettled ? 1 : 0,
            data.evidenceImageDataUrl || '',
            data.evidenceImageName || '',
            data.notes || '',
            data.createdAt,
            data.updatedAt
        );

        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu wpisu do rozliczenia:', error);
        throw error;
    }
});

ipcMain.handle('delete-pending-settlement-entry', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM pending_settlement_entries WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd usuwania wpisu do rozliczenia:', error);
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
        db.prepare('DELETE FROM daily_ai_analyses WHERE hubId = ?').run(id);
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

ipcMain.handle('get-daily-ai-skipped-issue-states', async () => {
    try {
        return getDailyAiSkippedIssueMap();
    } catch (error) {
        console.error('Błąd pobierania daily_ai_skipped_issue_states:', error);
        throw error;
    }
});

ipcMain.handle('save-daily-ai-skipped-issue-state', async (_, { issueId, skipInAi }: { issueId: string, skipInAi: boolean }) => {
    try {
        db.prepare(`
            INSERT INTO daily_ai_skipped_issue_states (issueId, skipInAi, updatedAt)
            VALUES (?, ?, ?)
            ON CONFLICT(issueId) DO UPDATE SET
                skipInAi = excluded.skipInAi,
                updatedAt = excluded.updatedAt
        `).run(issueId, skipInAi ? 1 : 0, new Date().toISOString());
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu daily_ai_skipped_issue_state:', error);
        throw error;
    }
});

ipcMain.handle('get-daily-ai-analyses', async (_, hubId: string) => {
    try {
        const rows = db.prepare(`
            SELECT *
            FROM daily_ai_analyses
            WHERE hubId = ?
            ORDER BY datetime(createdAt) DESC
        `).all(hubId) as Array<Omit<DailyAiAnalysis, 'projectCodes' | 'issueTitles'> & { projectCodes: string; issueTitles?: string }>;

        return rows.map((row) => ({
            ...row,
            projectCodes: (() => {
                try {
                    return JSON.parse(row.projectCodes || '[]');
                } catch {
                    return [];
                }
            })(),
            issueTitles: (() => {
                try {
                    return JSON.parse(row.issueTitles || '{}');
                } catch {
                    return {};
                }
            })(),
        }));
    } catch (error) {
        console.error('Błąd pobierania daily_ai_analyses:', error);
        throw error;
    }
});

ipcMain.handle('save-daily-ai-analysis', async (_, analysis: DailyAiAnalysis) => {
    try {
        db.prepare(`
            INSERT INTO daily_ai_analyses (
                id,
                hubId,
                projectCodes,
                dateFrom,
                dateTo,
                originalContent,
                currentContent,
                issueTitles,
                createdAt,
                updatedAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                hubId = excluded.hubId,
                projectCodes = excluded.projectCodes,
                dateFrom = excluded.dateFrom,
                dateTo = excluded.dateTo,
                originalContent = excluded.originalContent,
                currentContent = excluded.currentContent,
                issueTitles = excluded.issueTitles,
                createdAt = excluded.createdAt,
                updatedAt = excluded.updatedAt
        `).run(
            analysis.id,
            analysis.hubId,
            JSON.stringify(analysis.projectCodes || []),
            analysis.dateFrom,
            analysis.dateTo,
            analysis.originalContent,
            analysis.currentContent,
            JSON.stringify(analysis.issueTitles || {}),
            analysis.createdAt,
            analysis.updatedAt,
        );
        return { success: true };
    } catch (error) {
        console.error('Błąd zapisu daily_ai_analysis:', error);
        throw error;
    }
});

ipcMain.handle('delete-daily-ai-analysis', async (_, id: string) => {
    try {
        db.prepare('DELETE FROM daily_ai_analyses WHERE id = ?').run(id);
        return { success: true };
    } catch (error) {
        console.error('Błąd usuwania daily_ai_analysis:', error);
        throw error;
    }
});

