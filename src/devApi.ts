import type { LogEntry, ProgressPayload, ThemeMode } from "./types";
import type { XiaomiThemePackerApi } from "../electron/preload";

export function installDevApi() {
  if (window.xiaomiThemePacker) return;

  let mode: ThemeMode = "system";
  const api: XiaomiThemePackerApi = {
    window: {
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      close: async () => undefined,
      onBounds: (callback) => {
        const emitBounds = () => {
          callback({
            width: window.innerWidth,
            height: window.innerHeight,
            maximized: false,
            fullscreen: Boolean(document.fullscreenElement)
          });
        };
        emitBounds();
        window.addEventListener("resize", emitBounds);
        document.addEventListener("fullscreenchange", emitBounds);
        return () => {
          window.removeEventListener("resize", emitBounds);
          document.removeEventListener("fullscreenchange", emitBounds);
        };
      }
    },
    settings: {
      getTheme: async () => ({ mode }),
      setTheme: async (nextMode) => {
        mode = nextMode;
        return { mode };
      }
    },
    dialog: {
      selectFolder: async () => ({ canceled: false, path: "E:\\Themes\\NewTheme_v1" }),
      selectMtz: async () => ({ canceled: false, path: "E:\\Themes\\ModernDark.mtz" })
    },
    device: {
      getStatus: async () => ({ connected: false })
    },
    operations: {
      pack: async () => ({ ok: true, message: "导出完成。", path: "E:\\Themes\\ModernDark.mtz" }),
      unpack: async () => ({ ok: true, message: "解包完成。", path: "E:\\Themes\\ModernDark" }),
      deploy: async () => ({ ok: true, message: "已推送到手机。", path: "/sdcard/Download/ModernDark.mtz" }),
      exportLogs: async () => ({ ok: true, message: "日志已导出。" }),
      cleanupCache: async () => ({ ok: true, message: "缓存已清理。" }),
      restartAdb: async () => ({ ok: true, message: "ADB 已重启。" }),
      copyPackage: async () => ({ ok: true, message: "包名已复制。", data: "com.miui.home" }),
      copyPackageMaml: async () => ({
        ok: true,
        message: "MAML activity code copied.",
        data: [
          "<Variable name=\"current_package\" expression=\"'com.miui.home'\" />",
          "<Variable name=\"current_class\" expression=\"'com.miui.home.launcher.Launcher'\" />",
          "<IntentCommand action=\"android.intent.action.MAIN\" package=\"com.miui.home\" class=\"com.miui.home.launcher.Launcher\" />"
        ].join("\n")
      }),
      convertMaml: async (xml: string) => ({ ok: true, message: "转换完成。", data: `<Lockscreen version="1" frameRate="30" screenWidth="1080">\n${xml}\n</Lockscreen>` }),
      openPath: async () => undefined
    },
    updates: {
      check: async () => ({
        currentVersion: "0.1.0",
        latestVersion: "0.1.1",
        available: true,
        message: "New version 0.1.1 is available.",
        releaseUrl: "https://example.com/xiaomi-theme-packer/latest",
        downloadUrl: "https://example.com/xiaomi-theme-packer/Xiaomi-Theme-Packer-0.1.1.exe"
      }),
      openDownload: async () => undefined,
      downloadAndInstall: async () => ({ ok: true, message: "Update downloaded. Installer started." })
    },
    events: {
      onLog: (_callback: (entry: LogEntry) => void) => () => undefined,
      onProgress: (_callback: (payload: ProgressPayload) => void) => () => undefined,
      onUpdateProgress: () => () => undefined,
      onDeviceStatus: () => () => undefined
    }
  };

  window.xiaomiThemePacker = api;
}
