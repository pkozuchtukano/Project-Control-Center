export const appStorageKeys = {
  activeView: 'pcc-web-active-view',
  selectedProjectId: 'pcc-web-selected-project-id',
  darkMode: 'pcc-web-dark-mode',
  dailyDateFilters: 'pcc-web-daily-date-filters',
  dailyCollapsedSections: 'pcc-web-daily-collapsed-sections',
  statusDraft: (projectId: string) => `pcc-web-status-draft:${projectId}`,
  statusTitle: (projectId: string) => `pcc-web-status-title:${projectId}`,
  statusIncludedSources: (projectId: string) => `pcc-web-status-included-sources:${projectId}`,
};

export const readLocalJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeLocalJson = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};
