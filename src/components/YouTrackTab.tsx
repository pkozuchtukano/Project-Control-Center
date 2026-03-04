import { useState, useEffect } from 'react';
import { useYouTrack } from '../hooks/useYouTrack';
import { useProjectContext, type Project } from '../App';
import { format, subDays } from 'date-fns';
import { Loader2, RefreshCw, AlertCircle, MessageSquare, Edit3, Activity, Clock } from 'lucide-react';
import type { ActivityItem } from '../services/youtrackApi';

export const YouTrackTab = ({ project }: { project: Project }) => {
    const { settings } = useProjectContext();

    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [useCache, setUseCache] = useState(true);

    const { data, isLoading, error, fetchHistory, loadFromCache } = useYouTrack();

    const handleFetch = (forceRefresh = false) => {
        if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;

        if (!forceRefresh && useCache) {
            const loaded = loadFromCache(project.code, dateFrom, dateTo);
            if (loaded) return;
        }

        fetchHistory(settings.youtrackBaseUrl, settings.youtrackToken, project.code, dateFrom, dateTo);
    };

    useEffect(() => {
        handleFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id]); // Reload when changing projects

    const renderTimelineItem = (item: ActivityItem) => {
        const timeStr = format(new Date(item.timestamp), 'dd.MM HH:mm');
        const authorName = item.author.name || item.author.login;

        switch (item.type) {
            case 'comment':
                return (
                    <div key={item.id} className="flex gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group">
                        <div className="mt-1 flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                                <MessageSquare size={14} />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{authorName}</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> {timeStr}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 break-words bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
                                {item.text || 'Dodano komentarz bez treści (lub niedostępny).'}
                            </p>
                        </div>
                    </div>
                );

            case 'field-change':
                return (
                    <div key={item.id} className="flex gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group relative before:absolute before:left-7 before:top-10 before:bottom-[-10px] before:w-[2px] before:bg-gray-100 dark:before:bg-gray-800 last:before:hidden">
                        <div className="mt-1 flex-shrink-0 z-10 relative bg-white dark:bg-gray-800 rounded-full">
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center border-4 border-white dark:border-gray-800">
                                <Activity size={14} />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{authorName}</span>
                                <span className="text-xs text-gray-500">{timeStr}</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                zmienił/a <span className="font-medium text-gray-900 dark:text-gray-200">{item.field}</span> z <span className="line-through text-gray-400">{item.removed}</span> na <span className="font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 px-1 rounded">{item.added}</span>
                            </p>
                        </div>
                    </div>
                );

            case 'description-change':
                return (
                    <div key={item.id} className="flex gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group">
                        <div className="mt-1 flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center">
                                <Edit3 size={14} />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{authorName}</span>
                                <span className="text-xs text-gray-500">{timeStr}</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                zaktualizował/a opis zadania
                            </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <AlertCircle size={48} className="text-orange-400 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Brak Konfiguracji YouTrack</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">Przejdź do Ustawień Głównych (ikona zębatki w panelu bocznym) i wprowadź adres Base URL oraz Permanent Token do platformy YouTrack.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">

            {/* FILTERS PANEL */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Od</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Do</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={useCache} onChange={() => setUseCache(!useCache)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        Używaj cache
                    </label>
                    <button
                        onClick={() => handleFetch(true)}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {isLoading ? "Pobieranie..." : "Odśwież Oś Czasu"}
                    </button>
                </div>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-start gap-3 border border-red-100 dark:border-red-800/50">
                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                    <div className="font-medium">Wystąpił błąd: <span className="font-normal block mt-1">{error}</span></div>
                </div>
            )}

            {/* RESULTS LIST */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {!isLoading && data.length === 0 && !error && (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">Brak aktywności w wybranym przedziale czasowym dla projektu {project.code}.</p>
                    </div>
                )}

                {data.map(issue => (
                    <div key={issue.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-start justify-between">
                            <div>
                                <a
                                    href={`${settings.youtrackBaseUrl}/issue/${issue.idReadable}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mb-1 inline-block"
                                >
                                    {issue.idReadable}
                                </a>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{issue.summary}</h3>
                            </div>
                            {issue.resolved && (
                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                    Rozwiązane
                                </span>
                            )}
                        </div>

                        <div className="p-4 bg-white dark:bg-gray-800">
                            {issue.timeline.length > 0 ? (
                                <div className="space-y-1">
                                    {issue.timeline.map((item, idx) => (
                                        <div key={`${item.id}-${idx}`}>
                                            {renderTimelineItem(item)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic p-2">Nie wykryto wpisów w historii.</p>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && data.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 size={32} className="animate-spin text-indigo-500 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Synchronizacja danych z YouTrack...</p>
                    </div>
                )}
            </div>

        </div>
    );
};
