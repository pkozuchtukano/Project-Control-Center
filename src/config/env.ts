import type { Settings } from '../types';

const valueOrEmpty = (value?: string) => value?.trim() || '';

export const envSettings: Settings = {
  youtrackBaseUrl: valueOrEmpty(import.meta.env.VITE_YOUTRACK_BASE_URL),
  youtrackToken: valueOrEmpty(import.meta.env.VITE_YOUTRACK_TOKEN),
  googleClientId: valueOrEmpty(import.meta.env.VITE_GOOGLE_CLIENT_ID),
  googleClientSecret: valueOrEmpty(import.meta.env.VITE_GOOGLE_CLIENT_SECRET),
  googleDriveSharedFolderLink: valueOrEmpty(import.meta.env.VITE_GOOGLE_DRIVE_SHARED_FOLDER_LINK),
  geminiApiKey: valueOrEmpty(import.meta.env.VITE_GEMINI_API_KEY),
  geminiModel: valueOrEmpty(import.meta.env.VITE_GEMINI_MODEL),
  geminiApiBaseUrl: valueOrEmpty(import.meta.env.VITE_GEMINI_API_BASE_URL),
};

export const hasEnvSettings = Boolean(
  envSettings.youtrackBaseUrl ||
  envSettings.youtrackToken ||
  envSettings.googleClientId ||
  envSettings.googleClientSecret ||
  envSettings.googleDriveSharedFolderLink ||
  envSettings.geminiApiKey ||
  envSettings.geminiModel ||
  envSettings.geminiApiBaseUrl
);

export const getEnvSettingsOrNull = (): Settings | null => (
  hasEnvSettings
    ? { ...envSettings }
    : null
);
