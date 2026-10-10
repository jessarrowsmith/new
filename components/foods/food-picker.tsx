"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Food } from "@/lib/types";

/** Search box + result list for picking a saved food. */
export function FoodPicker({
  foods,
  onPick,
  placeholder = "Search foods to add",
}: {
  foods: Food[];
  onPick: (food: Food) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return foods.filter((f) => `${f.name} ${f.brand ?? ""}`.toLowerCase().includes(s)).slice(0, 8);
  }, [foods, q]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
          aria-label="Search foods to add"
        />
      </div>
      {q.trim() && (
        <ul className="mt-2 divide-y overflow-hidden rounded-xl border bg-card">
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              {foods.length === 0 ? "No foods saved yet. Add some on the Foods page." : "No match."}
            </li>
          )}
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                onClick={() => {
                  onPick(f);
                  setQ("");
                }}
              >
                <span className="min-w-0 truncate">
                  {f.name}
                  {f.brand && <span className="text-muted-foreground"> · {f.brand}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {Math.round(f.calories)} kcal / {f.serving_size}
                  {f.serving_unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
