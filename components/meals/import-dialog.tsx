"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { MacroSummary } from "@/components/macro-summary";
import { getSupabase } from "@/lib/supabase";
import { matchFood } from "@/lib/match";
import { amountToServings, foodMacros, round, sumMacros } from "@/lib/nutrition";
import type { Food } from "@/lib/types";

type Ingredient = {
  original: string;
  name: string;
  amount: number;
  unit: "g" | "ml";
  calories_per_100: number;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  fibre_per_100: number;
  sugar_per_100: number;
};
type Recipe = { name: string; servings: number; ingredients: Ingredient[] };

/** One row in the review step. `foodId` is a saved food's id, or "new" to create it from the estimate. */
type Row = Ingredient & { key: string; foodId: string; amountStr: string };

export function ImportDialogBody({
  foods,
  onSaved,
  onCancel,
}: {
  foods: Food[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const isUrl = /^https?:\/\/\S+$/i.test(input.trim());

  async function extract() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/meals/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUrl ? { url: input.trim() } : { text: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      const r = data.recipe as Recipe;
      setName(r.name || "");
      setServings(String(Math.max(1, r.servings || 1)));
      setSourceUrl(data.source_url ?? null);
      setRows(
        r.ingredients.map((ing, i) => {
          const match = matchFood(ing.name, foods);
          return { ...ing, key: String(i), foodId: match?.id ?? "new", amountStr: "" };
        }),
      );
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  const divisor = Math.max(Number(servings) || 1, 1);
  /** Amount of each ingredient in ONE serving of the meal (editable override via amountStr). */
  const amountFor = (r: Row) => (r.amountStr !== "" ? Number(r.amountStr) || 0 : round(r.amount / divisor));

  const totals = useMemo(
    () =>
      sumMacros(
        rows.map((r) => {
          const amount = amountFor(r);
          const food = foods.find((f) => f.id === r.foodId);
          return food
            ? foodMacros(food, amountToServings(food, amount))
            : {
                calories: (r.calories_per_100 * amount) / 100,
                protein: (r.protein_per_100 * amount) / 100,
                carbs: (r.carbs_per_100 * amount) / 100,
                fat: (r.fat_per_100 * amount) / 100,
              };
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, divisor, foods],
  );

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Give the meal a name.");
    setSaving(true);
    const sb = getSupabase();
    try {
      // 1. Create the foods that don't exist yet (per-100 g estimates).
      const newRows = rows.filter((r) => r.foodId === "new");
      const created = new Map<string, Food>();
      if (newRows.length) {
        const { data, error: err } = await sb
          .from("foods")
          .insert(
            newRows.map((r) => ({
              name: r.name,
              serving_size: 100,
              serving_unit: r.unit,
              calories: r.calories_per_100,
              protein: r.protein_per_100,
              carbs: r.carbs_per_100,
              fat: r.fat_per_100,
              fibre: r.fibre_per_100,
              sugar: r.sugar_per_100,
              source: "manual",
            })),
          )
          .select("*");
        if (err) throw err;
        // insert returns rows in insertion order
        newRows.forEach((r, i) => created.set(r.key, data[i] as Food));
      }
      // 2. Create the meal and its items.
      const { data: meal, error: mErr } = await sb
        .from("meals")
        .insert({ name: name.trim(), source_url: sourceUrl })
        .select("id")
        .single();
      if (mErr) throw mErr;
      const items = rows
        .map((r) => {
          const food = r.foodId === "new" ? created.get(r.key)! : foods.find((f) => f.id === r.foodId)!;
          return { meal_id: meal.id, food_id: food.id, servings: amountToServings(food, amountFor(r)) };
        })
        .filter((i) => i.servings > 0);
      const { error: iErr } = await sb.from("meal_items").insert(items);
      if (iErr) throw iErr;
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string }).message ?? "Couldn't save.");
      setSaving(false);
    }
  }

  if (step === "input") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste a recipe link, or paste the recipe text or video caption. For TikTok and Instagram,
          pasting the caption works best because those sites often block links.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={7}
          placeholder="https://… or the ingredients list"
          aria-label="Recipe link or text"
          className="w-full rounded-xl border border-input bg-card p-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={extract} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Reading recipe…" : "Extract ingredients"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-primary/40 px-3 py-2 text-sm">
        ✨ Check each ingredient. Nutrition for new foods is an <b>estimate</b> per 100 g, so match
        to your own saved foods where you can.
      </p>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div>
          <Label htmlFor="imp-name">Meal name</Label>
          <Input id="imp-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="imp-servings">Makes</Label>
          <Input id="imp-servings" type="number" min="1" step="any" value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        The meal is saved as <b>one serving</b>: amounts below are the whole recipe divided by {divisor}.
      </p>

      <ul className="space-y-2">
        {rows.map((r) => {
          const food = foods.find((f) => f.id === r.foodId);
          return (
            <li key={r.key} className="space-y-2 rounded-xl border bg-card p-3">
              <p className="text-sm text-muted-foreground">&ldquo;{r.original}&rdquo;</p>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Food for ${r.name}`}
                  className="min-w-0 flex-1"
                  value={r.foodId}
                  onChange={(e) => setRows((p) => p.map((x) => (x.key === r.key ? { ...x, foodId: e.target.value } : x)))}
                >
                  <option value="new">➕ New: {r.name}</option>
                  {foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.brand ? ` · ${f.brand}` : ""}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  aria-label={`Amount of ${r.name}`}
                  className="w-24"
                  value={r.amountStr !== "" ? r.amountStr : String(amountFor(r))}
                  onChange={(e) => setRows((p) => p.map((x) => (x.key === r.key ? { ...x, amountStr: e.target.value } : x)))}
                />
                <span className="w-5 text-sm text-muted-foreground">{food?.serving_unit ?? r.unit}</span>
              </div>
              {!food && (
                <p className="text-xs text-muted-foreground">
                  Estimate per 100{r.unit}: {Math.round(r.calories_per_100)} kcal · {round(r.protein_per_100)}p ·{" "}
                  {round(r.carbs_per_100)}c · {round(r.fat_per_100)}f
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="rounded-2xl bg-secondary p-4">
        <p className="mb-2 text-sm font-medium">Per serving</p>
        <MacroSummary macros={totals} />
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep("input")}>Back</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save meal"}</Button>
        </div>
      </div>
    </div>
  );
}
