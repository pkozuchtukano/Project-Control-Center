import type { Settings } from '../types';

const valueOrEmpty = (value?: string) => value?.trim() || '';

export const envSettings: Settings = {
  youtrackBaseUrl: valueOrEmpty(import.meta.env.VITE_YOUTRACK_BASE_URL),
  youtrackToken: valueOrEmpty(import.meta.env.VITE_YOUTRACK_TOKEN),
  googleClientId: valueOrEmpty(import.meta.env.VITE_GOOGLE_CLIENT_ID),
  googleClientSecret: valueOrEmpty(import.meta.env.VITE_GOOGLE_CLIENT_SECRET),
  googleDriveSharedFolderLink: valueOrEmpty(import.meta.env.VITE_GOOGLE_DRIVE_SHARED_FOLDER_LINK),
};

export const hasEnvManagedSettings = Boolean(
  envSettings.youtrackBaseUrl ||
  envSettings.youtrackToken ||
  envSettings.googleClientId ||
  envSettings.googleClientSecret ||
  envSettings.googleDriveSharedFolderLink
);

export const mergeSettingsWithEnv = (settings?: Partial<Settings> | null): Settings | null => {
  const merged: Settings = {
    youtrackBaseUrl: envSettings.youtrackBaseUrl || settings?.youtrackBaseUrl || '',
    youtrackToken: envSettings.youtrackToken || settings?.youtrackToken || '',
    googleClientId: envSettings.googleClientId || settings?.googleClientId || '',
    googleClientSecret: envSettings.googleClientSecret || settings?.googleClientSecret || '',
    googleDriveSharedFolderLink: envSettings.googleDriveSharedFolderLink || settings?.googleDriveSharedFolderLink || '',
  };

  return merged.youtrackBaseUrl || merged.youtrackToken || merged.googleClientId || merged.googleClientSecret || merged.googleDriveSharedFolderLink
    ? merged
    : null;
};
