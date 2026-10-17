import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findBotsDir } from "./bots.js";

export interface ScoutReport {
  name: string;
  date: string;
  content: string;
}

export interface ScoutData {
  catalog: string;
  monitorLog: string;
  reports: ScoutReport[];
}

export function getScoutData(): ScoutData {
  const botsDir = findBotsDir();
  const scoutWs = join(botsDir, "api-scout", "workspace");

  const catalogPath = join(scoutWs, "catalog", "catalog.md");
  const catalog = existsSync(catalogPath) ? readFileSync(catalogPath, "utf8") : "# Ecosystem API Catalog\n\nNo catalog generated yet.\n";

  const monitorPath = join(scoutWs, "monitor-log.md");
  const monitorLog = existsSync(monitorPath) ? readFileSync(monitorPath, "utf8") : "# API Scout Monitor Log\n\nNo logs recorded.\n";

  const reportsDir = join(scoutWs, "reports");
  const reports: ScoutReport[] = [];
  if (existsSync(reportsDir)) {
    const files = readdirSync(reportsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      try {
        const content = readFileSync(join(reportsDir, file), "utf8");
        reports.push({
          name: file,
          date: file.replace(/^(report-)?/, "").replace(/\.md$/, ""),
          content,
        });
      } catch {}
    }
  }

  return {
    catalog,
    monitorLog,
    reports: reports.sort((a, b) => b.name.localeCompare(a.name)),
  };
}
