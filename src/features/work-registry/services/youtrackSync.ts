import { format, addMonths, startOfMonth, endOfMonth, isAfter, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { type WorkItem } from '../types';
import { fetchProjectWorkLogs } from '../../../services/youtrackApi';

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
    dateTo: string,
    baseUrl: string,
    token: string,
    onProgress: (p: SyncProgress) => void
) => {
    try {
        let parsedFrom = parseISO(dateFrom);
        if (isNaN(parsedFrom.getTime())) {
            console.warn('Invalid dateFrom provided to syncWorkItems, defaulting to start of current month:', dateFrom);
            parsedFrom = new Date();
        }

        let parsedTo = parseISO(dateTo);
        if (isNaN(parsedTo.getTime())) {
            console.warn('Invalid dateTo provided to syncWorkItems, defaulting to current end of month:', dateTo);
            parsedTo = new Date();
        }

        const start = startOfMonth(parsedFrom);
        const end = endOfMonth(parsedTo);

        let currentIntervalStart = start;
        const chunks: { from: string; to: string; label: string }[] = [];

        while (!isAfter(currentIntervalStart, end)) {
            const chunkEnd = endOfMonth(currentIntervalStart);
            chunks.push({
                from: format(currentIntervalStart, 'yyyy-MM-dd'),
                to: format(chunkEnd, 'yyyy-MM-dd'),
                label: format(currentIntervalStart, 'LLLL yyyy', { locale: pl })
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

            const workLogs = await fetchProjectWorkLogs(
                baseUrl,
                token,
                youtrackQuery || projectId,
                chunk.from,
                chunk.to
            );

            const items: WorkItem[] = workLogs.map(log => ({
                id: log.id,
                issueId: log.issueId,
                issueReadableId: log.issueReadableId,
                issueSummary: log.issueSummary,
                issueType: log.issueType || null,
                author: log.authorLogin || log.authorName || 'Unknown',
                authorName: log.authorName || 'Unknown',
                date: new Date(log.date).toISOString(),
                minutes: log.durationMinutes || 0,
                description: log.text || '',
                lastModified: new Date(log.date).toISOString()
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
