import { Badge } from "@/components/ui/badge";
import { Cpu, Sparkles, ShieldCheck } from "lucide-react";
import type { MarketSource } from "@/lib/types";

export function ResolutionSourceBadge({
  source,
  adapterName,
}: {
  source: MarketSource;
  adapterName?: string;
}) {
  if (source === "Automated") {
    return (
      <Badge variant="success" className="gap-1">
        <ShieldCheck className="h-3 w-3" />
        {adapterName ? `${adapterName}` : "Trusted feed"}
      </Badge>
    );
  }
  if (source === "LLMAssisted") {
    return (
      <Badge variant="warning" className="gap-1">
        <Sparkles className="h-3 w-3" />
        LLM · {adapterName ?? "Claude"}
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="gap-1">
      <Cpu className="h-3 w-3" />
      Manual
    </Badge>
  );
}
