import { format } from 'date-fns';

import type { MaintenanceEntry, Project } from '../types';

export const DEFAULT_MAINTENANCE_VAT_RATE = 23;

export const roundCurrency = (value: number) => Number((value || 0).toFixed(2));

const isIsoDate = (value?: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export const formatDateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return format(date, 'yyyy-MM-dd');
};

const getDashboardSyncStorageKey = (projectId: string) => `pcc_dashboard_youtrack_last_sync:${projectId}`;

export const readDashboardLastSyncDate = (projectId: string) => {
  if (typeof window === 'undefined') return '';
  try {
    const savedDate = window.localStorage.getItem(getDashboardSyncStorageKey(projectId));
    return isIsoDate(savedDate) ? savedDate || '' : '';
  } catch {
    return '';
  }
};

export const saveDashboardLastSyncDate = (projectId: string, value: string) => {
  if (typeof window === 'undefined' || !isIsoDate(value)) return;
  try {
    window.localStorage.setItem(getDashboardSyncStorageKey(projectId), value);
  } catch {
    // ignore storage write failures
  }
};

export const calculateGrossFromNet = (net: number, vatRate: number) =>
  roundCurrency((net || 0) * (1 + (vatRate || 0) / 100));

export const calculateNetFromGross = (gross: number, vatRate: number) => {
  const divisor = 1 + (vatRate || 0) / 100;
  if (divisor <= 0) {
    return roundCurrency(gross || 0);
  }

  return roundCurrency((gross || 0) / divisor);
};

const isBugIssueType = (value?: string | null) =>
  value?.trim().toLowerCase() === 'bug';

export const buildBugHoursBreakdown = (items: Array<{ issueType?: string | null; minutes?: number }>) => (
  items.reduce(
    (acc, item) => {
      const hours = (item.minutes || 0) / 60;
      if (isBugIssueType(item.issueType)) {
        acc.bug += hours;
      } else {
        acc.other += hours;
      }
      return acc;
    },
    { bug: 0, other: 0 },
  )
);

export const createClientId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

export const getCurrentMonthValue = () => format(new Date(), 'yyyy-MM');

export const formatMaintenanceMonth = (value: string) => {
  if (!value) return 'Brak miesiąca';
  const [year, month] = value.split('-');
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!parsedYear || !parsedMonth) return value;
  return new Date(parsedYear, parsedMonth - 1, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
};

export const createMaintenanceDraft = (project: Project): MaintenanceEntry => {
  const now = new Date().toISOString();
  return {
    id: createClientId(),
    projectId: project.id,
    month: getCurrentMonthValue(),
    netAmount: project.maintenanceNetAmount || 0,
    vatRate: project.maintenanceVatRate || DEFAULT_MAINTENANCE_VAT_RATE,
    grossAmount: project.maintenanceGrossAmount || 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
};

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'pcc_sidebar_collapsed';
