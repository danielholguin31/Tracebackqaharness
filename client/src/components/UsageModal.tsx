import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { usage as usageApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UsageModal({ isOpen, onClose }: UsageModalProps) {
  const { data } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
    enabled: isOpen,
  });

  const creditsUsed     = data?.creditsUsed  ?? 12400;
  const creditsTotal    = data?.creditsTotal ?? 50000;
  const creditsOverage  = data?.creditsOverage ?? 240;
  const pctUsed         = Math.min(100, creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0);
  const totalRuns    = data?.totalRuns           ?? 128;
  const issuesFound  = data?.issuesFound         ?? 14;
  const timeSaved    = data?.agentTimeSavedHours ?? 24;
  const history: number[] = (data?.history ?? []).map((h: any) => h.creditsUsed);
  const topConsumers: any[] = data?.topConsumers ?? [];

  const chartData = history.length > 0
    ? history
    : [4, 12, 8, 24, 16, 32, 18, 42, 28, 14, 8, 22, 34, 16, 12, 28, 45, 30, 18, 26, 14, 8, 36, 42, 28, 16, 24, 38, 42, 12];
  const chartMax = Math.max(...chartData, 1);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[760px] p-0 overflow-hidden border-border/40 rounded-[8px]">
        <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/20">
          <DialogTitle className="text-[15px] font-medium text-foreground">Usage & Credits</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[72vh] custom-scrollbar">
          <div className="p-6 space-y-4">

            {/* Credits bar */}
            <div className="border border-border/40 rounded-[8px] p-5 bg-background space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Credits Used</p>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[28px] font-semibold text-foreground leading-none">{pctUsed.toFixed(1)}%</span>
                    <span className="text-[13px] text-muted-foreground">{creditsUsed.toLocaleString()} / {creditsTotal.toLocaleString()} credits</span>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground">Resets in 12 days</p>
              </div>
              <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", pctUsed > 80 ? "bg-destructive/70" : "bg-foreground")}
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
              {creditsOverage > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[12px] text-muted-foreground">Additional usage</span>
                  <span className="text-[12px] font-mono text-foreground">+{creditsOverage.toLocaleString()} credits · ${(creditsOverage * 0.05).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Runs",       value: totalRuns,        sub: "12% from last month"    },
                { label: "Issues Found",     value: issuesFound,      sub: "Across 5 suites"        },
                { label: "Agent Time Saved", value: `${timeSaved}h`,  sub: "Est. manual testing hrs" },
              ].map(s => (
                <div key={s.label} className="border border-border/40 rounded-[8px] p-4 bg-background">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{s.label}</p>
                  <div className="text-[22px] font-semibold text-foreground leading-none">{s.value}</div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Daily chart */}
            <div className="border border-border/40 rounded-[8px] p-5 bg-background">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] font-medium text-foreground">Daily Usage</p>
                <span className="text-[11px] text-muted-foreground">Last 30 days</span>
              </div>
              <div className="h-28 flex items-end gap-1">
                {chartData.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-foreground/10 hover:bg-foreground/20 rounded-t transition-colors relative group"
                    style={{ height: `${(h / chartMax) * 100}%` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-10">
                      {h}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
                <span>Oct 1</span>
                <span>Oct 15</span>
                <span>Oct 30</span>
              </div>
            </div>

            {/* Top consumers */}
            <div className="border border-border/40 rounded-[8px] overflow-hidden bg-background">
              <div className="px-4 py-2.5 bg-muted/20 border-b border-border/40">
                <p className="text-[12px] font-medium text-foreground">Top Consumers</p>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground">Test / Suite</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground">Runs</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground text-right">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(topConsumers.length > 0 ? topConsumers : [
                    { testName: "Nightly Regression Suite", runs: 14,  credits: 112.5 },
                    { testName: "Checkout Flow – Guest",     runs: 32,  credits: 64.0  },
                    { testName: "User Onboarding",           runs: 18,  credits: 36.0  },
                  ]).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium text-foreground">{item.testName}</td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">{item.runs}</td>
                      <td className="px-4 py-3 text-[12px] font-mono text-muted-foreground text-right">{item.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">Pro Plan · $49 / month · Renews Feb 1, 2027</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-precision btn-secondary px-3 py-1.5 text-[12px]">Close</button>
            <button className="btn-precision btn-primary px-3 py-1.5 text-[12px]">Manage Subscription</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
