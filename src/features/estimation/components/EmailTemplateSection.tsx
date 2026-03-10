import React, { useMemo, useEffect } from 'react';
import type { Estimation, EmailTemplate } from '../../../App';
import { Copy, Sparkles } from 'lucide-react';

interface EmailTemplateSectionProps {
  estimation: Estimation;
  setEstimation: React.Dispatch<React.SetStateAction<Estimation | null>>;
}

export const EmailTemplateSection: React.FC<EmailTemplateSectionProps> = ({ estimation, setEstimation }) => {
  const template = useMemo(() => estimation.emailTemplate || {
    to: '',
    cc: '',
    subject: '',
    body: '',
    variables: {}
  }, [estimation.emailTemplate]);

  // Find all matches of {{var}}
  const detectedVariables = useMemo(() => {
    const text = `${template.to} ${template.cc} ${template.subject} ${template.body}`;
    const matches = Array.from(text.matchAll(/\{\{([^}]+)\}\}/g));
    const vars = new Set<string>();
    for (const match of matches) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }, [template.to, template.cc, template.subject, template.body]);

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

  const updateVariable = (name: string, value: string) => {
    updateTemplate({
      variables: {
        ...template.variables,
        [name]: value
      }
    });
  };

  // Auto-fill dates
  useEffect(() => {
    let changed = false;
    const newVars = { ...template.variables };
    detectedVariables.forEach(v => {
      if (newVars[v] === undefined || newVars[v] === '') {
        if (v.toLowerCase().includes('data')) {
          newVars[v] = new Date().toLocaleDateString('pl-PL');
          changed = true;
        }
      }
    });

    // Clean up variables that are no longer in text? Maybe better not, to keep user input
    
    if (changed) {
      updateTemplate({ variables: newVars });
    }
  }, [detectedVariables]);

  const replaceVariables = (text: string) => {
    let result = text;
    detectedVariables.forEach(v => {
      const val = template.variables[v] || '';
      // We use escape-safe replacement
      result = result.split(`{{${v}}}`).join(val);
    });
    return result;
  };

  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    const processed = replaceVariables(text);
    await navigator.clipboard.writeText(processed);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4 p-6">
      {/* Dynamic Variables Section */}
      {detectedVariables.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1 bg-amber-100 dark:bg-amber-900/50 rounded text-amber-600 dark:text-amber-400">
              <Sparkles size={14} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Uzupełnij zmienne z szablonu
            </h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detectedVariables.map(v => {
              const isDate = v.toLowerCase().includes('data');
              let displayValue = template.variables[v] || '';
              
              // If it's a date and we have a value like DD.MM.YYYY, convert to YYYY-MM-DD for native input
              let dateValue = '';
              if (isDate && displayValue) {
                const parts = displayValue.split('.');
                if (parts.length === 3) {
                  dateValue = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else if (displayValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  dateValue = displayValue;
                }
              }

              const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value; // YYYY-MM-DD
                if (!val) {
                  updateVariable(v, '');
                  return;
                }
                const [y, m, d] = val.split('-');
                updateVariable(v, `${d}.${m}.${y}`);
              };

              return (
                <div key={v} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-amber-600/70 dark:text-amber-500/70 uppercase px-1">{v}</label>
                  {isDate ? (
                    <input
                      type="date"
                      value={dateValue}
                      onChange={handleDateChange}
                      className="bg-white dark:bg-gray-800 border border-amber-200/60 dark:border-amber-900/60 focus:ring-1 focus:ring-amber-500 rounded px-2 py-1 text-sm outline-none transition-shadow"
                    />
                  ) : (
                    <input
                      type="text"
                      value={displayValue}
                      onChange={e => updateVariable(v, e.target.value)}
                      placeholder={`Wartość dla ${v}...`}
                      className="bg-white dark:bg-gray-800 border border-amber-200/60 dark:border-amber-900/60 focus:ring-1 focus:ring-amber-500 rounded px-2 py-1 text-sm outline-none transition-shadow"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
