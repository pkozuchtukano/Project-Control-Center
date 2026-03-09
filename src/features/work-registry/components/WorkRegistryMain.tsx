import { useState } from 'react';
import {
    BarChart3, Trello, RefreshCw,
    AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { type Project } from '../../../App';
import { useWorkRegistry } from '../hooks/useWorkRegistry';
import { YouTrackTable } from './YouTrackTable';
import { StatisticsView } from './StatisticsView';
import { syncWorkItems, type SyncProgress } from '../services/youtrackSync';

interface Props {
    project: Project;
    settings: { youtrackBaseUrl: string; youtrackToken: string } | null;
}

export const WorkRegistryMain = ({ project, settings }: Props) => {
    const { workItems, isLoading, error, setCategory, setCategoriesBulk, refresh } = useWorkRegistry(project);
    const [activeTab, setActiveTab] = useState<'stats' | 'youtrack'>('stats');
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

    const handleSync = async () => {
        if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) {
            alert('Skonfiguruj YouTrack w ustawieniach głównych przed synchronizacją.');
            return;
        }

        await syncWorkItems(
            project.id,
            project.youtrackQuery || project.code || '',
            project.dateFrom,
            settings.youtrackBaseUrl,
            settings.youtrackToken,
            (progress) => {
                setSyncProgress(progress);
                if (progress.status === 'completed') {
                    refresh();
                    setTimeout(() => setSyncProgress(null), 3000);
                }
            }
        );
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            {/* Header / Sub-navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 mb-6 bg-white dark:bg-gray-800 p-3 px-6 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === 'stats'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <BarChart3 size={18} />
                        Statystyka
                    </button>
                    <button
                        onClick={() => setActiveTab('youtrack')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === 'youtrack'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Trello size={18} />
                        YouTrack
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {syncProgress && syncProgress.status === 'syncing' ? (
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                <Loader2 size={14} className="animate-spin" />
                                Synchronizacja: {syncProgress.currentMonth}
                            </div>
                            <div className="w-48 bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-indigo-500 h-full transition-all duration-300"
                                    style={{ width: `${(syncProgress.currentChunk / syncProgress.totalChunks) * 100}%` }}
                                />
                            </div>
                        </div>
                    ) : syncProgress && syncProgress.status === 'completed' ? (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold animate-in zoom-in duration-300">
                            <CheckCircle2 size={18} />
                            Zsynchronizowano
                        </div>
                    ) : (
                        <button
                            onClick={handleSync}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-all border border-indigo-100 dark:border-indigo-800"
                        >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                            Aktualizuj z YouTrack
                        </button>
                    )}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center p-20 gap-4">
                        <Loader2 size={40} className="text-indigo-500 animate-spin" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Ładowanie rejestru pracy...</p>
                    </div>
                ) : activeTab === 'stats' ? (
                    <StatisticsView items={workItems} />
                ) : (
                    <YouTrackTable
                        items={workItems}
                        onSetCategory={setCategory}
                        onSetCategoriesBulk={setCategoriesBulk}
                        youtrackBaseUrl={settings?.youtrackBaseUrl}
                    />
                )}
            </div>
        </div>
    );
};
