export function normalizeThemeResourcePath(input: string) {
  return input.replace(/\\/g, "/").replace(/^\/+/, "");
}
