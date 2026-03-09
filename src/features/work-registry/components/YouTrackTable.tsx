import { useState, useMemo } from 'react';
import { Search, Filter, Edit3 } from 'lucide-react';
import { type WorkItemRow, type WorkCategory } from '../types';
import { format, parseISO } from 'date-fns';

interface Props {
    items: WorkItemRow[];
    onSetCategory: (issueId: string, category: WorkCategory) => void;
}

export const YouTrackTable = ({ items, onSetCategory }: Props) => {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<WorkCategory | 'all'>('all');
    const [editingIssueId, setEditingIssueId] = useState<string | null>(null);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch =
                item.issueReadableId.toLowerCase().includes(search.toLowerCase()) ||
                item.issueSummary.toLowerCase().includes(search.toLowerCase()) ||
                item.authorName.toLowerCase().includes(search.toLowerCase());

            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

            return matchesSearch && matchesCategory;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [items, search, categoryFilter]);

    const categories: WorkCategory[] = ['Programistyczne', 'Obsługa projektu', 'Inne'];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
            {/* Filters Toolbar */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 items-center bg-gray-50/50 dark:bg-gray-800/50">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Szukaj po ID, nazwie lub osobie..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-400" />
                    <select
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as any)}
                    >
                        <option value="all">Wszystkie kategorie</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                    Znaleziono: <strong>{filteredItems.length}</strong> wpisów
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10 shadow-sm">
                        <tr className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Zadanie</th>
                            <th className="px-6 py-4">Osoba</th>
                            <th className="px-6 py-4">Czas</th>
                            <th className="px-6 py-4">Kategoria</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                    {format(parseISO(item.date), 'dd.MM.yyyy')}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{item.issueReadableId}</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{item.issueSummary}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                    {item.authorName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-sm font-mono">
                                        {(item.minutes / 60).toFixed(1)}h
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingIssueId === item.id ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                autoFocus
                                                className="text-sm bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                                defaultValue={item.category}
                                                onChange={(e) => {
                                                    onSetCategory(item.issueId, e.target.value as WorkCategory);
                                                    setEditingIssueId(null);
                                                }}
                                                onBlur={() => setEditingIssueId(null)}
                                            >
                                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    ) : (
                                        <div
                                            className="flex items-center gap-2 cursor-pointer group/cat"
                                            onClick={() => setEditingIssueId(item.id)}
                                        >
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.category === 'Programistyczne' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                item.category === 'Obsługa projektu' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                }`}>
                                                {item.category}
                                            </span>
                                            <Edit3 size={14} className="text-gray-300 group-hover/cat:text-indigo-500 opacity-0 group-hover/cat:opacity-100 transition-all" />
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredItems.length === 0 && (
                    <div className="p-20 text-center text-gray-500 dark:text-gray-400">
                        Brak danych spełniających kryteria wyszukiwania.
                    </div>
                )}
            </div>
        </div>
    );
};
