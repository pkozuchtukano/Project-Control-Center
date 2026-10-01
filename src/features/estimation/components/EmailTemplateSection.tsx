import React, { useMemo } from 'react';
import type { Estimation, EmailTemplate, Project, OrderProtocolStep } from '../../../types';
import { ChevronDown, Copy } from 'lucide-react';
import { getEstimationCustomVariableFields, getEstimationVariableDefinitions, resolveEstimationTemplate } from '../services/EstimationService';
import { parseDateVariable } from '../../../utils/dateParsing';

interface EmailTemplateSectionProps {
  estimation: Estimation;
  project: Project;
  flowSteps?: OrderProtocolStep[];
  setEstimation: React.Dispatch<React.SetStateAction<Estimation | null>>;
}

export const EstimationVariablesSection: React.FC<EmailTemplateSectionProps> = ({ estimation, project, flowSteps = [], setEstimation }) => {
  const variables = estimation.emailTemplate?.variables || {};
  const fields = getEstimationCustomVariableFields(estimation, project, flowSteps);
  const dateValue = parseDateVariable('data', variables.data)!.split('.').reverse().join('-');
  const updateVariable = (token: string, value: string) => {
    setEstimation(current => current ? {
      ...current,
      emailTemplate: {
        to: '',
        cc: '',
        subject: '',
        body: '',
        ...current.emailTemplate,
        variables: { ...current.emailTemplate?.variables, [token]: value },
      },
    } : current);
  };

  return (
    <section className="pcc-card space-y-4" aria-label="Zmienne wyceny">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">Zmienne</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {'U\u017cywane w krokach flow i szablonie e-mail. Dodaj w tre\u015bci token, np. {{twoja_zmienna}}, aby pojawi\u0142o si\u0119 pole do uzupe\u0142nienia.'}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
          <span>Data dla <code>{'{{data}}'}</code></span>
          <input
            type="date"
            value={dateValue}
            onChange={event => updateVariable('data', event.target.value.split('-').reverse().join('.'))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
          />
        </label>
      </div>
      {fields.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fields.map(token => (
            <label key={token} className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
              <code>{`{{${token}}}`}</code>
              <input
                type="text"
                value={variables[token] || ''}
                onChange={event => updateVariable(token, event.target.value)}
                className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
};

export const EmailTemplateSection: React.FC<EmailTemplateSectionProps> = ({ estimation, project, setEstimation }) => {
  const template = useMemo(() => estimation.emailTemplate || {
    to: '',
    cc: '',
    subject: '',
    body: '',
    variables: {}
  }, [estimation.emailTemplate]);

  const availableVariables = useMemo(() => {
    return getEstimationVariableDefinitions(estimation, project, template.variables || {})
      .slice()
      .sort((left, right) => left.token.localeCompare(right.token, 'pl', { sensitivity: 'base' }));
  }, [estimation, project, template.variables]);

  const updateTemplate = (updates: Partial<EmailTemplate>) => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        emailTemplate: {
          ...template,
          ...updates
        }
      };
    });
  };

  const replaceVariables = (text: string) => {
    return resolveEstimationTemplate(text, estimation, project, template.variables || {});
  };

  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [isVariablesPanelExpanded, setIsVariablesPanelExpanded] = React.useState(false);

  const handleCopy = async (text: string, id: string) => {
    const processed = replaceVariables(text);
    await navigator.clipboard.writeText(processed);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopySnippet = async (snippet: string, id: string) => {
    await navigator.clipboard.writeText(snippet);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <button
          type="button"
          onClick={() => setIsVariablesPanelExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={isVariablesPanelExpanded}
        >
          <div>
            <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Dostępne zmienne i funkcje</h4>
            <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-300/80">
              Rozwiń, gdy potrzebujesz skopiować token do flow albo szablonu e-mail wyceny.
            </p>
          </div>
          <ChevronDown size={18} className={`shrink-0 text-indigo-500 transition-transform ${isVariablesPanelExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isVariablesPanelExpanded && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availableVariables.map(variable => (
                <div
                  key={variable.token}
                  className="pcc-card-compact p-3 border-indigo-100 dark:border-indigo-900/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleCopySnippet(`{{${variable.token}}}`, `token:${variable.token}`)}
                      className="group inline-flex min-w-0 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-left text-xs font-semibold text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/40"
                      title={`Kliknij, aby skopiować {{${variable.token}}}.`}
                    >
                      <code className="truncate">{`{{${variable.token}}}`}</code>
                      {copiedField === `token:${variable.token}` ? (
                        <span className="shrink-0 text-[10px] font-bold text-emerald-500">Skopiowano</span>
                      ) : (
                        <Copy size={12} className="shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                  </div>
                  {variable.aliases && variable.aliases.length > 0 && (
                    <div className="mt-2 text-[11px] leading-5 text-indigo-700/70 dark:text-indigo-300/70">
                      <span className="font-semibold">Aliasy: </span>
                      {variable.aliases.map(alias => `{{${alias}}}`).join(', ')}
                    </div>
                  )}
                  <div className="mt-2 min-h-8 rounded-xl bg-gray-50 px-2.5 py-2 text-[11px] leading-5 text-gray-600 dark:bg-gray-950/50 dark:text-gray-300">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Aktualna wartość: </span>
                    <span className="break-words">{variable.value || 'brak wartości w bieżącym kontekście'}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-indigo-200/80 bg-white/80 p-4 dark:border-indigo-900/60 dark:bg-gray-900/40">
              <h5 className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">Dostępne funkcje</h5>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {['{{slownie(wartosc_brutto)}}', '{{slownie(wartosc_netto)}}'].map(signature => (
                  <button
                    type="button"
                    key={signature}
                    onClick={() => handleCopySnippet(signature, `function:${signature}`)}
                    className="group flex w-full items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-100/70 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30"
                    title={`Kliknij, aby skopiować ${signature}`}
                  >
                    <code className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">{signature}</code>
                    {copiedField === `function:${signature}` ? (
                      <span className="shrink-0 text-[10px] font-bold text-emerald-500">Skopiowano</span>
                    ) : (
                      <Copy size={13} className="shrink-0 text-indigo-500 opacity-60 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Email Fields */}
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'to', label: 'DO:', val: template.to },
            { id: 'cc', label: 'DW:', val: template.cc },
          ].map(field => (
            <div key={field.id} className="flex flex-col gap-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</label>
                <div className="flex items-center gap-2">
                  {copiedField === field.id && (
                    <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                  )}
                  <button
                    onClick={() => handleCopy(field.val, field.id)}
                    className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                    title="Kopiuj z podstawieniem zmiennych"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={field.val}
                onChange={e => updateTemplate({ [field.id]: e.target.value })}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded px-3 py-1.5 text-sm outline-none transition-shadow"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Temat:</label>
            <div className="flex items-center gap-2">
              {copiedField === 'subject' && (
                <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
              )}
              <button
                onClick={() => handleCopy(template.subject, 'subject')}
                className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                title="Kopiuj z podstawieniem zmiennych"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
          <input
            type="text"
            value={template.subject}
            onChange={e => updateTemplate({ subject: e.target.value })}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded px-3 py-1.5 text-sm outline-none transition-shadow font-medium"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Treść wiadomości:</label>
            <div className="flex items-center gap-2">
              {copiedField === 'body' && (
                <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano treść!</span>
              )}
              <button
                onClick={() => handleCopy(template.body, 'body')}
                className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                title="Kopiuj treść z danymi"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
          <textarea
            value={template.body}
            onChange={e => updateTemplate({ body: e.target.value })}
            rows={10}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded px-3 py-2 text-sm outline-none font-sans leading-relaxed resize-none transition-shadow"
          />
        </div>
      </div>
    </div>
  );
};
