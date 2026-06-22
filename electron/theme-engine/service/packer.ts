import fs from "node:fs";
import path from "node:path";
import { zipSync, type Zippable } from "fflate";
import { normalizeResourcePath } from "../runtime";

type PackOperation = "pack" | "unpack";

const ignoredDirectories = new Set([".git", ".svn", "__pycache__", ".DS_Store", "cache", "temp"]);

function walkFiles(root: string) {
  const files: string[] = [];

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}

function addFilesToZipMap(root: string, zipRoot: string, target: Zippable, storeOnly = false) {
  for (const filePath of walkFiles(root)) {
    const relative = normalizeResourcePath(path.relative(root, filePath));
    const name = zipRoot ? `${zipRoot}/${relative}` : relative;
    const bytes = new Uint8Array(fs.readFileSync(filePath));
    target[name] = storeOnly ? [bytes, { level: 0 }] : bytes;
  }
}

function buildModuleZipBuffer(moduleDir: string) {
  const moduleEntries: Zippable = {};
  addFilesToZipMap(moduleDir, "", moduleEntries);
  return zipSync(moduleEntries, { level: 6 });
}

export function buildMtzBuffer(sourceDir: string, operation: PackOperation = "pack", onProgress?: (percent: number) => void) {
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    throw new Error("Select a valid theme project folder.");
  }

  const mtzEntries: Zippable = {};
  const topLevelEntries = fs.readdirSync(sourceDir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
  const total = Math.max(topLevelEntries.length, 1);

  topLevelEntries.forEach((entry, index) => {
    const entryPath = path.join(sourceDir, entry.name);
    const zipName = normalizeResourcePath(entry.name);
    const lowerName = entry.name.toLowerCase();

    if (entry.isDirectory()) {
      if (lowerName === "wallpaper") {
        addFilesToZipMap(entryPath, zipName, mtzEntries, true);
      } else {
        mtzEntries[zipName] = [buildModuleZipBuffer(entryPath), { level: 0 }];
      }
    } else if (entry.isFile()) {
      const storeOnly = lowerName === "description.xml";
      const bytes = new Uint8Array(fs.readFileSync(entryPath));
      mtzEntries[zipName] = storeOnly ? [bytes, { level: 0 }] : bytes;
    }

    onProgress?.(Math.min(95, Math.round(((index + 1) / total) * 95)));
  });

  return zipSync(mtzEntries, { level: 6 });
}

export function packTheme(sourceDir: string, outputPath: string, onProgress?: (percent: number) => void) {
  const buffer = buildMtzBuffer(sourceDir, "pack", onProgress);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
