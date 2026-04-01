import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../../../types';
import { type WorkItem, type WorkCategory, type WorkItemRow } from '../types';

declare const window: any;

const ISSUE_MAINTENANCE_STORAGE_KEY = 'pcc_issue_maintenance_flags';

const readMaintenanceFlagsFromStorage = (): Record<string, boolean> => {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(ISSUE_MAINTENANCE_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeMaintenanceFlagsToStorage = (flags: Record<string, boolean>) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(ISSUE_MAINTENANCE_STORAGE_KEY, JSON.stringify(flags));
    } catch {
        // ignore storage write failures
    }
};

export const useWorkRegistry = (project: Project | null) => {
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [categories, setCategories] = useState<Record<string, string>>({});
    const [maintenanceFlags, setMaintenanceFlags] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!project) return;
        setIsLoading(true);
        try {
            const storageFlags = readMaintenanceFlagsFromStorage();
            const getMaintenanceFlags =
                typeof window.electron.getIssueMaintenanceFlags === 'function'
                    ? window.electron.getIssueMaintenanceFlags()
                    : Promise.resolve(storageFlags);

            const [items, cats, flags] = await Promise.all([
                window.electron.getWorkItems(project.id),
                window.electron.getIssueCategories(),
                getMaintenanceFlags
            ]);
            setWorkItems(items);
            setCategories(cats);
            setMaintenanceFlags(flags);
            writeMaintenanceFlagsToStorage({ ...storageFlags, ...flags });
        } catch (err: any) {
            setError(err.message || 'Błąd ładowania danych');
        } finally {
            setIsLoading(false);
        }
    }, [project]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const setCategory = async (issueId: string, category: WorkCategory) => {
        try {
            await window.electron.setIssueCategory({ issueId, category });
            setCategories(prev => ({ ...prev, [issueId]: category }));
        } catch (err: any) {
            console.error('Błąd zapisu kategorii:', err);
        }
    };

    const setCategoriesBulk = async (issueIds: string[], category: WorkCategory) => {
        try {
            await window.electron.setIssueCategoriesBulk({ issueIds, category });
            setCategories(prev => {
                const next = { ...prev };
                issueIds.forEach(id => {
                    next[id] = category;
                });
                return next;
            });
        } catch (err: any) {
            console.error('Błąd masowego zapisu kategorii:', err);
        }
    };

    const setMaintenance = async (issueId: string, isMaintenance: boolean) => {
        const previousFlags = readMaintenanceFlagsFromStorage();
        const nextFlags = { ...previousFlags, [issueId]: isMaintenance };
        setMaintenanceFlags(nextFlags);
        writeMaintenanceFlagsToStorage(nextFlags);

        if (typeof window.electron.setIssueMaintenanceFlag !== 'function') {
            console.warn('setIssueMaintenanceFlag is unavailable in the current preload context.');
            return;
        }

        try {
            await window.electron.setIssueMaintenanceFlag({ issueId, isMaintenance });
        } catch (err: any) {
            console.error('Błąd zapisu flagi utrzymania:', err);
            const rollbackFlags = { ...nextFlags, [issueId]: !isMaintenance };
            setMaintenanceFlags(rollbackFlags);
            writeMaintenanceFlagsToStorage(rollbackFlags);
        }
    };

    const importItems = async (items: any[]) => {
        if (!project) return;
        try {
            await window.electron.importWorkItems({ items, projectId: project.id });
            await loadData();
        } catch (err: any) {
            console.error('Błąd importu:', err);
            setError(err.message || 'Błąd importu danych');
        }
    };

    const workItemRows: WorkItemRow[] = workItems.map(item => ({
        ...item,
        category: (categories[item.issueId] as WorkCategory) || 'Programistyczne',
        isMaintenance: Boolean(maintenanceFlags[item.issueId])
    }));

    return {
        workItems: workItemRows,
        isLoading,
        error,
        setCategory,
        setMaintenance,
        setCategoriesBulk,
        importItems,
        refresh: loadData
    };
};
