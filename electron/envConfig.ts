import path from 'path';
import fs from 'fs';
import type { Settings } from '../src/types.js';

const parseEnvFile = (content: string) =>
  content.split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return acc;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});

const readEnvSettings = (appDir: string, executableDir: string): Settings => {
  const envPaths = [
    path.join(executableDir, '.env'),
    path.join(appDir, '.env'),
    path.join(process.cwd(), '.env'),
  ];

  for (const envPath of envPaths) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const raw = fs.readFileSync(envPath, 'utf-8');
      const parsed = parseEnvFile(raw);

      return {
        youtrackBaseUrl: parsed.VITE_YOUTRACK_BASE_URL || '',
        youtrackToken: parsed.VITE_YOUTRACK_TOKEN || '',
        googleClientId: parsed.VITE_GOOGLE_CLIENT_ID || '',
        googleClientSecret: parsed.VITE_GOOGLE_CLIENT_SECRET || '',
      };
    } catch {
      continue;
    }
  }

  return {
    youtrackBaseUrl: '',
    youtrackToken: '',
    googleClientId: '',
    googleClientSecret: '',
  };
};

export const getEnvSettings = (appDir: string, executableDir: string) => readEnvSettings(appDir, executableDir);
