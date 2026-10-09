import React from 'react';
import { cn } from "@/lib/utils";
import { Check, FileText } from "lucide-react";
import { availableReports } from './ReportTypeSelection';

export function RunReportTypeSelection({
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
  const toggleReport = (id: string) => {
    if (id === 'standard') return; // Cannot toggle standard
    if (selectedReports.includes(id)) {
      onChange(selectedReports.filter(r => r !== id));
    } else {
      onChange([...selectedReports, id]);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Inherited from test defaults — adjust for this run only.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {availableReports.map(report => {
          const isSelected = selectedReports.includes(report.id) || report.id === 'standard';
          return (
            <div
              key={report.id}
              onClick={() => toggleReport(report.id)}
              className={cn(
                "flex flex-col p-3 rounded-[8px] border text-left transition-all relative overflow-hidden",
                report.id === 'standard' ? "cursor-not-allowed opacity-80" : "cursor-pointer",
                isSelected
                  ? "bg-primary/5 border-primary/20"
                  : "surface-subtle border-border hover:border-primary/30"
              )}
            >
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              )}
              <div className="flex items-center gap-2 mb-1.5 pl-1">
                <span className={cn(
                  "text-[13px] font-medium",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}>{report.name}</span>
                <span className="text-[10px] uppercase font-mono status-chip bg-muted text-muted-foreground ml-auto">
                  {report.format}
                </span>
              </div>
              <span className="text-[12px] text-muted-foreground pl-1 leading-snug">
                {report.description}
              </span>
            </div>
          );
        })}
      </div>

      {selectedReports.includes('custom') && (
        <div className="mt-4 p-4 bg-muted/30 rounded-[8px] border border-border/50 animate-in fade-in">
          <label className="block text-[12px] font-medium text-foreground mb-2">Custom Analysis Prompt</label>
          <textarea
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="e.g. Focus only on the payment flow and flag any state that could cause a double charge."
            className="w-full surface-subtle border border-border rounded-[8px] px-3 py-2 text-[13px] min-h-[80px] focus:outline-none focus:border-primary resize-none  placeholder:text-muted-foreground/50"
          ></textarea>
        </div>
      )}
    </div>
  );
}
