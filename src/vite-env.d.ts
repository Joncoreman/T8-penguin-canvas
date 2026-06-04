/// <reference types="vite/client" />

type T8UpdaterStatusCode =
  | 'idle'
  | 'disabled'
  | 'checking'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

interface T8UpdaterProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface T8UpdaterStatus {
  status: T8UpdaterStatusCode;
  currentVersion: string;
  availableVersion?: string | null;
  message?: string | null;
  progress?: T8UpdaterProgress | null;
  downloaded?: boolean;
  error?: string | null;
  packaged?: boolean;
  updatedAt?: string | null;
}

interface T8UpdaterResult {
  success: boolean;
  message?: string;
  info?: unknown;
  status?: T8UpdaterStatus;
}

interface T8ParseAuthCookie {
  profileId: string;
  label: string;
  cookie: string;
  count: number;
  length: number;
  expiresAt?: string | null;
  domains?: string[];
}

interface T8ParseAuthSavedRecord {
  profileId: string;
  label: string;
  saved: true;
  encrypted?: boolean;
  savedAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
  length: number;
  count: number;
  domains?: string[];
  cookie?: string;
}

interface T8ParseAuthResult {
  success: boolean;
  message?: string;
  data?: T8ParseAuthCookie
    | T8ParseAuthSavedRecord
    | { records: T8ParseAuthSavedRecord[]; encryptionAvailable: boolean }
    | { profileId: string; label: string; removed: number; savedRemoved?: number };
}

interface Window {
  t8pc?: {
    getInfo: () => Promise<{
      packaged: boolean;
      backendPort: number;
      userData: string;
      version: string;
      updater?: T8UpdaterStatus;
    }>;
    openExternal: (url: string) => Promise<{ success: boolean; message?: string }>;
    parseAuth?: {
      login: (profileId: string) => Promise<T8ParseAuthResult>;
      getCookie: (profileId: string) => Promise<T8ParseAuthResult>;
      listSaved: (profileId?: string) => Promise<T8ParseAuthResult>;
      save: (profileId: string, cookieText: string, meta?: Record<string, unknown>) => Promise<T8ParseAuthResult>;
      load: (profileId: string) => Promise<T8ParseAuthResult>;
      clear: (profileId: string) => Promise<T8ParseAuthResult>;
    };
    updater?: {
      getStatus: () => Promise<T8UpdaterStatus>;
      check: () => Promise<T8UpdaterResult>;
      download: () => Promise<T8UpdaterResult>;
      install: () => Promise<T8UpdaterResult>;
      onStatus: (callback: (status: T8UpdaterStatus) => void) => () => void;
    };
  };
}
