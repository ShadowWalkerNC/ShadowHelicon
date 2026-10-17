import { useEffect, useState } from "react";
import { useController } from "../app/context.js";
import { ArrowLeftIcon, PlayIcon, PlusIcon } from "../components/ui/icons.js";
import { TopBar } from "../components/chrome.js";
import { Button, Spinner, cn } from "../components/ui/primitives.js";

export interface LabExperiment {
  id: string;
  title: string;
  status: "Draft" | "Active" | "Review" | "Decision" | "Shipped" | "Archived" | "Rejected";
  hypothesis: string;
  hasHarness: boolean;
  harnessFile?: string;
  files: string[];
  resultsMd?: string;
  decisionMd?: string;
  benchmarksJson?: Record<string, unknown>;
}

export function LabsPage() {
  const controller = useController();
  const [experiments, setExperiments] = useState<LabExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string>("hypothesis.md");
  const [fileContent, setFileContent] = useState<string>("");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [harnessOutput, setHarnessOutput] = useState<{ exitCode: number; stdout: string; stderr: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newHypothesis, setNewHypothesis] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/labs/experiments");
      if (res.ok) {
        const data = await res.json();
        setExperiments(data.experiments || []);
        if (data.experiments?.length > 0 && !selectedId) {
          setSelectedId(data.experiments[0].id);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchExperiments();
  }, []);

  const selectedExp = experiments.find((e) => e.id === selectedId) || null;

  // Load selected experiment doc
  useEffect(() => {
    if (!selectedExp) {
      setFileContent("");
      return;
    }
    if (activeFile === "results.md") {
      setFileContent(selectedExp.resultsMd || "No results recorded yet.");
    } else if (activeFile === "decision.md") {
      setFileContent(selectedExp.decisionMd || "No decision recorded yet.");
    } else if (activeFile === "benchmarks.json") {
      setFileContent(
        selectedExp.benchmarksJson ? JSON.stringify(selectedExp.benchmarksJson, null, 2) : "{}",
      );
    } else {
      setFileContent(selectedExp.hypothesis || "No hypothesis defined.");
    }
  }, [selectedExp, activeFile]);

  const handleRunHarness = async (expId: string) => {
    try {
      setRunningId(expId);
      setHarnessOutput(null);
      const res = await fetch("/api/labs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentId: expId }),
      });
      const data = await res.json();
      setHarnessOutput(data);
      void fetchExperiments();
    } catch (err: unknown) {
      setHarnessOutput({
        exitCode: 1,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningId(null);
    }
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/labs/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          hypothesis: newHypothesis.trim(),
        }),
      });
      if (res.ok) {
        setIsCreating(false);
        setNewTitle("");
        setNewHypothesis("");
        await fetchExperiments();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <TopBar className="justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => controller.goBack()}
            title="Go back"
            className="flex items-center gap-1.5"
          >
            <ArrowLeftIcon size={14} /> Back
          </Button>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm text-fg">MuseLab Framework</span>
            <span className="text-xs text-muted">R&D Benchmarks & Automated Harnesses</span>
          </div>
        </div>
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5"
          >
            <PlusIcon size={14} /> New Experiment
          </Button>
        </div>
      </TopBar>

      <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-border">
        {/* Left: Experiment list */}
        <div className="w-80 flex flex-col shrink-0 bg-surface/30 overflow-y-auto">
          <div className="p-3 font-semibold text-xs tracking-wider uppercase text-muted">
            Experiments ({experiments.length})
          </div>
          {loading ? (
            <div className="p-6 flex justify-center text-muted">
              <Spinner size={18} />
            </div>
          ) : experiments.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">No experiments found.</div>
          ) : (
            <div className="space-y-1 p-2">
              {experiments.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => {
                    setSelectedId(exp.id);
                    setHarnessOutput(null);
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg text-xs transition-colors",
                    selectedId === exp.id
                      ? "bg-accent/15 border border-accent/40 text-fg"
                      : "hover:bg-white/5 text-muted hover:text-fg border border-transparent",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-3xs font-semibold text-accent">{exp.id}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-3xs font-medium uppercase",
                        exp.status === "Shipped" || exp.status === "Active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : exp.status === "Review" || exp.status === "Decision"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-neutral-800 text-neutral-400",
                      )}
                    >
                      {exp.status}
                    </span>
                  </div>
                  <div className="font-medium text-sm text-fg truncate">{exp.title}</div>
                  <div className="mt-1 text-3xs text-subtle truncate">
                    {exp.files.length} artifacts {exp.hasHarness ? "· Harness ready" : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Selected Experiment Detail & Harness Runner */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg">
          {selectedExp ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                      {selectedExp.id}
                    </span>
                    <span className="text-xs text-muted">Status:</span>
                    <span className="font-semibold text-xs text-fg">{selectedExp.status}</span>
                  </div>
                  <h1 className="text-xl font-bold text-fg tracking-tight">{selectedExp.title}</h1>
                </div>

                {selectedExp.hasHarness ? (
                  <Button
                    variant="primary"
                    disabled={runningId === selectedExp.id}
                    onClick={() => handleRunHarness(selectedExp.id)}
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    {runningId === selectedExp.id ? (
                      <>
                        <Spinner size={14} /> Running...
                      </>
                    ) : (
                      <>
                        <PlayIcon size={14} /> Run Node Harness
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-subtle italic">No runnable harness</span>
                )}
              </div>

              {/* Harness Execution Output */}
              {harnessOutput ? (
                <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-fg">Harness Output</span>
                    <span
                      className={cn(
                        "font-mono px-2 py-0.5 rounded text-3xs font-medium",
                        harnessOutput.exitCode === 0
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300",
                      )}
                    >
                      Exit Code: {harnessOutput.exitCode}
                    </span>
                  </div>
                  <pre className="font-mono text-2xs p-3 rounded bg-black/60 overflow-x-auto text-emerald-400 max-h-60 whitespace-pre-wrap">
                    {harnessOutput.stdout || "(no stdout)"}
                    {harnessOutput.stderr ? `\n\nSTDERR:\n${harnessOutput.stderr}` : ""}
                  </pre>
                </div>
              ) : null}

              {/* Document Tabs */}
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex border-b border-border gap-2 text-xs">
                  {["hypothesis.md", "results.md", "benchmarks.json", "decision.md"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFile(tab)}
                      className={cn(
                        "px-3 py-1.5 font-medium border-b-2 transition-colors -mb-px cursor-pointer",
                        activeFile === tab
                          ? "border-accent text-accent font-semibold"
                          : "border-transparent text-muted hover:text-fg",
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex-1 rounded-xl border border-border bg-surface/20 p-4 overflow-y-auto">
                  <pre className="font-mono text-xs whitespace-pre-wrap text-fg leading-relaxed">
                    {fileContent}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
              Select an experiment from the left or create a new one.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateExperiment}
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-bold text-fg">Create New Experiment</h2>
            <div className="space-y-1">
              <label className="text-xs text-muted">Experiment Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. MUSE-004 Cache Affinity Optimization"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs text-fg focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Hypothesis & Objectives</label>
              <textarea
                rows={4}
                value={newHypothesis}
                onChange={(e) => setNewHypothesis(e.target.value)}
                placeholder="State the core hypothesis, assumptions, and validation criteria..."
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs text-fg focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Experiment
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
