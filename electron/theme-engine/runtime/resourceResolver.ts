import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { unzipSync } from "fflate";

export type ThemeResourceType = "folder" | "mtz";

export interface ThemeResourceResolver {
  type: ThemeResourceType;
  sourcePath: string;
  listResources(): string[];
  getResource(resourcePath: string): Promise<Buffer>;
  streamResource(resourcePath: string): NodeJS.ReadableStream;
  hasResource(resourcePath: string): boolean;
}

const ignoredDirectories = new Set([".git", ".svn", "__pycache__", ".DS_Store", "cache", "temp"]);

export function normalizeResourcePath(input: string) {
  return input.replace(/\\/g, "/").replace(/^\/+/, "");
}

function walkFileNames(root: string) {
  const files: string[] = [];

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(normalizeResourcePath(path.relative(root, fullPath)));
      }
    }
  }

  walk(root);
  return files;
}

function resolveFolderPath(root: string, resourcePath: string) {
  const normalized = normalizeResourcePath(resourcePath);
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(root, ...normalized.split("/"));
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Unsafe resource path: ${resourcePath}`);
  }
  return target;
}

function isZipBuffer(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  const signature = [bytes[0], bytes[1], bytes[2], bytes[3]].map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join("");
  return signature === "504B0304" || signature === "504B0506" || signature === "504B0708";
}

function listZipEntries(bytes: Uint8Array) {
  const names: string[] = [];
  unzipSync(bytes, {
    filter: (file) => {
      const normalized = normalizeResourcePath(file.name);
      if (normalized) names.push(normalized);
      return false;
    }
  });
  return names;
}

function readZipEntry(bytes: Uint8Array, entryPath: string) {
  const normalized = normalizeResourcePath(entryPath);
  const entries = unzipSync(bytes, {
    filter: (file) => normalizeResourcePath(file.name) === normalized
  });
  const found = Object.entries(entries).find(([name]) => normalizeResourcePath(name) === normalized);
  return found?.[1];
}

function listMtzResources(mtzBytes: Uint8Array) {
  const files = new Set<string>();
  const topLevelEntries = listZipEntries(mtzBytes);

  for (const name of topLevelEntries) {
    files.add(name);

    const isTopLevelModule = !name.includes("/") && name.toLowerCase() !== "description.xml";
    if (!isTopLevelModule) continue;

    const moduleBytes = readZipEntry(mtzBytes, name);
    if (!moduleBytes || !isZipBuffer(moduleBytes)) continue;

    try {
      for (const moduleEntry of listZipEntries(moduleBytes)) {
        files.add(normalizeResourcePath(`${name.replace(/\.zip$/i, "")}/${moduleEntry}`));
      }
    } catch {
      // Top-level MTZ entries may be raw binary resources.
    }
  }

  return [...files];
}

function readMtzResource(mtzBytes: Uint8Array, resourcePath: string) {
  const normalized = normalizeResourcePath(resourcePath);
  const direct = readZipEntry(mtzBytes, normalized);
  if (direct) return direct;

  const [moduleName, ...rest] = normalized.split("/");
  if (!moduleName || rest.length === 0) return undefined;

  const moduleCandidates = [moduleName, `${moduleName}.zip`];
  for (const candidate of moduleCandidates) {
    const moduleBytes = readZipEntry(mtzBytes, candidate);
    if (!moduleBytes || !isZipBuffer(moduleBytes)) continue;
    const nested = readZipEntry(moduleBytes, rest.join("/"));
    if (nested) return nested;
  }

  return undefined;
}

export function createFolderResourceResolver(sourceDir: string): ThemeResourceResolver {
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    throw new Error("Theme folder does not exist.");
  }

  const files = walkFileNames(sourceDir);
  const fileSet = new Set(files);

  return {
    type: "folder",
    sourcePath: sourceDir,
    listResources: () => [...files],
    hasResource: (resourcePath) => fileSet.has(normalizeResourcePath(resourcePath)),
    getResource: async (resourcePath) => fs.promises.readFile(resolveFolderPath(sourceDir, resourcePath)),
    streamResource: (resourcePath) => fs.createReadStream(resolveFolderPath(sourceDir, resourcePath))
  };
}

export function createMtzResourceResolver(mtzPath: string): ThemeResourceResolver {
  if (!mtzPath || !fs.existsSync(mtzPath)) {
    throw new Error("MTZ file does not exist.");
  }

  const mtzBytes = new Uint8Array(fs.readFileSync(mtzPath));
  const files = listMtzResources(mtzBytes);
  const fileSet = new Set(files);

  return {
    type: "mtz",
    sourcePath: mtzPath,
    listResources: () => [...files],
    hasResource: (resourcePath) => fileSet.has(normalizeResourcePath(resourcePath)),
    getResource: async (resourcePath) => {
      const bytes = readMtzResource(mtzBytes, resourcePath);
      if (!bytes) throw new Error(`Resource not found: ${resourcePath}`);
      return Buffer.from(bytes);
    },
    streamResource: (resourcePath) => {
      const bytes = readMtzResource(mtzBytes, resourcePath);
      if (!bytes) throw new Error(`Resource not found: ${resourcePath}`);
      return Readable.from(Buffer.from(bytes));
    }
  };
}

export function createResourceResolver(type: ThemeResourceType, sourcePath: string) {
  return type === "folder" ? createFolderResourceResolver(sourcePath) : createMtzResourceResolver(sourcePath);
}
