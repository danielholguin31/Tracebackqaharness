import { AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  actionText?: string;
  actionLink?: string;
  time?: string;
}

const severityConfig = {
  critical: { color: "text-destructive", bg: "bg-destructive", icon: AlertTriangle },
  warning: { color: "text-[#ca8a04]", bg: "bg-[#ca8a04]", icon: AlertCircle },
  info: { color: "text-[#3b82f6]", bg: "bg-[#3b82f6]", icon: Info }
};

export function AlertTable({ alerts: initialAlerts }: { alerts: Alert[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const visibleAlerts = expanded ? alerts : alerts.slice(0, 3);
  const hiddenCount = alerts.length - visibleAlerts.length;

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-medium text-foreground">Needs Attention</h2>
      </div>
      <div className="border border-border/60 rounded-[8px] overflow-x-auto surface-subtle">
        <table className="w-full text-left text-[14px] whitespace-nowrap">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground bg-muted/20">
              <th className="font-medium p-4 py-3 w-8"></th>
              <th className="font-medium p-4 py-3">Message</th>
              <th className="font-medium p-4 py-3">Time</th>
              <th className="font-medium p-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {visibleAlerts.map(alert => {
              const Icon = severityConfig[alert.type].icon;
              return (
              <tr key={alert.id} className="hover:bg-muted/10 transition-colors group">
                <td className="p-4 py-3 align-middle text-center">
                  <div className={cn("w-2 h-2 rounded-full inline-block", severityConfig[alert.type].bg)} />
                </td>
                <td className="p-4 py-3 align-middle text-foreground">
                  <div className="flex items-center gap-2">
                    {alert.message}
                  </div>
                </td>
                <td className="p-4 py-3 align-middle text-muted-foreground text-[13px]">
                  {alert.time || 'Just now'}
                </td>
                <td className="p-4 py-3 align-middle text-right">
                  <div className="flex items-center justify-end gap-3">
                    {alert.actionText && (
                      <a href={alert.actionLink || '#'} className="text-[13px] text-foreground hover:underline transition-colors font-medium">
                        {alert.actionText}
                      </a>
                    )}
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )})}
            {!expanded && hiddenCount > 0 && (
              <tr>
                <td colSpan={4} className="p-0">
                  <button
                    onClick={() => setExpanded(true)}
                    className="w-full text-center py-2.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors bg-muted/10"
                  >
                    View {hiddenCount} more alerts
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
