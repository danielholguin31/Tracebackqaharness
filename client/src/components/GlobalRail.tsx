import { Link, useLocation } from "wouter";
import { LayoutGrid, Settings, Wrench, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface GlobalRailProps {
  toolboxOpen: boolean;
  onToggleToolbox: () => void;
}

function RailBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-[8px] transition-all duration-150",
            active
              ? "bg-[hsl(var(--bg-overlay))] text-[hsl(var(--text-1))]"
              : "text-[hsl(var(--text-3))] hover:bg-[hsl(var(--bg-muted))] hover:text-[hsl(var(--text-2))]"
          )}
        >
          <Icon size={17} strokeWidth={1.7} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        <span className="text-[12px]">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function RailLink({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Link href={href}>
          <div
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-[8px] transition-all duration-150 cursor-pointer",
              active
                ? "bg-[hsl(var(--bg-overlay))] text-[hsl(var(--text-1))]"
                : "text-[hsl(var(--text-3))] hover:bg-[hsl(var(--bg-muted))] hover:text-[hsl(var(--text-2))]"
            )}
          >
            <Icon size={17} strokeWidth={1.7} />
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        <span className="text-[12px]">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function GlobalRail({ toolboxOpen, onToggleToolbox }: GlobalRailProps) {
  const [location] = useLocation();

  const projectsActive = location === "/personal" || location.startsWith("/personal/projects");
  const settingsActive = location.startsWith("/personal/settings");

  return (
    <div
      className="fixed top-0 left-0 h-screen w-[52px] z-40 flex flex-col items-center py-3 gap-0.5 shrink-0"
      style={{
        background: "hsl(var(--bg-subtle))",
        borderRight: "1px solid hsl(var(--border))",
      }}
    >
      {/* TB Mark */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Link href="/personal">
            <div className="w-9 h-9 flex items-center justify-center rounded-[8px] bg-[hsl(var(--text-1))] text-[hsl(var(--background))] text-[12px] font-bold cursor-pointer hover:opacity-85 transition-opacity mb-0.5">
              TB
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          <span className="text-[12px]">Personal Workspace</span>
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div
        className="w-6 my-1.5"
        style={{ height: 1, background: "hsl(var(--border))" }}
      />

      {/* Nav items */}
      <RailLink icon={LayoutGrid} label="Projects"            href="/personal"          active={projectsActive} />
      <RailLink icon={Settings}   label="Workspace Settings"  href="/personal/settings"  active={settingsActive} />
      <RailBtn  icon={Wrench}     label="Toolbox"             active={toolboxOpen}       onClick={onToggleToolbox} />

      {/* Push help/avatar to bottom */}
      <div className="flex-1" />

      <RailBtn icon={HelpCircle} label="Help" />

      {/* User avatar */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[11px] font-semibold text-white cursor-pointer hover:opacity-85 transition-opacity mt-1">
            DH
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          <span className="text-[12px]">Daniel H.</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
