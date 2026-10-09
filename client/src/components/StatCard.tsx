import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  value: number | string;
  label: string;
  variant?: "default" | "success" | "error" | "warning";
}

const variantColor: Record<string, string> = {
  default: "hsl(var(--text-1))",
  success: "var(--pass-text)",
  error:   "var(--fail-text)",
  warning: "var(--warn-text)",
};

export function StatCard({ icon: Icon, value, label, variant = "default" }: StatCardProps) {
  const color = variantColor[variant];

  return (
    <div
      className="flex flex-col gap-2 p-5 rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
      style={{ minHeight: 100 }}
    >
      {/* Icon */}
      <Icon size={17} strokeWidth={1.7} style={{ color }} />

      {/* Value */}
      <div
        className="text-[28px] font-semibold leading-none"
        style={{
          fontFamily: "var(--font-display)",
          color,
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </div>

      {/* Label */}
      <div
        className="text-[12px] text-[hsl(var(--text-3))]"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        {label}
      </div>
    </div>
  );
}
