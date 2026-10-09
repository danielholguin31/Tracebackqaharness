import React, { useState } from 'react';
import { cn } from "@/lib/utils";

interface ViewportSelectionProps {
  isMulti: boolean;
  setIsMulti: (val: boolean) => void;
  selectedSingle: string;
  setSelectedSingle: (val: string) => void;
  selectedMulti: string[];
  setSelectedMulti: (val: string[]) => void;
  customWidth: string;
  setCustomWidth: (val: string) => void;
  customHeight: string;
  setCustomHeight: (val: string) => void;
}

const PRESETS = [
  { id: 'desktop', label: 'Desktop', w: 1280, h: 720 },
  { id: 'laptop', label: 'Laptop', w: 1024, h: 768 },
  { id: 'tablet', label: 'Tablet', w: 768, h: 1024 },
  { id: 'mobile', label: 'Mobile', w: 390, h: 844 },
];

export function ViewportSelection({
  isMulti, setIsMulti,
  selectedSingle, setSelectedSingle,
  selectedMulti, setSelectedMulti,
  customWidth, setCustomWidth,
  customHeight, setCustomHeight
}: ViewportSelectionProps) {

  const toggleMulti = (id: string) => {
    if (selectedMulti.includes(id)) {
      setSelectedMulti(selectedMulti.filter(x => x !== id));
    } else {
      setSelectedMulti([...selectedMulti, id]);
    }
  };

  return (
    <div className="space-y-4">
      {!isMulti ? (
        <div className="space-y-3">
          <select
            value={selectedSingle}
            onChange={(e) => setSelectedSingle(e.target.value)}
            className="w-full appearance-none surface-subtle border border-border rounded-[8px] px-3 py-2 text-[13px] focus:outline-none focus:border-primary transition-colors cursor-pointer text-foreground"
          >
            {PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label} {p.w}×{p.h}</option>
            ))}
            <option value="custom">Custom</option>
          </select>

          {selectedSingle === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <input
                type="text"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                placeholder="W"
                className="w-20 bg-background border border-border rounded-[8px] px-2 py-1.5 text-[12px] focus:outline-none focus:border-primary font-mono text-center"
              />
              <span className="text-muted-foreground text-[12px]">×</span>
              <input
                type="text"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                placeholder="H"
                className="w-20 bg-background border border-border rounded-[8px] px-2 py-1.5 text-[12px] focus:outline-none focus:border-primary font-mono text-center"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 animate-in fade-in">
          <div className="grid grid-cols-1 gap-2">
            {PRESETS.map(p => (
              <label key={p.id} className="flex items-center gap-2.5 p-2 border border-border surface-subtle rounded-[8px] cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedMulti.includes(p.id)}
                  onChange={() => toggleMulti(p.id)}
                  className="w-3.5 h-3.5 rounded-[8px] border-border text-primary focus:ring-primary focus:ring-offset-0 bg-background"
                />
                <span className="text-[13px] text-foreground flex-1">{p.label}</span>
                <span className="text-[12px] text-muted-foreground font-mono">{p.w}×{p.h}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
            Each viewport runs as a parallel instance. Credits multiply per viewport.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-[12px] text-foreground">Test across multiple viewports</span>
        <div
          className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", isMulti ? "bg-primary" : "bg-muted")}
          onClick={() => {
            setIsMulti(!isMulti);
            // Default to desktop if switching to multi
            if (!isMulti && selectedMulti.length === 0) {
              setSelectedMulti(['desktop']);
            }
          }}
        >
          <div className={cn("w-3 h-3 bg-white rounded-full absolute top-0.5  transition-transform", isMulti ? "right-0.5" : "left-0.5")} />
        </div>
      </div>
    </div>
  );
}
