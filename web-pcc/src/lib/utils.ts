export const createClientId = (prefix?: string) =>
  `${prefix ? `${prefix}_` : ''}${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`}`;

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
