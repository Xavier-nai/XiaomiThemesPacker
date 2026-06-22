export type ThemeSourceType = "folder" | "mtz";

export interface ThemeModelResourceReader {
  type: ThemeSourceType;
  sourcePath: string;
  listResources(): string[];
  getResource(resourcePath: string): Promise<Buffer>;
}

export interface ThemeManifest {
  descriptionXml?: string;
  lockscreenManifests: string[];
}

export interface ThemeResources {
  icons: string[];
  wallpapers: string[];
  all: string[];
}

export interface ThemeModule {
  name: string;
  files: string[];
}

export interface ThemeModel {
  source: {
    type: ThemeSourceType;
    path: string;
  };
  manifest: ThemeManifest;
  resources: ThemeResources;
  modules: ThemeModule[];
}
