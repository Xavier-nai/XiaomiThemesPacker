import { normalizeThemeResourcePath } from "./path";
import type { ThemeModel, ThemeModelResourceReader, ThemeModule } from "./model";

function isImageResource(filePath: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(filePath);
}

function groupModules(files: string[]): ThemeModule[] {
  const grouped = new Map<string, string[]>();
  for (const file of files) {
    const [moduleName] = file.split("/");
    if (!moduleName || moduleName === file) continue;
    const items = grouped.get(moduleName) || [];
    items.push(file);
    grouped.set(moduleName, items);
  }
  return [...grouped.entries()].map(([name, moduleFiles]) => ({ name, files: moduleFiles }));
}

export async function parseThemeModel(resolver: ThemeModelResourceReader): Promise<ThemeModel> {
  const files = resolver.listResources().map(normalizeThemeResourcePath).sort((left, right) => left.localeCompare(right));
  const lowerToName = new Map(files.map((name) => [name.toLowerCase(), name]));
  const descriptionPath = lowerToName.get("description.xml");
  const descriptionXml = descriptionPath ? (await resolver.getResource(descriptionPath)).toString("utf8") : undefined;

  return {
    source: {
      type: resolver.type,
      path: resolver.sourcePath
    },
    manifest: {
      descriptionXml,
      lockscreenManifests: files.filter((name) => /^lockscreen\/(?:advance\/)?manifest\.xml$/i.test(name))
    },
    resources: {
      icons: files.filter((name) => /^icons\//i.test(name) && isImageResource(name)),
      wallpapers: files.filter((name) => /(^wallpaper\/|\/wallpaper|\/background|\/bg)/i.test(name) && isImageResource(name)),
      all: files
    },
    modules: groupModules(files)
  };
}
