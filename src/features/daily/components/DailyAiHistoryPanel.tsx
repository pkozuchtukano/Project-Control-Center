import { CalendarRange, History, Trash2 } from 'lucide-react';
import type { DailyAiAnalysis } from '../../../types';

type DailyAiHistoryPanelProps = {
  analyses: DailyAiAnalysis[];
  selectedAnalysisId: string | null;
  onSelect: (analysisId: string) => void;
  onDelete: (analysis: DailyAiAnalysis) => void;
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pl-PL');
};

const formatProjectHeader = (projectCodes: string[]) => {
  if (!projectCodes.length) return 'Brak projektów';
  return projectCodes.join(', ');
};

export const DailyAiHistoryPanel = ({
  analyses,
  selectedAnalysisId,
  onSelect,
  onDelete,
}: DailyAiHistoryPanelProps) => {
  return (
    <aside className="w-[380px] shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
          <History className="w-4 h-4 text-indigo-500" />
          Historia analiz AI
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Historia pokazuje zapisane analizy dla bieżącego widoku Daily. Kliknięcie wpisu otwiera pełnoekranowy edytor treści.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
        {analyses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-5 text-center text-sm text-gray-500 dark:text-gray-400">
            Brak zapisanych analiz. Uruchom `Analizuj z AI`, a następnie użyj przycisku `Zapisz`.
          </div>
        ) : (
          analyses.map((analysis) => (
            <div
              key={analysis.id}
              className={`group relative rounded-2xl border transition-all ${
                analysis.id === selectedAnalysisId
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-700'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(analysis.id)}
                className="w-full text-left px-3 py-3 pr-11"
              >
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatProjectHeader(analysis.projectCodes)}
                </div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  <CalendarRange className="w-3.5 h-3.5" />
                  {analysis.dateFrom} - {analysis.dateTo}
                </div>
                <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  Dodano: {formatDateTime(analysis.createdAt)}
                </div>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(analysis);
                }}
                className="absolute right-2 top-2 rounded-lg p-2 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                aria-label="Usuń wpis historii AI"
                title="Usuń wpis historii AI"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
