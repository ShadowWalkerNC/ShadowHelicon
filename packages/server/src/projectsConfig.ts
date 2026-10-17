import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { HeliconStore } from "@helicon/daemon";

export interface ProjectConfigEntry {
  name: string;
  path: string;
  category: string;
  private: boolean;
}

export interface ProjectsConfigFile {
  devRoot?: string;
  projects: ProjectConfigEntry[];
}

export const DEFAULT_DEV_ROOT = "C:\\Users\\white\\OneDrive\\Documents\\GitHub";

export function findProjectsConfigFile(customPath?: string): string | null {
  const currentDir = typeof __dirname !== "undefined" ? __dirname : ".";
  const candidates = [
    customPath,
    join(process.cwd(), "projects.config.json"),
    resolve(process.cwd(), "../../projects.config.json"),
    resolve(currentDir, "../../../../projects.config.json"),
    resolve(currentDir, "../../../projects.config.json"),
    resolve(currentDir, "../../projects.config.json"),
    join(homedir(), ".helicon", "projects.config.json"),
  ].filter((p): p is string => Boolean(p && existsSync(p)));

  return candidates[0] ?? null;
}

export function loadProjectsConfig(configPath?: string): ProjectsConfigFile | null {
  const file = findProjectsConfigFile(configPath);
  if (!file) return null;
  try {
    const raw = readFileSync(file, "utf8");
    return JSON.parse(raw) as ProjectsConfigFile;
  } catch {
    return null;
  }
}

export function resolveProjectPath(entry: ProjectConfigEntry, devRoot = DEFAULT_DEV_ROOT): string {
  if (isAbsolute(entry.path) && existsSync(entry.path)) {
    return entry.path;
  }

  const primary = join(devRoot, entry.path);
  if (existsSync(primary)) {
    return primary;
  }

  // Fallbacks on white user profile
  const docsFallback = join("C:\\Users\\white\\Documents\\GitHub", entry.path);
  if (existsSync(docsFallback)) {
    return docsFallback;
  }

  const desktopFallback = join("C:\\Users\\white\\Desktop", entry.path);
  if (existsSync(desktopFallback)) {
    return desktopFallback;
  }

  return primary;
}

export function syncProjectsFromConfig(store: HeliconStore, configPath?: string): number {
  const config = loadProjectsConfig(configPath);
  if (!config || !Array.isArray(config.projects)) return 0;

  const devRoot = config.devRoot || DEFAULT_DEV_ROOT;
  let synced = 0;

  for (const entry of config.projects) {
    if (!entry.name || !entry.path) continue;
    const resolvedPath = resolveProjectPath(entry, devRoot);
    store.upsertProject(resolvedPath, {
      displayName: entry.name,
      category: entry.category,
      isPrivate: entry.private === true,
    });
    synced += 1;
  }

  return synced;
}
