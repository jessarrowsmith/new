"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FoodPicker } from "@/components/foods/food-picker";
import { MacroSummary } from "@/components/macro-summary";
import { getSupabase } from "@/lib/supabase";
import { amountToServings, foodMacros, round, servingsToAmount, sumMacros } from "@/lib/nutrition";
import type { Food, Meal, MealItem } from "@/lib/types";

export type MealWithItems = Meal & { meal_items: (MealItem & { foods: Food })[] };

type Row = { key: string; food: Food; amount: string };

export function MealForm({
  meal,
  foods,
  onSaved,
  onCancel,
}: {
  meal?: MealWithItems;
  foods: Food[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(meal?.name ?? "");
  const [sourceUrl, setSourceUrl] = useState(meal?.source_url ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    (meal?.meal_items ?? []).map((i) => ({
      key: i.id,
      food: i.foods,
      amount: String(round(servingsToAmount(i.foods, i.servings))),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      sumMacros(
        rows.map((r) => foodMacros(r.food, amountToServings(r.food, Number(r.amount) || 0))),
      ),
    [rows],
  );

  const add = (food: Food) =>
    setRows((p) => [...p, { key: crypto.randomUUID(), food, amount: String(food.serving_size) }]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the meal a name.");
    if (rows.length === 0) return setError("Add at least one food.");
    if (rows.some((r) => !(Number(r.amount) > 0))) return setError("Every food needs an amount above 0.");

    setSaving(true);
    const sb = getSupabase();
    const fields = { name: name.trim(), source_url: sourceUrl.trim() || null };
    let mealId = meal?.id;
    if (meal) {
      const { error: err } = await sb.from("meals").update(fields).eq("id", meal.id);
      if (err) return fail(err.message);
    } else {
      const { data, error: err } = await sb.from("meals").insert(fields).select("id").single();
      if (err) return fail(err.message);
      mealId = data.id;
    }

    // Add the new items first, then remove the old ones, so a failure never leaves a meal empty.
    const oldIds = (meal?.meal_items ?? []).map((i) => i.id);
    const { error: insErr } = await sb.from("meal_items").insert(
      rows.map((r) => ({
        meal_id: mealId,
        food_id: r.food.id,
        servings: amountToServings(r.food, Number(r.amount)),
      })),
    );
    if (insErr) return fail(insErr.message);
    if (oldIds.length) {
      const { error: delErr } = await sb.from("meal_items").delete().in("id", oldIds);
      if (delErr) return fail(delErr.message);
    }
    setSaving(false);
    onSaved();

    function fail(msg: string) {
      setSaving(false);
      setError(msg);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="meal-name">Name</Label>
        <Input id="meal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Oat bowl" />
      </div>
      <div>
        <Label htmlFor="meal-url">Recipe link (optional)</Label>
        <Input id="meal-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
      </div>

      <div>
        <Label>Foods</Label>
        <FoodPicker foods={foods} onPick={add} />
        {rows.length > 0 && (
          <ul className="mt-3 space-y-2">
            {rows.map((r) => {
              const servings = amountToServings(r.food, Number(r.amount) || 0);
              return (
                <li key={r.key} className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.food.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(foodMacros(r.food, servings).calories)} kcal · {round(servings, 2)} serving
                      {round(servings, 2) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    aria-label={`Amount of ${r.food.name}`}
                    className="h-10 w-24"
                    value={r.amount}
                    onChange={(e) =>
                      setRows((p) => p.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))
                    }
                  />
                  <span className="w-5 text-sm text-muted-foreground">{r.food.serving_unit}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.food.name}`}
                    onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-secondary p-4">
        <p className="mb-2 text-sm font-medium">Meal total</p>
        <MacroSummary macros={totals} />
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : meal ? "Save changes" : "Create meal"}</Button>
      </div>
    </form>
  );
}
