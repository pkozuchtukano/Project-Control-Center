import { useState, useEffect } from 'react';
import { type Project, useProjectContext } from '../App';
import { format } from 'date-fns';
import { Loader2, Search, Calendar, HardHat, FileSpreadsheet, ChevronDown, ChevronRight, ListCollapse } from 'lucide-react';
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

    // Accordion states
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
    const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set()); // key: dayStr + '_' + issueId
    const [isAllExpanded, setIsAllExpanded] = useState(false);

    // Reset view state when project changes via sidebar
    useEffect(() => {
        setWorkLogs([]);
        setHasFetched(false);
        setQuery(project.youtrackQuery || project.code || '');
        setExpandedMonths(new Set());
        setExpandedDays(new Set());
        setExpandedIssues(new Set());
        setIsAllExpanded(false);
    }, [project.id, project.youtrackQuery, project.code]);

    const toggleMonth = (monthYear: string) => {
        setExpandedMonths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(monthYear)) newSet.delete(monthYear);
            else newSet.add(monthYear);
            return newSet;
        });
    };

    const toggleDay = (dayStr: string) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayStr)) newSet.delete(dayStr);
            else newSet.add(dayStr);
            return newSet;
        });
    };

    const toggleIssue = (issueKey: string) => {
        setExpandedIssues(prev => {
            const newSet = new Set(prev);
            if (newSet.has(issueKey)) newSet.delete(issueKey);
            else newSet.add(issueKey);
            return newSet;
        });
    };

    const handleExpandAllToggle = () => {
        if (isAllExpanded) {
            setExpandedMonths(new Set());
            setExpandedDays(new Set());
            setExpandedIssues(new Set());
            setIsAllExpanded(false);
        } else {
            const newMonths = new Set<string>();
            const newDays = new Set<string>();
            const newIssues = new Set<string>();
            
            Object.keys(groupedLogs).forEach(monthKey => {
                newMonths.add(monthKey);
                Object.keys(groupedLogs[monthKey]).forEach(dayKey => {
                    newDays.add(dayKey);
                    // Add all issues for this day
                    const dayLogs = groupedLogs[monthKey][dayKey];
                    dayLogs.forEach(l => {
                        newIssues.add(`${dayKey}_${l.issueReadableId}`);
                    });
                });
            });

            setExpandedMonths(newMonths);
            setExpandedDays(newDays);
            setExpandedIssues(newIssues);
            setIsAllExpanded(true);
        }
    };

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

            // Automatyczne rozwinięcie pierwszego (najnowszego) miesiąca, dnia i jego zadań
            const newExpandedMonths = new Set<string>();
            const newExpandedDays = new Set<string>();
            const newExpandedIssues = new Set<string>();
            
            if (logs.length > 0) {
                const firstLogDateObj = new Date(logs[0].date);
                const firstLogMonth = format(firstLogDateObj, 'MM.yyyy');
                const firstLogDate = format(firstLogDateObj, 'dd.MM.yyyy');
                
                newExpandedMonths.add(firstLogMonth);
                newExpandedDays.add(firstLogDate);

                const firstDayLogs = logs.filter(l => format(new Date(l.date), 'dd.MM.yyyy') === firstLogDate);
                firstDayLogs.forEach(l => {
                    newExpandedIssues.add(`${firstLogDate}_${l.issueReadableId}`);
                });
            }

            setExpandedMonths(newExpandedMonths);
            setExpandedDays(newExpandedDays);
            setExpandedIssues(newExpandedIssues);
            setIsAllExpanded(false);
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
                    
                    {hasFetched && workLogs.length > 0 && (
                        <button
                            onClick={handleExpandAllToggle}
                            className="h-[38px] px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ml-auto"
                        >
                            <ListCollapse size={16} />
                            {isAllExpanded ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
                        </button>
                    )}
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
                        <div key={monthYear} className="mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                            {/* Month Header */}
                            <button 
                                onClick={() => toggleMonth(monthYear)}
                                className="w-full flex items-center justify-between p-4 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-2xl group"
                            >
                                <div className="flex items-center gap-2">
                                    {expandedMonths.has(monthYear) ? (
                                        <ChevronDown size={22} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                    ) : (
                                        <ChevronRight size={22} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                    )}
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                                        {getMonthName(monthYear)}
                                    </h3>
                                </div>
                                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                                    {mh}h {mm > 0 ? `${mm}m` : ''}
                                </span>
                            </button>

                            {/* Days Iteration */}
                            {expandedMonths.has(monthYear) && (
                                <div className="p-4 pt-0 space-y-4">
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
                                            <button 
                                                onClick={() => toggleDay(dayStr)}
                                                className="w-full bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between transition-colors focus:outline-none"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {expandedDays.has(dayStr) ? (
                                                        <ChevronDown size={18} className="text-gray-500" />
                                                    ) : (
                                                        <ChevronRight size={18} className="text-gray-500" />
                                                    )}
                                                    <Calendar size={14} className="text-gray-500" />
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm">{dayStr}</span>
                                                </div>
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                    Suma: <span className="text-gray-700 dark:text-gray-200 font-semibold">{dh}h {dm > 0 ? `${dm}m` : ''}</span>
                                                </span>
                                            </button>

                                            {/* Day Logs List */}
                                            {expandedDays.has(dayStr) && (
                                                <>
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
                                                                
                                                                // Aggregate stats for issue in this day
                                                                let totalIssueMinutes = 0;
                                                                issueData.logs.forEach(l => totalIssueMinutes += l.durationMinutes);
                                                                const ih = Math.floor(totalIssueMinutes / 60);
                                                                const im = totalIssueMinutes % 60;
                                                                
                                                                const issueKey = `${dayStr}_${issueId}`;
                                                                const isIssueExpanded = expandedIssues.has(issueKey);

                                                                return (
                                                                    <div key={issueId} className="flex flex-col hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                                                        {/* Task Header Button */}
                                                                        <div className="px-4 py-3 flex items-start sm:items-center justify-between gap-2 overflow-hidden w-full">
                                                                            <button 
                                                                                onClick={() => toggleIssue(issueKey)}
                                                                                className="flex flex-1 min-w-0 items-start sm:items-center gap-2 focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700/50 p-1 -ml-1 rounded transition-colors text-left"
                                                                            >
                                                                                {isIssueExpanded ? (
                                                                                    <ChevronDown size={16} className="text-gray-400 shrink-0 mt-0.5 sm:mt-0" />
                                                                                ) : (
                                                                                    <ChevronRight size={16} className="text-gray-400 shrink-0 mt-0.5 sm:mt-0" />
                                                                                )}
                                                                                
                                                                                {/* Kod Zadania jako link (można klikać osobno) */}
                                                                                <a 
                                                                                    href={`${settings?.youtrackBaseUrl}/issue/${issueId}`} 
                                                                                    target="_blank" 
                                                                                    rel="noreferrer" 
                                                                                    onClick={(e) => e.stopPropagation()} // Zapobiega rozwijaniu gdy klikamy w sam link
                                                                                    className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                                                                                >
                                                                                    {issueId}
                                                                                </a>

                                                                                {/* Tytuł zadania - elastyczny */}
                                                                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-2">
                                                                                    {issueData.summary}
                                                                                </span>
                                                                            </button>

                                                                            {/* Suma dla zadania - przyklejona do prawej */}
                                                                            <div className="shrink-0 w-24 text-right">
                                                                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded w-full inline-block text-center border border-emerald-100 dark:border-emerald-800/50">
                                                                                    {ih}h {im > 0 ? `${im}m` : ''}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Logs list for this task */}
                                                                        {isIssueExpanded && (
                                                                            <div className="space-y-3 pl-10 pr-4 pb-4 border-l-2 border-gray-100 dark:border-gray-700 ml-5 mt-1">
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
                                                                        )}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>

                                                    {/* Day Summary by Employees */}
                                                    <div className="bg-gray-100/30 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700 p-4">
                                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Przepracowano tego dnia</h4>
                                                        {(() => {
                                                            const authorsSum = dayLogs.reduce((acc, log) => {
                                                                if (!acc[log.authorName]) acc[log.authorName] = 0;
                                                                acc[log.authorName] += log.durationMinutes;
                                                                return acc;
                                                            }, {} as Record<string, number>);

                                                            // Sort by hours descending
                                                            const sortedAuthors = Object.entries(authorsSum).sort((a, b) => b[1] - a[1]);

                                                            return (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                                    {sortedAuthors.map(([author, minutes]) => {
                                                                        const h = Math.floor(minutes / 60);
                                                                        const m = minutes % 60;
                                                                        return (
                                                                            <div key={author} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 shadow-sm">
                                                                                <div className="flex items-center gap-2 truncate pr-2">
                                                                                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0">
                                                                                        {author.charAt(0).toUpperCase()}
                                                                                    </div>
                                                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{author}</span>
                                                                                </div>
                                                                                <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">
                                                                                    {h}h {m > 0 ? `${m}m` : ''}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Month Summary by Employees */}
                                <div className="mt-8 border-t-2 border-indigo-100 dark:border-indigo-900/50 pt-5 pb-2">
                                    <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2">
                                        📊 Zaangażowanie personelu w miesiącu
                                    </h4>
                                    {(() => {
                                        const allMonthLogs = Object.values(monthLogs).flat();
                                        const authorsSum = allMonthLogs.reduce((acc, log) => {
                                            if (!acc[log.authorName]) acc[log.authorName] = 0;
                                            acc[log.authorName] += log.durationMinutes;
                                            return acc;
                                        }, {} as Record<string, number>);

                                        // Sort by hours descending
                                        const sortedAuthors = Object.entries(authorsSum).sort((a, b) => b[1] - a[1]);

                                        return (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-wrap">
                                                {sortedAuthors.map(([author, minutes]) => {
                                                    const h = Math.floor(minutes / 60);
                                                    const m = minutes % 60;
                                                    return (
                                                        <div key={author} className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex items-center gap-3 truncate pr-2">
                                                                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-full flex items-center justify-center text-sm text-white font-bold shrink-0 shadow-sm border border-white/20">
                                                                    {author.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{author}</span>
                                                            </div>
                                                            <span className="shrink-0 text-base font-black text-indigo-700 dark:text-indigo-400 ml-2">
                                                                {h}h {m > 0 ? `${m}m` : ''}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
