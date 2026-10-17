import { useEffect, useState } from "react";
import { useController } from "../app/context.js";
import { ArrowLeftIcon, PlayIcon } from "../components/ui/icons.js";
import { TopBar } from "../components/chrome.js";
import { Button, Spinner, cn } from "../components/ui/primitives.js";

export interface ScoutReport {
  name: string;
  content: string;
}

export interface ScoutData {
  catalogMd: string;
  monitorLogMd: string;
  reports: ScoutReport[];
}

export function ScoutPage() {
  const controller = useController();
  const [data, setData] = useState<ScoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"catalog" | "reports" | "monitor">("catalog");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchScoutData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/scout");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.reports?.length > 0 && !selectedReport) {
          setSelectedReport(json.reports[0].name);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchScoutData();
  }, []);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      const res = await fetch("/api/scout/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const result = await res.json();
        if (result.sessionId) {
          controller.openThread(result.sessionId);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const currentReportContent =
    data?.reports.find((r) => r.name === selectedReport)?.content || "No report content found.";

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
            <span className="font-semibold text-sm text-fg">API Scout</span>
            <span className="text-xs text-muted">Recon Reports, Catalog & Continuous Monitoring</span>
          </div>
        </div>
        <div>
          <Button
            variant="primary"
            size="sm"
            disabled={scanning}
            onClick={handleRunScan}
            className="flex items-center gap-1.5"
          >
            {scanning ? <Spinner size={14} /> : <PlayIcon size={14} />} Run Scout Scan
          </Button>
        </div>
      </TopBar>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4">
          {/* Navigation Tabs */}
          <div className="flex border-b border-border gap-2 text-xs">
            <button
              onClick={() => setActiveTab("catalog")}
              className={cn(
                "px-4 py-2 font-medium border-b-2 transition-colors -mb-px cursor-pointer",
                activeTab === "catalog"
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-muted hover:text-fg",
              )}
            >
              Verified Catalog (catalog.md)
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={cn(
                "px-4 py-2 font-medium border-b-2 transition-colors -mb-px cursor-pointer",
                activeTab === "reports"
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-muted hover:text-fg",
              )}
            >
              Scan Reports ({data?.reports.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("monitor")}
              className={cn(
                "px-4 py-2 font-medium border-b-2 transition-colors -mb-px cursor-pointer",
                activeTab === "monitor"
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-muted hover:text-fg",
              )}
            >
              Monitor Log (monitor-log.md)
            </button>
          </div>

          {/* Content Pane */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {activeTab === "catalog" ? (
              <div className="flex-1 rounded-xl border border-border bg-surface/30 p-5 overflow-y-auto">
                <pre className="font-mono text-xs whitespace-pre-wrap text-fg leading-relaxed">
                  {data?.catalogMd || "No catalog data found."}
                </pre>
              </div>
            ) : activeTab === "reports" ? (
              <div className="flex-1 flex min-h-0 divide-x divide-border rounded-xl border border-border bg-surface/20 overflow-hidden">
                <div className="w-64 bg-surface/40 overflow-y-auto p-2 space-y-1">
                  <div className="text-3xs uppercase tracking-wider text-muted font-semibold px-2 py-1">
                    Reports
                  </div>
                  {data?.reports.length === 0 ? (
                    <div className="p-3 text-xs text-subtle italic">No reports generated yet.</div>
                  ) : (
                    data?.reports.map((r) => (
                      <button
                        key={r.name}
                        onClick={() => setSelectedReport(r.name)}
                        className={cn(
                          "w-full text-left p-2 rounded text-xs transition-colors truncate block",
                          selectedReport === r.name
                            ? "bg-accent/20 text-accent font-medium"
                            : "text-muted hover:bg-white/5 hover:text-fg",
                        )}
                      >
                        📄 {r.name}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex-1 p-5 overflow-y-auto">
                  <pre className="font-mono text-xs whitespace-pre-wrap text-fg leading-relaxed">
                    {currentReportContent}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-border bg-surface/30 p-5 overflow-y-auto">
                <pre className="font-mono text-xs whitespace-pre-wrap text-emerald-400 leading-relaxed">
                  {data?.monitorLogMd || "No monitor entries logged yet."}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
