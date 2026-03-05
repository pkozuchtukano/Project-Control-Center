import { contextBridge, ipcRenderer } from 'electron';

// Expose safe context to the React app
contextBridge.exposeInMainWorld('electron', {
    readDb: () => ipcRenderer.invoke('read-db'),
    writeDb: (data: any) => ipcRenderer.invoke('write-db', data),
    fetchYouTrack: (options: any) => ipcRenderer.invoke('fetch-youtrack', options),
    getExcludedIssues: () => ipcRenderer.invoke('get-excluded-issues'),
    setIssueExcluded: (id: string, excluded: boolean) => ipcRenderer.invoke('set-issue-excluded', { id, excluded }),
});

