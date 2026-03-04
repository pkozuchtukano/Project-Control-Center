import { useState, useEffect } from 'react';
import { useYouTrack } from '../hooks/useYouTrack';
import { useProjectContext, type Project } from '../App';
import { format } from 'date-fns';
import { RefreshCw, Loader2, AlertCircle, MessageSquare, Calendar, Clock, ChevronDown } from 'lucide-react';
import { type ActivityItem, formatMinutesToDuration } from '../services/youtrackApi';
import { AuthenticatedImage } from './AuthenticatedImage';

export const YouTrackTab = ({ project }: { project: Project }) => {
    const { settings, updateProject } = useProjectContext();

    const [projectQuery, setProjectQuery] = useState(project.youtrackQuery || project.code || '');
    const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [useCache, setUseCache] = useState(true);
    const [hasFetched, setHasFetched] = useState(false);

    const { data, isLoading, error, fetchHistory, loadFromCache } = useYouTrack();

    const handleFetch = (forceRefresh = false, currentQuery = projectQuery) => {
        if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;
        setHasFetched(true);

        if (currentQuery !== project.youtrackQuery) {
            updateProject(project.id, { youtrackQuery: currentQuery });
        }

        if (!forceRefresh && useCache) {
            const loaded = loadFromCache(currentQuery, dateFrom, dateTo);
            if (loaded) return;
        }

        fetchHistory(settings.youtrackBaseUrl, settings.youtrackToken, currentQuery, dateFrom, dateTo);
    };

    useEffect(() => {
        setProjectQuery(project.youtrackQuery || project.code || '');
        setHasFetched(false); // Resetujemy stan pobierania gdy zmieniamy projekt
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id, project.youtrackQuery, project.code]); // Reload when changing projects

    useEffect(() => {
        if (projectQuery) {
            localStorage.setItem(`yt_query_${project.id}`, projectQuery);
        }
    }, [projectQuery, project.id]);

    const renderTextWithImages = (text: string) => {
        if (!text) return null;

        // Dopasowuje Markdown: ![alt](url) LUB tag HTML: <img ... src="url" ...>
        const regex = /(?:!\[([^\]]*)\]\(([^)]+)\))|(?:<img\b[^>]*src="([^"]+)"[^>]*>(?:<\/img>)?)/gi;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
            }

            let alt = '';
            let url = '';

            if (match[2]) {
                // Format Markdown ![alt](url)
                alt = match[1] || '';
                url = match[2];
            } else if (match[3]) {
                // Format tagu HTML <img src="url">
                url = match[3];
                // Spróbuj wyciągnąć atrybut alt
                const altMatch = match[0].match(/alt="([^"]*)"/i);
                if (altMatch) {
                    alt = altMatch[1];
                }
            }

            if (url) {
                parts.push(
                    <AuthenticatedImage
                        key={`img-${match.index}`}
                        src={url}
                        alt={alt}
                        className="max-h-96 object-contain"
                    />
                );
            }

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
        }

        return parts.length > 0 ? parts : text;
    };

    const getFieldChangeText = (item: ActivityItem) => {
        const fname = item.field?.toLowerCase() || '';

        const newSpan = <span className="text-emerald-600 dark:text-emerald-400 font-medium">{item.added}</span>;
        const oldSpan = <span className="text-red-500/80 mr-1">{item.removed}</span>;

        if (fname.includes('state') || fname.includes('status')) {
            return <span>zmieniono status na {newSpan}</span>;
        } else if (fname.includes('type') || fname.includes('typ') && !fname.includes('priority')) {
            return <span>zmieniono typ zadania na {newSpan}</span>;
        } else if (fname.includes('priority') || fname.includes('priorytet')) {
            return <span>zmieniono priorytet na {newSpan}</span>;
        } else if (fname.includes('assignee') || fname.includes('przypisany')) {
            if (item.removed && item.removed !== 'Brak' && item.removed !== 'Unassigned') {
                return <span>przekazano zadanie do {newSpan}</span>;
            } else {
                return <span>przypisano zadanie do {newSpan}</span>;
            }
        } else if (fname.includes('estimation') || fname.includes('estymacja')) {
            if (item.added === 'Brak' && (item.removed === 'Brak' || !item.removed)) {
                return null; // Zwrócenie nulla sprawi, że filtr to odrzuci w renderTimelineGroup
            } else if (item.added === 'Brak' && item.removed !== 'Brak') {
                return <span>Usunięto estymację</span>;
            } else if (item.removed && item.removed !== 'Brak' && item.added !== 'Brak') {
                return <span>zmieniono estymację z {oldSpan} na {newSpan}</span>;
            } else {
                return <span>wyestymowano zadanie na: {newSpan}</span>;
            }
        } else if (fname.includes('due date') || fname.includes('termin')) {
            const formatDate = (val: string | any[] | undefined) => {
                const strVal = String(val);
                if (strVal === 'Brak' || !strVal) return 'Brak';
                const dateNum = Number(strVal);
                return isNaN(dateNum) ? strVal : format(new Date(dateNum), 'dd.MM.yyyy');
            };
            const oldFormatted = <span className="text-red-500/80 mr-1">{formatDate(item.removed)}</span>;
            const newFormatted = <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatDate(item.added)}</span>;
            return <span>zmieniono termin z {oldFormatted} na {newFormatted}</span>;
        } else {
            return <span>zmieniono {item.field} z {oldSpan} =&gt; {newSpan}</span>;
        }
    };

    const renderTimelineGroup = (group: any, idx: number) => {
        if (group.items.length === 1) {
            const item = group.items[0];
            if (item.type === 'comment') {
                const content = typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
                return (
                    <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm mb-3 latest:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm text-blue-800 dark:text-blue-400">{group.authorName}:</span>
                            <span className="text-xs text-gray-500 font-medium">{group.timeStr}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md">Komentarz</span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {renderTextWithImages(content)}
                        </div>
                    </div>
                );
            }
            if (item.type === 'description-change') {
                return (
                    <div key={item.id} className="text-sm text-gray-800 dark:text-gray-200 py-1.5 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                        <span className="font-medium text-gray-500 mr-2">{group.timeStr}</span>
                        <span className="font-semibold text-blue-800 dark:text-blue-400">{group.authorName}:</span> zaktualizowano treść zadania. Zmieniono:
                        <div className="mt-1 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                            <span className="line-through text-red-500/80 mr-2">{renderTextWithImages(item.removed || 'Brak')}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">=&gt; {renderTextWithImages(item.added || 'Brak')}</span>
                        </div>
                    </div>
                );
            }
        }

        const actionTexts = group.items.map((item: ActivityItem, idx: number) => {
            if (item.type === 'field-change') return <span key={idx}>{getFieldChangeText(item)}</span>;
            if (item.type === 'work-item') {
                const mins = item.minutes || 0;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const durationStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
                return <span key={idx}>zarejestrowano pracę <span className="text-emerald-600 dark:text-emerald-400 font-medium">{durationStr}</span></span>;
            }
            if (item.type === 'issue-created') return <span key={idx}>dodano zadanie</span>;
            return null;
        }).filter(Boolean);

        return (
            <div key={group.key + group.items.length} className="text-sm text-gray-800 dark:text-gray-200 py-1.5 border-b border-gray-100 dark:border-gray-800/50 last:border-0 leading-relaxed">
                <span className="font-medium text-gray-500 mr-2">{group.timeStr}</span>
                {actionTexts.length > 0 && <span className="font-semibold text-blue-800 dark:text-blue-400">{group.authorName}:</span>}
                {actionTexts.length > 0 ? (
                    <span className="ml-1">
                        {actionTexts.map((action: any, i: number) => (
                            <span key={i}>
                                {action}
                                {i < actionTexts.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </span>
                ) : ''}
            </div>
        );
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
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Projekty (np. PMS, CBCP)</label>
                        <input type="text" value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Projekty..." className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]" />
                    </div>
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
                        {isLoading ? "Pobieranie..." : "Pobierz dane"}
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
                {!isLoading && data.length === 0 && !error && hasFetched && (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">Brak aktywności w wybranym przedziale czasowym dla projektu: <strong>{projectQuery}</strong>.</p>
                    </div>
                )}

                {!isLoading && data.length === 0 && !error && !hasFetched && (
                    <div className="text-center p-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                        <MessageSquare size={48} className="text-gray-300 dark:text-gray-600 mb-4 mx-auto" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200 mb-2">Platforma YouTrack</h3>
                        <p className="text-gray-500 dark:text-gray-400">Naciśnij "Pobierz dane", aby wczytać aktywność w wybranym przedziale.</p>
                    </div>
                )}

                {[...data].sort((a, b) => {
                    const aTime = a.timeline.length > 0 ? a.timeline[0].timestamp : Number.MAX_SAFE_INTEGER;
                    const bTime = b.timeline.length > 0 ? b.timeline[0].timestamp : Number.MAX_SAFE_INTEGER;
                    return aTime - bTime;
                }).map(issue => (
                    <div key={issue.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-1">
                                    <a
                                        href={`${settings.youtrackBaseUrl}/issue/${issue.idReadable}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        {issue.idReadable}
                                    </a>

                                    {issue.state && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                                            {issue.state}
                                        </span>
                                    )}

                                    {issue.dueDate && (() => {
                                        const now = new Date();
                                        now.setHours(0, 0, 0, 0);
                                        const due = new Date(issue.dueDate);
                                        due.setHours(0, 0, 0, 0);

                                        const MS_PER_DAY = 1000 * 60 * 60 * 24;
                                        const remainingDays = Math.round((due.getTime() - now.getTime()) / MS_PER_DAY);

                                        let colorClass = "text-gray-500 dark:text-gray-400";
                                        let iconColorClass = "text-gray-400";

                                        if (remainingDays <= 1) {
                                            colorClass = "text-red-600 dark:text-red-400 font-bold";
                                            iconColorClass = "text-red-500 dark:text-red-400";
                                        } else if (remainingDays <= 2) {
                                            colorClass = "text-yellow-600 dark:text-yellow-400 font-bold";
                                            iconColorClass = "text-yellow-500 dark:text-yellow-400";
                                        }

                                        return (
                                            <span className={`text-xs flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${colorClass}`}>
                                                <Calendar size={12} className={iconColorClass} />
                                                Termin: {format(due, 'dd.MM.yyyy')}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{issue.summary}</h3>

                                {/* TTIME TRACKING & PROGRESS BAR */}
                                {(issue.estimation || issue.spentTime) && (
                                    <div className="mt-3 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-2">
                                            {issue.estimation && (
                                                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                                    <span className="font-medium">Estymacja:</span>
                                                    <span className="font-bold">{issue.estimation.presentation}</span>
                                                </div>
                                            )}
                                            {issue.spentTime && (
                                                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                                    <Clock size={14} />
                                                    <span className="font-medium">Przepracowano:</span>
                                                    <span className="font-bold">{issue.spentTime.presentation}</span>
                                                </div>
                                            )}
                                            {issue.estimation && issue.spentTime && issue.estimation.minutes > 0 && (
                                                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                                    <span className="font-medium">Pozostało:</span>
                                                    <span className="font-bold">
                                                        {Math.max(0, issue.estimation.minutes - issue.spentTime.minutes) === 0
                                                            ? '0m'
                                                            : formatMinutesToDuration(Math.max(0, issue.estimation.minutes - issue.spentTime.minutes))}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* PROGRESS BAR */}
                                        {issue.estimation && issue.estimation.minutes > 0 && (
                                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1 flex">
                                                {(() => {
                                                    const estMin = issue.estimation.minutes;
                                                    const spentMin = issue.spentTime ? issue.spentTime.minutes : 0;
                                                    let percent = Math.round((spentMin / estMin) * 100);

                                                    // Kolor paska: zielony jeśli ok, pomarańczowy jeśli blisko, czerwony jeśli przekroczony
                                                    let bgClass = "bg-emerald-500";
                                                    if (percent > 100) {
                                                        bgClass = "bg-red-500";
                                                        percent = 100;
                                                    } else if (percent > 85) {
                                                        bgClass = "bg-orange-500";
                                                    }

                                                    return (
                                                        <div
                                                            className={`h-full ${bgClass} transition-all duration-500`}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {issue.resolved && (
                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex-shrink-0 ml-4 mt-1">
                                    Rozwiązane
                                </span>
                            )}
                        </div>

                        <div className="px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                            {issue.description ? (
                                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                                    {renderTextWithImages(issue.description)}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">Brak opisu zadania.</p>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50/30 dark:bg-gray-900/20">
                            {issue.timeline.length > 0 ? (
                                <div className="space-y-1">
                                    {(() => {
                                        const groupedItems: any[] = [];
                                        let currentGroup: any = null;

                                        issue.timeline.forEach(item => {
                                            const isDateOnly = item.type === 'work-item' || item.type === 'issue-created';
                                            const timeStr = format(new Date(item.timestamp), isDateOnly ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm');
                                            const authorName = item.author.name || item.author.login;
                                            const groupKey = `${timeStr}-${authorName}`;

                                            if (
                                                currentGroup &&
                                                currentGroup.key === groupKey &&
                                                item.type !== 'comment' &&
                                                item.type !== 'description-change' &&
                                                currentGroup.items[0].type !== 'comment' &&
                                                currentGroup.items[0].type !== 'description-change'
                                            ) {
                                                currentGroup.items.push(item);
                                            } else {
                                                currentGroup = {
                                                    key: groupKey,
                                                    timeStr,
                                                    authorName,
                                                    items: [item]
                                                };
                                                groupedItems.push(currentGroup);
                                            }
                                        });

                                        const dFrom = new Date(dateFrom); dFrom.setHours(0, 0, 0, 0);
                                        const dTo = new Date(dateTo); dTo.setHours(23, 59, 59, 999);
                                        const fromTime = dFrom.getTime();
                                        const toTime = dTo.getTime();

                                        const historyInRange: any[] = [];
                                        const historyOutRange: any[] = [];

                                        groupedItems.forEach(group => {
                                            const groupTime = group.items[0].timestamp;
                                            if (groupTime >= fromTime && groupTime <= toTime) {
                                                historyInRange.push(group);
                                            } else {
                                                historyOutRange.push(group);
                                            }
                                        });

                                        return (
                                            <>
                                                {historyOutRange.length > 0 && (() => {
                                                    const firstItemTimestamp = historyOutRange[0].items[0].timestamp;
                                                    const lastGroup = historyOutRange[historyOutRange.length - 1];
                                                    const lastItemTimestamp = lastGroup.items[lastGroup.items.length - 1].timestamp;

                                                    const firstDateStr = format(new Date(firstItemTimestamp), 'dd.MM.yyyy');
                                                    const lastDateStr = format(new Date(lastItemTimestamp), 'dd.MM.yyyy');
                                                    const rangeStr = firstDateStr === lastDateStr ? firstDateStr : `${firstDateStr} - ${lastDateStr}`;

                                                    return (
                                                        <details className="group mb-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 overflow-hidden">
                                                            <summary className="flex items-center justify-between cursor-pointer p-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none outline-none">
                                                                <span>Starsza historia ({historyOutRange.length} wpisów poza przedziałem) <span className="opacity-75 font-normal ml-1">({rangeStr})</span></span>
                                                                <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                                                            </summary>
                                                            <div className="p-3 pt-0 space-y-1">
                                                                {historyOutRange.map((group, idx) => (
                                                                    <div key={`out-${idx}`}>{renderTimelineGroup(group, idx)}</div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    );
                                                })()}

                                                <div className="space-y-1">
                                                    {historyInRange.length > 0 ? historyInRange.map((group, idx) => (
                                                        <div key={`in-${idx}`}>{renderTimelineGroup(group, idx + historyOutRange.length)}</div>
                                                    )) : (
                                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2">Brak aktywności obok tego zadania w wybranym przedziale {format(dFrom, 'dd.MM')} - {format(dTo, 'dd.MM')}.</p>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
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

        </div >
    );
};
