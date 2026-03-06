import { useState } from 'react';
import { type Project, useProjectContext } from '../App';
import { format } from 'date-fns';
import { Loader2, Search, Calendar, HardHat, FileSpreadsheet } from 'lucide-react';
import { fetchProjectWorkLogs, type WorkLogItem } from '../services/youtrackApi';

export const WorkRegistryYouTrackView = ({ project }: { project: Project }) => {
    const { settings } = useProjectContext();
    const [query, setQuery] = useState(project.youtrackQuery || project.code || '');
    
    // Default dates to current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const [dateFrom, setDateFrom] = useState(format(firstDay, 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(lastDay, 'yyyy-MM-dd'));

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workLogs, setWorkLogs] = useState<WorkLogItem[]>([]);
    const [hasFetched, setHasFetched] = useState(false);

    const handleFetch = async () => {
        if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) {
            setError('Brak konfiguracji YouTrack w Ustawieniach Głównych.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const logs = await fetchProjectWorkLogs(
                settings.youtrackBaseUrl,
                settings.youtrackToken,
                query,
                dateFrom,
                dateTo
            );
            setWorkLogs(logs);
            setHasFetched(true);
        } catch (err: any) {
            console.error('Błąd pobierania raportów pracy YouTrack:', err);
            setError(err.message || 'Wystąpił błąd podczas komunikacji z bazą YouTrack.');
        } finally {
            setIsLoading(false);
        }
    };

    // Grouping Logic
    // 1st level: Month-Year (np. "Styczeń 2026")
    // 2nd level: Day (np. "26.01.2026")
    // 3rd level: Array of WorkLogItem

    const groupedLogs = workLogs.reduce((acc, log) => {
        const d = new Date(log.date);
        const monthYear = format(d, 'MM.yyyy');
        const dayStr = format(d, 'dd.MM.yyyy');

        if (!acc[monthYear]) acc[monthYear] = {};
        if (!acc[monthYear][dayStr]) acc[monthYear][dayStr] = [];

        acc[monthYear][dayStr].push(log);
        return acc;
    }, {} as Record<string, Record<string, WorkLogItem[]>>);

    const getMonthName = (monthYear: string) => {
        const [m, y] = monthYear.split('.');
        const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
        return `${months[Number(m) - 1]} ${y}`;
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/30 dark:bg-gray-900/10 -m-6 p-6 rounded-b-2xl">
            {/* Control Panel / Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-6 sticky top-0 z-10">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Kod / Zapytanie projektu
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                placeholder="Np. project: TEST"
                            />
                        </div>
                    </div>
                    
                    <div className="w-36 shrink-0">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Data OD
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full pl-9 pr-2 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="w-36 shrink-0">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Data DO
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full pl-9 pr-2 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleFetch}
                        disabled={isLoading}
                        className="h-[38px] px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <FileSpreadsheet size={16} />
                        )}
                        Pobierz dane
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-800/50 mb-6 text-sm flex items-center gap-2">
                    <span className="font-semibold">Błąd:</span> {error}
                </div>
            )}

            {/* Results Area */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 overflow-y-auto">
                {!hasFetched && !isLoading && workLogs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
                            <HardHat size={28} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Gotowy do zaciągnięcia raportów</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm">
                            Wybierz przedział czasu na górnym pasku i naciśnij "Pobierz dane", aby wczytać logi czasu pracy.
                        </p>
                    </div>
                )}

                {isLoading && workLogs.length === 0 && (
                    <div className="flex justify-center items-center py-24">
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                    </div>
                )}

                {hasFetched && workLogs.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 italic">
                        Brak zarejestrowanego czasu pracy we wskazanym okresie.
                    </div>
                )}

                {/* Listing */}
                {Object.keys(groupedLogs).map((monthYear) => {
                    const monthLogs = groupedLogs[monthYear];
                    // Aggregate stats for month
                    let totalMonthMinutes = 0;
                    Object.values(monthLogs).flat().forEach(l => totalMonthMinutes += l.durationMinutes);
                    const mh = Math.floor(totalMonthMinutes / 60);
                    const mm = totalMonthMinutes % 60;

                    return (
                        <div key={monthYear} className="mb-8 last:mb-0">
                            {/* Month Header */}
                            <div className="flex items-center justify-between border-b-2 border-indigo-100 dark:border-indigo-900 pb-2 mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                                    {getMonthName(monthYear)}
                                </h3>
                                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-semibold">
                                    {mh}h {mm > 0 ? `${mm}m` : ''}
                                </span>
                            </div>

                            {/* Days Iteration */}
                            <div className="space-y-6">
                                {Object.keys(monthLogs).map((dayStr) => {
                                    const dayLogs = monthLogs[dayStr];
                                    
                                    // Aggregate stats for day
                                    let totalDayMinutes = 0;
                                    dayLogs.forEach(l => totalDayMinutes += l.durationMinutes);
                                    const dh = Math.floor(totalDayMinutes / 60);
                                    const dm = totalDayMinutes % 60;

                                    return (
                                        <div key={dayStr} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                                            {/* Day Header */}
                                            <div className="bg-gray-100/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-gray-500" />
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm">{dayStr}</span>
                                                </div>
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                    Suma: <span className="text-gray-700 dark:text-gray-200 font-semibold">{dh}h {dm > 0 ? `${dm}m` : ''}</span>
                                                </span>
                                            </div>

                                            {/* Day Logs List */}
                                            <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                                {(() => {
                                                    // Group by issue inside the day
                                                    const groupedByIssue = dayLogs.reduce((acc, log) => {
                                                        if (!acc[log.issueReadableId]) {
                                                            acc[log.issueReadableId] = {
                                                                summary: log.issueSummary,
                                                                logs: []
                                                            };
                                                        }
                                                        acc[log.issueReadableId].logs.push(log);
                                                        return acc;
                                                    }, {} as Record<string, { summary: string, logs: WorkLogItem[] }>);

                                                    return Object.keys(groupedByIssue).map(issueId => {
                                                        const issueData = groupedByIssue[issueId];
                                                        return (
                                                            <div key={issueId} className="px-4 py-4 flex flex-col gap-2 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                                                {/* Task Header */}
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <a href={`${settings?.youtrackBaseUrl}/issue/${issueId}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                                                        {issueId}
                                                                    </a>
                                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
                                                                        {issueData.summary}
                                                                    </span>
                                                                </div>

                                                                {/* Logs list for this task */}
                                                                <div className="space-y-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700 ml-1 mt-1">
                                                                    {issueData.logs.map((log) => (
                                                                        <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                                            {/* Author */}
                                                                            <div className="w-full sm:w-48 shrink-0 flex items-center gap-1.5 align-top pt-0.5">
                                                                                <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                                                                                    {log.authorName.charAt(0).toUpperCase()}
                                                                                </div>
                                                                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate" title={log.authorName}>
                                                                                    {log.authorName}
                                                                                </span>
                                                                            </div>

                                                                            {/* Logged Time */}
                                                                            <div className="w-24 shrink-0">
                                                                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded inline-block">
                                                                                    {log.durationPresentation}
                                                                                </span>
                                                                            </div>

                                                                            {/* Comment */}
                                                                            <div className="flex-1 min-w-0">
                                                                                {log.text && (
                                                                                    <span className="text-sm text-gray-600 dark:text-gray-400 italic">
                                                                                        "{log.text}"
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
