import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Code,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  X,
} from 'lucide-react';

import type { Project, ProjectPersonnelRole, Stakeholder, TaskType } from '../types';
import { useProjectContext } from '../context/ProjectContext';
import { TaskTypeIconMap } from '../utils/icons';
import {
  DEFAULT_MAINTENANCE_VAT_RATE,
  calculateGrossFromNet,
  calculateNetFromGross,
} from '../utils/appCalculations';

export const ProjectModal = ({
  isOpen,
  onClose,
  projectToEdit = null
}: {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}) => {
  const { addProject, updateProject } = useProjectContext();
  const [formData, setFormData] = useState<Omit<Project, 'id'>>({
    code: '', name: '', contractNo: '', contractSubject: '',
    dateFrom: '', dateTo: '',
    minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23, targetProfitPct: 20,
    hasMaintenance: false, maintenanceNetAmount: 0, maintenanceVatRate: DEFAULT_MAINTENANCE_VAT_RATE, maintenanceGrossAmount: 0,
    taskTypes: [],
    googleDocLink: '',
    pendingSettlementYoutrackUrl: '',
    clickupDailyUrl: '',
    isHiddenInSidebar: false,
    hasPersonnelRoles: false,
    personnelRoles: [],
    stakeholders: []
  });
  const [isMaintenanceGrossLocked, setIsMaintenanceGrossLocked] = useState(true);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [personnelRoles, setPersonnelRoles] = useState<ProjectPersonnelRole[]>([]);
  const predefinedIcons = Object.keys(TaskTypeIconMap);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setFormData({
        code: projectToEdit.code,
        name: projectToEdit.name,
        contractNo: projectToEdit.contractNo,
        contractSubject: projectToEdit.contractSubject || '',
        dateFrom: projectToEdit.dateFrom,
        dateTo: projectToEdit.dateTo,
        minHours: projectToEdit.minHours,
        maxHours: projectToEdit.maxHours,
        rateNetto: projectToEdit.rateNetto,
        rateBrutto: projectToEdit.rateBrutto,
        vatRate: projectToEdit.vatRate !== undefined ? projectToEdit.vatRate : 23,
        hasMaintenance: projectToEdit.hasMaintenance ?? false,
        maintenanceNetAmount: projectToEdit.maintenanceNetAmount ?? 0,
        maintenanceVatRate: projectToEdit.maintenanceVatRate ?? DEFAULT_MAINTENANCE_VAT_RATE,
        maintenanceGrossAmount: projectToEdit.maintenanceGrossAmount ?? calculateGrossFromNet(projectToEdit.maintenanceNetAmount ?? 0, projectToEdit.maintenanceVatRate ?? DEFAULT_MAINTENANCE_VAT_RATE),
        targetProfitPct: projectToEdit.targetProfitPct !== undefined ? projectToEdit.targetProfitPct : 20,
        taskTypes: projectToEdit.taskTypes || [],
        googleDocLink: projectToEdit.googleDocLink || '',
        pendingSettlementYoutrackUrl: projectToEdit.pendingSettlementYoutrackUrl || '',
        clickupDailyUrl: projectToEdit.clickupDailyUrl || '',
        isHiddenInSidebar: projectToEdit.isHiddenInSidebar ?? false,
        hasPersonnelRoles: projectToEdit.hasPersonnelRoles ?? false,
        personnelRoles: projectToEdit.personnelRoles || [],
        stakeholders: projectToEdit.stakeholders || []
      });
      setIsMaintenanceGrossLocked(true);
      setTaskTypes(projectToEdit.taskTypes || []);
      setStakeholders(projectToEdit.stakeholders || []);
      setPersonnelRoles(projectToEdit.personnelRoles || []);
    } else {
      setFormData({
        code: '', name: '', contractNo: '', contractSubject: '',
        dateFrom: '', dateTo: '',
        minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23, targetProfitPct: 20,
        hasMaintenance: false, maintenanceNetAmount: 0, maintenanceVatRate: DEFAULT_MAINTENANCE_VAT_RATE, maintenanceGrossAmount: 0,
        taskTypes: [],
        googleDocLink: '',
        pendingSettlementYoutrackUrl: '',
        clickupDailyUrl: '',
        isHiddenInSidebar: false,
        hasPersonnelRoles: false,
        personnelRoles: [],
        stakeholders: []
      });
      setIsMaintenanceGrossLocked(true);
      setTaskTypes([]);
      setStakeholders([]);
      setPersonnelRoles([]);
    }
  }, [projectToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    let newValue: any = type === 'checkbox' ? checked : value;

    if (type === 'number') {
      newValue = parseFloat(value) || 0;
    }

    if (name === 'hasMaintenance' && !checked) {
      setIsMaintenanceGrossLocked(true);
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };

      const currentVatRate = name === 'vatRate' ? newValue : prev.vatRate;
      const vatMultiplier = 1 + (currentVatRate / 100);

      if (name === 'rateNetto' || name === 'vatRate') {
        updated.rateBrutto = parseFloat((updated.rateNetto * vatMultiplier).toFixed(2));
      } else if (name === 'rateBrutto') {
        updated.rateNetto = parseFloat((newValue / vatMultiplier).toFixed(2));
      }

      if (name === 'hasMaintenance') {
        const hasMaintenance = checked;
        updated.hasMaintenance = hasMaintenance;
        if (!hasMaintenance) {
          updated.maintenanceNetAmount = 0;
          updated.maintenanceVatRate = DEFAULT_MAINTENANCE_VAT_RATE;
          updated.maintenanceGrossAmount = 0;
        } else {
          updated.maintenanceVatRate = prev.maintenanceVatRate || DEFAULT_MAINTENANCE_VAT_RATE;
          updated.maintenanceGrossAmount = calculateGrossFromNet(
            updated.maintenanceNetAmount,
            updated.maintenanceVatRate,
          );
        }
      }

      if (name === 'maintenanceVatRate') {
        updated.maintenanceVatRate = newValue;
        if (isMaintenanceGrossLocked) {
          updated.maintenanceGrossAmount = calculateGrossFromNet(updated.maintenanceNetAmount, newValue);
        } else {
          updated.maintenanceNetAmount = calculateNetFromGross(updated.maintenanceGrossAmount, newValue);
        }
      } else if (name === 'maintenanceNetAmount') {
        updated.maintenanceNetAmount = newValue;
        if (isMaintenanceGrossLocked) {
          updated.maintenanceGrossAmount = calculateGrossFromNet(newValue, updated.maintenanceVatRate);
        }
      } else if (name === 'maintenanceGrossAmount') {
        updated.maintenanceGrossAmount = newValue;
        if (!isMaintenanceGrossLocked) {
          updated.maintenanceNetAmount = calculateNetFromGross(newValue, updated.maintenanceVatRate);
        }
      }

      return updated;
    });
  };

  const handleMaintenanceLockToggle = () => {
    setIsMaintenanceGrossLocked(prev => {
      const next = !prev;
      setFormData(current => {
        if (!current.hasMaintenance) {
          return current;
        }

        if (next) {
          return {
            ...current,
            maintenanceGrossAmount: calculateGrossFromNet(
              current.maintenanceNetAmount,
              current.maintenanceVatRate,
            ),
          };
        }

        return {
          ...current,
          maintenanceNetAmount: calculateNetFromGross(
            current.maintenanceGrossAmount,
            current.maintenanceVatRate,
          ),
        };
      });
      return next;
    });
  };

  const createPersonnelRole = (): ProjectPersonnelRole => ({
    id: Date.now().toString(),
    name: '',
    participationPct: 0,
    hourlyRate: 0,
    minHours: 0,
    maxHours: 0,
  });

  const updatePersonnelRole = (
    roleId: string,
    field: keyof Omit<ProjectPersonnelRole, 'id'>,
    value: string,
  ) => {
    setPersonnelRoles(prev => prev.map(role => {
      if (role.id !== roleId) return role;
      return {
        ...role,
        [field]: field === 'name' ? value : parseFloat(value) || 0,
      };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Walidacja dat
    if (formData.dateFrom && formData.dateTo && new Date(formData.dateTo) < new Date(formData.dateFrom)) {
      setError('Data zakonczenia musi byc pozniejsza niz data rozpoczecia.');
      return;
    }

    if (formData.minHours && formData.maxHours && formData.minHours > formData.maxHours) {
      setError('Limit minimalny nie moze byc wiekszy niz maksymalny.');
      return;
    }

    const normalizedPersonnelRoles = personnelRoles
      .map(role => ({
        ...role,
        name: role.name.trim(),
        participationPct: Number(role.participationPct) || 0,
        hourlyRate: Number(role.hourlyRate) || 0,
        minHours: Number(role.minHours) || 0,
        maxHours: Number(role.maxHours) || 0,
      }))
      .filter(role => role.name !== '');

    const invalidPersonnelRole = normalizedPersonnelRoles.find(role =>
      role.participationPct < 0 ||
      role.participationPct > 100 ||
      role.hourlyRate < 0 ||
      role.minHours < 0 ||
      role.maxHours < 0 ||
      role.minHours > role.maxHours
    );

    if (invalidPersonnelRole) {
      setError('Sprawdz role personelu: procent udzialu musi byc w zakresie 0-100, stawka nie moze byc ujemna, a min godzin nie moze przekraczac max godzin.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalFormData = {
        ...formData,
        taskTypes: taskTypes.filter(t => t.name.trim() !== ''),
        stakeholders: stakeholders.filter(s => s.name.trim() !== ''),
        personnelRoles: normalizedPersonnelRoles,
      };

      if (projectToEdit) {
        await updateProject(projectToEdit.id, finalFormData);
      } else {
        await addProject(finalFormData);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Wystapil blad zapisu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-[90vw] max-w-[90vw] flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {projectToEdit ? 'Edytuj Projekt' : 'Nowy Projekt'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Sekcja 1: Parametry ogólne */}
            <div className="mb-8">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Parametry ogólne</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kod (Skrót) *</label>
                    <input required name="code" value={formData.code} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="np. PRJ-01" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pełna Nazwa</label>
                    <input name="name" value={formData.name} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nr Umowy</label>
                    <input name="contractNo" value={formData.contractNo} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Przedmiot Umowy</label>
                    <input name="contractSubject" value={formData.contractSubject} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                  </div>
                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                    <input
                      type="checkbox"
                      name="isHiddenInSidebar"
                      checked={formData.isHiddenInSidebar ?? false}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">{'Ukryj projekt w panelu bocznym'}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{'Projekt pozostaje dost\u0119pny w danych i mo\u017ce zosta\u0107 pokazany przyciskiem oka.'}</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Od</label>
                      <input type="date" name="dateFrom" value={formData.dateFrom} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition [color-scheme:light] dark:[color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Do</label>
                      <input type="date" name="dateTo" value={formData.dateTo} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition [color-scheme:light] dark:[color-scheme:dark]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Godzin</label>
                      <input type="number" min="0" name="minHours" value={formData.minHours} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Godzin</label>
                      <input type="number" min="0" name="maxHours" value={formData.maxHours} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka Netto (PLN)</label>
                      <input type="number" min="0" step="0.01" name="rateNetto" value={formData.rateNetto} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka Brutto (+{formData.vatRate}%)</label>
                      <input type="number" min="0" step="0.01" name="rateBrutto" value={formData.rateBrutto} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka VAT (%)</label>
                      <input type="number" min="0" step="1" name="vatRate" value={formData.vatRate} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Docelowy zysk (%)</label>
                      <input type="number" min="0" step="0.1" name="targetProfitPct" value={formData.targetProfitPct ?? 20} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Cel liczony jako narzut względem godzin przepracowanych: (wykorzystane - przepracowane) / przepracowane.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link dokumentu Google dla Notatek</label>
                      <input name="googleDocLink" value={formData.googleDocLink} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" 
                        placeholder="https://docs.google.com/document/d/..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Url tablicy w youtrack</label>
                      <input name="pendingSettlementYoutrackUrl" value={formData.pendingSettlementYoutrackUrl || ''} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        placeholder="https://youtrack/.../issues?q=..." />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">ClickUp</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Url do daily</label>
                <input
                  name="clickupDailyUrl"
                  value={formData.clickupDailyUrl || ''}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="https://app.clickup.com/..."
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Link do dokumentu ClickUp, do którego będzie można eksportować daily opracowane przez AI.
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Utrzymanie i Abonamenty</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                  <input
                    type="checkbox"
                    name="hasMaintenance"
                    checked={formData.hasMaintenance}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Opłata za utrzymanie</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Włączenie odblokowuje konfigurację miesięcznej opłaty abonamentowej.</span>
                  </div>
                </label>

                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity ${formData.hasMaintenance ? 'opacity-100' : 'opacity-60'}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kwota Netto (PLN)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="maintenanceNetAmount"
                      value={formData.maintenanceNetAmount}
                      onChange={handleChange}
                      disabled={!formData.hasMaintenance || !isMaintenanceGrossLocked}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka VAT (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="maintenanceVatRate"
                      value={formData.maintenanceVatRate}
                      onChange={handleChange}
                      disabled={!formData.hasMaintenance}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kwota Brutto (PLN)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="maintenanceGrossAmount"
                        value={formData.maintenanceGrossAmount}
                        onChange={handleChange}
                        disabled={!formData.hasMaintenance || isMaintenanceGrossLocked}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={handleMaintenanceLockToggle}
                        disabled={!formData.hasMaintenance}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-gray-600 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800"
                        title={isMaintenanceGrossLocked ? 'Brutto liczone automatycznie z netto' : 'Netto liczone od stałej kwoty brutto'}
                        aria-label={isMaintenanceGrossLocked ? 'Brutto liczone automatycznie z netto' : 'Netto liczone od stałej kwoty brutto'}
                      >
                        {isMaintenanceGrossLocked ? <Lock size={16} /> : <LockOpen size={16} />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {isMaintenanceGrossLocked
                        ? 'Tryb automatyczny: zmiana netto lub VAT przelicza brutto.'
                        : 'Tryb ryczałtowy: stałe brutto przelicza netto po zmianie VAT.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Role personelu</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                  <input
                    type="checkbox"
                    name="hasPersonnelRoles"
                    checked={formData.hasPersonnelRoles ?? false}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Projekt z rolami personelu</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Włączenie pozwala przypisać role z udziałem procentowym oraz minimalną i maksymalną pulą roboczogodzin.
                    </span>
                  </div>
                </label>

                {formData.hasPersonnelRoles && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Definicje ról</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Procent udziału będzie podstawą przyszłych wycen wraz z pulą godzin.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPersonnelRoles(prev => [...prev, createPersonnelRole()])}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5 hover:text-indigo-700 transition px-3 py-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg"
                      >
                        <Plus size={14} /> Dodaj rolę
                      </button>
                    </div>

                    <div className="space-y-3">
                      {personnelRoles.map((role) => (
                        <div key={role.id} className="grid grid-cols-1 lg:grid-cols-[minmax(180px,1fr)_120px_120px_120px_120px_auto] gap-3 items-start rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Rola</label>
                            <input
                              value={role.name}
                              onChange={(e) => updatePersonnelRole(role.id, 'name', e.target.value)}
                              placeholder="np. Analityk, Developer"
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Udział (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={role.participationPct}
                              onChange={(e) => updatePersonnelRole(role.id, 'participationPct', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Min godzin</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={role.minHours}
                              onChange={(e) => updatePersonnelRole(role.id, 'minHours', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Max godzin</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={role.maxHours}
                              onChange={(e) => updatePersonnelRole(role.id, 'maxHours', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Stawka brutto / h</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={role.hourlyRate}
                              onChange={(e) => updatePersonnelRole(role.id, 'hourlyRate', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setPersonnelRoles(prev => prev.filter(item => item.id !== role.id))}
                            className="lg:mt-6 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-gray-400 transition-colors hover:text-red-500"
                            title="Usuń rolę"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {personnelRoles.length === 0 && (
                        <p className="text-xs text-center text-gray-500 py-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                          Brak zdefiniowanych ról personelu dla tego projektu.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sekcja 2: Interesariusze (Stakeholders) */}
            <div className="mb-8 p-6 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Briefcase size={18} />
                  </div>
                  <h3 className="text-md font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Interesariusze</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setStakeholders(prev => [...prev, { id: Date.now().toString(), name: '', role: '', company: 'customer', isPresent: true }])} 
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5 hover:text-indigo-700 transition px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900"
                >
                  <Plus size={14} /> Dodaj Osobę
                </button>
              </div>
              <div className="space-y-3">
                {stakeholders.map((s) => (
                  <div key={s.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-12 gap-3 flex-1 bg-white dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 shadow-sm">
                      <div className="col-span-5">
                        <input
                          value={s.name}
                          onChange={(e) => setStakeholders(prev => prev.map(item => item.id === s.id ? { ...item, name: e.target.value } : item))}
                          placeholder="Imię i Nazwisko"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          value={s.role}
                          onChange={(e) => setStakeholders(prev => prev.map(item => item.id === s.id ? { ...item, role: e.target.value } : item))}
                          placeholder="Rola w projekcie"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={s.company}
                          onChange={(e) => setStakeholders(prev => prev.map(item => item.id === s.id ? { ...item, company: e.target.value as any } : item))}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        >
                          <option value="customer">Klient</option>
                          <option value="contractor">Wykonawca</option>
                        </select>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setStakeholders(prev => prev.filter(item => item.id !== s.id))} 
                      className="text-gray-400 hover:text-red-500 p-2.5 transition-colors bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mt-0.5 shadow-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {stakeholders.length === 0 && (
                  <p className="text-xs text-center text-gray-500 py-4 bg-white/50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">Brak zdefiniowanych osób przypisanych do projektu.</p>
                )}
              </div>
            </div>

            {/* Sekcja 3: Rodzaje zadań */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                <h3 className="text-md font-bold text-gray-900 dark:text-white">Rodzaje zadań zdefiniowane dla projektu</h3>
                <button type="button" onClick={() => setTaskTypes(prev => [...prev, { id: Date.now().toString(), name: '', color: '#3b82f6', icon: 'Code' }])} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 hover:text-indigo-700 transition bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-md">
                  <Plus size={14} /> Dodaj rodzaj
                </button>
              </div>
              <div className="space-y-4">
                {taskTypes.map((tt) => {
                  const SelectedIcon = TaskTypeIconMap[tt.icon] || Code;
                  return (
                    <div key={tt.id} className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="flex gap-3 items-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shrink-0 shadow-sm" style={{ color: tt.color }}>
                          <SelectedIcon size={20} />
                        </div>
                        <input
                          value={tt.name}
                          onChange={(e) => setTaskTypes(prev => prev.map(t => t.id === tt.id ? { ...t, name: e.target.value } : t))}
                          placeholder="Wpisz nazwę rodzaju zadania..."
                          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        />
                        <input
                          type="color"
                          value={tt.color}
                          onChange={(e) => setTaskTypes(prev => prev.map(t => t.id === tt.id ? { ...t, color: e.target.value } : t))}
                          className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer bg-white dark:bg-gray-700 p-1 shrink-0"
                          title="Wybierz kolor"
                        />
                        <button type="button" onClick={() => setTaskTypes(prev => prev.filter(t => t.id !== tt.id))} className="text-gray-400 hover:text-red-500 p-2 transition-colors bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shrink-0" title="Usuń rodzaj">
                          <X size={18} />
                        </button>
                      </div>

                      <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 pl-1">Wybierz ikonę</p>
                        <div className="flex flex-wrap items-center gap-1.5 focus-within:ring-0">
                          {predefinedIcons.map(iconName => {
                            const IconComponent = TaskTypeIconMap[iconName] || Code;
                            const isSelected = tt.icon === iconName;
                            return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => setTaskTypes(prev => prev.map(t => t.id === tt.id ? { ...t, icon: iconName } : t))}
                                className={`p-2.5 rounded-xl transition-all border ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/40 dark:border-indigo-800/60 dark:text-indigo-400 shadow-sm scale-105' : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-white hover:shadow-sm hover:border-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:hover:border-gray-600'}`}
                                title={iconName}
                              >
                                <IconComponent size={20} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {taskTypes.length === 0 && (
                  <p className="text-sm text-gray-500 italic p-4 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">Brak zdefiniowanych rodzajów zadań do tego projektu.</p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              Anuluj
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition flex items-center justify-center min-w-[120px]">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (projectToEdit ? 'Zapisz Zmiany' : 'Utwórz Projekt')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
