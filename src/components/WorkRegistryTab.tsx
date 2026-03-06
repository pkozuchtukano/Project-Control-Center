import { useState } from 'react';
import { type Project } from '../App';
import { BarChart3, Trello } from 'lucide-react';
import { WorkRegistryYouTrackView } from './WorkRegistryYouTrackView';

type WorkTab = 'stats' | 'youtrack';

export const WorkRegistryTab = ({ project }: { project: Project }) => {
    const [activeTab, setActiveTab] = useState<WorkTab>('stats');

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header / Sub-navigation */}
            <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 mb-6 bg-white dark:bg-gray-800 p-2 px-4 rounded-xl shadow-sm">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === 'stats'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <BarChart3 size={18} />
                    Statystyka
                </button>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2 hidden sm:block"></div>
                <button
                    onClick={() => setActiveTab('youtrack')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === 'youtrack'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <Trello size={18} />
                    YouTrack
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1">
                {activeTab === 'stats' && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-gray-800 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-4">
                            <BarChart3 size={28} className="text-indigo-400 dark:text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Statystyki Pracy</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                            Moduł ewidencji i raportowania czasu pracy na osiach wykresów jest w przygotowaniu.
                        </p>
                    </div>
                )}
                {activeTab === 'youtrack' && (
                    <WorkRegistryYouTrackView project={project} />
                )}
            </div>
        </div>
    );
};
