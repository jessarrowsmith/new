import { cn } from "@/lib/utils";
import type { Macros } from "@/lib/types";

const ITEMS = [
  { key: "calories", label: "Cal", unit: "", color: "text-cal" },
  { key: "protein", label: "Protein", unit: "g", color: "text-protein" },
  { key: "carbs", label: "Carbs", unit: "g", color: "text-carbs" },
  { key: "fat", label: "Fat", unit: "g", color: "text-fat" },
] as const;

/** The four core numbers, shown the same way everywhere in the app. */
export function MacroSummary({
  macros,
  className,
}: {
  macros: Macros;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-4 gap-2 text-center", className)}>
      {ITEMS.map(({ key, label, unit, color }) => (
        <div key={key}>
          <div className={cn("text-base font-semibold tabular-nums", color)}>
            {key === "calories"
              ? Math.round(macros[key])
              : Math.round(macros[key] * 10) / 10}
            {unit}
          </div>
          <div className="text-[11px] text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  );
}
