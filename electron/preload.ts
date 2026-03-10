import { contextBridge, ipcRenderer } from 'electron';

// Expose safe context to the React app
contextBridge.exposeInMainWorld('electron', {
    readDb: () => ipcRenderer.invoke('read-db'),
    writeDb: (data: any) => ipcRenderer.invoke('write-db', data),
    fetchYouTrack: (options: any) => ipcRenderer.invoke('fetch-youtrack', options),
    getExcludedIssues: () => ipcRenderer.invoke('get-excluded-issues'),
    setIssueExcluded: (id: string, excluded: boolean) => ipcRenderer.invoke('set-issue-excluded', { id, excluded }),
    getYoutrackTabs: (projectId: string) => ipcRenderer.invoke('get-youtrack-tabs', projectId),
    saveYoutrackTab: (tab: { id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }) => ipcRenderer.invoke('save-youtrack-tab', tab),
    deleteYoutrackTab: (id: string) => ipcRenderer.invoke('delete-youtrack-tab', id),
    reorderYoutrackTabs: (tabs: { id: string; orderIndex: number }[]) => ipcRenderer.invoke('reorder-youtrack-tabs', tabs),
    getIssueTaskTypes: (issueIds: string[]) => ipcRenderer.invoke('get-issue-task-types', issueIds),
    setIssueTaskType: (issueId: string, taskTypeId: string) => ipcRenderer.invoke('set-issue-task-type', issueId, taskTypeId),
    getWorkItems: (projectId: string) => ipcRenderer.invoke('get-work-items', projectId),
    upsertWorkItems: (data: { items: any[], projectId: string }) => ipcRenderer.invoke('upsert-work-items', data),
    getIssueCategories: () => ipcRenderer.invoke('get-issue-categories'),
    setIssueCategory: (data: { issueId: string, category: string }) => ipcRenderer.invoke('set-issue-category', data),
    setIssueCategoriesBulk: (data: { issueIds: string[], category: string }) => ipcRenderer.invoke('set-issue-categories-bulk', data),
    importWorkItems: (data: { items: any[], projectId: string }) => ipcRenderer.invoke('import-work-items', data),
    importOrders: (data: { orders: any[], projectId: string }) => ipcRenderer.invoke('import-orders', data),
});

