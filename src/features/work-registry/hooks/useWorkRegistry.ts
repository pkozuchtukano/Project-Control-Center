import { useState, useEffect, useCallback } from 'react';
import { type Project } from '../../../App';
import { type WorkItem, type WorkCategory, type WorkItemRow } from '../types';

declare const window: any;

export const useWorkRegistry = (project: Project | null) => {
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [categories, setCategories] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!project) return;
        setIsLoading(true);
        try {
            const [items, cats] = await Promise.all([
                window.electron.getWorkItems(project.id),
                window.electron.getIssueCategories()
            ]);
            setWorkItems(items);
            setCategories(cats);
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

    const workItemRows: WorkItemRow[] = workItems.map(item => ({
        ...item,
        category: (categories[item.issueId] as WorkCategory) || 'Programistyczne'
    }));

    return {
        workItems: workItemRows,
        isLoading,
        error,
        setCategory,
        refresh: loadData
    };
};
