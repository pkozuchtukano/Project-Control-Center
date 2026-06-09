import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../../../types';
import { type WorkItem, type WorkCategory, type WorkItemRow } from '../types';

declare const window: any;

const ISSUE_MAINTENANCE_STORAGE_KEY = 'pcc_issue_maintenance_flags';

const readLegacyMaintenanceFlagsFromStorage = (): Record<string, boolean> => {
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

const clearLegacyMaintenanceFlagsFromStorage = () => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(ISSUE_MAINTENANCE_STORAGE_KEY);
    } catch {
        // ignore legacy storage cleanup failures
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
            if (typeof window.electron.getIssueMaintenanceFlags !== 'function') {
                throw new Error('Brak dostępu do bazy flag utrzymania.');
            }

            const [items, cats, dbFlags] = await Promise.all([
                window.electron.getWorkItems(project.id),
                window.electron.getIssueCategories(),
                window.electron.getIssueMaintenanceFlags()
            ]);
            const legacyFlags = readLegacyMaintenanceFlagsFromStorage();
            const legacyEntriesToMigrate = Object.entries(legacyFlags)
                .filter(([issueId]) => dbFlags[issueId] === undefined);

            if (legacyEntriesToMigrate.length > 0) {
                if (typeof window.electron.setIssueMaintenanceFlag !== 'function') {
                    throw new Error('Brak dostępu do zapisu flag utrzymania w bazie.');
                }

                await Promise.all(legacyEntriesToMigrate.map(([issueId, isMaintenance]) =>
                    window.electron.setIssueMaintenanceFlag({ issueId, isMaintenance })
                ));
                clearLegacyMaintenanceFlagsFromStorage();
            }

            setWorkItems(items);
            setCategories(cats);
            setMaintenanceFlags({ ...legacyFlags, ...dbFlags });
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
        const nextFlags = { ...maintenanceFlags, [issueId]: isMaintenance };
        setMaintenanceFlags(nextFlags);

        if (typeof window.electron.setIssueMaintenanceFlag !== 'function') {
            console.warn('setIssueMaintenanceFlag is unavailable in the current preload context.');
            return;
        }

        try {
            await window.electron.setIssueMaintenanceFlag({ issueId, isMaintenance });
        } catch (err: any) {
            console.error('Błąd zapisu flagi utrzymania:', err);
            setMaintenanceFlags(maintenanceFlags);
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
