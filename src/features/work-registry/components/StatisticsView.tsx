import { useState, useMemo, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, Cell, PieChart, Pie, LineChart, Line
} from 'recharts';
import { type WorkItemRow } from '../types';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Props {
    items: WorkItemRow[];
}

// Funkcja przypisująca spójne kolory dla autorów
const getAuthorColor = (index: number) => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'];
    return colors[index % colors.length];
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Calculate total BEFORE filtering zero values
        const total = payload.reduce((sum: number, entry: any) => sum + Number(entry.value), 0);

        // Filter out zero values and sort by value descending
        const filteredPayload = [...payload]
            .filter((item: any) => item.value > 0)
            .sort((a: any, b: any) => b.value - a.value);

        if (filteredPayload.length === 0 && total === 0) return null;

        return (
            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg min-w-[180px]">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        Suma: {total.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h
                    </p>
                </div>
                <div className="space-y-1.5">
                    {filteredPayload.map((entry: any, index: number) => (
                        <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {entry.name}
                                </span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {Number(entry.value).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export const StatisticsView = ({ items }: Props) => {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        if (items.length > 0) {
            const minDateIso = items.reduce((min, item) => (item.date < min ? item.date : min), items[0].date);
            setDateFrom(minDateIso.split('T')[0]);
            setDateTo(format(new Date(), 'yyyy-MM-dd'));
        }
    }, [items]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (dateFrom && item.date < dateFrom) return false;
            // The date string typically has T00:00:00, adding T23:59:59 matches the end of the day.
            if (dateTo && item.date > `${dateTo}T23:59:59`) return false;
            return true;
        });
    }, [items, dateFrom, dateTo]);

    // Better monthly data with proper sorting
    const sortedMonthlyData = useMemo(() => {
        const monthMap: Record<string, any> = {};
        filteredItems.forEach(item => {
            const date = parseISO(item.date);
            const key = format(date, 'yyyy-MM');
            if (!monthMap[key]) {
                monthMap[key] = { key, display: format(date, 'MMM yy', { locale: pl }), Programistyczne: 0, 'Obsługa projektu': 0, Inne: 0 };
            }
            monthMap[key][item.category] += item.minutes / 60;
        });
        return Object.values(monthMap).sort((a: any, b: any) => a.key.localeCompare(b.key));
    }, [filteredItems]);

    // 2. Category Distribution
    const categoryData = useMemo(() => {
        const counts = { Programistyczne: 0, 'Obsługa projektu': 0, Inne: 0 };
        filteredItems.forEach(item => {
            counts[item.category] += item.minutes / 60;
        });
        return [
            { name: 'Programistyczne', value: counts.Programistyczne, color: '#10b981' },
            { name: 'Obsługa projektu', value: counts['Obsługa projektu'], color: '#f59e0b' },
            { name: 'Inne', value: counts.Inne, color: '#6366f1' },
        ].filter(d => d.value > 0);
    }, [filteredItems]);

    // 3. Top Authors
    const authorData = useMemo(() => {
        const authors: Record<string, number> = {};
        filteredItems.forEach(item => {
            authors[item.authorName] = (authors[item.authorName] || 0) + item.minutes / 60;
        });
        return Object.entries(authors)
            .map(([name, hours]) => ({ name, hours }))
            .sort((a, b) => b.hours - a.hours);
    }, [filteredItems]);

    // 4. Zaangażowanie osób w czasie (miesięcznie)
    const monthlyAuthorData = useMemo(() => {
        const monthMap: Record<string, any> = {};
        
        // Zbieramy wszystkich unikalnych autorów w bieżącym filtrze,
        // żeby móc wyzerować im godziny w miesiącach w których nie pracowali
        const allAuthors = new Set<string>();
        filteredItems.forEach(item => allAuthors.add(item.authorName));
        
        filteredItems.forEach(item => {
            const date = parseISO(item.date);
            const key = format(date, 'yyyy-MM');
            
            if (!monthMap[key]) {
                monthMap[key] = { key, display: format(date, 'MMM yy', { locale: pl }) };
                allAuthors.forEach(a => monthMap[key][a] = 0);
            }
            monthMap[key][item.authorName] += parseFloat((item.minutes / 60).toFixed(2));
        });
        
        return Object.values(monthMap).sort((a: any, b: any) => a.key.localeCompare(b.key));
    }, [filteredItems]);

    if (items.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 p-20 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                Brak danych do wygenerowania statystyk. Zsynchronizuj dane z YouTrack.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Od daty</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Do daty</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]" />
                </div>
                {(dateFrom || dateTo) && (
                    <button
                        onClick={() => {
                            if (items.length > 0) {
                                const minDateIso = items.reduce((min, item) => (item.date < min ? item.date : min), items[0].date);
                                setDateFrom(minDateIso.split('T')[0]);
                                setDateTo(format(new Date(), 'yyyy-MM-dd'));
                            } else {
                                setDateFrom('');
                                setDateTo('');
                            }
                        }}
                        className="mt-5 text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                        Pełny zakres
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
                {/* Main Bar Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 uppercase tracking-wider">Rozkład miesięczny (roboczogodziny)</h3>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedMonthlyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="display"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ fill: 'rgba(229, 231, 235, 0.2)' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="Programistyczne" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={40} />
                            <Bar dataKey="Obsługa projektu" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Inne" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Pie Chart / Distribution */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 uppercase tracking-wider self-start">Struktura prac</h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ cx, cy, midAngle = 0, innerRadius, outerRadius, percent = 0 }) => {
                                    const RADIAN = Math.PI / 180;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    
                                    if (percent < 0.05) return null; // Ukryj małe etykiety
                                    
                                    return (
                                        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="11" fontWeight="bold">
                                            {`${(percent * 100).toFixed(0)}%`}
                                        </text>
                                    );
                                }}
                                labelLine={false}
                            >
                                {categoryData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 w-full">
                    {categoryData.map(c => (
                        <div key={c.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                <span className="text-gray-600 dark:text-gray-400">{c.name}</span>
                            </div>
                            <span className="font-bold dark:text-white">{c.value.toFixed(1)}h</span>
                        </div>
                    ))}
                    {categoryData.length > 0 && (
                        <div className="flex items-center justify-between text-sm pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Suma Razem</span>
                            </div>
                            <span className="font-black text-indigo-600 dark:text-indigo-400">
                                {categoryData.reduce((sum, c) => sum + c.value, 0).toFixed(1)}h
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* All Authors */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 uppercase tracking-wider">Uczestnicy Projektu</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {authorData.map((author) => (
                        <div key={author.name} className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700 dark:text-gray-300">{author.name}</span>
                                <span className="text-gray-500">{author.hours.toFixed(1)}h</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                                    style={{ width: `${(author.hours / authorData[0].hours) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 uppercase tracking-wider">Zaangażowanie w czasie (miesięcznie / rbh)</h3>
                <div className="h-[350px] w-full">
                    {monthlyAuthorData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyAuthorData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis 
                                    dataKey="display" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 12, fill: '#6B7280' }} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 12, fill: '#6B7280' }} 
                                />
                                <Tooltip 
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                {authorData.map((author, idx) => (
                                    <Line 
                                        key={author.name} 
                                        type="monotone" 
                                        dataKey={author.name} 
                                        stroke={getAuthorColor(idx)} 
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                            Brak danych dla wybranego okresu
                        </div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};
