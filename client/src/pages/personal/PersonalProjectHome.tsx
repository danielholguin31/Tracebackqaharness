import { useLocation } from "wouter";
import { CheckCircle2, XCircle, AlertCircle, Play, FileCheck, Layers, Bug, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/personal-mock-data";

interface PersonalProjectHomeProps {
  project: Project;
}

export function PersonalProjectHome({ project }: PersonalProjectHomeProps) {
  const [, navigate] = useLocation();
  const base = `/personal/projects/${project.id}`;

  const statusIcon = (status: string) => {
    if (status === "passed") return <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />;
    if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    if (status === "warning") return <AlertCircle className="w-3.5 h-3.5 text-[#ca8a04]" />;
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16a34a] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16a34a]" />
      </span>
    );
  };

  const severityStyle = (s: string) =>
    s === "critical"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : s === "high"
      ? "bg-[#ca8a04]/10 text-[#ca8a04] border-[#ca8a04]/20"
      : "bg-muted text-muted-foreground border-border/50";

  return (
    <div className="min-h-full w-full flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-4xl space-y-10">

        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: project.color }}
          />
          <h1
            className="text-[26px] font-semibold text-foreground tracking-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.3px" }}
          >
            {project.name}
          </h1>
          <span
            className="text-[13px] text-muted-foreground font-mono mt-0.5"
          >
            {project.baseUrl}
          </span>
        </div>

        {/* ── Stat cards ─────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Runs", value: project.stats.totalRuns, icon: Play, color: "text-foreground" },
            { label: "Passing Tests", value: project.stats.passingTests, icon: CheckCircle2, color: "text-[#16a34a]" },
            { label: "Failing Tests", value: project.stats.failingTests, icon: XCircle, color: "text-destructive" },
            { label: "Open Issues", value: project.stats.openIssues, icon: AlertTriangle, color: "text-[#ca8a04]" },
          ].map((card) => (
            <div
              key={card.label}
              className="flex flex-col gap-2 p-4 rounded-[8px] border border-border bg-background"
            >
              <card.icon className={cn("w-4 h-4", card.color)} strokeWidth={1.8} />
              <span
                className={cn("text-[28px] font-semibold leading-none", card.color)}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {card.value}
              </span>
              <span className="text-[12px] text-muted-foreground">{card.label}</span>
            </div>
          ))}
        </div>

        {/* ── Quick actions ──────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Tests", icon: FileCheck, path: `${base}/tests` },
            { label: "Runs", icon: Play, path: `${base}/runs` },
            { label: "Suites", icon: Layers, path: `${base}/suites` },
            { label: "Issues", icon: Bug, path: `${base}/issues` },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-[8px] border border-border bg-background text-[13px] font-medium text-foreground hover:bg-muted/60 hover:border-border transition-all text-left"
            >
              <item.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Two-column ─────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Recent Runs */}
          <div className="flex flex-col border border-border rounded-[8px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-semibold text-foreground">Recent Runs</span>
              <button
                onClick={() => navigate(`${base}/runs`)}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </button>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {project.recentRuns.length === 0 ? (
                <div className="px-4 py-6 text-[13px] text-muted-foreground text-center">No runs yet</div>
              ) : (
                project.recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`${base}/runs`)}
                  >
                    {statusIcon(run.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">
                        {run.testName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "status-chip text-[10px]",
                            run.mode === "autonomous"
                              ? "status-passed"
                              : "bg-muted text-foreground border-border/50"
                          )}
                        >
                          {run.mode}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {run.duration}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {run.timestamp}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Open Issues */}
          <div className="flex flex-col border border-border rounded-[8px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-semibold text-foreground">Open Issues</span>
              <button
                onClick={() => navigate(`${base}/issues`)}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </button>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {project.openIssues.length === 0 ? (
                <div className="px-4 py-6 text-[13px] text-muted-foreground text-center">
                  No open issues
                </div>
              ) : (
                project.openIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`${base}/issues`)}
                  >
                    <span
                      className={cn(
                        "status-chip text-[10px] border mt-0.5 shrink-0",
                        severityStyle(issue.severity)
                      )}
                    >
                      {issue.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground leading-snug">
                        {issue.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {issue.foundIn} · {issue.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
