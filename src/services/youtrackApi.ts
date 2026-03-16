import axios from 'axios';

// Helper to make API calls using Electron IPC or fallback to axios
const makeRequest = async (url: string, token: string, params: any) => {
    if (window.electron?.fetchYouTrack) {
        return window.electron.fetchYouTrack({
            url,
            method: 'GET',
            headers: getHeaders(token),
            params
        });
    } else {
        const res = await axios.get(url, {
            headers: getHeaders(token),
            params
        });
        return res.data;
    }
};

export interface YouTrackIssue {
    id: string;
    idReadable: string;
    summary: string;
    description?: string;
    resolved?: number | null;
    updated?: number;
    created?: number;
    dueDate?: number | null;
    reporter?: { name: string; login: string };
    assignee?: { name: string; login: string; fullName?: string } | null;
    estimation?: {
        presentation: string;
        minutes: number;
    } | null;
    spentTime?: {
        presentation: string;
        minutes: number;
    } | null;
    state?: {
        name: string;
        color: { background: string; foreground: string };
    } | null;
    type?: {
        name: string;
        color: { background: string; foreground: string };
    } | null;
    attachments?: {
        id: string;
        name: string;
        url: string;
    }[];
    links?: {
        direction?: string;
        linkType?: {
            name?: string;
            outwardName?: string;
            inwardName?: string;
        };
        issues?: {
            id: string;
            idReadable: string;
            summary?: string;
        }[];
    }[];
    priority?: {
        name: string;
        color: { background: string; foreground: string };
    } | null;
}

export interface ActivityItem {
    type: 'issue-created' | 'comment' | 'field-change' | 'description-change' | 'work-item';
    id: string;
    timestamp: number;
    author: { name: string; login: string };
    field?: string;
    added?: string | any[];
    removed?: string | any[];
    text?: string;
    minutes?: number; // dla work-item
    dateStr?: string; // dla work-item YYYY-MM-DD
    workComments?: string[]; // komunikaty przy logowaniu czasu
    workItemType?: string; // typ pracy (np. Development, Testing)
}

export interface WorkLogItem {
    id: string;
    issueId: string;
    issueReadableId: string;
    issueSummary: string;
    date: number; // timestamp
    durationMinutes: number;
    durationPresentation: string;
    authorName: string;
    authorLogin: string;
    text: string;
    workType: string;
}

export interface IssueWithHistory extends YouTrackIssue {
    project?: {
        id: string;
        shortName: string;
    };
    timeline: ActivityItem[];
}

const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
});

export const formatMinutesToDuration = (minutesStr: string | number): string => {
    const mins = typeof minutesStr === 'string' ? parseInt(minutesStr, 10) : minutesStr;
    if (isNaN(mins)) return String(minutesStr); // Nie liczba operujemy na oryginalnym
    if (mins === 0) return '0m';

    // YouTrack default: 1w = 5d, 1d = 8h, 1h = 60m
    const MINUTES_IN_HOUR = 60;
    const MINUTES_IN_DAY = 8 * MINUTES_IN_HOUR; // 480
    const MINUTES_IN_WEEK = 5 * MINUTES_IN_DAY; // 2400

    let remaining = mins;
    const weeks = Math.floor(remaining / MINUTES_IN_WEEK);
    remaining %= MINUTES_IN_WEEK;

    const days = Math.floor(remaining / MINUTES_IN_DAY);
    remaining %= MINUTES_IN_DAY;

    const hours = Math.floor(remaining / MINUTES_IN_HOUR);
    remaining %= MINUTES_IN_HOUR;

    const parts = [];
    if (weeks > 0) parts.push(`${weeks}w`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (remaining > 0) parts.push(`${remaining}m`);

    return parts.join(' ');
};

export const fetchIssuesActivity = async (
    baseUrl: string,
    token: string,
    projectName: string,
    dateFrom: string,
    dateTo: string,
    tab: 'Aktywności' | 'Do zrobienia' = 'Aktywności',
    customStatuses?: string[],  // when provided, overrides tab logic with custom State filter
    tabName?: string, // used to detect "Zakończone"
    includeFilters?: boolean // dodano parametr sterujący filtrem daty
): Promise<IssueWithHistory[]> => {
    if (!baseUrl || !token) throw new Error("Brak konfiguracji YouTrack (URL lub Token).");

    const apiBase = baseUrl.replace(/\/$/, '') + '/api';

    // 1. Fetch Issues
    let query: string;
    const isZakonczone = tabName?.toLowerCase() === 'zakończone';

    if (customStatuses && customStatuses.length > 0) {
        const stateFilter = customStatuses.map(s => `{${s}}`).join(', ');
        
        if (tab === 'Aktywności') {
            // Broad query for the whole board: date activity OR specific global states
            // Use flat structure to avoid parsing issues with parentheses in some versions
            query = `project: ${projectName} updated: ${dateFrom} .. ${dateTo} or project: ${projectName} State: ${stateFilter}`;
        } else {
            // Standard custom tab behavior
            query = `project: ${projectName} State: ${stateFilter}`;
            if (includeFilters === true || (isZakonczone && includeFilters !== false)) {
                query += ` updated: ${dateFrom} .. ${dateTo}`;
            }
        }
    } else if (tab === 'Do zrobienia') {
        query = `project: ${projectName} State: {To Do}`;
    } else {
        query = `project: ${projectName} updated: ${dateFrom} .. ${dateTo}`;
    }

    // Pobierz WSZYSTKIE zadania (paginacja - brak limitu)
    const issues: any[] = [];
    const ISSUES_PAGE = 100;
    let issueSkip = 0;
    const issueFields = 'id,idReadable,summary,resolved,description,created,updated,reporter(name,login,fullName),assignee(name,login,fullName),project(id,shortName),customFields(name,value(presentation,name,login,email,id,minutes,color(id,background,foreground))),attachments(id,name,url,mimeType,size),tags(name,color(id)),links(direction,linkType(name,outwardName,inwardName),issues(id,idReadable,summary))';

    while (true) {
        const page: any[] = await makeRequest(`${apiBase}/issues`, token, {
            query,
            fields: issueFields,
            $top: ISSUES_PAGE,
            $skip: issueSkip
        });
        if (!Array.isArray(page) || page.length === 0) break;
        issues.push(...page);
        if (page.length < ISSUES_PAGE) break;
        issueSkip += ISSUES_PAGE;
    }

    // 2. For each issue, fetch full activity (comments + field changes)
    // We use Promise.all to fetch them concurrently. We limit fields to keep response light.
    const historyPromises = issues.map(async (issue) => {
        try {
            // Activities endpoint
            const rawActivities = await makeRequest(`${apiBase}/issues/${issue.id}/activities`, token, {
                categories: 'CommentsCategory,IssueCreatedCategory,ProjectCategory,IssueResolvedCategory,CustomFieldCategory,SummaryCategory,DescriptionCategory,WorkItemCategory,AttachmentCategory,TagsCategory',
                fields: 'id,timestamp,author(name,login,email),category(id),added(name,text,presentation,duration(minutes,presentation),date,type(name),author(name,login,email)),removed(name,text,presentation,duration(minutes,presentation),date,type(name),author(name,login,email)),field(customField(name),name),targetMember,text'
            }) || [];
            const timeline: ActivityItem[] = [];

            // Dla WorkItemCategory agregujemy po dacie i autorze
            const workAggregator: { [key: string]: ActivityItem } = {};

            rawActivities.forEach((activity: any) => {
                const catId = activity.category?.id;
                const author = activity.author || { name: 'System', login: 'system' };

                if (catId === 'IssueCreatedCategory') {
                    timeline.push({
                        type: 'issue-created',
                        id: activity.id,
                        timestamp: activity.timestamp,
                        author
                    });
                } else if (catId === 'CommentsCategory') {
                    const commentText = activity.added?.[0]?.text;
                    if (commentText) {
                        timeline.push({
                            type: 'comment',
                            id: activity.id,
                            timestamp: activity.timestamp,
                            author,
                            text: commentText
                        });
                    }
                } else if (catId === 'CustomFieldCategory' || catId === 'ProjectCategory' || catId === 'IssueResolvedCategory') {
                    const fieldName = activity.field?.customField?.name || activity.field?.name || 'Pole';
                    // Estymacje i niektóre pola są przesyłane jako obiekty, a statusy jako tablice
                    const addedValRaw = activity.added;
                    const removedValRaw = activity.removed;

                    let added = 'Brak';
                    if (Array.isArray(addedValRaw) && addedValRaw.length > 0) {
                        const first = addedValRaw[0];
                        added = first?.presentation || first?.name || first?.text || first?.duration?.presentation || (typeof first === 'string' ? first : JSON.stringify(first));
                    } else if (addedValRaw && !Array.isArray(addedValRaw)) {
                        added = addedValRaw.presentation || addedValRaw.name || addedValRaw.text || addedValRaw.duration?.presentation || (typeof addedValRaw === 'string' ? addedValRaw : JSON.stringify(addedValRaw));
                    }

                    let removed = 'Brak';
                    if (Array.isArray(removedValRaw) && removedValRaw.length > 0) {
                        const first = removedValRaw[0];
                        removed = first?.presentation || first?.name || first?.text || first?.duration?.presentation || (typeof first === 'string' ? first : JSON.stringify(first));
                    } else if (removedValRaw && !Array.isArray(removedValRaw)) {
                        removed = removedValRaw.presentation || removedValRaw.name || removedValRaw.text || removedValRaw.duration?.presentation || (typeof removedValRaw === 'string' ? removedValRaw : JSON.stringify(removedValRaw));
                    }

                    if (fieldName.toLowerCase() === 'spent time') {
                        return; // Pomijamy całkowicie
                    }

                    // Formatowanie estymacji, YouTrack czasem wysyła czyste minuty bez jednostki
                    const isEstimation = fieldName.toLowerCase().includes('estimation') || fieldName.toLowerCase().includes('estymacja');
                    if (isEstimation) {
                        if (added !== 'Brak' && !isNaN(Number(added))) added = formatMinutesToDuration(added);
                        if (removed !== 'Brak' && !isNaN(Number(removed))) removed = formatMinutesToDuration(removed);
                    }

                    if (added === 'Brak' && removed === 'Brak') {
                        return; // Pomijamy techniczne "puste" zmiany
                    }

                    // Formatowanie dat (np. dla pola resolved dostajemy czysty timestamp w ms)
                    if (fieldName.toLowerCase() === 'resolved date') {
                        if (added !== 'Brak' && !isNaN(Number(added))) {
                            added = new Date(Number(added)).toLocaleString('pl-PL');
                        }
                        if (removed !== 'Brak' && !isNaN(Number(removed))) {
                            removed = new Date(Number(removed)).toLocaleString('pl-PL');
                        }
                    }

                    timeline.push({
                        type: 'field-change',
                        id: activity.id,
                        timestamp: activity.timestamp,
                        author,
                        field: fieldName,
                        added: typeof added === 'object' ? JSON.stringify(added) : String(added),
                        removed: typeof removed === 'object' ? JSON.stringify(removed) : String(removed)
                    });
                } else if (catId === 'DescriptionCategory' || catId === 'SummaryCategory') {
                    const oldStr = activity.removed || '';
                    const newStr = activity.added || '';
                    timeline.push({
                        type: 'description-change',
                        id: activity.id,
                        timestamp: activity.timestamp,
                        author,
                        field: catId === 'SummaryCategory' ? 'Zmienił temat/summary' : 'Zaktualizował treść zadania',
                        removed: typeof oldStr === 'string' ? oldStr : '',
                        added: typeof newStr === 'string' ? newStr : ''
                    });
                } else if (catId === 'WorkItemCategory') {
                    // Dodany work item
                    const workItem = activity.added?.[0];
                    if (workItem && workItem.duration && workItem.duration.minutes) {
                        const actualAuthor = workItem.author || author;
                        const dateStr = workItem.date ? new Date(workItem.date).toISOString().split('T')[0] : new Date(activity.timestamp).toISOString().split('T')[0];
                        const tempId = `work-${actualAuthor.login || actualAuthor.name}-${dateStr}`;
                        const comment = workItem.text || '';
                        const workItemTypeName = workItem.type?.name || '';

                        if (workAggregator[tempId]) {
                            workAggregator[tempId].minutes = (workAggregator[tempId].minutes || 0) + workItem.duration.minutes;
                            if (comment) {
                                workAggregator[tempId].workComments = workAggregator[tempId].workComments || [];
                                workAggregator[tempId].workComments!.push(comment);
                            }
                            // Jeśli rejestrujemy tego samego dnia kilka wpisów, zachowajmy najnowszy timestamp modyfikacji dla celów sortowania 
                            // jeśli to ta sama data fizycznego zasobu
                            if (activity.timestamp > workAggregator[tempId].timestamp) {
                                workAggregator[tempId].timestamp = workItem.date ? new Date(workItem.date).getTime() : activity.timestamp;
                            }
                        } else {
                            workAggregator[tempId] = {
                                type: 'work-item',
                                id: tempId,
                                timestamp: workItem.date ? new Date(workItem.date).getTime() : activity.timestamp,
                                author: actualAuthor,
                                minutes: workItem.duration.minutes,
                                dateStr,
                                workComments: comment ? [comment] : [],
                                workItemType: workItemTypeName || undefined
                            };
                        }
                    }
                }
            });

            // Dodajemy zagregowane logowania pracy
            Object.values(workAggregator).forEach(aggItem => {
                timeline.push(aggItem);
            });

            // Sort timeline chronologically (oldest first)
            timeline.sort((a, b) => a.timestamp - b.timestamp);

            let dueDate: number | null = null;
            let estimation = null;
            let spentTime = null;
            let state: { name: string; color: { background: string; foreground: string } } | null = null;
            let type: { name: string; color: { background: string; foreground: string } } | null = null;
            let assignee: { name: string; login: string } | null = null;
            let priority: { name: string; color: { background: string; foreground: string } } | null = null;

            if (issue.customFields) {
                issue.customFields.forEach((f: any) => {
                    const fname = f.name?.toLowerCase();
                    if (!fname) return;

                    if (fname === 'due date' || fname === 'termin') {
                        if (f.value) {
                            if (typeof f.value === 'number') {
                                dueDate = f.value;
                            } else if (f.value.presentation) {
                                const parsedDate = new Date(f.value.presentation).getTime();
                                if (!isNaN(parsedDate)) dueDate = parsedDate;
                            } else if (typeof f.value === 'string') {
                                const parsedDate = new Date(f.value).getTime();
                                if (!isNaN(parsedDate)) dueDate = parsedDate;
                            }
                        }
                    } else if (fname === 'estimation' || fname.includes('estymacja')) {
                        if (f.value) {
                            estimation = {
                                presentation: f.value.presentation || formatMinutesToDuration(f.value.minutes || f.value) || String(f.value),
                                minutes: f.value.minutes || (typeof f.value === 'number' ? f.value : 0)
                            };
                        }
                    } else if (fname === 'spent time' || fname.includes('przepracowano')) {
                        if (f.value) {
                            spentTime = {
                                presentation: f.value.presentation || formatMinutesToDuration(f.value.minutes || f.value) || String(f.value),
                                minutes: f.value.minutes || (typeof f.value === 'number' ? f.value : 0)
                            };
                        }
                    } else if (fname === 'state' || fname === 'status') {
                        if (f.value) {
                            state = {
                                name: f.value.name || f.value.presentation || String(f.value),
                                color: f.value.color || { background: '#eee', foreground: '#444' }
                            };
                        }
                    } else if (fname === 'type' || fname === 'typ') {
                        if (f.value) {
                            type = {
                                name: f.value.name || f.value.presentation || String(f.value),
                                color: f.value.color || { background: '#eee', foreground: '#444' }
                            };
                        }
                    } else if (fname === 'assignee' || fname === 'przypisany' || fname === 'osoba odpowiedzialna') {
                        if (f.value) {
                            // SingleUserIssueCustomField: value is a user object
                            const user = Array.isArray(f.value) ? f.value[0] : f.value;
                            if (user && (user.name || user.login)) {
                                assignee = { name: user.name || user.login, login: user.login || user.name };
                            }
                        }
                    } else if (fname === 'priority' || fname === 'priorytet') {
                        if (f.value) {
                            priority = {
                                name: f.value.name || f.value.presentation || String(f.value),
                                color: f.value.color || { background: '#eee', foreground: '#444' }
                            };
                        }
                    }
                });
            }

            return {
                id: issue.id,
                idReadable: issue.idReadable,
                summary: issue.summary,
                description: issue.description,
                resolved: issue.resolved,
                created: issue.created,
                updated: issue.updated,
                reporter: issue.reporter,
                assignee: assignee || issue.assignee || null,
                project: issue.project ? {
                    id: issue.project.id,
                    shortName: issue.project.shortName
                } : undefined,
                dueDate,
                estimation,
                spentTime,
                state,
                type,
                priority,
                attachments: issue.attachments || [],
                tags: issue.tags || [],
                links: issue.links || [],
                rawCustomFields: issue.customFields || [],
                timeline
            };
        } catch (err) {
            console.error(`Błąd pobierania historii dla zadania ${issue.idReadable}:`, err);
            return { ...issue, timeline: [] }; // fallback for single issue error
        }
    });

    return Promise.all(historyPromises);
};

export const fetchProjectWorkLogs = async (
    baseUrl: string,
    token: string,
    projectQuery: string,
    dateFrom: string, // YYYY-MM-DD
    dateTo: string    // YYYY-MM-DD
): Promise<WorkLogItem[]> => {
    if (!baseUrl || !token) throw new Error("Brak konfiguracji YouTrack (URL lub Token).");
    const apiBase = baseUrl.replace(/\/$/, '') + '/api';

    // Poprawna forma filtru projektu – jeśli nie ma operatora ':' to dodaj prefix 'project:'
    const safeProjectQuery = projectQuery.includes(':') 
        ? projectQuery 
        : `project: ${projectQuery}`;

    const query = `${safeProjectQuery} work date: ${dateFrom} .. ${dateTo}`;

    // --- Krok 1: Pobierz WSZYSTKIE pasujące zadania (z paginacją) ---
    const allIssues: any[] = [];
    const PAGE_SIZE = 100;
    let skip = 0;

    while (true) {
        const page: any[] = await makeRequest(`${apiBase}/issues`, token, {
            query,
            fields: 'id,idReadable,summary',
            $top: PAGE_SIZE,
            $skip: skip
        });

        if (!Array.isArray(page) || page.length === 0) break;
        allIssues.push(...page);
        if (page.length < PAGE_SIZE) break; // ostatnia strona
        skip += PAGE_SIZE;
    }

    const workLogs: WorkLogItem[] = [];
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59`).getTime();

    // --- Krok 2: Dla każdego zadania pobierz WSZYSTKIE logi czasu (z paginacją) ---
    const timePromises = allIssues.map(async (issue) => {
        try {
            const allWorkItems: any[] = [];
            let wiSkip = 0;

            while (true) {
                const page: any[] = await makeRequest(
                    `${apiBase}/issues/${issue.id}/timeTracking/workItems`,
                    token,
                    {
                        fields: 'id,date,duration(minutes,presentation),author(name,login),text,type(name)',
                        $top: PAGE_SIZE,
                        $skip: wiSkip
                    }
                );

                if (!Array.isArray(page) || page.length === 0) break;
                allWorkItems.push(...page);
                if (page.length < PAGE_SIZE) break;
                wiSkip += PAGE_SIZE;
            }

            allWorkItems.forEach((wi: any) => {
                const logDate = wi.date;
                // Filtrowanie po stronie klienta jako zabezpieczenie (API filtruje zadania, nie workItems)
                if (logDate >= fromTime && logDate <= toTime) {
                    workLogs.push({
                        id: wi.id,
                        issueId: issue.id,
                        issueReadableId: issue.idReadable,
                        issueSummary: issue.summary,
                        date: wi.date,
                        durationMinutes: wi.duration?.minutes || 0,
                        durationPresentation: wi.duration?.presentation || '',
                        authorName: wi.author?.name || 'System',
                        authorLogin: wi.author?.login || 'system',
                        text: wi.text || '',
                        workType: wi.type?.name || ''
                    });
                }
            });
        } catch (err) {
            console.error(`Błąd dociągania logów czasu dla zadania ${issue.idReadable}:`, err);
        }
    });

    await Promise.all(timePromises);

    // Sortuj od najnowszego do najstarszego
    workLogs.sort((a, b) => b.date - a.date);

    return workLogs;
};
