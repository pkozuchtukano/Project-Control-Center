import axios from 'axios';

export interface YouTrackIssue {
    id: string;
    idReadable: string;
    summary: string;
    resolved?: number | null;
}

export interface ActivityItem {
    type: 'comment' | 'field-change' | 'description-change';
    id: string;
    timestamp: number;
    author: { name: string; login: string };
    field?: string;
    added?: string | any[];
    removed?: string | any[];
    text?: string;
}

export interface IssueWithHistory extends YouTrackIssue {
    timeline: ActivityItem[];
}

const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
});

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

    const issuesRes = await axios.get(`${apiBase}/issues`, {
        headers: getHeaders(token),
        params: {
            query,
            fields: 'id,idReadable,summary,resolved',
            $top: 100 // reasonable limit for typical usage
        }
    });

    const issues: YouTrackIssue[] = issuesRes.data;

    // 2. For each issue, fetch full activity (comments + field changes)
    // We use Promise.all to fetch them concurrently. We limit fields to keep response light.
    const historyPromises = issues.map(async (issue) => {
        try {
            // Activities endpoint
            const activitiesRes = await axios.get(`${apiBase}/issues/${issue.id}/activities`, {
                headers: getHeaders(token),
                params: {
                    categories: 'CommentsCategory,IssueCreatedCategory,ProjectCategory,IssueResolvedCategory,CustomFieldCategory,SummaryCategory,DescriptionCategory',
                    fields: 'id,timestamp,author(name,login),category(id),added(name,text,name),removed(name,text,name),field(customField(name),name),text'
                }
            });

            const rawActivities = activitiesRes.data || [];
            const timeline: ActivityItem[] = [];

            rawActivities.forEach((activity: any) => {
                const catId = activity.category?.id;
                const author = activity.author || { name: 'System', login: 'system' };

                if (catId === 'CommentsCategory') {
                    // It's a comment
                    // Current YouTrack API might nest comment text in added[0].text
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
                    // Field change (Status, Priority, etc.)
                    const fieldName = activity.field?.customField?.name || activity.field?.name || 'Pole';
                    const added = activity.added?.[0]?.name || activity.added?.[0] || 'Brak';
                    const removed = activity.removed?.[0]?.name || activity.removed?.[0] || 'Brak';

                    // Skip if it's just raw arrays of obscure objects without names, try to extract strings

                    timeline.push({
                        type: 'field-change',
                        id: activity.id,
                        timestamp: activity.timestamp,
                        author,
                        field: fieldName,
                        added: typeof added === 'string' ? added : JSON.stringify(added),
                        removed: typeof removed === 'string' ? removed : JSON.stringify(removed)
                    });
                } else if (catId === 'DescriptionCategory') {
                    timeline.push({
                        type: 'description-change',
                        id: activity.id,
                        timestamp: activity.timestamp,
                        author
                    });
                }
            });

            // Sort timeline chronologically
            timeline.sort((a, b) => b.timestamp - a.timestamp); // Sort newest first by default

            return {
                ...issue,
                timeline
            };
        } catch (err) {
            console.error(`Błąd pobierania historii dla zadania ${issue.idReadable}:`, err);
            return { ...issue, timeline: [] }; // fallback for single issue error
        }
    });

    return Promise.all(historyPromises);
};
