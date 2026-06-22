import { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme, clipboard, screen } from "electron";
import windowStateKeeper from "electron-window-state";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { createThemeEngineAPI } from "./theme-engine";
import type { DeviceStatus, LogEntry, LogLevel, OperationResult, PackRequest, ProgressPayload, ThemePreference, UnpackRequest, UpdateInfo, UpdateProgress } from "./types";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 500;
const UPDATE_CHECK_URL =
  process.env.XIAOMI_THEME_PACKER_UPDATE_URL ||
  "https://example.com/xiaomi-theme-packer/latest.json";
const APP_ICON_PATH = isDev
  ? path.join(process.cwd(), "build", "icon.png")
  : path.join(process.resourcesPath, "build", "icon.png");
let mainWindow: BrowserWindow | null = null;
let currentThemeMode: ThemePreference["mode"] = "system";
let normalWindowBounds: { x: number; y: number; width: number; height: number } | null = null;
let manuallyMaximized = false;
let devLogPath = "";
let windowLimitTimer: NodeJS.Timeout | null = null;
let windowBoundsTimer: NodeJS.Timeout | null = null;

if (isDev) {
  const runtimeRoot = path.join(process.cwd(), ".runtime");
  const userDataPath = path.join(runtimeRoot, "userData");
  const sessionDataPath = path.join(runtimeRoot, "sessionData");
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(sessionDataPath, { recursive: true });
  app.setPath("userData", userDataPath);
  app.setPath("sessionData", sessionDataPath);
  devLogPath = path.join(runtimeRoot, "main.log");
  app.commandLine.appendSwitch("disable-http-cache");
  app.commandLine.appendSwitch("disable-features", "NetworkServiceSandbox");
}

function devLog(message: string) {
  if (!devLogPath) return;
  try {
    fs.appendFileSync(devLogPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {
    // Logging must not prevent the app window from opening.
  }
}

function captureDevWindow(reason: string) {
  if (!devLogPath || !mainWindow || mainWindow.isDestroyed()) return;

  setTimeout(async () => {
    try {
      devLog(`window:capturePage:start reason=${reason}`);
      const image = await mainWindow?.capturePage();
      if (!image) {
        devLog(`window:capturePage:empty reason=${reason}`);
        return;
      }
      const screenshotPath = path.join(path.dirname(devLogPath), `window-${reason}.png`);
      fs.writeFileSync(screenshotPath, image.toPNG());
      devLog(`window:capturePage:ok reason=${reason} path=${screenshotPath} size=${image.getSize().width}x${image.getSize().height}`);
    } catch (error) {
      devLog(`window:capturePage:error reason=${reason} message=${error instanceof Error ? error.message : String(error)}`);
    }
  }, 1000);
}

function userSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings(): ThemePreference {
  try {
    const text = fs.readFileSync(userSettingsPath(), "utf8");
    const data = JSON.parse(text) as Partial<ThemePreference>;
    if (data.mode === "light" || data.mode === "dark" || data.mode === "system") {
      return { mode: data.mode };
    }
  } catch {
    // Default settings are used when the file does not exist or is invalid.
  }
  return { mode: "system" };
}

function writeSettings(settings: ThemePreference) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(userSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function applyTheme(mode: ThemePreference["mode"]) {
  currentThemeMode = mode;
  nativeTheme.themeSource = mode;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "").split(/[+-]/)[0];
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function readCurrentVersion() {
  return app.getVersion();
}

function isHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function emitUpdateProgress(payload: UpdateProgress) {
  mainWindow?.webContents.send("updates:progress", payload);
}

function getUpdateInstallerPath(version?: string) {
  const suffix = version ? normalizeVersion(version) : Date.now().toString();
  const updateDir = path.join(app.getPath("userData"), "updates");
  fs.mkdirSync(updateDir, { recursive: true });
  return path.join(updateDir, `Xiaomi-Theme-Packer-${suffix}.exe`);
}

async function downloadUpdateInstaller(url: string, version?: string) {
  if (!isHttpUrl(url)) throw new Error("Invalid update download URL.");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}.`);
  }

  const total = Number(response.headers.get("content-length") || 0) || undefined;
  const installerPath = getUpdateInstallerPath(version);
  const tempPath = `${installerPath}.download`;
  const reader = response.body.getReader();
  const output = fs.createWriteStream(tempPath);
  let transferred = 0;

  emitUpdateProgress({ percent: 0, transferred, total, message: "Downloading update..." });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      transferred += value.byteLength;
      output.write(Buffer.from(value));
      const percent = total ? Math.min(99, Math.round((transferred / total) * 100)) : 0;
      emitUpdateProgress({ percent, transferred, total, message: "Downloading update..." });
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      output.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
  }

  fs.renameSync(tempPath, installerPath);
  emitUpdateProgress({ percent: 100, transferred, total, message: "Download complete. Starting installer..." });
  return installerPath;
}

async function downloadAndInstallUpdate(url: string, version?: string): Promise<OperationResult> {
  try {
    const installerPath = await downloadUpdateInstaller(url, version);
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });
    child.unref();
    setTimeout(() => app.quit(), 800);
    return { ok: true, message: "Update downloaded. Installer started.", path: installerPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitUpdateProgress({ percent: 0, transferred: 0, message });
    return { ok: false, message };
  }
}

async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = readCurrentVersion();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(UPDATE_CHECK_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      return {
        currentVersion,
        available: false,
        message: `Update check failed: HTTP ${response.status}.`
      };
    }

    const data = (await response.json()) as Partial<UpdateInfo> & { version?: string };
    const latestVersion = String(data.latestVersion || data.version || "").trim();
    if (!latestVersion) {
      return {
        currentVersion,
        available: false,
        message: "Update manifest is missing version."
      };
    }

    const available = compareVersions(latestVersion, currentVersion) > 0;
    return {
      currentVersion,
      latestVersion,
      available,
      message: available ? `New version ${latestVersion} is available.` : "Already on the latest version.",
      releaseUrl: isHttpUrl(data.releaseUrl) ? data.releaseUrl : undefined,
      downloadUrl: isHttpUrl(data.downloadUrl) ? data.downloadUrl : undefined,
      notes: typeof data.notes === "string" ? data.notes : undefined,
      publishedAt: typeof data.publishedAt === "string" ? data.publishedAt : undefined
    };
  } catch (error) {
    return {
      currentVersion,
      available: false,
      message: error instanceof Error ? `Update check failed: ${error.message}` : "Update check failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

function emitLog(level: LogLevel, message: string) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString("en-GB", { hour12: false }) + `.${String(new Date().getMilliseconds()).padStart(3, "0")}`,
    level,
    message
  };
  mainWindow?.webContents.send("log:entry", entry);
}

function emitProgress(payload: ProgressPayload) {
  mainWindow?.webContents.send("operation:progress", payload);
}

function getWindowBounds(state: { x?: number; y?: number; width?: number; height?: number }) {
  const savedBounds = {
    x: state.x ?? 0,
    y: state.y ?? 0,
    width: state.width ?? DEFAULT_WIDTH,
    height: state.height ?? DEFAULT_HEIGHT
  };
  const display = screen.getDisplayMatching(savedBounds);
  const workArea = display.workArea;
  const width = Math.max(MIN_WIDTH, Math.min(savedBounds.width, workArea.width));
  const height = Math.max(MIN_HEIGHT, Math.min(savedBounds.height, workArea.height));
  const hasSavedPosition = typeof state.x === "number" && typeof state.y === "number";
  const x = hasSavedPosition
    ? Math.max(workArea.x, Math.min(savedBounds.x, workArea.x + workArea.width - width))
    : workArea.x + Math.round((workArea.width - width) / 2);
  const y = hasSavedPosition
    ? Math.max(workArea.y, Math.min(savedBounds.y, workArea.y + workArea.height - height))
    : workArea.y + Math.round((workArea.height - height) / 2);

  return { x, y, width, height, maxWidth: workArea.width, maxHeight: workArea.height };
}

function applyWindowSizeLimits(window: BrowserWindow) {
  const bounds = window.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  window.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
  window.setMaximumSize(workArea.width, workArea.height);
}

function scheduleWindowSizeLimits() {
  if (windowLimitTimer) return;
  windowLimitTimer = setTimeout(() => {
    windowLimitTimer = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      applyWindowSizeLimits(mainWindow);
    }
  }, 16);
}

function emitWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  mainWindow.webContents.send("window:bounds", {
    width: bounds.width,
    height: bounds.height,
    maximized: mainWindow.isMaximized(),
    fullscreen: mainWindow.isFullScreen()
  });
}

function scheduleWindowBounds() {
  if (windowBoundsTimer) return;
  windowBoundsTimer = setTimeout(() => {
    windowBoundsTimer = null;
    emitWindowBounds();
  }, 16);
}

function createWindow() {
  if (!isDev) {
    const logDir = app.getPath("userData");
    fs.mkdirSync(logDir, { recursive: true });
    devLogPath = path.join(logDir, "main.log");
  }

  devLog("createWindow:start");
  const state = windowStateKeeper({
    defaultWidth: DEFAULT_WIDTH,
    defaultHeight: DEFAULT_HEIGHT
  });
  const bounds = getWindowBounds(state);
  devLog(`createWindow:bounds=${JSON.stringify(bounds)}`);

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    maxWidth: bounds.maxWidth,
    maxHeight: bounds.maxHeight,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    icon: APP_ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  devLog("browserWindow:created");
  state.manage(mainWindow);
  applyWindowSizeLimits(mainWindow);

  mainWindow.on("moved", scheduleWindowSizeLimits);
  mainWindow.on("move", scheduleWindowSizeLimits);
  mainWindow.on("resize", () => {
    scheduleWindowSizeLimits();
    scheduleWindowBounds();
  });
  mainWindow.on("maximize", emitWindowBounds);
  mainWindow.on("unmaximize", emitWindowBounds);
  mainWindow.on("enter-full-screen", emitWindowBounds);
  mainWindow.on("leave-full-screen", emitWindowBounds);
  screen.on("display-metrics-changed", scheduleWindowSizeLimits);

  mainWindow.once("ready-to-show", () => {
    devLog("window:ready-to-show");
    emitWindowBounds();
    mainWindow?.show();
    captureDevWindow("ready-to-show");
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      devLog("window:show-fallback");
      mainWindow.show();
    }
  }, 1500);

  mainWindow.on("show", () => devLog("window:show"));
  mainWindow.on("hide", () => devLog("window:hide"));
  mainWindow.webContents.on("did-start-loading", () => devLog("webContents:did-start-loading"));
  mainWindow.webContents.on("did-finish-load", () => {
    devLog("webContents:did-finish-load");
    captureDevWindow("did-finish-load");
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    devLog(`webContents:console level=${level} source=${sourceId}:${line} message=${message}`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    devLog(`webContents:did-fail-load code=${errorCode} description=${errorDescription} url=${validatedURL}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    devLog(`webContents:render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });

  if (isDev) {
    devLog(`loadURL:${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    const filePath = path.join(__dirname, "../dist/index.html");
    devLog(`loadFile:${filePath}`);
    mainWindow.loadFile(filePath);
  }

  mainWindow.on("closed", () => {
    devLog("window:closed");
    themeEngine.stopDeviceStatusWatcher();
    mainWindow = null;
  });
}

const themeEngine = createThemeEngineAPI(
  {
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    cwd: process.cwd(),
    userDataPath: app.getPath("userData"),
    cacheRoots: [path.join(app.getPath("userData"), "cache"), path.join(app.getPath("userData"), "temp")]
  },
  {
    onLog: emitLog,
    onProgress: emitProgress,
    onDeviceStatus: (status) => mainWindow?.webContents.send("device:status-changed", status)
  }
);
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:maximize-toggle", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized() || manuallyMaximized) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else if (normalWindowBounds) {
      mainWindow.setBounds(normalWindowBounds, false);
    }
    manuallyMaximized = false;
    scheduleWindowSizeLimits();
    scheduleWindowBounds();
    return;
  }

  normalWindowBounds = mainWindow.getBounds();
  mainWindow.maximize();
  manuallyMaximized = true;
  scheduleWindowSizeLimits();
  scheduleWindowBounds();
});
ipcMain.handle("window:close", () => mainWindow?.close());

ipcMain.handle("updates:check", () => checkForUpdates());
ipcMain.handle("updates:open-download", async (_event, url?: string) => {
  if (!isHttpUrl(url)) return false;
  await shell.openExternal(url);
  return true;
});
ipcMain.handle("updates:download-and-install", (_event, url: string, version?: string): Promise<OperationResult> => {
  return downloadAndInstallUpdate(url, version);
});

ipcMain.handle("settings:get-theme", () => ({ mode: currentThemeMode }));
ipcMain.handle("settings:set-theme", (_event, mode: ThemePreference["mode"]) => {
  applyTheme(mode);
  writeSettings({ mode });
  emitLog("INFO", `Theme mode changed: ${mode}`);
  return { mode };
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"]
  });
  return { canceled: result.canceled, path: result.filePaths[0] };
});

ipcMain.handle("dialog:select-mtz", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [{ name: "MTZ Theme", extensions: ["mtz", "zip"] }]
  });
  return { canceled: result.canceled, path: result.filePaths[0] };
});

ipcMain.handle("device:get-status", async () => {
  return themeEngine.getDeviceStatus();
});

ipcMain.handle("operation:pack", async (_event, request: PackRequest): Promise<OperationResult> => {
  try {
    const defaultPath = path.join(app.getPath("desktop"), `${path.basename(request.sourceDir)}.mtz`);
    const save = await dialog.showSaveDialog(mainWindow!, {
      defaultPath,
      filters: [{ name: "MTZ Theme", extensions: ["mtz"] }]
    });
    if (save.canceled || !save.filePath) return { ok: false, message: "Export canceled." };

    const result = await themeEngine.pack({ sourceDir: request.sourceDir, outputPath: save.filePath });
    return {
      ok: result.success,
      message: result.success ? "Export completed." : result.warnings[0] || "Export failed.",
      path: result.outputPath
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:unpack", async (_event, request: UnpackRequest): Promise<OperationResult> => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Select unpack folder",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, message: "Unpack canceled." };

    const unpack = await themeEngine.unpack({ mtzPath: request.mtzPath, outputRoot: result.filePaths[0] });
    return {
      ok: unpack.success,
      message: unpack.success ? "Unpack completed." : "Unpack failed.",
      path: unpack.outputPath
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:deploy", async (_event, mtzPath?: string): Promise<OperationResult> => {
  try {
    let targetPath = mtzPath;
    if (!targetPath) {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openFile"],
        filters: [{ name: "MTZ Theme", extensions: ["mtz"] }]
      });
      if (result.canceled || !result.filePaths[0]) return { ok: false, message: "Apply canceled." };
      targetPath = result.filePaths[0];
    }

    const result = await themeEngine.deploy({ mtzPath: targetPath });
    return {
      ok: result.success,
      message: result.success ? "Applied through Theme Manager." : result.status,
      path: result.success ? result.status : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:export-logs", async (_event, logs: LogEntry[]): Promise<OperationResult> => {
  const save = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: path.join(app.getPath("desktop"), `xiaomi-theme-packer-${Date.now()}.txt`),
    filters: [{ name: "Text", extensions: ["txt"] }]
  });
  if (save.canceled || !save.filePath) return { ok: false, message: "Log export canceled." };
  const text = logs.map((entry) => `${entry.time} [${entry.level}] ${entry.message}`).join(os.EOL);
  fs.writeFileSync(save.filePath, text, "utf8");
  emitLog("SUCCESS", `Logs exported: ${save.filePath}`);
  return { ok: true, message: "Logs exported.", path: save.filePath };
});

ipcMain.handle("operation:cleanup-cache", async (): Promise<OperationResult> => {
  try {
    return themeEngine.cleanupCache();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:restart-adb", async (): Promise<OperationResult> => {
  try {
    return await themeEngine.restartAdb();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:copy-package", async (): Promise<OperationResult> => {
  try {
    const result = await themeEngine.copyPackage();
    if (result.ok && result.data) clipboard.writeText(result.data);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:convert-maml", (_event, xml: string): OperationResult => {
  try {
    return themeEngine.convertMaml(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:copy-package-maml", async (): Promise<OperationResult> => {
  try {
    const result = await themeEngine.copyPackageMaml();
    if (result.ok && result.data) clipboard.writeText(result.data);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("app:open-path", (_event, targetPath: string) => {
  if (targetPath) shell.showItemInFolder(targetPath);
});

app.whenReady().then(() => {
  applyTheme(readSettings().mode);
  createWindow();
  themeEngine.startDeviceStatusWatcher();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      themeEngine.startDeviceStatusWatcher();
    }
  });
});

app.on("window-all-closed", () => {
  themeEngine.stopDeviceStatusWatcher();
  if (process.platform !== "darwin") app.quit();
});






