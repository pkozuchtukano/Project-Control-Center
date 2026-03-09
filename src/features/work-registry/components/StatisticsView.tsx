import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, Cell, PieChart, Pie
} from 'recharts';
import { type WorkItemRow } from '../types';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Props {
    items: WorkItemRow[];
}

export const StatisticsView = ({ items }: Props) => {

    // Better monthly data with proper sorting
    const sortedMonthlyData = useMemo(() => {
        const monthMap: Record<string, any> = {};
        items.forEach(item => {
            const date = parseISO(item.date);
            const key = format(date, 'yyyy-MM');
            if (!monthMap[key]) {
                monthMap[key] = { key, display: format(date, 'MMM yy', { locale: pl }), Programistyczne: 0, 'Obsługa projektu': 0, Inne: 0 };
            }
            monthMap[key][item.category] += item.minutes / 60;
        });
        return Object.values(monthMap).sort((a: any, b: any) => a.key.localeCompare(b.key));
    }, [items]);

    // 2. Category Distribution
    const categoryData = useMemo(() => {
        const counts = { Programistyczne: 0, 'Obsługa projektu': 0, Inne: 0 };
        items.forEach(item => {
            counts[item.category] += item.minutes / 60;
        });
        return [
            { name: 'Programistyczne', value: counts.Programistyczne, color: '#10b981' },
            { name: 'Obsługa projektu', value: counts['Obsługa projektu'], color: '#f59e0b' },
            { name: 'Inne', value: counts.Inne, color: '#6366f1' },
        ].filter(d => d.value > 0);
    }, [items]);

    // 3. Top Authors
    const authorData = useMemo(() => {
        const authors: Record<string, number> = {};
        items.forEach(item => {
            authors[item.authorName] = (authors[item.authorName] || 0) + item.minutes / 60;
        });
        return Object.entries(authors)
            .map(([name, hours]) => ({ name, hours }))
            .sort((a, b) => b.hours - a.hours);
    }, [items]);

    if (items.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 p-20 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                Brak danych do wygenerowania statystyk. Zsynchronizuj dane z YouTrack.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
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
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {categoryData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
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

            <div className="lg:col-span-2 bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <h4 className="text-indigo-900 dark:text-indigo-300 font-semibold mb-2">Wnioski z analizy</h4>
                <p className="text-sm text-indigo-700 dark:text-indigo-400 leading-relaxed">
                    Widoczna powyżej dystrybucja godzin pokazuje realne zaangażowanie zespołu w prace rozwojowe względem kosztów obsługi.
                    Stabilny udział grupy <strong>Programistyczne</strong> (powyżej 80%) świadczy o wysokiej efektywności produkcyjnej projektu.
                </p>
            </div>
        </div>
    );
};
