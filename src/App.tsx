import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { CheckIcon, CleanIcon, CodeIcon, CopyIcon, DocIcon, DownloadIcon, FolderIcon, GearIcon, RestartIcon, SearchIcon, TrashIcon } from "./icons";
import { useResizeObserver, useSmoothCorners } from "./hooks";
import type { DeviceStatus, LogEntry, LogLevel, OperationResult, PageId, ThemeMode, UpdateInfo } from "./types";

const locale = typeof navigator !== "undefined" ? (navigator.languages?.[0] || navigator.language || "en") : "en";
const isChineseLocale = /^zh/i.test(locale);

const ui = isChineseLocale
  ? {
      lastUpdatedPrefix: "\u6700\u540e\u66f4\u65b0\uff1a",
      windowClose: "\u5173\u95ed",
      windowMinimize: "\u6700\u5c0f\u5316",
      windowMaximize: "\u6700\u5927\u5316",
      sidebarPack: "\u6253\u5305",
      sidebarLogs: "\u65e5\u5fd7",
      sidebarMore: "\u66f4\u591a",
      devicePrefix: "\u8bbe\u5907",
      deviceConnected: "\u5df2\u8fde\u63a5",
      deviceDisconnected: "\u672a\u8fde\u63a5",
      packPageTitle: "\u6253\u5305\u5217\u8868",
      themePackageTitle: "\u4e3b\u9898\u6587\u4ef6\u6253\u5305",
      unpackTitle: "\u89e3\u5305",
      select: "\u9009\u62e9",
      exportMtz: "\u5bfc\u51faMTZ",
      applyToPhone: "\u5e94\u7528\u5230\u624b\u673a",
      packProgress: "\u6253\u5305\u8fdb\u5ea6",
      unpackProgress: "\u89e3\u5305\u8fdb\u5ea6",
      logsPageTitle: "\u8fd0\u884c\u65e5\u5fd7",
      monitoring: "\u76d1\u63a7\u4e2d",
      exportLogs: "\u5bfc\u51fa",
      clearLogs: "\u6e05\u7a7a",
      autoScroll: "\u81ea\u52a8\u6eda\u52a8",
      timestamp: "\u65f6\u95f4\u6233",
      filterLogs: "\u7b5b\u9009\u65e5\u5fd7...",
      lines: "\u884c\u6570",
      memory: "\u5185\u5b58",
      connected: "\u5df2\u8fde\u63a5",
      moreThemeModeTitle: "\u4e3b\u9898\u6a21\u5f0f",
      appearanceTitle: "\u5916\u89c2",
      appearanceDesc: "\u9009\u62e9\u60a8\u559c\u6b22\u7684\u754c\u9762\u5916\u89c2\u989c\u8272\u3002",
      system: "\u8ddf\u968f\u7cfb\u7edf",
      light: "\u6d45\u8272\u6a21\u5f0f",
      dark: "\u6df1\u8272\u6a21\u5f0f",
      deviceToolsTitle: "\u5de5\u5177",
      cleanCacheTitle: "\u6e05\u7406\u4e3b\u9898\u7f13\u5b58",
      cleanCacheDesc: "\u91ca\u653e\u78c1\u76d8\u7a7a\u95f4\u5e76\u89e3\u51b3\u4e3b\u9898\u663e\u793a\u5f02\u5e38\u7684\u95ee\u9898\u3002",
      cleanCacheButton: "\u6e05\u7406",
      restartAdbTitle: "\u91cd\u542f ADB",
      restartAdbDesc: "\u82e5\u65e0\u6cd5\u68c0\u6d4b\u5230\u8bbe\u5907\uff0c\u8bf7\u5c1d\u8bd5\u91cd\u542f\u670d\u52a1\u3002",
      restartAdbButton: "\u91cd\u542f",
      currentPackageTitle: "\u590d\u5236",
      copyPackageTitle: "\u590d\u5236\u5f53\u524d\u754c\u9762\u5305\u540d",
      copyPackageDesc: "\u83b7\u53d6\u6b63\u5728\u8fd0\u884c\u7684\u5e94\u7528\u5305\u6807\u8bc6\u7b26\u3002",
      convertMamlTitle: "\u5f53\u524d\u754c\u9762\u7c7b\u540d\u5305\u540d\u590d\u5236\u4e3aMAML\u4ee3\u7801",
      convertMamlDesc: "\u83b7\u53d6\u5f53\u524d\u754c\u9762\u7c7b\u540d\u5305\u540d",
      xmlPlaceholder: "XML",
      convertButton: "\u8f6c\u6362",
      mamlPlaceholder: "MAML \u8f93\u51fa",
      updateChecking: "\u68c0\u67e5\u66f4\u65b0\u4e2d...",
      updateAvailable: "\u53d1\u73b0\u65b0\u7248\u672c",
      updateLatest: "\u5df2\u662f\u6700\u65b0\u7248\u672c",
      updateDownload: "\u4e0b\u8f7d",
      updateDownloading: "\u4e0b\u8f7d\u66f4\u65b0\u4e2d",
      updateInstalling: "\u542f\u52a8\u5b89\u88c5\u5668\u4e2d...",
      updateDownloadFailed: "\u4e0b\u8f7d\u5931\u8d25",
      updateCheck: "\u68c0\u67e5"
    }
  : {
      lastUpdatedPrefix: "Last updated: ",
      windowClose: "Close",
      windowMinimize: "Minimize",
      windowMaximize: "Maximize",
      sidebarPack: "Pack",
      sidebarLogs: "Logs",
      sidebarMore: "More",
      devicePrefix: "Device",
      deviceConnected: "Connected",
      deviceDisconnected: "Disconnected",
      packPageTitle: "Pack List",
      themePackageTitle: "Theme Package",
      unpackTitle: "Unpack",
      select: "Select",
      exportMtz: "Export MTZ",
      applyToPhone: "Apply to Phone",
      packProgress: "Pack Progress",
      unpackProgress: "Unpack Progress",
      logsPageTitle: "Runtime Logs",
      monitoring: "MONITORING",
      exportLogs: "Export",
      clearLogs: "Clear",
      autoScroll: "Auto-scroll",
      timestamp: "Timestamp",
      filterLogs: "Filter logs...",
      lines: "Lines",
      memory: "Memory",
      connected: "Connected",
      moreThemeModeTitle: "Theme Mode",
      appearanceTitle: "Appearance",
      appearanceDesc: "Choose the interface appearance color you prefer.",
      system: "System",
      light: "Light Mode",
      dark: "Dark Mode",
      deviceToolsTitle: "Tools",
      cleanCacheTitle: "Clean Theme Cache",
      cleanCacheDesc: "Free disk space and fix stale theme display issues.",
      cleanCacheButton: "Clean",
      restartAdbTitle: "Restart ADB",
      restartAdbDesc: "Restart the service if no device can be detected.",
      restartAdbButton: "Restart",
      currentPackageTitle: "Copy",
      copyPackageTitle: "Copy Current Screen Package",
      copyPackageDesc: "Get the package identifier for the running app.",
      convertMamlTitle: "Copy Current Screen Class and Package as MAML",
      convertMamlDesc: "Get the current screen class and package name.",
      xmlPlaceholder: "XML",
      convertButton: "Convert",
      mamlPlaceholder: "MAML output",
      updateChecking: "Checking updates...",
      updateAvailable: "Update available",
      updateLatest: "You're up to date",
      updateDownload: "Download",
      updateDownloading: "Downloading update",
      updateInstalling: "Starting installer...",
      updateDownloadFailed: "Download failed",
      updateCheck: "Check"
    };
function createLog(level: LogLevel, message: string): LogEntry {
  const now = new Date();
  return {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    time: now.toLocaleTimeString("en-GB", { hour12: false }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`,
    level,
    message
  };
}

function formatLastUpdated(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${ui.lastUpdatedPrefix}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resolveThemeMode(mode: ThemeMode) {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeDataset(mode: ThemeMode) {
  document.documentElement.dataset.themePreference = mode;
  document.documentElement.dataset.themeMode = resolveThemeMode(mode);
}

function getWindowCornerSmoothing(page: PageId) {
  return page === "pack" ? 0.5699999928474426 : 0.6000000238418579;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cubicBezier(value: number, x1: number, y1: number, x2: number, y2: number) {
  const sample = (time: number, a1: number, a2: number) => {
    const inverseTime = 1 - time;
    return 3 * inverseTime * inverseTime * time * a1 + 3 * inverseTime * time * time * a2 + time * time * time;
  };
  const derivative = (time: number, a1: number, a2: number) => {
    const inverseTime = 1 - time;
    return 3 * inverseTime * inverseTime * a1 + 6 * inverseTime * time * (a2 - a1) + 3 * time * time * (1 - a2);
  };

  let time = value;
  for (let index = 0; index < 5; index += 1) {
    const x = sample(time, x1, x2) - value;
    const dx = derivative(time, x1, x2);
    if (Math.abs(x) < 0.001 || dx === 0) break;
    time = clamp(time - x / dx, 0, 1);
  }
  return sample(time, y1, y2);
}

function easeLiquid(value: number) {
  return cubicBezier(value, 0.2, 0.8, 0.2, 1);
}

function getDynamicWindowRadius(height: number, edgeToEdge: boolean) {
  if (edgeToEdge) return 0;
  return clamp(22 - (height - 500) * 0.02, 12, 18);
}

function isViewportEdgeToEdge() {
  const widthDelta = Math.abs(window.outerWidth - window.screen.availWidth);
  const heightDelta = Math.abs(window.outerHeight - window.screen.availHeight);
  const fullscreenWidthDelta = Math.abs(window.outerWidth - window.screen.width);
  const fullscreenHeightDelta = Math.abs(window.outerHeight - window.screen.height);
  return (
    Boolean(document.fullscreenElement) ||
    (widthDelta <= 2 && heightDelta <= 2) ||
    (fullscreenWidthDelta <= 2 && fullscreenHeightDelta <= 2)
  );
}

function useWindowMotionState() {
  const getInitialBounds = () => ({
    width: typeof window === "undefined" ? 800 : window.innerWidth,
    height: typeof window === "undefined" ? 500 : window.innerHeight,
    edgeToEdge: typeof window === "undefined" ? false : isViewportEdgeToEdge()
  });
  const [state, setState] = useState(() => {
    const initial = getInitialBounds();
    return {
      ...initial,
      radius: getDynamicWindowRadius(initial.height, initial.edgeToEdge),
      resizing: false
    };
  });

  useEffect(() => {
    const initial = getInitialBounds();
    const current = {
      width: initial.width,
      height: initial.height,
      radius: getDynamicWindowRadius(initial.height, initial.edgeToEdge)
    };
    const target = {
      width: initial.width,
      height: initial.height,
      radius: current.radius,
      edgeToEdge: initial.edgeToEdge
    };
    let resizeTimer = 0;
    let frame = 0;
    let previousTime = performance.now();

    const commit = (resizing: boolean) => {
      setState({
        width: current.width,
        height: current.height,
        radius: current.radius,
        edgeToEdge: target.edgeToEdge,
        resizing
      });
    };

    const animate = (time: number) => {
      const delta = clamp((time - previousTime) / 1000, 0, 0.05);
      previousTime = time;
      const alpha = easeLiquid(clamp(delta * 9, 0, 1));
      current.width += (target.width - current.width) * alpha;
      current.height += (target.height - current.height) * alpha;
      current.radius += (target.radius - current.radius) * alpha;
      const settled =
        Math.abs(current.width - target.width) < 0.25 &&
        Math.abs(current.height - target.height) < 0.25 &&
        Math.abs(current.radius - target.radius) < 0.05;
      if (settled) {
        current.width = target.width;
        current.height = target.height;
        current.radius = target.radius;
      }
      commit(!settled || Boolean(resizeTimer));
      if (!settled || resizeTimer) {
        frame = window.requestAnimationFrame(animate);
      } else {
        frame = 0;
      }
    };

    const startAnimation = () => {
      if (frame) return;
      previousTime = performance.now();
      frame = window.requestAnimationFrame(animate);
    };

    const updateTarget = (bounds: { width: number; height: number; maximized?: boolean; fullscreen?: boolean }) => {
      target.width = bounds.width;
      target.height = bounds.height;
      target.edgeToEdge = Boolean(bounds.maximized || bounds.fullscreen);
      target.radius = getDynamicWindowRadius(bounds.height, target.edgeToEdge);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0;
        startAnimation();
      }, 160);
      startAnimation();
    };

    const fallbackBounds = () => {
      updateTarget({
        width: window.innerWidth,
        height: window.innerHeight,
        maximized: isViewportEdgeToEdge(),
        fullscreen: Boolean(document.fullscreenElement)
      });
    };
    const offBounds =
      typeof window.xiaomiThemePacker.window.onBounds === "function"
        ? window.xiaomiThemePacker.window.onBounds(updateTarget)
        : () => {
            window.removeEventListener("resize", fallbackBounds);
            document.removeEventListener("fullscreenchange", fallbackBounds);
          };
    if (typeof window.xiaomiThemePacker.window.onBounds !== "function") {
      window.addEventListener("resize", fallbackBounds);
      document.addEventListener("fullscreenchange", fallbackBounds);
    }
    updateTarget({
      width: window.innerWidth,
      height: window.innerHeight,
      maximized: isViewportEdgeToEdge(),
      fullscreen: Boolean(document.fullscreenElement)
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      offBounds();
    };
  }, []);

  return state;
}

export function App() {
  const [page, setPage] = useState<PageId>("pack");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [packProgress, setPackProgress] = useState(0);
  const [unpackProgress, setUnpackProgress] = useState(0);
  const [selectedThemeDir, setSelectedThemeDir] = useState("");
  const [selectedMtz, setSelectedMtz] = useState("");
  const [lastExportedMtz, setLastExportedMtz] = useState("");
  const [packUpdatedAt, setPackUpdatedAt] = useState(() => formatLastUpdated());
  const [unpackUpdatedAt, setUnpackUpdatedAt] = useState(() => formatLastUpdated());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ connected: false });
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const windowMotion = useWindowMotionState();
  const liquidWindowStyle = {
    "--liquid-width": `${windowMotion.width}px`,
    "--liquid-height": `${windowMotion.height}px`,
    "--window-radius": `${windowMotion.radius}px`
  } as CSSProperties;
  useSmoothCorners();

  const checkUpdates = useCallback(async () => {
    setUpdateInfo((current) => ({
      currentVersion: current?.currentVersion || "",
      latestVersion: current?.latestVersion,
      available: Boolean(current?.available),
      checking: true,
      downloading: false,
      downloadProgress: undefined,
      message: ui.updateChecking,
      releaseUrl: current?.releaseUrl,
      downloadUrl: current?.downloadUrl,
      notes: current?.notes,
      publishedAt: current?.publishedAt
    }));
    const result = await window.xiaomiThemePacker.updates.check();
    setUpdateInfo(result);
  }, []);

  useEffect(() => {
    window.xiaomiThemePacker.settings.getTheme().then((value) => {
      setThemeMode(value.mode);
      applyThemeDataset(value.mode);
    });
    window.xiaomiThemePacker.device.getStatus().then((status) => setDeviceStatus(status as DeviceStatus));
    checkUpdates();
    const offLog = window.xiaomiThemePacker.events.onLog((entry) => setLogs((items) => [...items, entry]));
    const offProgress = window.xiaomiThemePacker.events.onProgress((payload) => {
      if (payload.operation === "pack" || payload.operation === "deploy") setPackProgress(payload.percent);
      if (payload.operation === "unpack") setUnpackProgress(payload.percent);
    });
    const offDeviceStatus = window.xiaomiThemePacker.events.onDeviceStatus((status) => setDeviceStatus(status));
    const offUpdateProgress = window.xiaomiThemePacker.events.onUpdateProgress((payload) => {
      setUpdateInfo((current) => {
        if (!current) return current;
        return {
          ...current,
          downloading: payload.percent < 100,
          downloadProgress: payload.percent,
          message: payload.message
        };
      });
    });
    return () => {
      offLog();
      offProgress();
      offDeviceStatus();
      offUpdateProgress();
    };
  }, [checkUpdates]);


  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (themeMode === "system") applyThemeDataset("system");
    };
    updateSystemTheme();
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [themeMode]);

  const pushLocalLog = useCallback((level: LogLevel, message: string) => {
    setLogs((items) => [...items, createLog(level, message)]);
  }, []);

  return (
    <div className={`app-window page-${page} ${windowMotion.edgeToEdge ? "window-edge-to-edge" : "window-floating"} ${windowMotion.resizing ? "window-resizing" : ""}`} style={liquidWindowStyle} data-window-state={windowMotion.edgeToEdge ? "edge" : "floating"} data-window-resizing={windowMotion.resizing ? "true" : "false"}>
      <Sidebar page={page} onNavigate={setPage} deviceStatus={deviceStatus} updateInfo={updateInfo} onCheckUpdate={checkUpdates} onUpdateInfoChange={setUpdateInfo} />
      <main className="main-region">
        {page === "pack" && (
          <PackPage
            selectedThemeDir={selectedThemeDir}
            selectedMtz={selectedMtz}
            lastExportedMtz={lastExportedMtz}
            packUpdatedAt={packUpdatedAt}
            unpackUpdatedAt={unpackUpdatedAt}
            packProgress={packProgress}
            unpackProgress={unpackProgress}
            onThemeDirChange={setSelectedThemeDir}
            onMtzChange={setSelectedMtz}
            onLastExportedMtzChange={setLastExportedMtz}
            onPackUpdatedAtChange={setPackUpdatedAt}
            onUnpackUpdatedAtChange={setUnpackUpdatedAt}
            onLocalLog={pushLocalLog}
          />
        )}
        {page === "logs" && <LogsPage logs={logs} setLogs={setLogs} />}
        {page === "more" && <MorePage themeMode={themeMode} setThemeMode={setThemeMode} onLocalLog={pushLocalLog} />}
      </main>
    </div>
  );
}

function WindowDots() {
  return (
    <div className="window-dots" data-drag-region="false">
      <button className="dot red" data-smooth-corner="circle" aria-label={ui.windowClose} onClick={() => window.xiaomiThemePacker.window.close()}><span className="dot-symbol" aria-hidden="true" /></button>
      <button className="dot yellow" data-smooth-corner="circle" aria-label={ui.windowMinimize} onClick={() => window.xiaomiThemePacker.window.minimize()}><span className="dot-symbol" aria-hidden="true" /></button>
      <button className="dot green" data-smooth-corner="circle" aria-label={ui.windowMaximize} onClick={() => window.xiaomiThemePacker.window.toggleMaximize()}><span className="dot-symbol" aria-hidden="true" /></button>
    </div>
  );
}

function Sidebar({ page, onNavigate, deviceStatus, updateInfo, onCheckUpdate, onUpdateInfoChange }: { page: PageId; onNavigate: (page: PageId) => void; deviceStatus: DeviceStatus; updateInfo: UpdateInfo | null; onCheckUpdate: () => void; onUpdateInfoChange: React.Dispatch<React.SetStateAction<UpdateInfo | null>> }) {
  const items = [
    { id: "pack" as const, label: ui.sidebarPack, icon: FolderIcon },
    { id: "logs" as const, label: ui.sidebarLogs, icon: DocIcon },
    { id: "more" as const, label: ui.sidebarMore, icon: GearIcon }
  ];
  const deviceLabel = `${ui.devicePrefix}: ${deviceStatus.connected ? deviceStatus.model || ui.deviceConnected : ui.deviceDisconnected}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-shadow" data-smooth-corner="18" data-figma-corner-radius="18" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" aria-hidden="true" />
      <div className="sidebar-panel" data-smooth-corner="18" data-figma-corner-radius="18" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" aria-hidden="true" />
      <WindowDots />
      <nav className="nav-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)}>
              <Icon className="nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <UpdateCard info={updateInfo} onCheckUpdate={onCheckUpdate} onUpdateInfoChange={onUpdateInfoChange} />
      <div className="device-label">{deviceLabel}</div>
    </aside>
  );
}

function UpdateCard({ info, onCheckUpdate, onUpdateInfoChange }: { info: UpdateInfo | null; onCheckUpdate: () => void; onUpdateInfoChange: React.Dispatch<React.SetStateAction<UpdateInfo | null>> }) {
  if (!info?.checking && !info?.available) return null;

  const targetUrl = info.downloadUrl || info.releaseUrl;
  const installUpdate = async () => {
    if (!targetUrl) return;
    onUpdateInfoChange((current) => current ? { ...current, downloading: true, downloadProgress: 0, message: ui.updateDownloading } : current);
    const latestVersion = info.latestVersion;
    const result = (await window.xiaomiThemePacker.updates.downloadAndInstall(targetUrl, latestVersion)) as OperationResult;
    if (!result.ok) {
      onUpdateInfoChange((current) => current ? { ...current, downloading: false, message: result.message || ui.updateDownloadFailed } : current);
      return;
    }
    onUpdateInfoChange((current) => current ? { ...current, downloading: false, downloadProgress: 100, message: ui.updateInstalling } : current);
  };
  const progress = Math.max(0, Math.min(100, Math.round(info.downloadProgress || 0)));
  const subtitle = info.downloading
    ? `${progress}%`
    : info.available && info.latestVersion
      ? `v${info.latestVersion}`
      : info.message || ui.updateChecking;

  return (
    <div className={`update-card ${info.available ? "available" : "checking"} ${info.downloading ? "downloading" : ""}`} data-smooth-corner="10" data-figma-corner-radius="10" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
      <div className="update-copy">
        <strong>{info.downloading ? ui.updateDownloading : info.available ? ui.updateAvailable : ui.updateChecking}</strong>
        <span>{subtitle}</span>
      </div>
      {info.downloading && (
        <div className="update-progress" data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill">
          <span data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill" style={{ width: `${progress}%` }} />
        </div>
      )}
      {info.available ? (
        <button className="update-action" data-smooth-corner="7" data-figma-corner-radius="7" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={targetUrl ? installUpdate : onCheckUpdate} disabled={info.downloading}>
          {targetUrl ? ui.updateDownload : ui.updateCheck}
        </button>
      ) : null}
    </div>
  );
}

interface PackPageProps {
  selectedThemeDir: string;
  selectedMtz: string;
  lastExportedMtz: string;
  packUpdatedAt: string;
  unpackUpdatedAt: string;
  packProgress: number;
  unpackProgress: number;
  onThemeDirChange: (value: string) => void;
  onMtzChange: (value: string) => void;
  onLastExportedMtzChange: (value: string) => void;
  onPackUpdatedAtChange: (value: string) => void;
  onUnpackUpdatedAtChange: (value: string) => void;
  onLocalLog: (level: LogLevel, message: string) => void;
}

function PackPage(props: PackPageProps) {
  const selectThemeDir = async () => {
    const result = await window.xiaomiThemePacker.dialog.selectFolder();
    if (!result.canceled && result.path) {
      props.onThemeDirChange(result.path);
      props.onPackUpdatedAtChange(formatLastUpdated());
      props.onLocalLog("INFO", `Theme directory selected: ${result.path}`);
    }
  };

  const selectMtz = async () => {
    const result = await window.xiaomiThemePacker.dialog.selectMtz();
    if (!result.canceled && result.path) {
      props.onMtzChange(result.path);
      props.onUnpackUpdatedAtChange(formatLastUpdated());
      props.onLocalLog("INFO", `MTZ selected: ${result.path}`);
    }
  };

  const exportMtz = async () => {
    const result = (await window.xiaomiThemePacker.operations.pack(props.selectedThemeDir)) as OperationResult;
    if (result.ok && result.path) {
      props.onLastExportedMtzChange(result.path);
      props.onPackUpdatedAtChange(formatLastUpdated());
    }
  };

  const deploy = async () => {
    const result = (await window.xiaomiThemePacker.operations.deploy(props.lastExportedMtz)) as OperationResult;
    if (result.ok) props.onPackUpdatedAtChange(formatLastUpdated());
  };

  const unpack = async () => {
    const result = (await window.xiaomiThemePacker.operations.unpack(props.selectedMtz)) as OperationResult;
    if (result.ok) props.onUnpackUpdatedAtChange(formatLastUpdated());
  };

  return (
    <section className="page pack-page">
      <header className="top-bar drag-bar">
        <h1>{ui.packPageTitle}</h1>
      </header>
      <div className="pack-content">
        <PackCard
          title={ui.themePackageTitle}
          date={props.packUpdatedAt}
          pathValue={props.selectedThemeDir}
          pathPlaceholder=""
          selectLabel={ui.select}
          onSelect={selectThemeDir}
          actions={[
            { label: ui.exportMtz, onClick: exportMtz },
            { label: ui.applyToPhone, onClick: deploy }
          ]}
          progressLabel={ui.packProgress}
          progress={props.packProgress}
          progressTone="blue"
        />
        <PackCard
          title={ui.unpackTitle}
          date={props.unpackUpdatedAt}
          pathValue={props.selectedMtz}
          pathPlaceholder=""
          selectLabel={ui.select}
          onSelect={selectMtz}
          actions={[{ label: ui.unpackTitle, onClick: unpack }]}
          progressLabel={ui.unpackProgress}
          progress={props.unpackProgress}
          progressTone="yellow"
          compact
        />
      </div>
    </section>
  );
}

interface PackCardProps {
  title: string;
  date: string;
  pathValue: string;
  pathPlaceholder: string;
  selectLabel: string;
  onSelect: () => void;
  actions: Array<{ label: string; onClick: () => void }>;
  progressLabel: string;
  progress: number;
  progressTone: "blue" | "yellow";
  compact?: boolean;
}

function PackCard({ title, date, pathValue, pathPlaceholder, selectLabel, onSelect, actions, progressLabel, progress, progressTone, compact }: PackCardProps) {
  return (
    <article className={`pack-card ${compact ? "compact" : ""}`} data-smooth-corner="16" data-figma-corner-radius="16" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
      <div className="pack-card-head">
        <div className="pack-title-area">
          <h2>{title}</h2>
          <p>{date}</p>
          <div className="path-row">
            <div className="path-display" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" title={pathValue || pathPlaceholder}>{pathValue || pathPlaceholder}</div>
            <button className="small-select" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={onSelect}>{selectLabel}</button>
          </div>
        </div>
        <div className="card-actions">
          {actions.map((action) => (
            <button key={action.label} className="primary-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={action.onClick}>{action.label}</button>
          ))}
        </div>
      </div>
      <ProgressBar label={progressLabel} percent={progress} tone={progressTone} />
    </article>
  );
}

function ProgressBar({ label, percent, tone }: { label: string; percent: number; tone: "blue" | "yellow" }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="progress-block">
      <div className="progress-meta">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="progress-track" data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill">
        <div className={`progress-fill ${tone}`} data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function LogsPage({ logs, setLogs }: { logs: LogEntry[]; setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [timestamp, setTimestamp] = useState(true);
  const { ref, rect } = useResizeObserver<HTMLDivElement>();
  const listRef = useRef<VariableSizeList>(null);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((entry) => `${entry.time} ${entry.level} ${entry.message}`.toLowerCase().includes(needle));
  }, [logs, query]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0, true);
  }, [autoScroll, filteredLogs.length, rect.width, timestamp]);

  useEffect(() => {
    if (autoScroll && filteredLogs.length > 0) {
      listRef.current?.scrollToItem(filteredLogs.length - 1, "end");
    }
  }, [autoScroll, filteredLogs.length, logs.length]);

  const exportLogs = async () => {
    await window.xiaomiThemePacker.operations.exportLogs(logs);
  };

  const getItemSize = (index: number) => {
    const entry = filteredLogs[index];
    if (!entry) return 28;
    const listWidth = Math.max(220, rect.width || 720);
    const fixedWidth = (timestamp ? 98 : 0) + 58 + 40;
    const messageWidth = Math.max(96, listWidth - fixedWidth);
    const charsPerLine = Math.max(12, Math.floor(messageWidth / 7.2));
    const lines = Math.max(1, Math.ceil(entry.message.length / charsPerLine));
    return Math.ceil(lines * 19.5 + 10);
  };

  const Row = ({ index, style }: ListChildComponentProps) => {
    const entry = filteredLogs[index];
    return (
      <div className="log-row" style={style}>
        <div className={`log-line level-${entry.level.toLowerCase()}`} data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
          {timestamp && <span className="log-time">{entry.time}</span>}
          <span className="log-level">[{entry.level}]</span>
          <span className="log-message">{entry.message}</span>
        </div>
      </div>
    );
  };

  return (
    <section className="page logs-page">
      <div className="log-shell" data-smooth-corner="18" data-figma-corner-radius="18" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
        <header className="log-header drag-bar">
          <div className="log-title-group">
            <h1>{ui.logsPageTitle}</h1>
            <div className="monitor-pill" data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill"><span data-smooth-corner="circle" />{ui.monitoring}</div>
          </div>
          <div className="log-buttons">
            <button className="soft-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={exportLogs}><DownloadIcon />{ui.exportLogs}</button>
            <button className="soft-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={() => setLogs([])}><TrashIcon />{ui.clearLogs}</button>
          </div>
        </header>
        <div className="log-toolbar">
          <div className="check-row">
            <button type="button" className="check-option" aria-pressed={autoScroll} onClick={() => setAutoScroll((value) => !value)}>
              <span className="check-button" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">{autoScroll && <CheckIcon />}</span>
              <span>{ui.autoScroll}</span>
            </button>
            <button type="button" className="check-option" aria-pressed={timestamp} onClick={() => setTimestamp((value) => !value)}>
              <span className="check-button" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">{timestamp && <CheckIcon />}</span>
              <span>{ui.timestamp}</span>
            </button>
          </div>
          <div className="search-box" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui.filterLogs} />
          </div>
        </div>
        <div ref={ref} className="log-content">
          <VariableSizeList
            ref={listRef}
            className="log-virtual-list"
            height={Math.max(120, rect.height)}
            width="100%"
            itemCount={filteredLogs.length}
            itemSize={getItemSize}
            overscanCount={8}
          >
            {Row}
          </VariableSizeList>
        </div>
        <footer className="log-footer">
          <div><span>{ui.lines}: {logs.length}</span><span>{ui.memory}: {getMemoryLabel()}</span></div>
          <div className="connected-dot"><span data-smooth-corner="circle" />{ui.connected}</div>
        </footer>
      </div>
    </section>
  );
}

function getMemoryLabel() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  if (!memory?.usedJSHeapSize) return "142MB";
  return `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`;
}

function MorePage({ themeMode, setThemeMode, onLocalLog }: { themeMode: ThemeMode; setThemeMode: (mode: ThemeMode) => void; onLocalLog: (level: LogLevel, message: string) => void }) {
  const changeTheme = async (mode: ThemeMode) => {
    const result = await window.xiaomiThemePacker.settings.setTheme(mode);
    setThemeMode(result.mode);
    applyThemeDataset(result.mode);
  };

  const runConvert = async () => {
    const result = (await window.xiaomiThemePacker.operations.copyPackageMaml()) as OperationResult;
    if (result.ok) {
      onLocalLog("SUCCESS", result.message || (isChineseLocale ? "MAML 包名代码已复制。" : "MAML package code copied."));
    } else {
      onLocalLog("ERROR", result.message || (isChineseLocale ? "MAML 包名代码复制失败。" : "MAML package code copy failed."));
    }
  };

  return (
    <section className="page more-page">
      <div className="settings-content">
        <SettingsSection title={ui.appearanceTitle}>
      <div className="settings-card single-row" data-smooth-corner="12" data-figma-corner-radius="12" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <div className="setting-copy">
              <strong>{ui.moreThemeModeTitle}</strong>
              <span>{ui.appearanceDesc}</span>
            </div>
            <div className="segmented" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
              <button data-smooth-corner="6" data-figma-corner-radius="6" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" className={themeMode === "system" ? "selected" : ""} onClick={() => changeTheme("system")}>{ui.system}</button>
              <button data-smooth-corner="6" data-figma-corner-radius="6" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" className={themeMode === "light" ? "selected" : ""} onClick={() => changeTheme("light")}>{ui.light}</button>
              <button data-smooth-corner="6" data-figma-corner-radius="6" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" className={themeMode === "dark" ? "selected" : ""} onClick={() => changeTheme("dark")}>{ui.dark}</button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title={ui.deviceToolsTitle}>
          <div className="settings-card stacked" data-smooth-corner="12" data-figma-corner-radius="12" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <SettingRow
              icon={<CleanIcon />}
              tone="blue"
              title={ui.cleanCacheTitle}
              description={ui.cleanCacheDesc}
              button={<button className="primary-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={() => window.xiaomiThemePacker.operations.cleanupCache()}>{ui.cleanCacheButton}</button>}
            />
            <SettingRow
              icon={<RestartIcon />}
              title={ui.restartAdbTitle}
              description={ui.restartAdbDesc}
              button={<button className="neutral-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={() => window.xiaomiThemePacker.operations.restartAdb()}>{ui.restartAdbButton}</button>}
            />
          </div>
        </SettingsSection>

        <SettingsSection title={ui.currentPackageTitle}>
          <div className="settings-card stacked" data-smooth-corner="12" data-figma-corner-radius="12" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <SettingRow
              icon={<CopyIcon />}
              title={ui.copyPackageTitle}
              description={ui.copyPackageDesc}
              button={<button className="icon-button" data-smooth-corner="0" data-figma-corner-radius="0" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" aria-label={ui.copyPackageTitle} onClick={() => window.xiaomiThemePacker.operations.copyPackage()}><CopyIcon /></button>}
            />
            <SettingRow
              icon={<CodeIcon />}
              title={ui.convertMamlTitle}
              description={ui.convertMamlDesc}
              button={<button className="icon-button" data-smooth-corner="0" data-figma-corner-radius="0" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" aria-label={ui.convertMamlTitle} onClick={runConvert}><CodeIcon /></button>}
            />
          </div>
        </SettingsSection>
      </div>
    </section>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function SettingRow({ icon, title, description, button, tone }: { icon: React.ReactNode; title: string; description: string; button: React.ReactNode; tone?: "blue" }) {
  return (
    <div className="setting-row">
      <div className="setting-left">
        <div className={`setting-icon ${tone === "blue" ? "blue" : ""}`} data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">{icon}</div>
        <div className="setting-copy">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      <div className="setting-button">{button}</div>
    </div>
  );
}
