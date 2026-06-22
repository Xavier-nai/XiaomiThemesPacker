import fs from "node:fs";
import { runAdb, type AdbContext } from "./adb";

function parseSemanticVersion(value: string) {
  const match = value.match(/\d+(?:\.\d+){0,2}/);
  if (!match) return null;
  return match[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function compareSemanticVersion(left: number[] | null, right: number[]) {
  if (!left) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] || 0;
    const rightPart = right[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

async function getAdbShellValue(context: AdbContext, args: string[], timeoutMs = 10000) {
  const result = await runAdb(context, args, timeoutMs);
  if (result.code !== 0) return "";
  return result.stdout.trim();
}

async function getAndroidVersionName(context: AdbContext) {
  const release = await getAdbShellValue(context, ["shell", "getprop", "ro.build.version.release"]);
  if (release) return release;
  const sdk = Number.parseInt(await getAdbShellValue(context, ["shell", "getprop", "ro.build.version.sdk"]), 10);
  if (!Number.isFinite(sdk)) return "";
  if (sdk >= 35) return "15.0.0";
  if (sdk >= 34) return "14.0.0";
  if (sdk >= 33) return "13.0.0";
  return `${sdk}`;
}

async function getOsVersionName(context: AdbContext) {
  return getAdbShellValue(context, ["shell", "getprop", "ro.mi.os.version.name"]);
}

function applyThemeArgs(remotePath: string, ver2Step?: "ver2_step_init" | "ver2_step_apply") {
  const args = [
    "shell",
    "am",
    "start",
    "-n",
    "com.android.thememanager/com.android.thememanager.ApplyThemeForScreenshot",
    "-e",
    "theme_file_path",
    remotePath,
    "-e",
    "api_called_from",
    "ThemeEditor"
  ];
  if (ver2Step) args.push("-e", "ver2_step", ver2Step);
  return args;
}

export async function deployTheme(context: AdbContext, targetPath: string) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return { ok: false, remote: undefined, message: "Select a valid MTZ file." };
  }

  const devices = await runAdb(context, ["devices", "-l"]);
  if (devices.code !== 0 || !/\bdevice\b/.test(devices.stdout.split(/\r?\n/).slice(1).join("\n"))) {
    return { ok: false, remote: undefined, message: "No connected ADB device found." };
  }

  const androidVersion = parseSemanticVersion(await getAndroidVersionName(context));
  const osVersionName = await getOsVersionName(context);
  const needsThemeStoreFlow = compareSemanticVersion(androidVersion, [13, 0, 0]) >= 0;
  const needsOs2Path = compareSemanticVersion(androidVersion, [15, 0, 0]) >= 0 || osVersionName.toUpperCase().startsWith("OS2");
  const remote = needsThemeStoreFlow
    ? needsOs2Path
      ? "/sdcard/Android/data/com.android.thememanager/files/temp.mtz"
      : "/sdcard/Download/auto/temp.mtz"
    : "/sdcard/temp.mtz";

  if (needsThemeStoreFlow) {
    if (!needsOs2Path) {
      await runAdb(context, ["shell", "rm", "-rf", remote], 30000);
      const init = await runAdb(context, applyThemeArgs(remote, "ver2_step_init"), 30000);
      if (init.code !== 0) return { ok: false, remote, message: init.stderr || init.stdout || "Theme manager init failed." };
    } else {
      await runAdb(context, ["shell", "mkdir", "-p", "/sdcard/Android/data/com.android.thememanager/files"], 30000);
    }
  }

  const push = await runAdb(context, ["push", targetPath, remote], 120000);
  if (push.code !== 0) return { ok: false, remote, message: push.stderr || push.stdout || "ADB push failed." };

  const apply = await runAdb(context, applyThemeArgs(remote, needsThemeStoreFlow ? "ver2_step_apply" : undefined), 30000);
  if (apply.code !== 0) return { ok: false, remote, message: apply.stderr || apply.stdout || "Theme manager apply failed." };

  return { ok: true, remote, message: apply.stdout || push.stdout };
}

