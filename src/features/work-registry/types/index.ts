export interface WorkItem {
    id: string;
    issueId: string;
    issueReadableId: string;
    issueSummary: string;
    issueType?: string | null;
    author: string;
    authorName: string;
    date: string; // ISO string
    minutes: number;
    description: string;
    lastModified: string;
}

export type WorkCategory = 'Programistyczne' | 'Obsługa projektu' | 'Inne';

export interface WorkItemRow extends WorkItem {
    category: WorkCategory;
}

export interface SyncProgress {
    totalChunks: number;
    currentChunk: number;
    currentMonth: string;
    status: 'idle' | 'syncing' | 'completed' | 'error';
    error?: string;
}
