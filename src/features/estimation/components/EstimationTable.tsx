import React from 'react';
import type { Project, Estimation, EstimationItem } from '../../../App';
import { Plus, X, AlertCircle } from 'lucide-react';
import { generateId } from '../services/EstimationService';

interface EstimationTableProps {
  estimation: Estimation;
  setEstimation: React.Dispatch<React.SetStateAction<Estimation | null>>;
  project: Project;
  isBrutto: boolean;
  setIsBrutto: (val: boolean) => void;
}

export const EstimationTable: React.FC<EstimationTableProps> = ({ 
  estimation, 
  setEstimation, 
  project,
  isBrutto,
  setIsBrutto
}) => {
  

  const updateItem = (id: string, updates: Partial<EstimationItem>) => {
    setEstimation(prev => {
      if (!prev) return null;
      const newItems = prev.items.map(item => {
        if (item.id !== id) return item;
        
        const updated = { ...item, ...updates };
        
        const baseChanged = 'baseHours' in updates;
        const multChanged = 'multiplier' in updates;
        const overrideToggledOff = updates.isOverridden === false;

        if (!updated.isOverridden || overrideToggledOff) {
          if (baseChanged || multChanged || overrideToggledOff) {
            // Round calculated finalHours to nearest 0.5 IMMEDIATELY
            updated.finalHours = Math.round(updated.baseHours * updated.multiplier * 2) / 2;
          }
        }
        
        return updated;
      });
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: [...prev.items, {
          id: generateId(),
          name: 'Nowa pozycja',
          baseHours: 0,
          multiplier: 1.2,
          finalHours: 0,
          isOverridden: false
        }]
      };
    });
  };

  const removeItem = (id: string) => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.filter(i => i.id !== id)
      };
    });
  };

  const totalHours = estimation.items.reduce((sum, item) => sum + item.finalHours, 0);
  const totalNetto = totalHours * project.rateNetto;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/30 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
          <tr>
            <th className="px-4 py-3 w-10 text-center">Lp.</th>
            <th className="px-4 py-3">Przedmiot wyceny</th>
            <th className="px-4 py-3 w-24 text-center">Est. Zespół (h)</th>
            <th className="px-4 py-3 w-20 text-center">Dod. (%)</th>
            <th className="px-4 py-3 w-28 text-center bg-indigo-50/30 dark:bg-indigo-900/10">Finał (h)</th>
            <th className="px-4 py-3 w-32 text-right">
              <div className="flex flex-col items-end">
                <span className="whitespace-nowrap">Kwota ({isBrutto ? 'brutto' : 'netto'})</span>
                <button 
                  onClick={() => setIsBrutto(!isBrutto)}
                  className="text-[10px] uppercase tracking-wider text-indigo-500 hover:text-indigo-600 font-bold"
                >
                  Pokaż {isBrutto ? 'netto' : 'brutto'}
                </button>
              </div>
            </th>
            <th className="px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {estimation.items.map((item, idx) => (
            <tr key={item.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
              <td className="px-4 py-2 text-center text-gray-400">{idx + 1}.</td>
              <td className="px-4 py-2">
                <input
                  value={item.name}
                  onChange={e => updateItem(item.id, { name: e.target.value })}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-gray-900 dark:text-white outline-none transition-shadow"
                />
              </td>
              <td className="px-4 py-2">
                <NumericCell
                  value={item.baseHours}
                  roundTo={0.5}
                  onChange={val => updateItem(item.id, { baseHours: val })}
                  className="w-full text-center"
                />
              </td>
              <td className="px-4 py-2 text-center">
                 <NumericCell
                  value={item.multiplier}
                  disabled={item.isOverridden}
                  onChange={val => updateItem(item.id, { multiplier: val })}
                  className={`w-full text-center ${item.isOverridden ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}
                />
              </td>
              <td className={`px-4 py-2 text-center bg-indigo-50/20 dark:bg-indigo-900/5 relative group/item`}>
                <NumericCell
                  value={item.finalHours}
                  isBold
                  roundTo={0.5}
                  onChange={val => {
                    updateItem(item.id, { 
                      isOverridden: true,
                      finalHours: val
                    });
                  }}
                  className={`w-full text-center ${item.isOverridden ? 'border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400' : 'border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}
                />
                {item.isOverridden && (
                  <button 
                    onClick={() => updateItem(item.id, { isOverridden: false })}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 p-1 text-amber-500 hover:text-indigo-500 transition"
                    title="Przywróc obliczenia automatyczne"
                  >
                    <RotateCcwSmall />
                  </button>
                )}
              </td>
              <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-300">
                {(item.finalHours * project.rateNetto * (isBrutto ? 1.23 : 1)).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => removeItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 transition"
                >
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50/80 dark:bg-gray-900/80 font-bold border-t border-gray-200 dark:border-gray-700">
          <tr>
            <td colSpan={2} className="px-4 py-4 text-right text-gray-500 uppercase text-xs tracking-wider">Podsumowanie</td>
            <td className="px-4 py-4 text-center text-gray-400 font-normal">
              {estimation.items.reduce((s, i) => s + i.baseHours, 0).toFixed(2)}h
            </td>
            <td></td>
            <td className="px-4 py-4 text-center text-indigo-600 dark:text-indigo-400 text-lg">
              {totalHours.toFixed(2)}h
            </td>
            <td className="px-4 py-4 text-right text-indigo-600 dark:text-indigo-400 text-lg">
              {(totalNetto * (isBrutto ? 1.23 : 1)).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={addItem}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition"
        >
          <Plus size={16} /> Dodaj pozycję wyceny
        </button>
      </div>
      
      {estimation.items.some(i => i.isOverridden) && (
        <div className="p-4 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400/80 bg-amber-50/50 dark:bg-amber-900/10">
          <AlertCircle size={14} />
          <span>Niektóre wartości finałowe zostały nadpisane ręcznie (oznaczone kolorem pomarańczowym).</span>
        </div>
      )}
    </div>
  );
};

interface NumericCellProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  disabled?: boolean;
  isBold?: boolean;
  roundTo?: number;
}

const NumericCell: React.FC<NumericCellProps> = ({ value, onChange, className = '', disabled = false, isBold = false, roundTo }) => {
  const [localVal, setLocalVal] = React.useState(value.toFixed(2));
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync with value from parent when not focused
  React.useEffect(() => {
    if (!isFocused) {
      setLocalVal(value.toFixed(2));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value.replace(',', '.');
    // Allow digits, one dot, and one minus sign at start
    if (/^-?\d*\.?\d*$/.test(newVal)) {
      setLocalVal(newVal);
      const parsed = parseFloat(newVal);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(localVal);
    let final = isNaN(parsed) ? 0 : parsed;
    
    if (roundTo) {
      final = Math.round(final / roundTo) * roundTo;
    }

    onChange(final);
    setLocalVal(final.toFixed(2));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={isFocused ? localVal : value.toFixed(2)}
      disabled={disabled}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onBlur={handleBlur}
      onChange={handleChange}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-gray-900 dark:text-white outline-none transition-shadow ${isBold ? 'font-bold' : ''} ${className}`}
    />
  );
};

const RotateCcwSmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
