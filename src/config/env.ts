import type { Settings } from '../types';

const valueOrEmpty = (value?: string) => value?.trim() || '';

export const envSettings: Settings = {
  youtrackBaseUrl: valueOrEmpty(import.meta.env.VITE_YOUTRACK_BASE_URL),
  youtrackToken: valueOrEmpty(import.meta.env.VITE_YOUTRACK_TOKEN),
  googleClientId: valueOrEmpty(import.meta.env.VITE_GOOGLE_CLIENT_ID),
  googleClientSecret: valueOrEmpty(import.meta.env.VITE_GOOGLE_CLIENT_SECRET),
  googleDriveSharedFolderLink: valueOrEmpty(import.meta.env.VITE_GOOGLE_DRIVE_SHARED_FOLDER_LINK),
};

export const hasEnvSettings = Boolean(
  envSettings.youtrackBaseUrl ||
  envSettings.youtrackToken ||
  envSettings.googleClientId ||
  envSettings.googleClientSecret ||
  envSettings.googleDriveSharedFolderLink
);

export const getEnvSettingsOrNull = (): Settings | null => (
  hasEnvSettings
    ? { ...envSettings }
    : null
);
