import { format, addMonths, startOfMonth, endOfMonth, isAfter, parseISO } from 'date-fns';
import { type WorkItem } from '../types';

declare const window: any;

export interface SyncProgress {
    totalChunks: number;
    currentChunk: number;
    currentMonth: string;
    status: 'idle' | 'syncing' | 'completed' | 'error';
    error?: string;
}

export const syncWorkItems = async (
    projectId: string,
    youtrackQuery: string,
    dateFrom: string,
    baseUrl: string,
    token: string,
    onProgress: (p: SyncProgress) => void
) => {
    try {
        // Fallback if dateFrom is missing or invalid
        let parsedDate = parseISO(dateFrom);
        if (isNaN(parsedDate.getTime())) {
            console.warn('Invalid dateFrom provided to syncWorkItems, defaulting to start of current month:', dateFrom);
            parsedDate = new Date();
        }

        const start = startOfMonth(parsedDate);
        const now = new Date();
        const end = endOfMonth(now);

        let currentIntervalStart = start;
        const chunks: { from: string; to: string; label: string }[] = [];

        while (!isAfter(currentIntervalStart, end)) {
            const chunkEnd = endOfMonth(currentIntervalStart);
            chunks.push({
                from: format(currentIntervalStart, 'yyyy-MM-dd'),
                to: format(chunkEnd, 'yyyy-MM-dd'),
                label: format(currentIntervalStart, 'LLLL yyyy')
            });
            currentIntervalStart = addMonths(currentIntervalStart, 1);
        }

        if (chunks.length === 0) {
            onProgress({
                totalChunks: 0,
                currentChunk: 0,
                currentMonth: '',
                status: 'completed'
            });
            return;
        }

        onProgress({
            totalChunks: chunks.length,
            currentChunk: 0,
            currentMonth: chunks[0].label,
            status: 'syncing'
        });

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            onProgress({
                totalChunks: chunks.length,
                currentChunk: i + 1,
                currentMonth: chunk.label,
                status: 'syncing'
            });

            // Improved YouTrack query: use youtrackQuery if available, otherwise just project ID
            // We use the same logic as in YouTrackTab: youtrackQuery || project.code || project.id
            const projectFilter = youtrackQuery ? `{${youtrackQuery}}` : `{${projectId}}`;
            const query = encodeURIComponent(`work date: ${chunk.from} .. ${chunk.to} project: ${projectFilter}`);
            const url = `${baseUrl}/api/workItems?fields=$type,author(id,name),created,creator(id,name),date,duration(id,minutes),id,issue(id,idReadable,summary),text,updated&query=${query}&$top=1000`;

            const response = await window.electron.fetchYouTrack({
                url,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            const items: WorkItem[] = response.map((item: any) => ({
                id: item.id,
                issueId: item.issue.id,
                issueReadableId: item.issue.idReadable,
                issueSummary: item.issue.summary,
                author: item.author?.id || item.author?.name || 'Unknown',
                authorName: item.author?.name || 'Unknown',
                date: new Date(item.date).toISOString(),
                minutes: item.duration?.minutes || 0,
                description: item.text || '',
                lastModified: new Date(item.updated || item.created).toISOString()
            }));

            if (items.length > 0) {
                await window.electron.upsertWorkItems({ items, projectId });
            }

            // Small delay to prevent hammering
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        onProgress({
            totalChunks: chunks.length,
            currentChunk: chunks.length,
            currentMonth: 'Zakończono',
            status: 'completed'
        });

    } catch (error: any) {
        console.error('Błąd synchronizacji:', error);
        onProgress({
            totalChunks: 0,
            currentChunk: 0,
            currentMonth: '',
            status: 'error',
            error: error.message || 'Wystąpił nieoczekiwany błąd'
        });
    }
};
