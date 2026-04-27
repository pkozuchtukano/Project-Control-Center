import { useEffect, useMemo, useState } from 'react';
import { Bot, Copy, Loader2, RotateCcw, Save, Send, UploadCloud, X } from 'lucide-react';
import type { GeminiGenerateRequest, GeminiGenerateResponse } from '../../../types';

type DailyAiAnalysisModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sourcePayloadText: string;
  defaultModel?: string;
  onAnalyze: (request: GeminiGenerateRequest) => Promise<GeminiGenerateResponse>;
  isAnalyzing: boolean;
  onSaveAnalysis: (content: string) => Promise<void>;
  isSavingAnalysis: boolean;
  onExportToClickUp?: (content: string) => Promise<string | void>;
  isExportingToClickUp?: boolean;
  canExportToClickUp?: boolean;
};

type DailyAiAnalysisFormState = {
  model: string;
  systemInstruction: string;
  promptText: string;
  stopSequences: string;
  responseMimeType: string;
  responseModalities: string;
  candidateCount: string;
  maxOutputTokens: string;
  temperature: string;
  topP: string;
  topK: string;
  seed: string;
  presencePenalty: string;
  frequencyPenalty: string;
  responseLogprobs: boolean;
  logprobs: string;
  enableEnhancedCivicAnswers: boolean;
  thinkingBudget: string;
  includeThoughts: boolean;
  thinkingLevel: string;
  mediaResolution: string;
  responseSchemaText: string;
  responseJsonSchemaText: string;
  speechConfigText: string;
  imageConfigText: string;
  additionalGenerationConfigText: string;
  additionalRequestFieldsText: string;
};

const STORAGE_KEY = 'daily_ai_analysis_settings';
const CUSTOM_MODEL_VALUE = '__custom_model__';
const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
] as const;

const DEFAULT_SYSTEM_INSTRUCTION = [
  'Jestes analitykiem projektu IT.',
  'Na podstawie otrzymanego JSON opisz po polsku aktualny stan projektu.',
  'Wskaz aktywne zadania, tematy w realizacji, testy wewnetrzne, testy po stronie klienta, blokery, ryzyka, notatki PM oraz rekomendowane kolejne kroki.',
  'Formatuj zadania jako glowna liste punktowana: jeden punkt to jedno zadanie z kodem YouTrack i tytulem.',
  'Wydarzenia, komentarze, zmiany statusu i logi czasu wewnatrz zadania opisuj jako zwarty blok tekstu w tym samym punkcie zadania, bez dodatkowej listy zagniezdzonej.',
  'Oddzielaj kolejne zadania pusta linia, aby wpis w historii byl czytelny po otwarciu w edytorze.',
  'Pisz konkretnie, technicznie i syntetycznie.',
].join(' ');

const createDefaultFormState = (defaultModel?: string): DailyAiAnalysisFormState => ({
  model: defaultModel || '',
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  promptText: '',
  stopSequences: '',
  responseMimeType: 'text/plain',
  responseModalities: '',
  candidateCount: '1',
  maxOutputTokens: '4096',
  temperature: '0.2',
  topP: '',
  topK: '',
  seed: '',
  presencePenalty: '',
  frequencyPenalty: '',
  responseLogprobs: false,
  logprobs: '',
  enableEnhancedCivicAnswers: false,
  thinkingBudget: '',
  includeThoughts: false,
  thinkingLevel: '',
  mediaResolution: '',
  responseSchemaText: '',
  responseJsonSchemaText: '',
  speechConfigText: '',
  imageConfigText: '',
  additionalGenerationConfigText: '',
  additionalRequestFieldsText: '',
});

const parseDelimitedList = (value: string) =>
  value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseOptionalNumber = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`Pole ${label} musi byc liczba.`);
  }
  return parsed;
};

const parseOptionalInteger = (value: string, label: string) => {
  const parsed = parseOptionalNumber(value, label);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed)) {
    throw new Error(`Pole ${label} musi byc liczba calkowita.`);
  }
  return parsed;
};

const parseOptionalJson = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Pole ${label} zawiera niepoprawny JSON.`);
  }
};

const toSettingsSnapshot = (state: DailyAiAnalysisFormState): Omit<DailyAiAnalysisFormState, 'promptText'> => {
  const { promptText: _promptText, ...settings } = state;
  return settings;
};

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

export const DailyAiAnalysisModal = ({
  isOpen,
  onClose,
  sourcePayloadText,
  defaultModel,
  onAnalyze,
  isAnalyzing,
  onSaveAnalysis,
  isSavingAnalysis,
  onExportToClickUp,
  isExportingToClickUp = false,
  canExportToClickUp = false,
}: DailyAiAnalysisModalProps) => {
  const [formState, setFormState] = useState<DailyAiAnalysisFormState>(() => createDefaultFormState(defaultModel));
  const [analysisResult, setAnalysisResult] = useState<GeminiGenerateResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'payload' | 'result' | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const isCustomModel = useMemo(
    () => Boolean(formState.model.trim()) && !GEMINI_MODEL_OPTIONS.some((option) => option.value === formState.model.trim()),
    [formState.model],
  );

  useEffect(() => {
    if (!isOpen) return;

    const defaults = createDefaultFormState(defaultModel);
    let savedSettings: Partial<Omit<DailyAiAnalysisFormState, 'promptText'>> = {};

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      savedSettings = raw ? JSON.parse(raw) : {};
    } catch {
      savedSettings = {};
    }

    setFormState({
      ...defaults,
      ...savedSettings,
      promptText: sourcePayloadText,
    });
    setAnalysisResult(null);
    setAnalysisError(null);
    setCopiedTarget(null);
    setExportSuccess(null);
  }, [isOpen, sourcePayloadText, defaultModel]);

  useEffect(() => {
    if (!isOpen) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSettingsSnapshot(formState)));
  }, [formState, isOpen]);

  const requestPreview = useMemo(() => {
    try {
      const generationConfigFromJson = parseOptionalJson(formState.additionalGenerationConfigText, 'Dodatkowa konfiguracja generationConfig');
      const additionalRequestFields = parseOptionalJson(formState.additionalRequestFieldsText, 'Dodatkowe pola request');

      const generationConfig: Record<string, unknown> = {
        ...(generationConfigFromJson && typeof generationConfigFromJson === 'object' ? generationConfigFromJson as Record<string, unknown> : {}),
      };

      const stopSequences = parseDelimitedList(formState.stopSequences);
      const responseModalities = parseDelimitedList(formState.responseModalities);
      const candidateCount = parseOptionalInteger(formState.candidateCount, 'candidateCount');
      const maxOutputTokens = parseOptionalInteger(formState.maxOutputTokens, 'maxOutputTokens');
      const temperature = parseOptionalNumber(formState.temperature, 'temperature');
      const topP = parseOptionalNumber(formState.topP, 'topP');
      const topK = parseOptionalInteger(formState.topK, 'topK');
      const seed = parseOptionalInteger(formState.seed, 'seed');
      const presencePenalty = parseOptionalNumber(formState.presencePenalty, 'presencePenalty');
      const frequencyPenalty = parseOptionalNumber(formState.frequencyPenalty, 'frequencyPenalty');
      const logprobs = parseOptionalInteger(formState.logprobs, 'logprobs');
      const thinkingBudget = parseOptionalInteger(formState.thinkingBudget, 'thinkingBudget');
      const responseSchema = parseOptionalJson(formState.responseSchemaText, 'responseSchema');
      const responseJsonSchema = parseOptionalJson(formState.responseJsonSchemaText, 'responseJsonSchema');
      const speechConfig = parseOptionalJson(formState.speechConfigText, 'speechConfig');
      const imageConfig = parseOptionalJson(formState.imageConfigText, 'imageConfig');

      if (stopSequences.length) generationConfig.stopSequences = stopSequences;
      if (formState.responseMimeType.trim()) generationConfig.responseMimeType = formState.responseMimeType.trim();
      if (responseModalities.length) generationConfig.responseModalities = responseModalities;
      if (candidateCount !== undefined) generationConfig.candidateCount = candidateCount;
      if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;
      if (temperature !== undefined) generationConfig.temperature = temperature;
      if (topP !== undefined) generationConfig.topP = topP;
      if (topK !== undefined) generationConfig.topK = topK;
      if (seed !== undefined) generationConfig.seed = seed;
      if (presencePenalty !== undefined) generationConfig.presencePenalty = presencePenalty;
      if (frequencyPenalty !== undefined) generationConfig.frequencyPenalty = frequencyPenalty;
      if (formState.responseLogprobs) generationConfig.responseLogprobs = true;
      if (logprobs !== undefined) generationConfig.logprobs = logprobs;
      if (formState.enableEnhancedCivicAnswers) generationConfig.enableEnhancedCivicAnswers = true;
      if (responseSchema !== undefined) generationConfig.responseSchema = responseSchema;
      if (responseJsonSchema !== undefined) generationConfig.responseJsonSchema = responseJsonSchema;
      if (speechConfig !== undefined) generationConfig.speechConfig = speechConfig;
      if (imageConfig !== undefined) generationConfig.imageConfig = imageConfig;
      if (formState.mediaResolution.trim()) generationConfig.mediaResolution = formState.mediaResolution.trim();

      const thinkingConfig: Record<string, unknown> = {};
      if (thinkingBudget !== undefined) thinkingConfig.thinkingBudget = thinkingBudget;
      if (formState.includeThoughts) thinkingConfig.includeThoughts = true;
      if (formState.thinkingLevel.trim()) thinkingConfig.thinkingLevel = formState.thinkingLevel.trim();
      if (Object.keys(thinkingConfig).length) generationConfig.thinkingConfig = thinkingConfig;

      return {
        model: formState.model.trim() || defaultModel || undefined,
        systemInstruction: formState.systemInstruction.trim() || undefined,
        prompt: formState.promptText,
        ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
        ...(additionalRequestFields && typeof additionalRequestFields === 'object'
          ? { additionalRequestFields: additionalRequestFields as Record<string, unknown> }
          : {}),
      } satisfies GeminiGenerateRequest;
    } catch (error: any) {
      return { error: error?.message || 'Niepoprawne parametry formularza.' };
    }
  }, [formState, defaultModel]);

  const handleFormChange = <K extends keyof DailyAiAnalysisFormState>(key: K, value: DailyAiAnalysisFormState[K]) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetDefaults = () => {
    const defaults = createDefaultFormState(defaultModel);
    setFormState({
      ...defaults,
      promptText: sourcePayloadText,
    });
    setAnalysisError(null);
  };

  const handleResetPayload = () => {
    handleFormChange('promptText', sourcePayloadText);
  };

  const handleAnalyze = async () => {
    if ('error' in requestPreview) {
      setAnalysisError(requestPreview.error);
      return;
    }

    if (!formState.promptText.trim()) {
      setAnalysisError('Tresc wysylana do Gemini nie moze byc pusta.');
      return;
    }

    setAnalysisError(null);
    setAnalysisResult(null);
    setExportSuccess(null);

    try {
      const response = await onAnalyze(requestPreview);
      setAnalysisResult(response);
    } catch (error: any) {
      setAnalysisError(error?.message || 'Nie udalo sie pobrac odpowiedzi z Gemini.');
    }
  };

  const handleCopy = async (target: 'payload' | 'result', value: string) => {
    await copyText(value);
    setCopiedTarget(target);
    window.setTimeout(() => setCopiedTarget((prev) => (prev === target ? null : prev)), 2000);
  };

  const handleSaveAnalysis = async () => {
    if (!analysisResult?.text?.trim()) {
      setAnalysisError('Najpierw uruchom analizę AI, aby zapisać odpowiedź do historii.');
      return;
    }

    try {
      await onSaveAnalysis(analysisResult.text);
      setAnalysisError(null);
    } catch (error: any) {
      setAnalysisError(error?.message || 'Nie udało się zapisać analizy do historii.');
    }
  };

  const handleExportToClickUp = async () => {
    if (!analysisResult?.text?.trim()) {
      setAnalysisError('Najpierw uruchom analizę AI, aby wyeksportować odpowiedź do ClickUp.');
      return;
    }

    if (!onExportToClickUp || !canExportToClickUp) {
      setAnalysisError('Brak konfiguracji ClickUp `Url do daily` dla tego projektu.');
      return;
    }

    try {
      const message = await onExportToClickUp(analysisResult.text);
      setExportSuccess(message || 'Wyeksportowano odpowiedź AI do ClickUp.');
      setAnalysisError(null);
    } catch (error: any) {
      setExportSuccess(null);
      setAnalysisError(error?.message || 'Nie udało się wyeksportować odpowiedzi AI do ClickUp.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div className="w-full max-w-7xl max-h-[94vh] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
              <Bot className="w-4 h-4 text-indigo-500" />
              Analizuj z AI
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Formularz buduje request do Gemini na podstawie aktualnego eksportu JSON z tablicy Daily. Tresc mozesz podejrzec, zmienic i wyslac ponownie.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5 min-w-0">
            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tresc do analizy</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Domyslnie to aktualny JSON przygotowany z tablicy Daily. Mozesz go poprawic przed wysylka.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPayload}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Odswiez JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy('payload', formState.promptText)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedTarget === 'payload' ? 'Skopiowano' : 'Kopiuj'}
                  </button>
                </div>
              </div>

              <textarea
                value={formState.promptText}
                onChange={(event) => handleFormChange('promptText', event.target.value)}
                className="w-full min-h-[320px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-mono text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                spellCheck={false}
              />
            </section>

            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Odpowiedz AI</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Po analizie tutaj pojawi sie odpowiedz modelu oraz metadane wykonania.
                </p>
              </div>

              {analysisError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
                  {analysisError}
                </div>
              )}

              {exportSuccess && (
                <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
                  {exportSuccess}
                </div>
              )}

              {'error' in requestPreview && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
                  {requestPreview.error}
                </div>
              )}

              <div className="space-y-3">
                <textarea
                  value={analysisResult?.text || ''}
                  readOnly
                  placeholder="Po kliknieciu Analizuj z AI tutaj pojawi sie odpowiedz Gemini."
                  className="w-full min-h-[220px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />

                {analysisResult && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        Model: {analysisResult.model}
                      </span>
                      {analysisResult.finishReason && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          Finish: {analysisResult.finishReason}
                        </span>
                      )}
                      {analysisResult.responseId && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          Response ID: {analysisResult.responseId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Metadane i odpowiedz mozesz skopiowac dalej do notatek lub maila.</span>
                      <button
                        type="button"
                        onClick={() => void handleCopy('result', analysisResult.text)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedTarget === 'result' ? 'Skopiowano' : 'Kopiuj odpowiedz'}
                      </button>
                    </div>

                    {analysisResult.usageMetadata && (
                      <pre className="overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                        {JSON.stringify(analysisResult.usageMetadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-5 min-w-0">
            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Parametry Gemini</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Formularz obejmuje glowne pola `generationConfig` oraz dodatkowe sekcje JSON dla rozszerzen requestu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Domyslne
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Model</span>
                  <select
                    value={isCustomModel ? CUSTOM_MODEL_VALUE : (formState.model.trim() || defaultModel || 'gemini-2.5-flash')}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (nextValue === CUSTOM_MODEL_VALUE) {
                        handleFormChange('model', formState.model.trim() || '');
                        return;
                      }
                      handleFormChange('model', nextValue);
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    {GEMINI_MODEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value={CUSTOM_MODEL_VALUE}>Własny model...</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">responseMimeType</span>
                  <input
                    value={formState.responseMimeType}
                    onChange={(event) => handleFormChange('responseMimeType', event.target.value)}
                    placeholder="text/plain"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              </div>

              {isCustomModel && (
                <label className="space-y-1.5 mt-3 block">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Własna nazwa modelu</span>
                  <input
                    value={formState.model}
                    onChange={(event) => handleFormChange('model', event.target.value)}
                    placeholder="np. gemini-2.5-flash-preview-09-2025"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              )}

              <label className="space-y-1.5 mt-3 block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">systemInstruction</span>
                <textarea
                  value={formState.systemInstruction}
                  onChange={(event) => handleFormChange('systemInstruction', event.target.value)}
                  className="w-full min-h-[110px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </label>

              <div className="grid gap-3 mt-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ['candidateCount', 'candidateCount'],
                  ['maxOutputTokens', 'maxOutputTokens'],
                  ['temperature', 'temperature'],
                  ['topP', 'topP'],
                  ['topK', 'topK'],
                  ['seed', 'seed'],
                  ['presencePenalty', 'presencePenalty'],
                  ['frequencyPenalty', 'frequencyPenalty'],
                  ['logprobs', 'logprobs'],
                  ['thinkingBudget', 'thinkingBudget'],
                ].map(([field, label]) => (
                  <label key={field} className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
                    <input
                      value={formState[field as keyof DailyAiAnalysisFormState] as string}
                      onChange={(event) => handleFormChange(field as keyof DailyAiAnalysisFormState, event.target.value as never)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </label>
                ))}

                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">responseModalities</span>
                  <input
                    value={formState.responseModalities}
                    onChange={(event) => handleFormChange('responseModalities', event.target.value)}
                    placeholder="TEXT, IMAGE, AUDIO"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">thinkingLevel</span>
                  <input
                    value={formState.thinkingLevel}
                    onChange={(event) => handleFormChange('thinkingLevel', event.target.value)}
                    placeholder="minimal, low, medium, high"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">mediaResolution</span>
                  <input
                    value={formState.mediaResolution}
                    onChange={(event) => handleFormChange('mediaResolution', event.target.value)}
                    placeholder="MEDIA_RESOLUTION_HIGH"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              </div>

              <label className="space-y-1.5 mt-3 block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">stopSequences</span>
                <textarea
                  value={formState.stopSequences}
                  onChange={(event) => handleFormChange('stopSequences', event.target.value)}
                  placeholder="Jedna wartosc na linie albo rozdziel po przecinkach"
                  className="w-full min-h-[84px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-3">
                {[
                  ['responseLogprobs', 'responseLogprobs'],
                  ['enableEnhancedCivicAnswers', 'enableEnhancedCivicAnswers'],
                  ['includeThoughts', 'thinkingConfig.includeThoughts'],
                ].map(([field, label]) => (
                  <label key={field} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={Boolean(formState[field as keyof DailyAiAnalysisFormState])}
                      onChange={(event) => handleFormChange(field as keyof DailyAiAnalysisFormState, event.target.checked as never)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Zaawansowane pola JSON</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Te pola pozwalaja ustawic zlozone parametry requestu Gemini, np. schemy odpowiedzi lub dodatkowe obiekty konfiguracyjne.
              </p>

              {[
                ['responseSchemaText', 'responseSchema (JSON)'],
                ['responseJsonSchemaText', 'responseJsonSchema (JSON)'],
                ['speechConfigText', 'speechConfig (JSON)'],
                ['imageConfigText', 'imageConfig (JSON)'],
                ['additionalGenerationConfigText', 'Dodatkowe pola generationConfig (JSON)'],
                ['additionalRequestFieldsText', 'Dodatkowe pola request (JSON)'],
              ].map(([field, label]) => (
                <label key={field} className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
                  <textarea
                    value={formState[field as keyof DailyAiAnalysisFormState] as string}
                    onChange={(event) => handleFormChange(field as keyof DailyAiAnalysisFormState, event.target.value as never)}
                    className="w-full min-h-[92px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    spellCheck={false}
                  />
                </label>
              ))}
            </section>

            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Podglad requestu</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tak zostanie zbudowany request wysylany do IPC `ask-gemini`.
                </p>
              </div>
              <pre className="overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {'error' in requestPreview
                  ? requestPreview.error
                  : JSON.stringify(requestPreview, null, 2)}
              </pre>
            </section>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ustawienia formularza sa zapamietywane lokalnie. Zmiana tresci JSON nie nadpisuje Twoich domyslnych preferencji parametrów.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              Zamknij
            </button>
            <button
              type="button"
              onClick={() => void handleExportToClickUp()}
              disabled={isExportingToClickUp || !analysisResult?.text?.trim() || !canExportToClickUp}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white ${
                isExportingToClickUp || !analysisResult?.text?.trim() || !canExportToClickUp
                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700'
                  : 'bg-sky-600 hover:bg-sky-700'
              }`}
              title={canExportToClickUp ? 'Eksportuj odpowiedź AI do dokumentu ClickUp' : 'Uzupełnij Url do daily w ustawieniach projektu'}
            >
              {isExportingToClickUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {isExportingToClickUp ? 'Eksport...' : 'Export do ClickUp'}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAnalysis()}
              disabled={isSavingAnalysis || !analysisResult?.text?.trim()}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white ${
                isSavingAnalysis || !analysisResult?.text?.trim()
                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSavingAnalysis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingAnalysis ? 'Zapisywanie...' : 'Zapisz'}
            </button>
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={isAnalyzing || !formState.promptText.trim()}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-all ${
                isAnalyzing || !formState.promptText.trim()
                  ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]'
              }`}
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isAnalyzing ? 'Analiza w toku...' : 'Analizuj z AI'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
