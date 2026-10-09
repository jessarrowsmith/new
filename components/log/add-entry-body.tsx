"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MealWithItems } from "@/components/meals/meal-form";
import { mealTotals } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import type { Food } from "@/lib/types";

/** Tap a food or meal to log it straight away (1 serving); adjust the amount afterwards in the list. */
export function AddEntryBody({
  foods,
  meals,
  onAddFood,
  onAddMeal,
}: {
  foods: Food[];
  meals: MealWithItems[];
  onAddFood: (food: Food) => void;
  onAddMeal: (meal: MealWithItems) => void;
}) {
  const [tab, setTab] = useState<"meals" | "foods">("meals");
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();

  const shownFoods = useMemo(
    () => (s ? foods.filter((f) => `${f.name} ${f.brand ?? ""}`.toLowerCase().includes(s)) : foods).slice(0, 30),
    [foods, s],
  );
  const shownMeals = useMemo(() => (s ? meals.filter((m) => m.name.toLowerCase().includes(s)) : meals).slice(0, 30), [meals, s]);

  const rowClass = "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-secondary hover:bg-secondary";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1" role="tablist">
        {(["meals", "foods"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("rounded-full py-2 text-sm font-medium capitalize", tab === t && "bg-card font-bold shadow-sm")}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${tab}`} className="pl-10" aria-label={`Search ${tab}`} />
      </div>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {tab === "meals" &&
          shownMeals.map((m) => (
            <li key={m.id}>
              <button className={rowClass} onClick={() => onAddMeal(m)}>
                <span className="min-w-0 truncate font-medium">{m.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{Math.round(mealTotals(m).calories)} kcal</span>
              </button>
            </li>
          ))}
        {tab === "foods" &&
          shownFoods.map((f) => (
            <li key={f.id}>
              <button className={rowClass} onClick={() => onAddFood(f)}>
                <span className="min-w-0 truncate font-medium">
                  {f.name}
                  {f.brand && <span className="font-normal text-muted-foreground"> · {f.brand}</span>}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {Math.round(f.calories)} kcal / {f.serving_size}
                  {f.serving_unit}
                </span>
              </button>
            </li>
          ))}
        {((tab === "meals" && shownMeals.length === 0) || (tab === "foods" && shownFoods.length === 0)) && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            {(tab === "meals" ? meals : foods).length === 0 ? `No ${tab} saved yet.` : "No match."}
          </li>
        )}
      </ul>
    </div>
  );
}
