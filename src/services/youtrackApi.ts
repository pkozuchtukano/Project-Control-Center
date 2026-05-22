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
    issueType?: string;
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

const buildProjectWorkItemsQuery = (projectQuery: string) => {
    const trimmedQuery = projectQuery.trim();
    if (!trimmedQuery) return '';
    if (trimmedQuery.includes(':')) return trimmedQuery;

    const projectValue = /\s/.test(trimmedQuery) ? `{${trimmedQuery}}` : trimmedQuery;
    return `project: ${projectValue}`;
};

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

const formatTimestampFieldValue = (value: string) => {
    if (value === 'Brak' || value.trim() === '') return value;
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return value;

    const parsedDate = new Date(numericValue);
    if (Number.isNaN(parsedDate.getTime())) return value;

    return parsedDate.toLocaleString('pl-PL');
};

const extractUnsupportedStateValue = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '');
    const match = message.match(/The value "([^"]+)" isn't used for the State field/i);
    return match?.[1] || null;
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
    let effectiveCustomStatuses = customStatuses ? [...customStatuses] : undefined;

    if (effectiveCustomStatuses && effectiveCustomStatuses.length > 0) {
        const stateFilter = effectiveCustomStatuses.map(s => `{${s}}`).join(', ');
        
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
        try {
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
        } catch (error) {
            const unsupportedState = extractUnsupportedStateValue(error);
            if (!unsupportedState || !effectiveCustomStatuses?.length) {
                throw error;
            }

            const nextStatuses = effectiveCustomStatuses.filter(
                status => status.toLowerCase() !== unsupportedState.toLowerCase()
            );
            if (nextStatuses.length === effectiveCustomStatuses.length) {
                throw error;
            }

            console.warn(`Status "${unsupportedState}" nie jest używany w projekcie ${projectName}; pomijam go w zapytaniu Daily.`);
            effectiveCustomStatuses = nextStatuses.length > 0 ? nextStatuses : undefined;
            const stateFilter = effectiveCustomStatuses?.map(s => `{${s}}`).join(', ');
            if (stateFilter && tab === 'Aktywności') {
                query = `project: ${projectName} updated: ${dateFrom} .. ${dateTo} or project: ${projectName} State: ${stateFilter}`;
            } else if (stateFilter) {
                query = `project: ${projectName} State: ${stateFilter}`;
                if (includeFilters === true || (isZakonczone && includeFilters !== false)) {
                    query += ` updated: ${dateFrom} .. ${dateTo}`;
                }
            } else if (tab === 'Do zrobienia') {
                query = `project: ${projectName} State: {To Do}`;
            } else {
                query = `project: ${projectName} updated: ${dateFrom} .. ${dateTo}`;
            }
            issues.length = 0;
            issueSkip = 0;
        }
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
                    const normalizedFieldName = fieldName.toLowerCase();
                    if (normalizedFieldName === 'resolved date' || normalizedFieldName === 'due date' || normalizedFieldName === 'termin') {
                        added = formatTimestampFieldValue(added);
                        removed = formatTimestampFieldValue(removed);
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
    const query = buildProjectWorkItemsQuery(projectQuery);
    const PAGE_SIZE = 100;
    let skip = 0;
    const workLogs: WorkLogItem[] = [];

    while (true) {
        const page: any[] = await makeRequest(`${apiBase}/workItems`, token, {
            query,
            startDate: dateFrom,
            endDate: dateTo,
            fields: 'id,date,duration(minutes,presentation),author(name,login),text,type(name),issue(id,idReadable,summary,customFields(name,value(name,presentation)))',
            $top: PAGE_SIZE,
            $skip: skip
        });

        if (!Array.isArray(page) || page.length === 0) break;

        page.forEach((wi: any) => {
            const issue = wi.issue || {};
            let issueType = '';
            if (Array.isArray(issue.customFields)) {
                const typeField = issue.customFields.find((field: any) => {
                    const fieldName = String(field?.name || '').toLowerCase();
                    return fieldName === 'type' || fieldName === 'typ';
                });
                const typeValue = typeField?.value;
                issueType = typeValue?.name || typeValue?.presentation || '';
            }

            workLogs.push({
                id: wi.id,
                issueId: issue.id || '',
                issueReadableId: issue.idReadable || '',
                issueSummary: issue.summary || '',
                issueType,
                date: wi.date,
                durationMinutes: wi.duration?.minutes || 0,
                durationPresentation: wi.duration?.presentation || '',
                authorName: wi.author?.name || 'System',
                authorLogin: wi.author?.login || 'system',
                text: wi.text || '',
                workType: wi.type?.name || ''
            });
        });

        if (page.length < PAGE_SIZE) break;
        skip += PAGE_SIZE;
    }

    workLogs.sort((a, b) => b.date - a.date);

    return workLogs;
};
