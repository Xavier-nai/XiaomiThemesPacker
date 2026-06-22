import type { DeviceStatus, LogLevel, ProgressPayload } from "../../types";
import type { ThemeModel, ThemeSourceType } from "../core";

export type DeviceInfo = DeviceStatus;

export interface ThemeEngineContext {
  resourcesPath: string;
  appPath: string;
  cwd: string;
  userDataPath: string;
  cacheRoots: string[];
}

export interface ThemeEngineCallbacks {
  onLog?: (level: LogLevel, message: string) => void;
  onProgress?: (payload: ProgressPayload) => void;
  onDeviceStatus?: (status: DeviceStatus) => void;
}

export interface ThemeSourceInput {
  type: ThemeSourceType;
  path: string;
}

export interface PackInput {
  sourceDir: string;
  outputPath: string;
}

export interface PackResult {
  success: boolean;
  outputPath: string;
  duration: number;
  warnings: string[];
}

export interface UnpackInput {
  mtzPath: string;
  outputRoot: string;
}

export interface UnpackResult {
  success: boolean;
  outputPath: string;
  files: string[];
  warnings: string[];
}

export interface DeployInput {
  mtzPath: string;
}

export interface DeployResult {
  success: boolean;
  device: DeviceInfo;
  status: string;
}

export interface ParseThemeModelInput {
  source: ThemeSourceInput;
}

export interface ThemeEngineAPI {
  pack(input: PackInput): Promise<PackResult>;
  unpack(input: UnpackInput): Promise<UnpackResult>;
  deploy(input: DeployInput): Promise<DeployResult>;
  parseThemeModel?(input: ParseThemeModelInput): Promise<ThemeModel>;
}
