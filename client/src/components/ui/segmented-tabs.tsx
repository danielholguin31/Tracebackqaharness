import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SegTab {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentedTabsProps {
  tabs: SegTab[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function SegmentedTabs({ tabs, value, onChange, className }: SegmentedTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const initialized = useRef(false);
  const [pill, setPill] = useState({ left: 0, width: 0, transition: false });

  useLayoutEffect(() => {
    const idx = tabs.findIndex(t => t.value === value);
    const el = tabRefs.current[idx];
    if (!el) return;
    setPill({
      left: el.offsetLeft,
      width: el.offsetWidth,
      transition: initialized.current,
    });
    initialized.current = true;
  }, [value, tabs]);

  return (
    <div className={cn("relative flex items-center gap-0.5 bg-muted/30 border border-border/40 rounded-[8px] p-0.5", className)}>
      {/* Sliding pill */}
      <div
        className="absolute rounded-[6px] bg-background shadow-sm border border-border/30 pointer-events-none"
        style={{
          left: pill.left,
          width: pill.width,
          top: 2,
          bottom: 2,
          ...(pill.transition && {
            transition: "left 200ms cubic-bezier(0.4,0,0.2,1), width 200ms cubic-bezier(0.4,0,0.2,1)",
          }),
        }}
      />
      {tabs.map((tab, i) => (
        <button
          key={tab.value}
          ref={el => { tabRefs.current[i] = el; }}
          onClick={() => onChange(tab.value)}
          className={cn(
            "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors whitespace-nowrap",
            value === tab.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
