import type { UpdateInfo } from "./types";

export interface GitHubReleaseResponse {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
}

export interface GitHubUpdateServiceOptions {
  owner: string;
  repo: string;
  timeoutMs?: number;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "").split(/[+-]/)[0];
}

export function compareVersions(left: string, right: string) {
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

function isHttpUrl(value?: string): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function createGitHubUpdateService(options: GitHubUpdateServiceOptions) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const latestReleaseUrl = `https://api.github.com/repos/${options.owner}/${options.repo}/releases/latest`;

  return {
    async check(currentVersion: string): Promise<UpdateInfo> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(latestReleaseUrl, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            accept: "application/vnd.github+json",
            "user-agent": "Xiaomi-Theme-Packer"
          }
        });

        if (!response.ok) {
          return {
            currentVersion,
            available: false,
            message: `Update check failed: HTTP ${response.status}.`
          };
        }

        const release = (await response.json()) as GitHubReleaseResponse;
        const latestVersion = String(release.tag_name || "").trim();

        if (!latestVersion) {
          return {
            currentVersion,
            available: false,
            message: "Update check failed: release tag_name is missing."
          };
        }

        const available = compareVersions(latestVersion, currentVersion) > 0;

        return {
          currentVersion,
          latestVersion: normalizeVersion(latestVersion),
          available,
          message: available ? `New version ${normalizeVersion(latestVersion)} is available.` : "Already on the latest version.",
          releaseName: typeof release.name === "string" ? release.name : undefined,
          releaseUrl: isHttpUrl(release.html_url) ? release.html_url : undefined,
          notes: typeof release.body === "string" ? release.body : undefined
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
  };
}
