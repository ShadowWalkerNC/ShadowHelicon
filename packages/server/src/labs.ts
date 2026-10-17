import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export interface LabExperiment {
  id: string;
  lifecycle: string;
  simulation: boolean;
  executionStatus: string;
  decision: string;
  title?: string;
  hypothesis?: string;
  results?: string;
  decisionText?: string;
  benchmarks?: Record<string, unknown> | null;
  files: Record<string, string>;
}

export function findLabsDir(): string {
  const currentDir = typeof __dirname !== "undefined" ? __dirname : ".";
  const candidates = [
    join(process.cwd(), "labs"),
    resolve(currentDir, "../../../labs"),
    resolve(currentDir, "../../labs"),
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

export function listExperiments(): LabExperiment[] {
  const labsDir = findLabsDir();
  const expDir = join(labsDir, "experiments");
  if (!existsSync(expDir)) return [];

  const registryFile = join(expDir, "registry.json");
  let registryEntries: Array<Record<string, unknown>> = [];
  if (existsSync(registryFile)) {
    try {
      const reg = JSON.parse(readFileSync(registryFile, "utf8")) as { experiments?: Array<Record<string, unknown>> };
      if (Array.isArray(reg.experiments)) {
        registryEntries = reg.experiments;
      }
    } catch {
      // fallback
    }
  }

  const dirs = readdirSync(expDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("MUSE-"))
    .map((d) => d.name);

  const results: LabExperiment[] = [];

  for (const dirName of dirs) {
    const regEntry = registryEntries.find((e) => e["id"] === dirName);
    const itemDir = join(expDir, dirName);

    const readSafe = (file: string) => {
      const p = join(itemDir, file);
      return existsSync(p) ? readFileSync(p, "utf8") : "";
    };

    let benchmarks: Record<string, unknown> | null = null;
    const bmFile = join(itemDir, "benchmarks.json");
    if (existsSync(bmFile)) {
      try {
        benchmarks = JSON.parse(readFileSync(bmFile, "utf8")) as Record<string, unknown>;
      } catch {
        // ignore
      }
    }

    results.push({
      id: dirName,
      lifecycle: String(regEntry?.["lifecycle"] ?? "EXPERIMENT"),
      simulation: Boolean(regEntry?.["simulation"] ?? false),
      executionStatus: String(regEntry?.["executionStatus"] ?? benchmarks?.["runStatus"] ?? "NOT RUN"),
      decision: String(regEntry?.["decision"] ?? benchmarks?.["codingCapabilityDecision"] ?? "INCONCLUSIVE"),
      hypothesis: readSafe("hypothesis.md"),
      results: readSafe("results.md"),
      decisionText: readSafe("decision.md"),
      benchmarks,
      files: {
        hypothesis: `labs/experiments/${dirName}/hypothesis.md`,
        implementation: `labs/experiments/${dirName}/harness.mjs`,
        results: `labs/experiments/${dirName}/results.md`,
        decision: `labs/experiments/${dirName}/decision.md`,
      },
    });
  }

  return results;
}

export function createExperiment(id: string, title: string, hypothesis: string): LabExperiment {
  const labsDir = findLabsDir();
  const expDir = join(labsDir, "experiments");
  const targetDir = join(expDir, id);
  mkdirSync(targetDir, { recursive: true });

  const templateFile = join(expDir, "EXPERIMENT.template.md");
  const template = existsSync(templateFile)
    ? readFileSync(templateFile, "utf8")
    : "# " + id + " - " + title + "\nLifecycle: IDEA\nExecution: NOT RUN\n";

  writeFileSync(
    join(targetDir, "hypothesis.md"),
    `# ${id} hypothesis: ${title}\n\n${hypothesis || "Bounded hypothesis statement."}\n`,
  );
  writeFileSync(join(targetDir, "results.md"), `# ${id} results\n\nExecution: NOT RUN\n`);
  writeFileSync(join(targetDir, "decision.md"), `# ${id} decision\n\nINCONCLUSIVE\n`);
  writeFileSync(
    join(targetDir, "benchmarks.json"),
    JSON.stringify(
      {
        experimentId: id,
        title,
        runStatus: "NOT RUN",
        codingCapabilityDecision: "INCONCLUSIVE",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  // Update registry.json if present
  const regFile = join(expDir, "registry.json");
  if (existsSync(regFile)) {
    try {
      const reg = JSON.parse(readFileSync(regFile, "utf8")) as { schemaVersion: number; experiments: Array<Record<string, unknown>> };
      reg.experiments.push({
        id,
        lifecycle: "IDEA",
        simulation: false,
        executionStatus: "NOT RUN",
        decision: "INCONCLUSIVE",
        files: {
          hypothesis: `experiments/${id}/hypothesis.md`,
          implementation: `experiments/${id}/harness.mjs`,
          results: `experiments/${id}/results.md`,
          decision: `experiments/${id}/decision.md`,
        },
      });
      writeFileSync(regFile, JSON.stringify(reg, null, 2));
    } catch {
      // ignore
    }
  }

  return {
    id,
    lifecycle: "IDEA",
    simulation: false,
    executionStatus: "NOT RUN",
    decision: "INCONCLUSIVE",
    title,
    hypothesis,
    results: "Execution: NOT RUN",
    decisionText: "INCONCLUSIVE",
    benchmarks: { runStatus: "NOT RUN" },
    files: {},
  };
}

export interface RunHarnessResult {
  experimentId: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  passed: boolean;
  durationMs: number;
}

export async function runExperimentHarness(experimentId: string): Promise<RunHarnessResult> {
  const labsDir = findLabsDir();
  const expDir = join(labsDir, "experiments", experimentId);
  if (!existsSync(expDir)) {
    throw new Error(`Experiment ${experimentId} not found.`);
  }

  // Determine test file or harness to run
  let targetScript = join(expDir, "harness-safety.test.mjs");
  if (!existsSync(targetScript)) {
    targetScript = join(expDir, "harness.mjs");
  }
  if (!existsSync(targetScript)) {
    // If there's an implementation or test file
    const tests = readdirSync(expDir).filter((f) => f.endsWith(".test.mjs") || f.endsWith(".mjs"));
    if (tests.length > 0) {
      targetScript = join(expDir, tests[0] as string);
    } else {
      throw new Error(`No harness or test runner found in ${experimentId}.`);
    }
  }

  const start = Date.now();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(process.execPath, [targetScript], {
      cwd: expDir,
      env: { ...process.env },
    });

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      const passed = code === 0;

      // Update results.md and benchmarks.json
      const resultsPath = join(expDir, "results.md");
      const resultText = [
        `# ${experimentId} results`,
        `Last Run: ${new Date().toISOString()}`,
        `Status: ${passed ? "PASS" : "FAIL"} (Exit code: ${code})`,
        `Duration: ${durationMs}ms`,
        "",
        "## Output",
        "```",
        stdout.trim() || stderr.trim(),
        "```",
      ].join("\n");
      writeFileSync(resultsPath, resultText);

      const bmPath = join(expDir, "benchmarks.json");
      let bm: Record<string, unknown> = {};
      if (existsSync(bmPath)) {
        try {
          bm = JSON.parse(readFileSync(bmPath, "utf8")) as Record<string, unknown>;
        } catch {}
      }
      bm["runStatus"] = passed ? "PASS" : "FAIL";
      bm["wallClockSeconds"] = durationMs / 1000;
      bm["lastRun"] = new Date().toISOString();
      writeFileSync(bmPath, JSON.stringify(bm, null, 2));

      resolve({
        experimentId,
        exitCode: code,
        stdout,
        stderr,
        passed,
        durationMs,
      });
    });

    child.on("error", (err) => {
      resolve({
        experimentId,
        exitCode: 1,
        stdout,
        stderr: String(err),
        passed: false,
        durationMs: Date.now() - start,
      });
    });
  });
}
