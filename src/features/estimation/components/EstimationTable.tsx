import React from 'react';
import type { Project, Estimation, EstimationItem } from '../../../types';
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
  const [activeHint, setActiveHint] = React.useState<{ itemId: string; field: 'baseHours' | 'finalHours' } | null>(null);

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
  const expectedHours = typeof estimation.expectedHours === 'number' && Number.isFinite(estimation.expectedHours)
    ? estimation.expectedHours
    : null;
  const roleExpectedHoursInputRef = React.useRef('');
  const roleExpectedHoursDomRef = React.useRef<HTMLInputElement | null>(null);
  const isRoleExpectedHoursFocusedRef = React.useRef(false);
  React.useEffect(() => {
    if (isRoleExpectedHoursFocusedRef.current) return;
    const nextValue = expectedHours === null ? '' : expectedHours.toFixed(2);
    roleExpectedHoursInputRef.current = nextValue;
    if (roleExpectedHoursDomRef.current) {
      roleExpectedHoursDomRef.current.value = nextValue;
    }
  }, [expectedHours]);
  const getSuggestedFinalHours = (itemId: string) => {
    if (expectedHours === null) return null;
    const otherItemsTotal = estimation.items
      .filter((item) => item.id !== itemId)
      .reduce((sum, item) => sum + item.finalHours, 0);

    return expectedHours - otherItemsTotal;
  };
  const getSuggestedBaseHours = (item: EstimationItem) => {
    if (item.isOverridden || item.multiplier === 0) return null;
    const suggestedFinal = getSuggestedFinalHours(item.id);
    if (suggestedFinal === null) return null;
    return suggestedFinal / item.multiplier;
  };
  const updateExpectedHours = (value: number) => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        expectedHours: value,
      };
    });
  };
  const renderHint = (value: number | null, label: string) => {
    if (value === null) return null;
    return (
      <div className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/70 dark:text-indigo-200">
        {label}: {value.toFixed(2)} h
      </div>
    );
  };

  const hasPersonnelRoles = project.hasPersonnelRoles === true;
  const personnelRoles = project.personnelRoles || [];
  const getRoleForItem = (item: EstimationItem) => personnelRoles.find((role) =>
    role.id === item.roleId ||
    Boolean(item.roleName && role.name.trim().toLowerCase() === item.roleName.trim().toLowerCase())
  );
  const getRoleById = (roleId?: string) => personnelRoles.find((role) => role.id === roleId);
  const getItemGrossRate = (item: EstimationItem) => Number(item.rate ?? getRoleForItem(item)?.hourlyRate ?? 0) || 0;

  const updateItemRole = (item: EstimationItem, roleId: string) => {
    const role = getRoleById(roleId);
    updateItem(item.id, {
      roleId,
      roleName: role?.name || '',
      rate: role?.hourlyRate ?? 0,
    });
  };

  if (hasPersonnelRoles) {
    const totalGross = estimation.items.reduce((sum, item) => sum + (item.finalHours * getItemGrossRate(item)), 0);
    const vatMultiplier = 1 + ((Number(project.vatRate) || 0) / 100);
    const totalNet = vatMultiplier > 0 ? totalGross / vatMultiplier : totalGross;
    const parsedRoleExpectedHours = parseFloat(roleExpectedHoursInputRef.current.replace(',', '.'));
    const visibleExpectedHours = Number.isFinite(parsedRoleExpectedHours) ? parsedRoleExpectedHours : expectedHours;
    const remainingHours = visibleExpectedHours !== null ? visibleExpectedHours - totalHours : null;
    const fillHoursFromRoleShares = () => {
      const currentExpectedHours = parseFloat(roleExpectedHoursInputRef.current.replace(',', '.'));
      if (!Number.isFinite(currentExpectedHours)) return;
      updateExpectedHours(currentExpectedHours);

      setEstimation(prev => {
        if (!prev) return null;
        const itemsByRoleId = prev.items.reduce<Record<string, EstimationItem[]>>((acc, item) => {
          const role = getRoleForItem(item);
          if (!role) return acc;
          acc[role.id] = [...(acc[role.id] || []), item];
          return acc;
        }, {});

        const hoursByItemId = new Map<string, number>();

        Object.entries(itemsByRoleId).forEach(([roleId, roleItems]) => {
          const role = getRoleById(roleId);
          if (!role || roleItems.length === 0) return;

          const roleHours = Math.round(currentExpectedHours * ((Number(role.participationPct) || 0) / 100));
          const baseHours = Math.floor(roleHours / roleItems.length);
          const remainder = roleHours - (baseHours * roleItems.length);

          roleItems.forEach((item, index) => {
            hoursByItemId.set(item.id, baseHours + (index < remainder ? 1 : 0));
          });
        });

        const newItems = prev.items.map(item => {
          const role = getRoleForItem(item);

          if (!role) {
            return {
              ...item,
              baseHours: 0,
              finalHours: 0,
              isOverridden: true,
            };
          }

          const assignedHours = hoursByItemId.get(item.id) || 0;

          return {
            ...item,
            roleId: role.id,
            roleName: role.name,
            rate: role.hourlyRate,
            baseHours: assignedHours,
            finalHours: assignedHours,
            isOverridden: true,
          };
        });

        return { ...prev, items: newItems };
      });
    };

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/30 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 w-10 text-center">Lp.</th>
              <th className="px-4 py-3 min-w-[220px]">Przedmiot wyceny</th>
              <th className="px-4 py-3 w-44">Rola</th>
              <th className="px-4 py-3 min-w-[180px]">Uwagi / Wyszczególnienie</th>
              <th className="px-4 py-3 w-28 text-center">Liczba Godzin</th>
              <th className="px-4 py-3 w-32 text-right">Stawka za godz.</th>
              <th className="px-4 py-3 w-36 text-right">Kwota razem</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {estimation.items.map((item, idx) => {
              const grossRate = getItemGrossRate(item);
              return (
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
                    <select
                      value={item.roleId || ''}
                      onChange={(e) => updateItemRole(item, e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-gray-900 dark:text-white outline-none transition-shadow"
                    >
                      <option value="">Wybierz rolę</option>
                      {personnelRoles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={item.details || ''}
                      onChange={e => updateItem(item.id, { details: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-gray-900 dark:text-white outline-none transition-shadow"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <NumericCell
                      value={item.finalHours}
                      roundTo={0.5}
                      onChange={val => updateItem(item.id, { isOverridden: true, finalHours: val })}
                      className="w-full text-center font-bold text-indigo-600 dark:text-indigo-400"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <NumericCell
                      value={grossRate}
                      onChange={val => updateItem(item.id, { rate: val })}
                      className="w-full text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-300">
                    {(item.finalHours * grossRate).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
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
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50/80 dark:bg-gray-900/80 font-bold border-t border-gray-200 dark:border-gray-700">
            <tr>
              <td colSpan={4} className="px-4 py-4 text-right text-gray-500 uppercase text-xs tracking-wider">RAZEM:</td>
              <td className="px-4 py-4 text-center text-indigo-600 dark:text-indigo-400 text-lg">
                {totalHours.toFixed(2)}h
              </td>
              <td></td>
              <td className="px-4 py-4 text-right text-indigo-600 dark:text-indigo-400 text-lg leading-tight">
                <div>{totalGross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</div>
                <div className="mt-0.5 text-xs font-normal uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  ({totalNet.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)
                </div>
              </td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 pb-4 text-right text-gray-500 uppercase text-xs tracking-wider">Oczekiwane:</td>
              <td colSpan={2} className="px-4 pb-4">
                <div className="flex min-w-[230px] items-center justify-center gap-2">
                  <input
                    ref={roleExpectedHoursDomRef}
                    type="text"
                    inputMode="decimal"
                    defaultValue={roleExpectedHoursInputRef.current}
                    onFocus={(event) => {
                      isRoleExpectedHoursFocusedRef.current = true;
                      event.target.select();
                    }}
                    onChange={(event) => {
                      const nextValue = event.target.value.replace(',', '.');
                      if (!/^\d*\.?\d*$/.test(nextValue)) {
                        event.target.value = roleExpectedHoursInputRef.current;
                        return;
                      }
                      event.target.value = nextValue;
                      roleExpectedHoursInputRef.current = nextValue;
                    }}
                    onBlur={() => {
                      isRoleExpectedHoursFocusedRef.current = false;
                      const parsed = parseFloat(roleExpectedHoursInputRef.current);
                      if (!Number.isFinite(parsed)) {
                        roleExpectedHoursInputRef.current = '';
                        if (roleExpectedHoursDomRef.current) {
                          roleExpectedHoursDomRef.current.value = '';
                        }
                        return;
                      }
                      const rounded = Math.round(parsed);
                      const nextValue = rounded.toFixed(2);
                      roleExpectedHoursInputRef.current = nextValue;
                      if (roleExpectedHoursDomRef.current) {
                        roleExpectedHoursDomRef.current.value = nextValue;
                      }
                      updateExpectedHours(rounded);
                    }}
                    className="w-28 rounded border border-emerald-200 bg-white px-2 py-1 text-center font-bold text-emerald-600 outline-none transition-shadow focus:ring-1 focus:ring-indigo-500 dark:border-emerald-900/40 dark:bg-gray-800 dark:text-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={fillHoursFromRoleShares}
                    disabled={!Number.isFinite(parseFloat(roleExpectedHoursInputRef.current.replace(',', '.')))}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30 dark:disabled:border-gray-700 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
                  >
                    Wypełnij
                  </button>
                </div>
              </td>
              <td className="px-4 pb-4 text-right text-gray-500 uppercase text-xs tracking-wider whitespace-nowrap">Pozostało:</td>
              <td className={`px-4 pb-4 text-right text-sm font-bold ${remainingHours !== null && remainingHours < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {remainingHours !== null ? `${remainingHours.toFixed(2)} h` : '-'}
              </td>
            </tr>
          </tfoot>
        </table>
        {personnelRoles.length === 0 && (
          <div className="p-4 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400/80 bg-amber-50/50 dark:bg-amber-900/10">
            <AlertCircle size={14} />
            <span>Projekt ma włączone role personelu, ale nie ma jeszcze zdefiniowanych ról w konfiguracji projektu.</span>
          </div>
        )}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={addItem}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition"
          >
            <Plus size={16} /> Dodaj pozycję wyceny
          </button>
        </div>
      </div>
    );
  }

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
                <div className="relative">
                  <NumericCell
                    value={item.baseHours}
                    roundTo={0.5}
                    onFocusChange={(isFocused) => {
                      setActiveHint(isFocused ? { itemId: item.id, field: 'baseHours' } : null);
                    }}
                    onChange={val => updateItem(item.id, { baseHours: val })}
                    className="w-full text-center"
                  />
                  {activeHint?.itemId === item.id && activeHint.field === 'baseHours' && renderHint(getSuggestedBaseHours(item), 'Podpowiedź')}
                </div>
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
                <div className="relative">
                  <NumericCell
                    value={item.finalHours}
                    isBold
                    roundTo={0.5}
                    onFocusChange={(isFocused) => {
                      setActiveHint(isFocused ? { itemId: item.id, field: 'finalHours' } : null);
                    }}
                    onChange={val => {
                      updateItem(item.id, { 
                        isOverridden: true,
                        finalHours: val
                      });
                    }}
                    className={`w-full text-center ${item.isOverridden ? 'border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400' : 'border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}
                  />
                  {activeHint?.itemId === item.id && activeHint.field === 'finalHours' && renderHint(getSuggestedFinalHours(item.id), 'Podpowiedź')}
                </div>
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
            <td className="px-4 py-4 text-right text-indigo-600 dark:text-indigo-400 text-lg leading-tight">
              <div>{(totalNetto * (isBrutto ? 1.23 : 1)).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</div>
              {isBrutto && (
                <div className="mt-0.5 text-xs font-normal uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  ({totalNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)
                </div>
              )}
            </td>
            <td></td>
          </tr>
          <tr>
            <td colSpan={4} className="px-4 pb-4 text-right text-gray-500 uppercase text-xs tracking-wider">Oczekiwane</td>
            <td className="px-4 pb-4 text-center">
              <NumericCell
                value={expectedHours ?? 0}
                roundTo={0.5}
                onChange={updateExpectedHours}
                emptyWhenZero={expectedHours === null}
                className="w-full text-center font-bold border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400"
              />
            </td>
            <td className="px-4 pb-4 text-right text-xs font-semibold text-gray-400 dark:text-gray-500">
              {expectedHours !== null ? `Różnica: ${(totalHours - expectedHours).toFixed(2)} h` : 'Wpisz docelową sumę godzin'}
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
  emptyWhenZero?: boolean;
  onFocusChange?: (isFocused: boolean) => void;
}

const NumericCell: React.FC<NumericCellProps> = ({ value, onChange, className = '', disabled = false, isBold = false, roundTo, emptyWhenZero = false, onFocusChange }) => {
  const formatDisplayValue = React.useCallback((nextValue: number) => {
    if (emptyWhenZero && nextValue === 0) {
      return '';
    }

    return nextValue.toFixed(2);
  }, [emptyWhenZero]);
  const [localVal, setLocalVal] = React.useState(formatDisplayValue(value));
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync with value from parent when not focused
  React.useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatDisplayValue(value));
    }
  }, [value, isFocused, formatDisplayValue]);

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
    onFocusChange?.(false);
    const parsed = parseFloat(localVal);
    let final = isNaN(parsed) ? 0 : parsed;
    
    if (roundTo) {
      final = Math.round(final / roundTo) * roundTo;
    }

    onChange(final);
    setLocalVal(formatDisplayValue(final));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={isFocused ? localVal : formatDisplayValue(value)}
      disabled={disabled}
      onFocus={(e) => {
        setIsFocused(true);
        onFocusChange?.(true);
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
