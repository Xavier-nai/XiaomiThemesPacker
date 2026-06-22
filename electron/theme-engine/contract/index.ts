import path from "node:path";
import { createThemeEngine } from "../service";
import type { OperationResult } from "../../types";
import type {
  DeployInput,
  DeployResult,
  PackInput,
  PackResult,
  ParseThemeModelInput,
  ThemeEngineCallbacks,
  ThemeEngineAPI,
  ThemeEngineContext,
  UnpackInput,
  UnpackResult
} from "./types";

export type {
  DeployInput,
  DeployResult,
  DeviceInfo,
  PackInput,
  PackResult,
  ParseThemeModelInput,
  ThemeEngineCallbacks,
  ThemeEngineAPI,
  ThemeEngineContext,
  ThemeSourceInput,
  UnpackInput,
  UnpackResult
} from "./types";

export interface ThemeEngineHostAPI extends ThemeEngineAPI {
  getDeviceStatus: ReturnType<typeof createThemeEngine>["getDeviceStatus"];
  startDeviceStatusWatcher: ReturnType<typeof createThemeEngine>["startDeviceStatusWatcher"];
  stopDeviceStatusWatcher: ReturnType<typeof createThemeEngine>["stopDeviceStatusWatcher"];
  cleanupCache: ReturnType<typeof createThemeEngine>["cleanupCache"];
  restartAdb: ReturnType<typeof createThemeEngine>["restartAdb"];
  copyPackage: ReturnType<typeof createThemeEngine>["copyPackage"];
  convertMaml: ReturnType<typeof createThemeEngine>["convertMaml"];
  copyPackageMaml: ReturnType<typeof createThemeEngine>["copyPackageMaml"];
}

function toPackResult(result: OperationResult, outputPath: string, startedAt: number): PackResult {
  return {
    success: result.ok,
    outputPath: result.path || outputPath,
    duration: Date.now() - startedAt,
    warnings: result.ok ? [] : [result.message]
  };
}

export function createThemeEngineAPI(context: ThemeEngineContext, callbacks: ThemeEngineCallbacks = {}): ThemeEngineHostAPI {
  const service = createThemeEngine(context, callbacks);

  return {
    pack: async (input: PackInput): Promise<PackResult> => {
      const startedAt = Date.now();
      return toPackResult(service.pack(input.sourceDir, input.outputPath), input.outputPath, startedAt);
    },

    unpack: async (input: UnpackInput): Promise<UnpackResult> => {
      const result = service.unpack(input.mtzPath, input.outputRoot);
      const outputDir = result.path || path.join(input.outputRoot, path.basename(input.mtzPath, path.extname(input.mtzPath)));
      return {
        success: result.ok,
        outputPath: outputDir,
        files: result.ok ? service.listFolderFiles(outputDir) : [],
        warnings: result.ok ? [] : [result.message]
      };
    },

    deploy: async (input: DeployInput): Promise<DeployResult> => {
      const device = await service.getDeviceStatus();
      const result = await service.deploy(input.mtzPath);
      return {
        success: result.ok,
        device,
        status: result.ok ? result.path || result.message : result.message
      };
    },

    parseThemeModel: async (input: ParseThemeModelInput) => {
      return input.source.type === "folder"
        ? service.parseFolderTheme(input.source.path)
        : service.parseMtzTheme(input.source.path);
    },

    getDeviceStatus: service.getDeviceStatus,
    startDeviceStatusWatcher: service.startDeviceStatusWatcher,
    stopDeviceStatusWatcher: service.stopDeviceStatusWatcher,
    cleanupCache: service.cleanupCache,
    restartAdb: service.restartAdb,
    copyPackage: service.copyPackage,
    convertMaml: service.convertMaml,
    copyPackageMaml: service.copyPackageMaml
  };
}
