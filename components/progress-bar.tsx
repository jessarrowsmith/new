import { cn } from "@/lib/utils";

/** Labelled progress bar. Going over target keeps the bar full and says by how much. */
export function ProgressBar({
  label,
  value,
  target,
  unit = "",
  colorClass,
  large,
  stacked,
}: {
  label: string;
  value: number;
  target: number;
  unit?: string;
  colorClass: string; // e.g. "bg-protein"
  large?: boolean;
  /** Compact: label on top, bar, then "value / target" underneath (fits three across on a phone). */
  stacked?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target > 0 && value > target;
  const shown = Math.round(value * 10) / 10;
  if (stacked) {
    return (
      <div>
        <div className="mb-1 text-xs font-medium">{label}</div>
        <div
          role="progressbar"
          aria-label={label}
          aria-valuenow={Math.round(value)}
          aria-valuemin={0}
          aria-valuemax={Math.round(target)}
          className="h-2 overflow-hidden rounded-full bg-secondary"
        >
          <div className={cn("h-full rounded-full transition-all", colorClass, over && "opacity-70")} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-xs tabular-nums text-muted-foreground">
          <span className={cn("font-semibold", over ? "text-destructive" : "text-foreground")}>{shown}</span> / {Math.round(target)}
          {unit}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className={cn("mb-1 flex items-baseline justify-between gap-2", large ? "text-base" : "text-sm")}>
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className={cn("font-semibold text-foreground", large && "text-lg")}>{shown}</span>
          {unit} / {Math.round(target)}
          {unit}
          {over && <span className="ml-1.5 text-destructive">+{Math.round((value - target) * 10) / 10}</span>}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(target)}
        className={cn("overflow-hidden rounded-full bg-secondary", large ? "h-3.5" : "h-2.5")}
      >
        <div className={cn("h-full rounded-full transition-all", colorClass, over && "opacity-70")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
