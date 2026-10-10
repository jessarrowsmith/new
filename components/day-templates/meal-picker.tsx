"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MealWithItems } from "@/components/meals/meal-form";
import { mealTotals } from "@/lib/nutrition";

/** Search box + result list for picking a saved meal. */
export function MealPicker({
  meals,
  onPick,
  label,
}: {
  meals: MealWithItems[];
  onPick: (meal: MealWithItems) => void;
  label: string;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? meals.filter((m) => m.name.toLowerCase().includes(s)) : meals).slice(0, 8);
  }, [meals, q]);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={`Add a meal to ${label.toLowerCase()}`}
        className="pl-10"
        aria-label={`Add a meal to ${label}`}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full divide-y overflow-y-auto rounded-xl border bg-card shadow-lg">
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              {meals.length === 0 ? "No meals saved yet. Create some on the Meals page." : "No match."}
            </li>
          )}
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(m);
                  setQ("");
                  setOpen(false);
                }}
              >
                <span className="min-w-0 truncate">{m.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {Math.round(mealTotals(m).calories)} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
