import { useEffect, useState } from "react";
import { useController } from "../app/context.js";
import { ArrowLeftIcon, PlayIcon, PlusIcon, TrashIcon } from "../components/ui/icons.js";
import { TopBar } from "../components/chrome.js";
import { Button, Spinner, cn } from "../components/ui/primitives.js";

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

export function BotsPage() {
  const controller = useController();
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [activeBot, setActiveBot] = useState<BotView | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"agents" | "soul" | "memory" | "workspace" | "runs">("agents");
  const [editAgents, setEditAgents] = useState("");
  const [editSoul, setEditSoul] = useState("");
  const [editMemory, setEditMemory] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAvatar, setNewAvatar] = useState("🤖");
  const [newAllowShell, setNewAllowShell] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bots");
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
        if (data.bots?.length > 0 && !selectedName) {
          setSelectedName(data.bots[0].name);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBots();
  }, []);

  const fetchBotDetail = async (name: string) => {
    try {
      setBotLoading(true);
      const res = await fetch(`/api/bots/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveBot(data.bot);
        setEditAgents(data.bot.agentsMd || "");
        setEditSoul(data.bot.soulMd || "");
        setEditMemory(data.bot.memoryMd || "");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBotLoading(false);
    }
  };

  useEffect(() => {
    if (selectedName) {
      void fetchBotDetail(selectedName);
    }
  }, [selectedName]);

  const handleSaveBot = async () => {
    if (!selectedName || !activeBot) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/bots/${encodeURIComponent(selectedName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: activeBot.config,
          agentsMd: editAgents,
          soulMd: editSoul,
          memoryMd: editMemory,
        }),
      });
      if (res.ok) {
        await fetchBotDetail(selectedName);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRunBot = async (name: string) => {
    try {
      setRunning(true);
      const res = await fetch(`/api/bots/${encodeURIComponent(name)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) {
          // Navigate to the newly spawned bot thread
          controller.openThread(data.sessionId);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteBot = async (name: string) => {
    if (!window.confirm(`Delete bot ${name}?`)) return;
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedName(null);
        setActiveBot(null);
        await fetchBots();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const cleanId = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    try {
      const tools = newAllowShell
        ? ["read_file", "write_file", "run_command", "shell"]
        : ["read_file", "write_file"];
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanId,
          config: {
            name: cleanId,
            displayName: newDisplayName.trim() || cleanId,
            avatar: newAvatar.trim() || "🤖",
            description: newDescription.trim(),
            enabled: true,
            tools,
          },
          agentsMd: `# ${newDisplayName || cleanId} Instructions\n\nDirectives for this bot.\n`,
          soulMd: `# ${newDisplayName || cleanId} Soul\n\nIdentity and guidelines.\n`,
          memoryMd: `# ${newDisplayName || cleanId} Memory\n\nPersistent context.\n`,
        }),
      });
      if (res.ok) {
        setIsCreating(false);
        setNewName("");
        setNewDisplayName("");
        setNewDescription("");
        await fetchBots();
        setSelectedName(cleanId);
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
            <span className="font-semibold text-sm text-fg">Personal Bots</span>
            <span className="text-xs text-muted">Autonomous Agents & Tool Allowlist Policy</span>
          </div>
        </div>
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5"
          >
            <PlusIcon size={14} /> Create Bot
          </Button>
        </div>
      </TopBar>

      <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-border">
        {/* Left: Bots list cards */}
        <div className="w-84 flex flex-col shrink-0 bg-surface/30 overflow-y-auto">
          <div className="p-3 font-semibold text-xs tracking-wider uppercase text-muted">
            Configured Bots ({bots.length})
          </div>
          {loading ? (
            <div className="p-6 flex justify-center text-muted">
              <Spinner size={18} />
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {bots.map((bot) => (
                <div
                  key={bot.name}
                  onClick={() => setSelectedName(bot.name)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all cursor-pointer",
                    selectedName === bot.name
                      ? "bg-accent/15 border-accent/40 shadow-sm"
                      : "bg-surface/40 hover:bg-surface/80 border-border text-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{bot.avatar || "🤖"}</span>
                      <span className="font-semibold text-sm text-fg">{bot.displayName}</span>
                    </div>
                    {bot.schedule ? (
                      <span className="font-mono text-3xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {bot.schedule}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-subtle line-clamp-2 mb-2.5">{bot.description}</p>
                  <div className="flex items-center justify-between text-3xs border-t border-white/5 pt-2">
                    <span className="text-muted">
                      Tools: {bot.tools.includes("shell") ? "All (Shell on)" : "Restricted (No shell)"}
                    </span>
                    <button
                      type="button"
                      disabled={running}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRunBot(bot.name);
                      }}
                      className="px-2 py-1 rounded bg-accent text-accent-fg font-medium flex items-center gap-1 hover:brightness-110 cursor-pointer"
                    >
                      <PlayIcon size={10} /> Run Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Selected Bot Detail & Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg">
          {activeBot ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{activeBot.config.avatar || "🤖"}</span>
                  <div>
                    <h1 className="text-xl font-bold text-fg tracking-tight">
                      {activeBot.config.displayName}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                      <span className="font-mono text-accent">bots/{activeBot.config.name}</span>
                      <span>·</span>
                      <span>
                        Policy:{" "}
                        {activeBot.config.tools.includes("shell")
                          ? "Shell allowed"
                          : "Shell denied by default"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBot(activeBot.config.name)}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    <TrashIcon size={14} /> Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={running}
                    onClick={() => handleRunBot(activeBot.config.name)}
                    className="flex items-center gap-1.5"
                  >
                    {running ? <Spinner size={14} /> : <PlayIcon size={14} />} Run Bot Thread
                  </Button>
                </div>
              </div>

              {/* Tabs: Instructions (AGENTS.md), Soul (SOUL.md), Memory (MEMORY.md), Workspace files, Runs */}
              <div className="flex border-b border-border gap-2 text-xs">
                {(
                  [
                    { key: "agents", label: "AGENTS.md (Directives)" },
                    { key: "soul", label: "SOUL.md (Identity)" },
                    { key: "memory", label: "MEMORY.md (Context)" },
                    { key: "workspace", label: `Workspace (${activeBot.workspaceFiles.length})` },
                    { key: "runs", label: `Past Runs (${activeBot.runs.length})` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={cn(
                      "px-3 py-2 font-medium border-b-2 transition-colors -mb-px cursor-pointer",
                      activeTab === t.key
                        ? "border-accent text-accent font-semibold"
                        : "border-transparent text-muted hover:text-fg",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                {activeTab === "agents" ? (
                  <div className="flex-1 flex flex-col space-y-2">
                    <textarea
                      rows={14}
                      value={editAgents}
                      onChange={(e) => setEditAgents(e.target.value)}
                      className="w-full flex-1 p-4 rounded-xl bg-surface/30 border border-border font-mono text-xs text-fg leading-relaxed focus:outline-none focus:border-accent"
                    />
                    <div className="flex justify-end">
                      <Button variant="secondary" size="sm" disabled={saving} onClick={handleSaveBot}>
                        {saving ? "Saving..." : "Save Instructions"}
                      </Button>
                    </div>
                  </div>
                ) : activeTab === "soul" ? (
                  <div className="flex-1 flex flex-col space-y-2">
                    <textarea
                      rows={14}
                      value={editSoul}
                      onChange={(e) => setEditSoul(e.target.value)}
                      className="w-full flex-1 p-4 rounded-xl bg-surface/30 border border-border font-mono text-xs text-fg leading-relaxed focus:outline-none focus:border-accent"
                    />
                    <div className="flex justify-end">
                      <Button variant="secondary" size="sm" disabled={saving} onClick={handleSaveBot}>
                        {saving ? "Saving..." : "Save Soul"}
                      </Button>
                    </div>
                  </div>
                ) : activeTab === "memory" ? (
                  <div className="flex-1 flex flex-col space-y-2">
                    <textarea
                      rows={14}
                      value={editMemory}
                      onChange={(e) => setEditMemory(e.target.value)}
                      className="w-full flex-1 p-4 rounded-xl bg-surface/30 border border-border font-mono text-xs text-fg leading-relaxed focus:outline-none focus:border-accent"
                    />
                    <div className="flex justify-end">
                      <Button variant="secondary" size="sm" disabled={saving} onClick={handleSaveBot}>
                        {saving ? "Saving..." : "Save Memory"}
                      </Button>
                    </div>
                  </div>
                ) : activeTab === "workspace" ? (
                  <div className="flex-1 rounded-xl border border-border bg-surface/20 p-4 overflow-y-auto space-y-1">
                    <div className="text-xs text-muted mb-2 font-mono">Path: {activeBot.workspacePath}</div>
                    {activeBot.workspaceFiles.length === 0 ? (
                      <div className="text-xs text-subtle italic">No files in bot workspace yet.</div>
                    ) : (
                      activeBot.workspaceFiles.map((file) => (
                        <div key={file} className="font-mono text-xs text-fg py-1 px-2 rounded hover:bg-white/5">
                          📄 {file}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="flex-1 rounded-xl border border-border bg-surface/20 p-4 overflow-y-auto space-y-2">
                    {activeBot.runs.length === 0 ? (
                      <div className="text-xs text-subtle italic">No runs recorded yet.</div>
                    ) : (
                      activeBot.runs.map((run) => (
                        <div key={run} className="font-mono text-xs text-fg p-2 rounded bg-surface border border-border">
                          ⚡ {run}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">
              Select a bot from the left to configure or run.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateBot}
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-bold text-fg">Create Bot</h2>
            <div className="space-y-1">
              <label className="text-xs text-muted">Bot ID (lowercase slug)</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. data-scout-bot"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs text-fg focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Display Name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="e.g. Data Scout Bot"
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs text-fg focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Avatar Emoji</label>
              <input
                type="text"
                value={newAvatar}
                onChange={(e) => setNewAvatar(e.target.value)}
                className="w-20 px-3 py-2 rounded-lg bg-bg border border-border text-xs text-fg text-center"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Description</label>
              <textarea
                rows={2}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Primary purpose of this bot..."
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs text-fg focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="allowShell"
                checked={newAllowShell}
                onChange={(e) => setNewAllowShell(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="allowShell" className="text-xs text-fg select-none">
                Allow Shell Tools (Uncheck to enforce deny policy on shell execution)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Bot
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
