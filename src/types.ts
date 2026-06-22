export type PageId = "pack" | "logs" | "more" | "about";
export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS" | "DEBUG";
export type ThemeMode = "system" | "light" | "dark";

export interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  message: string;
}

export interface ProgressPayload {
  operation: "pack" | "unpack" | "deploy" | "cleanup" | "adb" | "copy-package" | "maml";
  percent: number;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  path?: string;
  data?: string;
}

export interface AppInfo {
  appName: string;
  version: string;
  electron: string;
  node: string;
  chrome: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  available: boolean;
  checking?: boolean;
  downloading?: boolean;
  downloadProgress?: number;
  message: string;
  releaseName?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  notes?: string;
  publishedAt?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total?: number;
  message: string;
}

export interface WindowBoundsPayload {
  width: number;
  height: number;
  maximized: boolean;
  fullscreen: boolean;
}

export interface DeviceStatus {
  connected: boolean;
  model?: string;
}
