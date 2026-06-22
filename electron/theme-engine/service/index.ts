import fs from "node:fs";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { packTheme } from "./packer";
import { unpackMtz } from "./unpacker";
import { getDeviceStatus, runAdb, startTrackDevices, type AdbContext } from "./adb";
import { deployTheme } from "./deployer";
import { convertXmlToMaml, currentActivityToMaml, parseCurrentActivity, parseCurrentPackage } from "./maml";
import { parseThemeModel } from "../core";
import { createFolderResourceResolver, createMtzResourceResolver } from "../runtime";
import type { DeviceStatus, OperationResult, ProgressPayload } from "../../types";

export interface ThemeEngineContext extends AdbContext {
  userDataPath: string;
  cacheRoots: string[];
}

export interface ThemeEngineCallbacks {
  onLog?: (level: "INFO" | "WARN" | "ERROR" | "SUCCESS" | "DEBUG", message: string) => void;
  onProgress?: (payload: ProgressPayload) => void;
  onDeviceStatus?: (status: DeviceStatus) => void;
}

export function createThemeEngine(context: ThemeEngineContext, callbacks: ThemeEngineCallbacks = {}) {
  let deviceWatchTimer: NodeJS.Timeout | null = null;
  let deviceTrackProcess: ChildProcessWithoutNullStreams | null = null;
  let lastDeviceStatus: DeviceStatus | null = null;
  let deviceStatusChecking = false;

  const log = callbacks.onLog || (() => undefined);
  const progress = callbacks.onProgress || (() => undefined);

  const sameDeviceStatus = (left: DeviceStatus | null, right: DeviceStatus) => {
    return Boolean(left && left.connected === right.connected && (left.model || "") === (right.model || ""));
  };

  const refreshDeviceStatus = async (force = false) => {
    if (deviceStatusChecking) return;
    deviceStatusChecking = true;
    try {
      const status = await getDeviceStatus(context);
      if (force || !sameDeviceStatus(lastDeviceStatus, status)) {
        lastDeviceStatus = status;
        callbacks.onDeviceStatus?.(status);
      }
    } catch {
      const status: DeviceStatus = { connected: false };
      if (force || !sameDeviceStatus(lastDeviceStatus, status)) {
        lastDeviceStatus = status;
        callbacks.onDeviceStatus?.(status);
      }
    } finally {
      deviceStatusChecking = false;
    }
  };

  return {
    listFolderFiles: (sourceDir: string) => createFolderResourceResolver(sourceDir).listResources(),

    parseFolderTheme: async (sourceDir: string) => parseThemeModel(createFolderResourceResolver(sourceDir)),
    parseMtzTheme: async (mtzPath: string) => parseThemeModel(createMtzResourceResolver(mtzPath)),

    getDeviceStatus: async () => {
      const status = await getDeviceStatus(context);
      lastDeviceStatus = status;
      return status;
    },

    startDeviceStatusWatcher: () => {
      if (deviceWatchTimer || deviceTrackProcess) return;
      void refreshDeviceStatus(true);
      deviceWatchTimer = setInterval(() => void refreshDeviceStatus(), 3000);
      deviceTrackProcess = startTrackDevices(context, () => void refreshDeviceStatus());
    },

    stopDeviceStatusWatcher: () => {
      if (deviceWatchTimer) {
        clearInterval(deviceWatchTimer);
        deviceWatchTimer = null;
      }
      if (deviceTrackProcess) {
        deviceTrackProcess.kill();
        deviceTrackProcess = null;
      }
    },

    pack: (sourceDir: string, outputPath: string): OperationResult => {
      log("INFO", `Packing theme directory: ${sourceDir}`);
      progress({ operation: "pack", percent: 1 });
      packTheme(sourceDir, outputPath, (percent) => progress({ operation: "pack", percent }));
      progress({ operation: "pack", percent: 100 });
      log("SUCCESS", `MTZ exported: ${outputPath}`);
      return { ok: true, message: "Export completed.", path: outputPath };
    },

    unpack: (mtzPath: string, outputRoot: string): OperationResult => {
      log("INFO", `Unpacking MTZ: ${mtzPath}`);
      progress({ operation: "unpack", percent: 1 });
      const outputDir = unpackMtz(mtzPath, outputRoot, (percent) => progress({ operation: "unpack", percent }));
      progress({ operation: "unpack", percent: 100 });
      log("SUCCESS", `MTZ unpacked: ${outputDir}`);
      return { ok: true, message: "Unpack completed.", path: outputDir };
    },

    deploy: async (targetPath: string): Promise<OperationResult> => {
      log("INFO", "Checking ADB device connection...");
      progress({ operation: "deploy", percent: 25 });
      log("INFO", "Applying MTZ through Xiaomi Theme Manager...");
      const result = await deployTheme(context, targetPath);
      if (!result.ok) {
        log("ERROR", result.message);
        return { ok: false, message: result.message, path: result.remote };
      }
      progress({ operation: "deploy", percent: 100 });
      log("SUCCESS", `MTZ applied through Theme Manager: ${result.remote}`);
      return { ok: true, message: "Applied through Theme Manager.", path: result.remote };
    },

    cleanupCache: (): OperationResult => {
      for (const root of context.cacheRoots) {
        if (fs.existsSync(root)) {
          fs.rmSync(root, { recursive: true, force: true });
          log("INFO", `Deleted: ${root}`);
        }
      }
      log("SUCCESS", "Theme cache cleaned.");
      return { ok: true, message: "Cache cleaned." };
    },

    restartAdb: async (): Promise<OperationResult> => {
      log("INFO", "Restarting ADB server...");
      progress({ operation: "adb", percent: 10 });
      const kill = await runAdb(context, ["kill-server"]);
      progress({ operation: "adb", percent: 50 });
      const start = await runAdb(context, ["start-server"]);
      progress({ operation: "adb", percent: 100 });
      if (kill.code !== 0 || start.code !== 0) {
        const message = start.stderr || kill.stderr || "ADB restart failed.";
        log("ERROR", message);
        return { ok: false, message };
      }
      log("SUCCESS", "ADB server restarted.");
      return { ok: true, message: "ADB restarted." };
    },

    copyPackage: async (): Promise<OperationResult> => {
      log("INFO", "Reading current foreground package...");
      const result = await runAdb(context, ["shell", "dumpsys", "window"], 30000);
      if (result.code !== 0) {
        const message = result.stderr || "Failed to read foreground app.";
        log("ERROR", message);
        return { ok: false, message };
      }
      const packageName = parseCurrentPackage(result.stdout);
      if (!packageName) {
        log("WARN", "No foreground package found.");
        return { ok: false, message: "Could not parse foreground package name." };
      }
      return { ok: true, message: "Package name copied.", data: packageName };
    },

    convertMaml: (xml: string): OperationResult => {
      const data = convertXmlToMaml(xml);
      log("SUCCESS", "XML converted to MAML code.");
      return { ok: true, message: "Conversion completed.", data };
    },

    copyPackageMaml: async (): Promise<OperationResult> => {
      log("INFO", "Reading current foreground activity for MAML code...");
      const result = await runAdb(context, ["shell", "dumpsys", "window"], 30000);
      if (result.code !== 0) {
        const message = result.stderr || "Failed to read foreground app.";
        log("ERROR", message);
        return { ok: false, message };
      }
      const activity = parseCurrentActivity(result.stdout);
      if (!activity?.packageName) {
        log("WARN", "No foreground activity found.");
        return { ok: false, message: "Could not parse foreground package and class name." };
      }
      const data = currentActivityToMaml(activity);
      log("SUCCESS", `Copied MAML activity code for: ${activity.packageName}/${activity.className}`);
      return { ok: true, message: "MAML activity code copied.", data };
    }
  };
}
