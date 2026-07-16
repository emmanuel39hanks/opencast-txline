import { cn } from "@/lib/utils";
import type { Adapter } from "@/lib/types";
import { ShieldCheck, Sparkles, UserCog } from "lucide-react";

export function AdapterBadge({ adapter, className }: { adapter: Adapter; className?: string }) {
  const style =
    adapter.trustLevel === "deterministic"
      ? {
          bg: "bg-success/10 text-success border-success/40",
          icon: <ShieldCheck className="h-3.5 w-3.5" />,
          label: "Deterministic",
        }
      : adapter.trustLevel === "llm-assisted"
        ? {
            bg: "bg-warning/10 text-warning border-warning/40",
            icon: <Sparkles className="h-3.5 w-3.5" />,
            label: "LLM-assisted",
          }
        : {
            bg: "bg-muted text-muted-foreground border-border",
            icon: <UserCog className="h-3.5 w-3.5" />,
            label: "Manual",
          };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
        style.bg,
        className,
      )}
    >
      {style.icon}
      <span>{adapter.displayName}</span>
      <span className="text-[10px] opacity-70">· {style.label}</span>
    </div>
  );
}
