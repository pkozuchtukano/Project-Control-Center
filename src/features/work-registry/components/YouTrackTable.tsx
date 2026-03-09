import { useState, useMemo } from 'react';
import {
    Search, Filter, ChevronDown, ChevronRight,
    CheckSquare, Square, CheckCircle2, Clock, User, Tag, MessageSquare
} from 'lucide-react';
import { type WorkItemRow, type WorkCategory } from '../types';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Props {
    items: WorkItemRow[];
    onSetCategory: (issueId: string, category: WorkCategory) => void;
    onSetCategoriesBulk?: (issueIds: string[], category: WorkCategory) => void;
    youtrackBaseUrl?: string;
}

// Formatuje minuty do "8h 15m"
const formatMinutes = (totalMinutes: number): string => {
    if (totalMinutes <= 0) return '0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

// Kolor badge dla kategorii
const categoryBadgeClass = (cat: WorkCategory): string => {
    switch (cat) {
        case 'Programistyczne':
            return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
        case 'Obsługa projektu':
            return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
        default:
            return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800';
    }
};

// Grupuje logi jednego zadania per (data, osoba) i sumuje minuty
interface DayPersonLog {
    dateStr: string;      // YYYY-MM-DD
    authorName: string;
    totalMinutes: number;
    workTypes: string[];  // unikalne typy
    comments: string[];   // komentarze
}

const groupLogs = (rows: WorkItemRow[]): DayPersonLog[] => {
    const map = new Map<string, DayPersonLog>();
    rows.forEach(row => {
        const dateStr = row.date.split('T')[0];
        const key = `${dateStr}__${row.authorName}`;
        if (map.has(key)) {
            const entry = map.get(key)!;
            entry.totalMinutes += row.minutes;
            const wt: string = (row as any).workType || '';
            if (wt && !entry.workTypes.includes(wt)) entry.workTypes.push(wt);
            if (row.description && !entry.comments.includes(row.description)) {
                entry.comments.push(row.description);
            }
        } else {
            const wt: string = (row as any).workType || '';
            map.set(key, {
                dateStr,
                authorName: row.authorName,
                totalMinutes: row.minutes,
                workTypes: wt ? [wt] : [],
                comments: row.description ? [row.description] : []
            });
        }
    });
    // Posortuj od najnowszej daty
    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
};

// ---- Komponent pojedynczego wiersza akordeonu ----
interface IssueGroup {
    issueId: string;
    issueReadableId: string;
    issueSummary: string;
    category: WorkCategory;
    totalMinutes: number;
    rows: WorkItemRow[];
}

interface AccordionRowProps {
    group: IssueGroup;
    isSelected: boolean;
    onToggleSelect: () => void;
    onSetCategory: (issueId: string, cat: WorkCategory) => void;
    youtrackBaseUrl?: string;
}

const CATEGORIES: WorkCategory[] = ['Programistyczne', 'Obsługa projektu', 'Inne'];

const AccordionRow = ({ group, isSelected, onToggleSelect, onSetCategory, youtrackBaseUrl }: AccordionRowProps) => {
    const [open, setOpen] = useState(false);
    const logs = useMemo(() => groupLogs(group.rows), [group.rows]);

    const issueUrl = youtrackBaseUrl
        ? `${youtrackBaseUrl.replace(/\/$/, '')}/issue/${group.issueReadableId}`
        : null;

    return (
        <div className={`border-b border-gray-100 dark:border-gray-800/60 last:border-0 transition-colors ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/20'}`}>
            {/* ---- Nagłówek wiersza (zawsze widoczny) ---- */}
            <div className="flex items-center gap-3 px-4 py-3">
                {/* Checkbox */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                    className={`flex-shrink-0 transition-colors ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400'}`}
                >
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                {/* Strzałka expand */}
                <button
                    onClick={() => setOpen(o => !o)}
                    className="flex-shrink-0 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-0.5 rounded"
                    aria-label={open ? 'Zwiń' : 'Rozwiń'}
                >
                    {open
                        ? <ChevronDown size={18} className="text-indigo-500" />
                        : <ChevronRight size={18} />
                    }
                </button>

                {/* ID + Nazwa — klikalny do toggleowania */}
                <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setOpen(o => !o)}
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        {issueUrl ? (
                            <a
                                href={issueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors shrink-0"
                            >
                                {group.issueReadableId}
                            </a>
                        ) : (
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                {group.issueReadableId}
                            </span>
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {group.issueSummary}
                        </span>
                    </div>
                </div>

                {/* Łączny czas */}
                <div className="flex-shrink-0 flex items-center gap-1.5 text-sm font-mono font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                    <Clock size={14} className="text-gray-400" />
                    {formatMinutes(group.totalMinutes)}
                </div>

                {/* Dropdown Grupy — inline select zawsze widoczny */}
                <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <select
                        value={group.category}
                        onChange={e => onSetCategory(group.issueId, e.target.value as WorkCategory)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border outline-none cursor-pointer transition-all
                            focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
                            ${categoryBadgeClass(group.category)}
                            appearance-none pr-6 bg-no-repeat`}
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                            backgroundPosition: 'right 6px center'
                        }}
                    >
                        {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ---- Rozwinięta sekcja z logami ---- */}
            {open && (
                <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900/60 shadow-sm">
                    {logs.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-gray-400 italic">Brak logów czasu</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                                    <th className="px-4 py-2.5 text-left w-32">
                                        <div className="flex items-center gap-1.5">Data</div>
                                    </th>
                                    <th className="px-4 py-2.5 text-left w-40">
                                        <div className="flex items-center gap-1.5">
                                            <User size={12} />
                                            Osoba
                                        </div>
                                    </th>
                                    <th className="px-4 py-2.5 text-left w-28">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={12} />
                                            Czas
                                        </div>
                                    </th>
                                    <th className="px-4 py-2.5 text-left w-36">
                                        <div className="flex items-center gap-1.5">
                                            <Tag size={12} />
                                            Typ pracy
                                        </div>
                                    </th>
                                    <th className="px-4 py-2.5 text-left">
                                        <div className="flex items-center gap-1.5">
                                            <MessageSquare size={12} />
                                            Komentarz
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                                {logs.map((log, idx) => (
                                    <tr
                                        key={`${log.dateStr}-${log.authorName}-${idx}`}
                                        className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                                    >
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300 font-medium">
                                            {format(parseISO(log.dateStr), 'dd.MM.yyyy', { locale: pl })}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400">
                                            {log.authorName}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded text-xs">
                                                {formatMinutes(log.totalMinutes)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-500 text-xs">
                                            {log.workTypes.length > 0
                                                ? log.workTypes.join(', ')
                                                : <span className="opacity-40">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                                            {log.comments.length > 0
                                                ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        {log.comments.map((c, ci) => (
                                                            <span key={ci} className="line-clamp-2">{c}</span>
                                                        ))}
                                                    </div>
                                                )
                                                : <span className="opacity-40">—</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

// =====================================================
// ---- Główny komponent YouTrackTable ----
// =====================================================
export const YouTrackTable = ({ items, onSetCategory, onSetCategoriesBulk, youtrackBaseUrl }: Props) => {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<WorkCategory | 'all'>('all');
    const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());

    // Grupuj WorkItemRow po issueId → IssueGroup
    const issueGroups = useMemo<IssueGroup[]>(() => {
        // Zbierz unikalne issue
        const map = new Map<string, IssueGroup>();
        items.forEach(item => {
            if (!map.has(item.issueId)) {
                map.set(item.issueId, {
                    issueId: item.issueId,
                    issueReadableId: item.issueReadableId,
                    issueSummary: item.issueSummary,
                    category: item.category,
                    totalMinutes: 0,
                    rows: []
                });
            }
            const g = map.get(item.issueId)!;
            g.totalMinutes += item.minutes;
            g.rows.push(item);
            // Kategoria — weź zawsze aktualną (ostatnio ustawioną)
            g.category = item.category;
        });

        // Filtruj + szukaj
        return Array.from(map.values())
            .filter(g => {
                const matchesSearch =
                    g.issueReadableId.toLowerCase().includes(search.toLowerCase()) ||
                    g.issueSummary.toLowerCase().includes(search.toLowerCase()) ||
                    g.rows.some(r => r.authorName.toLowerCase().includes(search.toLowerCase()));
                const matchesCategory = categoryFilter === 'all' || g.category === categoryFilter;
                return matchesSearch && matchesCategory;
            })
            // Posortuj wg daty ostatniego logu (najnowsze pierwsze)
            .sort((a, b) => {
                const lastA = Math.max(...a.rows.map(r => new Date(r.date).getTime()));
                const lastB = Math.max(...b.rows.map(r => new Date(r.date).getTime()));
                return lastB - lastA;
            });
    }, [items, search, categoryFilter]);

    const toggleSelectIssue = (issueId: string) => {
        setSelectedIssueIds(prev => {
            const next = new Set(prev);
            if (next.has(issueId)) next.delete(issueId);
            else next.add(issueId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIssueIds.size === issueGroups.length && issueGroups.length > 0) {
            setSelectedIssueIds(new Set());
        } else {
            setSelectedIssueIds(new Set(issueGroups.map(g => g.issueId)));
        }
    };

    const handleBulkCategoryChange = (category: WorkCategory) => {
        if (!onSetCategoriesBulk) return;
        const ids = Array.from(selectedIssueIds);
        if (ids.length > 0) {
            onSetCategoriesBulk(ids, category);
            setSelectedIssueIds(new Set());
        }
    };

    const allSelected = issueGroups.length > 0 && selectedIssueIds.size === issueGroups.length;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm relative">
            {/* ---- Pasek filtrów ---- */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-3 items-center bg-gray-50/50 dark:bg-gray-800/50">
                {/* Checkbox "zaznacz wszystkie" */}
                <button
                    onClick={toggleSelectAll}
                    className={`flex-shrink-0 p-1 rounded transition-colors ${allSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400'}`}
                    title={allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                >
                    {allSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>

                {/* Wyszukiwarka */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Szukaj po ID, nazwie lub osobie..."
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Filtr kategorii */}
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400 flex-shrink-0" />
                    <select
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value as any)}
                    >
                        <option value="all">Wszystkie grupy</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto whitespace-nowrap">
                    Zadań: <strong className="text-gray-700 dark:text-gray-300">{issueGroups.length}</strong>
                </div>
            </div>

            {/* ---- Bulk Action Bar ---- */}
            {selectedIssueIds.size > 0 && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-5 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2 pr-4 border-r border-indigo-400">
                        <CheckCircle2 size={18} />
                        <span className="font-bold whitespace-nowrap">Zaznaczono: {selectedIssueIds.size}</span>
                    </div>
                    <span className="text-sm font-medium opacity-90">Ustaw grupę:</span>
                    <div className="flex gap-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleBulkCategoryChange(cat)}
                                className="px-3 py-1 bg-white/10 hover:bg-white/25 rounded-lg text-xs font-bold transition-colors border border-white/20"
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setSelectedIssueIds(new Set())}
                        className="text-white/70 hover:text-white text-sm font-bold"
                    >
                        Anuluj
                    </button>
                </div>
            )}

            {/* ---- Nagłówek kolumn ---- */}
            <div className="px-4 py-2.5 grid grid-cols-[18px_18px_1fr_auto_auto] gap-3 items-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/30 select-none">
                <span />
                <span />
                <span>Zadanie</span>
                <span className="text-right pr-2">Łącznie</span>
                <span>Grupa</span>
            </div>

            {/* ---- Lista zadań ---- */}
            <div className="flex-1 overflow-auto">
                {issueGroups.length === 0 ? (
                    <div className="p-20 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Brak zadań spełniających kryteria wyszukiwania.
                    </div>
                ) : (
                    <div className="divide-y-0">
                        {issueGroups.map(group => (
                            <AccordionRow
                                key={group.issueId}
                                group={group}
                                isSelected={selectedIssueIds.has(group.issueId)}
                                onToggleSelect={() => toggleSelectIssue(group.issueId)}
                                onSetCategory={onSetCategory}
                                youtrackBaseUrl={youtrackBaseUrl}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
