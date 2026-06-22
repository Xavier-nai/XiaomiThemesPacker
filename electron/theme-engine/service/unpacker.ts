import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

function getSafeOutputPath(outputDir: string, entryName: string) {
  const resolvedOutput = path.resolve(outputDir);
  const normalized = path.normalize(entryName);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;

  const target = path.resolve(outputDir, normalized);
  if (target !== resolvedOutput && !target.startsWith(resolvedOutput + path.sep)) return null;
  return target;
}

export function unpackMtz(mtzPath: string, outputRoot: string, onProgress?: (percent: number) => void) {
  if (!mtzPath || !fs.existsSync(mtzPath)) {
    throw new Error("Select a valid MTZ file.");
  }

  const outputDir = path.join(outputRoot, path.basename(mtzPath, path.extname(mtzPath)));
  fs.mkdirSync(outputDir, { recursive: true });

  const entries = unzipSync(fs.readFileSync(mtzPath));
  const names = Object.keys(entries);
  const total = Math.max(names.length, 1);

  names.forEach((name, index) => {
    const target = getSafeOutputPath(outputDir, name);
    if (!target) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entries[name]);
    onProgress?.(Math.min(98, Math.round(((index + 1) / total) * 98)));
  });

  return outputDir;
}

