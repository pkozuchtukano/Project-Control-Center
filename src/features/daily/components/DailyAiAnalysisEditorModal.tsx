import { RotateCcw, Save, X } from 'lucide-react';
import type { DailyAiAnalysis } from '../../../types';
import { Editor } from '../../meeting-notes/components/Editor';

type DailyAiAnalysisEditorModalProps = {
  analysis: DailyAiAnalysis | null;
  draftContent: string;
  isSaving: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onRestoreOriginal: () => void;
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

export const DailyAiAnalysisEditorModal = ({
  analysis,
  draftContent,
  isSaving,
  onClose,
  onChange,
  onSave,
  onRestoreOriginal,
}: DailyAiAnalysisEditorModalProps) => {
  if (!analysis) return null;

  const hasUnsavedChanges = draftContent !== analysis.currentContent;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm p-4">
      <div className="h-full w-full rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-black text-gray-900 dark:text-white">
              {formatProjectHeader(analysis.projectCodes)}
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Zakres: {analysis.dateFrom} - {analysis.dateTo}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Dodano: {formatDateTime(analysis.createdAt)}
            </div>
            {analysis.updatedAt !== analysis.createdAt && (
              <div className="text-sm text-amber-600 dark:text-amber-400">
                Ostatnia edycja: {formatDateTime(analysis.updatedAt)}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Zamknij edytor analizy AI"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          <Editor
            content={draftContent}
            onChange={onChange}
            placeholder="Edytuj treść analizy dla zespołu..."
            minHeight={720}
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {hasUnsavedChanges ? 'Masz niezapisane zmiany.' : 'Treść jest zgodna z zapisaną wersją.'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRestoreOriginal}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <RotateCcw className="w-4 h-4" />
              Przywróć oryginał
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white ${
                isSaving || !hasUnsavedChanges
                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
