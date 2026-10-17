import { useEffect, useMemo } from "react";
import { useApp, useController, useNow } from "../../app/context.js";
import { planView, type PlanTone, type PlanView } from "../../model/plan.js";
import { costOf, formatCost, listedPrice } from "../../model/pricing.js";
import { GaugeIcon } from "../ui/icons.js";
import { cn } from "../ui/primitives.js";

const TONE_COLOR: Record<PlanTone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
};

const TONE_TEXT: Record<PlanTone, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-rose-400",
};

export function PermanentUsageBar() {
  const controller = useController();
  const usage = useApp((s) => s.planUsage);
  const route = useApp((s) => s.route);
  const thread = useApp((s) => (s.route.kind === "thread" ? s.threads[s.route.sessionId] : null));
  const models = useApp((s) => s.models);

  // Poll plan usage periodically
  const now = useNow(30_000, true);
  useEffect(() => {
    void controller.loadPlanUsage();
  }, [controller]);

  const view: PlanView | null = useMemo(() => planView(usage, now), [usage, now]);

  // Compute active thread cost based on published Meta rates
  const threadCost = useMemo(() => {
    if (!thread) return 0;
    let cost = 0;
    const calls = Object.values(thread.fold.meta.calls || {});
    if (calls.length > 0) {
      for (const call of calls) {
        const price = listedPrice(call.modelId ?? thread.fold.meta.modelId ?? "muse-spark-1.2");
        if (price) {
          cost += costOf(price, {
            promptTokens: call.promptTokens,
            outputTokens: call.outputTokens,
            cachedTokens: call.cachedTokens,
          });
        }
      }
    } else if (thread.fold.meta.tokenTotals) {
      const price = listedPrice(thread.fold.meta.modelId ?? "muse-spark-1.2");
      if (price) {
        cost = costOf(price, {
          promptTokens: thread.fold.meta.tokenTotals.promptTokens,
          outputTokens: thread.fold.meta.tokenTotals.outputTokens,
        });
      }
    }
    return cost;
  }, [thread]);

  const windowRow = view?.rows.find((r) => r.key === "window");
  const weeklyRow = view?.rows.find((r) => r.key === "weekly");

  return (
    <aside
      aria-label="Muse Usage & Rate Meter"
      className={cn(
        "fixed bottom-3 right-3 z-50 select-none",
        "flex items-center gap-3.5 rounded-xl border border-white/10",
        "bg-surface/95 px-3 py-1.5 text-xs shadow-xl backdrop-blur-md",
        "transition-all duration-150 hover:border-white/20 hover:bg-surface",
      )}
    >
      <button
        type="button"
        onClick={() => controller.navigate({ kind: "usage" })}
        className="flex items-center gap-1.5 text-subtle hover:text-fg font-medium transition-colors cursor-pointer"
        title="Open full usage report"
      >
        <GaugeIcon size={14} className="text-accent" />
        <span className="font-semibold text-fg tracking-tight">Muse Meter</span>
        {view?.tier ? (
          <span className="rounded bg-active/80 px-1 py-0.5 text-3xs font-mono uppercase text-muted">
            {view.tier}
          </span>
        ) : null}
      </button>

      <div className="h-3 w-px bg-white/10" aria-hidden="true" />

      {/* 5-hour rolling window */}
      <div
        className="flex items-center gap-1.5 cursor-help"
        title={`5-Hour Rolling Window: ${windowRow ? `${windowRow.used} used (${windowRow.resets})` : "Awaiting model call"}`}
      >
        <div
          className={cn("h-2 w-2 rounded-full", windowRow ? TONE_COLOR[windowRow.tone] : "bg-neutral-600")}
        />
        <span className="text-muted">5h:</span>
        <span className={cn("font-medium tabular-nums", windowRow ? TONE_TEXT[windowRow.tone] : "text-fg")}>
          {windowRow ? windowRow.used : "0%"}
        </span>
      </div>

      <div className="h-3 w-px bg-white/10" aria-hidden="true" />

      {/* Weekly cap */}
      <div
        className="flex items-center gap-1.5 cursor-help"
        title={`Weekly Cap: ${weeklyRow ? `${weeklyRow.used} used (${weeklyRow.resets})` : "Awaiting model call"}`}
      >
        <div
          className={cn("h-2 w-2 rounded-full", weeklyRow ? TONE_COLOR[weeklyRow.tone] : "bg-neutral-600")}
        />
        <span className="text-muted">Wk:</span>
        <span className={cn("font-medium tabular-nums", weeklyRow ? TONE_TEXT[weeklyRow.tone] : "text-fg")}>
          {weeklyRow ? weeklyRow.used : "0%"}
        </span>
      </div>

      <div className="h-3 w-px bg-white/10" aria-hidden="true" />

      {/* Current thread cost */}
      <div
        className="flex items-center gap-1.5 cursor-help"
        title={`Active Thread Cost (Meta published rates): ${formatCost(threadCost)}${route.kind === "thread" ? "" : " (No active thread selected)"}`}
      >
        <span className="text-muted">Thread:</span>
        <span className="font-mono font-medium text-accent tabular-nums">
          {formatCost(threadCost)}
        </span>
      </div>
    </aside>
  );
}
