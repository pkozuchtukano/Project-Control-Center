import { CalendarRange, History } from 'lucide-react';
import type { DailyAiAnalysis } from '../../../types';

type DailyAiHistoryPanelProps = {
  analyses: DailyAiAnalysis[];
  selectedAnalysisId: string | null;
  onSelect: (analysisId: string) => void;
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
            <button
              key={analysis.id}
              type="button"
              onClick={() => onSelect(analysis.id)}
              className={`w-full text-left rounded-2xl border px-3 py-3 transition-all ${
                analysis.id === selectedAnalysisId
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-700'
              }`}
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
          ))
        )}
      </div>
    </aside>
  );
};
