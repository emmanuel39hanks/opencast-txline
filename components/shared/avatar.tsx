import { cn } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = 24,
  className,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full text-[10px] font-semibold uppercase text-white",
        className,
      )}
      style={{ width: size, height: size, background: color }}
      aria-label={name}
    >
      {initial}
    </div>
  );
}
