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
});

