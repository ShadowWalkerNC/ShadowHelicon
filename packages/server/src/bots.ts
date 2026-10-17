import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export interface BotConfig {
  name: string;
  displayName: string;
  avatar?: string;
  description: string;
  enabled: boolean;
  schedule?: string;
  tools: string[];
}

export interface BotView {
  config: BotConfig;
  agentsMd: string;
  soulMd: string;
  memoryMd: string;
  workspacePath: string;
  runs: string[];
  workspaceFiles: string[];
}

export function findBotsDir(): string {
  const currentDir = typeof __dirname !== "undefined" ? __dirname : ".";
  const candidates = [
    join(process.cwd(), "bots"),
    resolve(currentDir, "../../../bots"),
    resolve(currentDir, "../../bots"),
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

export function listBots(): BotConfig[] {
  const botsDir = findBotsDir();
  if (!existsSync(botsDir)) return [];

  const dirs = readdirSync(botsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const configs: BotConfig[] = [];
  for (const name of dirs) {
    const jsonFile = join(botsDir, name, "bot.json");
    if (existsSync(jsonFile)) {
      try {
        const raw = readFileSync(jsonFile, "utf8");
        const parsed = JSON.parse(raw) as BotConfig;
        configs.push(parsed);
      } catch {
        // ignore broken json
      }
    }
  }
  return configs;
}

export function getBot(name: string): BotView | null {
  const botsDir = findBotsDir();
  const botDir = join(botsDir, name);
  const jsonFile = join(botDir, "bot.json");
  if (!existsSync(jsonFile)) return null;

  let config: BotConfig;
  try {
    config = JSON.parse(readFileSync(jsonFile, "utf8")) as BotConfig;
  } catch {
    return null;
  }

  const readSafe = (file: string) => {
    const p = join(botDir, file);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  };

  const wsDir = join(botDir, "workspace");
  const workspaceFiles = existsSync(wsDir)
    ? readdirSync(wsDir, { recursive: true }).map((f) => String(f))
    : [];

  const runsDir = join(botDir, "runs");
  const runs = existsSync(runsDir)
    ? readdirSync(runsDir).filter((f) => f.endsWith(".json") || f.endsWith(".txt") || f.endsWith(".md"))
    : [];

  return {
    config,
    agentsMd: readSafe("AGENTS.md"),
    soulMd: readSafe("SOUL.md"),
    memoryMd: readSafe("MEMORY.md"),
    workspacePath: wsDir,
    runs,
    workspaceFiles,
  };
}

export function saveBot(
  name: string,
  data: {
    config?: Partial<BotConfig>;
    agentsMd?: string;
    soulMd?: string;
    memoryMd?: string;
  },
): BotView {
  const botsDir = findBotsDir();
  const botDir = join(botsDir, name);
  mkdirSync(botDir, { recursive: true });
  mkdirSync(join(botDir, "workspace"), { recursive: true });
  mkdirSync(join(botDir, "memory"), { recursive: true });
  mkdirSync(join(botDir, "runs"), { recursive: true });

  const jsonFile = join(botDir, "bot.json");
  let currentConfig: BotConfig = {
    name,
    displayName: name,
    avatar: "🤖",
    description: "",
    enabled: true,
    tools: ["read_file", "write_file", "run_command"],
  };

  if (existsSync(jsonFile)) {
    try {
      currentConfig = { ...currentConfig, ...JSON.parse(readFileSync(jsonFile, "utf8")) };
    } catch {}
  }

  if (data.config) {
    currentConfig = { ...currentConfig, ...data.config, name };
  }
  writeFileSync(jsonFile, JSON.stringify(currentConfig, null, 2));

  if (data.agentsMd !== undefined) {
    writeFileSync(join(botDir, "AGENTS.md"), data.agentsMd);
  } else if (!existsSync(join(botDir, "AGENTS.md"))) {
    writeFileSync(join(botDir, "AGENTS.md"), `# ${name} Instructions\n\nDirectives for this bot.\n`);
  }

  if (data.soulMd !== undefined) {
    writeFileSync(join(botDir, "SOUL.md"), data.soulMd);
  } else if (!existsSync(join(botDir, "SOUL.md"))) {
    writeFileSync(join(botDir, "SOUL.md"), `# ${name} Soul\n\nIdentity and behavioral guidelines.\n`);
  }

  if (data.memoryMd !== undefined) {
    writeFileSync(join(botDir, "MEMORY.md"), data.memoryMd);
  } else if (!existsSync(join(botDir, "MEMORY.md"))) {
    writeFileSync(join(botDir, "MEMORY.md"), `# ${name} Memory\n\nContext and knowledge.\n`);
  }

  return getBot(name) as BotView;
}

export function deleteBot(name: string): boolean {
  const botsDir = findBotsDir();
  const botDir = join(botsDir, name);
  if (!existsSync(botDir)) return false;
  rmSync(botDir, { recursive: true, force: true });
  return true;
}

export function recordBotRun(name: string, runData: Record<string, unknown>): string {
  const botsDir = findBotsDir();
  const runsDir = join(botsDir, name, "runs");
  mkdirSync(runsDir, { recursive: true });
  const runId = `run-${Date.now()}`;
  writeFileSync(join(runsDir, `${runId}.json`), JSON.stringify(runData, null, 2));
  return runId;
}

