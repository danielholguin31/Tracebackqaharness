import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div className="flex items-center gap-1.5">
        <h1 className="text-[16px] font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors outline-none">
                <Info className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" sideOffset={6} className="w-auto max-w-[220px] px-3 py-2 text-[12px] text-muted-foreground">
              {description}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
