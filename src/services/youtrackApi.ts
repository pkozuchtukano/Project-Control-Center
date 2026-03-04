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
    dueDate?: number | null;
    estimation?: {
        presentation: string;
        minutes: number;
    } | null;
    spentTime?: {
        presentation: string;
        minutes: number;
    } | null;
    state?: string | null;
    attachments?: {
        name: string;
        url: string;
    }[];
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
}

export interface IssueWithHistory extends YouTrackIssue {
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
    dateTo: string
): Promise<IssueWithHistory[]> => {
    if (!baseUrl || !token) throw new Error("Brak konfiguracji YouTrack (URL lub Token).");

    const apiBase = baseUrl.replace(/\/$/, '') + '/api';

    // 1. Fetch Issues modified in the given date range
    // Format query according to YouTrack search syntax: "project: {name} updated: {from} .. {to}"
    // YouTrack expects dates usually in clear text or specific format, we can use YYYY-MM-DD
    const query = `project: ${projectName} updated: ${dateFrom} .. ${dateTo}`;

    const issues: any[] = await makeRequest(`${apiBase}/issues`, token, {
        query,
        fields: 'id,idReadable,summary,resolved,description,customFields(name,value(presentation,name,id,minutes)),attachments(name,url)',
        $top: 100 // reasonable limit for typical usage
    });

    // 2. For each issue, fetch full activity (comments + field changes)
    // We use Promise.all to fetch them concurrently. We limit fields to keep response light.
    const historyPromises = issues.map(async (issue) => {
        try {
            // Activities endpoint
            const rawActivities = await makeRequest(`${apiBase}/issues/${issue.id}/activities`, token, {
                categories: 'CommentsCategory,IssueCreatedCategory,ProjectCategory,IssueResolvedCategory,CustomFieldCategory,SummaryCategory,DescriptionCategory,WorkItemCategory',
                fields: 'id,timestamp,author(name,login),category(id),added(name,text,presentation,duration(minutes,presentation),date),removed(name,text,presentation,duration(minutes,presentation),date),field(customField(name),name),text'
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
                        const dateStr = workItem.date ? new Date(workItem.date).toISOString().split('T')[0] : new Date(activity.timestamp).toISOString().split('T')[0];
                        const tempId = `work-${author.login}-${dateStr}`;

                        if (workAggregator[tempId]) {
                            workAggregator[tempId].minutes = (workAggregator[tempId].minutes || 0) + workItem.duration.minutes;
                            // Aktualizujemy timestamp na najnowszy
                            if (activity.timestamp > workAggregator[tempId].timestamp) {
                                workAggregator[tempId].timestamp = activity.timestamp;
                            }
                        } else {
                            workAggregator[tempId] = {
                                type: 'work-item',
                                id: tempId,
                                timestamp: activity.timestamp,
                                author,
                                minutes: workItem.duration.minutes,
                                dateStr
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
            let state: string | null = null;

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
                            state = f.value.name || f.value.presentation || String(f.value);
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
                dueDate,
                estimation,
                spentTime,
                state,
                attachments: issue.attachments || [],
                timeline
            };
        } catch (err) {
            console.error(`Błąd pobierania historii dla zadania ${issue.idReadable}:`, err);
            return { ...issue, timeline: [] }; // fallback for single issue error
        }
    });

    return Promise.all(historyPromises);
};
