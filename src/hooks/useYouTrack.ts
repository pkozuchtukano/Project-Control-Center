import { useState, useCallback } from 'react';
import { fetchIssuesActivity, type IssueWithHistory } from '../services/youtrackApi';

export const useYouTrack = () => {
    const [data, setData] = useState<IssueWithHistory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(async (baseUrl: string, token: string, projectName: string, dateFrom: string, dateTo: string) => {
        if (!baseUrl || !token) {
            setError('Brak konfiguracji YouTrack. Przejdź do Ustawień Głównych, aby podać adres URL i Permanent Token.');
            return;
        }
        if (!projectName) {
            setError('Brak kodu projektu YouTrack.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Opcjonalnie: cache logic
            const cacheKey = `yt_${projectName}_${dateFrom}_${dateTo}`;
            const cached = localStorage.getItem(cacheKey);

            const results = await fetchIssuesActivity(baseUrl, token, projectName, dateFrom, dateTo);
            setData(results);
            localStorage.setItem(cacheKey, JSON.stringify(results));
        } catch (err: any) {
            console.error(err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                setError('Brak dostępu. Sprawdź swój token YouTrack.');
            } else if (err.code === 'ERR_NETWORK') {
                setError('Błąd sieci. Sprawdź połączenie i YouTrack Base URL.');
            } else {
                setError(err.message || 'Wystąpił nieznany błąd podczas łączenia z API.');
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadFromCache = useCallback((projectName: string, dateFrom: string, dateTo: string) => {
        const cacheKey = `yt_${projectName}_${dateFrom}_${dateTo}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                setData(JSON.parse(cached));
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }, []);

    const clearData = useCallback(() => {
        setData([]);
        setError(null);
    }, []);

    return {
        data,
        isLoading,
        error,
        fetchHistory,
        loadFromCache,
        clearData
    };
};
