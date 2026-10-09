import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RunReportTypeSelection } from "./ReportTypeSelectionRun";
import { ChevronDown, Play, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { runs as runsApi } from "@/lib/api";

interface RunTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId?: string;
  testName: string;
  defaultReports?: string[];
  defaultCustomPrompt?: string;
  mode: 'autonomous' | 'deterministic';
}

export function RunTriggerModal({
  isOpen,
  onClose,
  testId,
  testName,
  defaultReports = ['standard'],
  defaultCustomPrompt = '',
  mode
}: RunTriggerModalProps) {
  const [, setLocation] = useLocation();
  const [selectedReports, setSelectedReports] = useState<string[]>(defaultReports);
  const [customPrompt, setCustomPrompt] = useState(defaultCustomPrompt);
  const [environment, setEnvironment] = useState('staging');
  const [isStarting, setIsStarting] = useState(false);

  const handleStartRun = async () => {
    setIsStarting(true);
    try {
      if (testId) {
        const run = await runsApi.create({ testId, environment, triggeredBy: 'manual' });
        setLocation(`/runs/initializing/${run.id}`);
      } else {
        setLocation('/runs/live/autonomous');
      }
    } catch {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden surface-subtle border-border rounded-[8px]">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <DialogTitle className="text-[15px] font-medium flex items-center gap-2">
            <Play className="w-4 h-4 text-primary fill-current" />
            Run Test
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-background">
          {/* Target Info */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Target Test</label>
                <div className="text-[13px] font-mono text-foreground bg-muted/50 px-3 py-2 rounded-[8px] border border-border/50">
                  {testName}
                </div>
              </div>
              <div className="w-[200px]">
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Environment</label>
                <div className="relative">
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full appearance-none surface-subtle border border-border rounded-[8px] pl-3 pr-8 py-2 text-[13px] focus:outline-none hover:border-border/70 focus:border-primary transition-colors cursor-pointer text-foreground"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="preview">Preview Deployment</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Reports Selection */}
          <div>
            <h3 className="text-[13px] font-medium text-foreground mb-3">Analysis Reports</h3>
            <RunReportTypeSelection
              selectedReports={selectedReports}
              onChange={setSelectedReports}
              customPrompt={customPrompt}
              onCustomPromptChange={setCustomPrompt}
            />
          </div>

          {/* Context Note */}
          <div>
            <label className="text-[12px] font-medium text-foreground mb-2 block">Run Context (Optional)</label>
            <textarea
              placeholder="Add context for this run..."
              className="w-full surface-subtle border border-border rounded-[8px] px-3 py-2 text-[13px] min-h-[60px] focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50 font-mono text-foreground"
            ></textarea>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStartRun}
            disabled={isStarting}
            className="btn-precision btn-primary px-4 py-1.5 text-[13px] flex items-center gap-2 disabled:opacity-70"
          >
            {isStarting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
            ) : (
              <><Play className="w-4 h-4 fill-current" /> Start Run</>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
