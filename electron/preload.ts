import { contextBridge, ipcRenderer } from "electron";
import type { AppInfo, DeviceStatus, LogEntry, ProgressPayload, ThemePreference, UpdateInfo, UpdateProgress, WindowBoundsPayload } from "./types";

const api = {
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:maximize-toggle"),
    close: () => ipcRenderer.invoke("window:close"),
    onBounds: (callback: (bounds: WindowBoundsPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, bounds: WindowBoundsPayload) => callback(bounds);
      ipcRenderer.on("window:bounds", listener);
      return () => ipcRenderer.off("window:bounds", listener);
    }
  },
  settings: {
    getTheme: () => ipcRenderer.invoke("settings:get-theme") as Promise<ThemePreference>,
    setTheme: (mode: ThemePreference["mode"]) => ipcRenderer.invoke("settings:set-theme", mode) as Promise<ThemePreference>
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
    selectMtz: () => ipcRenderer.invoke("dialog:select-mtz")
  },
  device: {
    getStatus: () => ipcRenderer.invoke("device:get-status")
  },
  operations: {
    pack: (sourceDir: string) => ipcRenderer.invoke("operation:pack", { sourceDir }),
    unpack: (mtzPath: string) => ipcRenderer.invoke("operation:unpack", { mtzPath }),
    deploy: (mtzPath?: string) => ipcRenderer.invoke("operation:deploy", mtzPath),
    exportLogs: (logs: LogEntry[]) => ipcRenderer.invoke("operation:export-logs", logs),
    cleanupCache: () => ipcRenderer.invoke("operation:cleanup-cache"),
    restartAdb: () => ipcRenderer.invoke("operation:restart-adb"),
    copyPackage: () => ipcRenderer.invoke("operation:copy-package"),
    copyPackageMaml: () => ipcRenderer.invoke("operation:copy-package-maml"),
    convertMaml: (xml: string) => ipcRenderer.invoke("operation:convert-maml", xml),
    openPath: (targetPath: string) => ipcRenderer.invoke("app:open-path", targetPath)
  },
  app: {
    getInfo: () => ipcRenderer.invoke("app:get-info") as Promise<AppInfo>
  },
  updates: {
    check: () => ipcRenderer.invoke("updates:check") as Promise<UpdateInfo>,
    openDownload: (url?: string) => ipcRenderer.invoke("updates:open-download", url),
    downloadAndInstall: (url: string, version?: string) => ipcRenderer.invoke("updates:download-and-install", url, version)
  },
  events: {
    onLog: (callback: (entry: LogEntry) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry);
      ipcRenderer.on("log:entry", listener);
      return () => ipcRenderer.off("log:entry", listener);
    },
    onProgress: (callback: (payload: ProgressPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ProgressPayload) => callback(payload);
      ipcRenderer.on("operation:progress", listener);
      return () => ipcRenderer.off("operation:progress", listener);
    },
    onUpdateProgress: (callback: (payload: UpdateProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: UpdateProgress) => callback(payload);
      ipcRenderer.on("updates:progress", listener);
      return () => ipcRenderer.off("updates:progress", listener);
    },
    onDeviceStatus: (callback: (status: DeviceStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: DeviceStatus) => callback(status);
      ipcRenderer.on("device:status-changed", listener);
      return () => ipcRenderer.off("device:status-changed", listener);
    }
  }
};

contextBridge.exposeInMainWorld("xiaomiThemePacker", api);

export type XiaomiThemePackerApi = typeof api;
