import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { Check, FileText, ChevronDown, ChevronRight } from "lucide-react";

interface ReportType {
  id: string;
  name: string;
  description: string;
  format: 'UI' | 'PDF';
  defaultEnabled?: boolean;
}

export const availableReports: ReportType[] = [
  { id: 'standard', name: 'Standard', description: 'Basic execution report', format: 'UI', defaultEnabled: true },
  { id: 'regression', name: 'Regression', description: 'Visual & functional comparison', format: 'UI' },
  { id: 'coverage', name: 'Coverage', description: 'Code and element coverage', format: 'PDF' },
  { id: 'security', name: 'Security', description: 'Basic vulnerability scan', format: 'PDF' },
  { id: 'performance', name: 'Performance', description: 'Load time and network metrics', format: 'PDF' },
  { id: 'accessibility', name: 'Accessibility', description: 'WCAG compliance check', format: 'PDF' },
  { id: 'custom', name: 'Custom', description: 'AI-driven specialized report', format: 'PDF' },
];

export function DefaultReportsSelection({
  selectedReports,
  onChange,
  customPrompt,
  onCustomPromptChange
}: {
  selectedReports: string[];
  onChange: (selected: string[]) => void;
  customPrompt: string;
  onCustomPromptChange: (prompt: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleReport = (id: string) => {
    if (id === 'standard') return; // Cannot toggle standard
    if (selectedReports.includes(id)) {
      onChange(selectedReports.filter(r => r !== id));
    } else {
      onChange([...selectedReports, id]);
    }
  };

  return (
    <div className="border-t border-border pt-6 mt-6">
      <div className="flex items-center justify-between cursor-pointer group mb-2 outline-none" onClick={() => setExpanded(!expanded)}>
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">Default Reports</div>
        <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform", expanded && "rotate-90")} />
      </div>

      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1">
          <p className="text-[12px] text-muted-foreground mb-4">
            These generate automatically on every run. Override per run when triggering manually.
          </p>
          <div className="space-y-1">
            {availableReports.map(report => (
              <div key={report.id} className="flex flex-col">
                <label className={cn(
                  "flex items-center gap-3 p-2 rounded-[8px] hover:bg-muted/50 cursor-pointer transition-colors",
                  report.id === 'standard' && "opacity-60 cursor-not-allowed hover:bg-transparent"
                )}>
                  <div className={cn(
                    "w-4 h-4 rounded-sm flex items-center justify-center border shrink-0",
                    (selectedReports.includes(report.id) || report.id === 'standard')
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input bg-background"
                  )}>
                    {(selectedReports.includes(report.id) || report.id === 'standard') && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-foreground">{report.name}</span>
                    <span className="text-[12px] text-muted-foreground">— {report.description}</span>
                  </div>
                </label>

                {report.id === 'custom' && selectedReports.includes('custom') && (
                  <div className="pl-9 pr-2 pb-2">
                    <textarea
                      value={customPrompt}
                      onChange={(e) => onCustomPromptChange(e.target.value)}
                      placeholder="Describe what the analysis agent should focus on..."
                      className="w-full surface-subtle border border-border rounded-[8px] px-3 py-2 text-[12px] min-h-[60px] focus:outline-none focus:border-primary resize-none  placeholder:text-muted-foreground/60"
                    ></textarea>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
