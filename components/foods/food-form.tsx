"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import { rescaleServings, scaleNutrition } from "@/lib/nutrition";
import type { Food } from "@/lib/types";

type Fields = {
  name: string;
  brand: string;
  serving_size: string;
  serving_unit: "g" | "ml";
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  sugar: string;
};

const NUMERIC = ["calories", "protein", "carbs", "fat", "fibre", "sugar"] as const;
const LABELS: Record<(typeof NUMERIC)[number], string> = {
  calories: "Calories (kcal)",
  protein: "Protein (g)",
  carbs: "Carbs (g)",
  fat: "Fat (g)",
  fibre: "Fibre (g)",
  sugar: "Sugar (g)",
};

function toFields(f?: Food): Fields {
  return {
    name: f?.name ?? "",
    brand: f?.brand ?? "",
    serving_size: String(f?.serving_size ?? 100),
    serving_unit: f?.serving_unit ?? "g",
    calories: String(f?.calories ?? ""),
    protein: String(f?.protein ?? ""),
    carbs: String(f?.carbs ?? ""),
    fat: String(f?.fat ?? ""),
    fibre: String(f?.fibre ?? ""),
    sugar: String(f?.sugar ?? ""),
  };
}

export function FoodForm({
  food,
  onSaved,
  onCancel,
}: {
  food?: Food;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Fields>(() => toFields(food));
  const [fromPhoto, setFromPhoto] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // When on, changing the serving size rescales the nutrition so it stays the same per g/ml.
  const [scale, setScale] = useState(true);
  // The numbers the scaling starts from. Rescaling always works from these (not from the
  // already-rounded numbers on screen), so going 40 -> 50 -> 40 lands back on the originals.
  const base = useRef<{ serving: number; vals: Partial<Record<(typeof NUMERIC)[number], number>> }>(
    rebase(toFields(food)),
  );

  function rebase(fields: Fields) {
    const vals: Partial<Record<(typeof NUMERIC)[number], number>> = {};
    for (const k of NUMERIC) if (fields[k].trim() !== "" && !Number.isNaN(Number(fields[k]))) vals[k] = Number(fields[k]);
    return { serving: Number(fields.serving_size) || 0, vals };
  }

  const set = (k: keyof Fields, v: string) => setF((p) => ({ ...p, [k]: v }));

  function changeServing(v: string) {
    const next = Number(v);
    setF((p) => {
      const out = { ...p, serving_size: v };
      if (scale && next > 0 && base.current.serving > 0) {
        for (const k of NUMERIC) {
          const b = base.current.vals[k];
          if (b !== undefined) out[k] = String(scaleNutrition(b, base.current.serving, next));
        }
      }
      return out;
    });
  }

  /** Typing your own nutrition number makes it the new starting point for scaling. */
  function changeNutrition(k: (typeof NUMERIC)[number], v: string) {
    const next = { ...f, [k]: v };
    setF(next);
    base.current = rebase(next);
  }

  function toggleScale(on: boolean) {
    setScale(on);
    if (on) base.current = rebase(f);
  }

  async function readLabel(file: File) {
    setError(null);
    setReading(true);
    try {
      const image = await compressImage(file);
      const res = await fetch("/api/foods/read-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mediaType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read the label.");
      const x = data.food;
      const filled: Fields = {
        name: x.name ?? "",
        brand: x.brand ?? "",
        serving_size: String(x.serving_size ?? 100),
        serving_unit: x.serving_unit === "ml" ? "ml" : "g",
        calories: String(x.calories ?? 0),
        protein: String(x.protein ?? 0),
        carbs: String(x.carbs ?? 0),
        fat: String(x.fat ?? 0),
        fibre: String(x.fibre ?? 0),
        sugar: String(x.sugar ?? 0),
      };
      setF(filled);
      base.current = rebase(filled);
      setFromPhoto(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the label.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const serving = Number(f.serving_size);
    if (!f.name.trim()) return setError("Give the food a name.");
    if (!(serving > 0)) return setError("Serving size must be more than 0.");
    const nums = Object.fromEntries(NUMERIC.map((k) => [k, Number(f[k] || 0)]));
    if (Object.values(nums).some((n) => Number.isNaN(n) || n < 0))
      return setError("Nutrition values must be numbers, 0 or more.");

    setSaving(true);
    const row = {
      name: f.name.trim(),
      brand: f.brand.trim() || null,
      serving_size: serving,
      serving_unit: f.serving_unit,
      ...nums,
      ...(food ? {} : { source: fromPhoto ? "photo" : "manual" }),
    };
    const sb = getSupabase();
    const { error: err } = food
      ? await sb.from("foods").update(row).eq("id", food.id)
      : await sb.from("foods").insert(row);
    if (err) {
      setSaving(false);
      return setError(err.message);
    }

    // Meals and log entries store "number of servings". If the serving size changed with nutrition
    // kept the same per g/ml, convert them so the grams you actually ate don't change.
    if (food && scale && Math.abs(serving - food.serving_size) > 1e-9) {
      const touched: { table: "meal_items" | "log_entries"; id: string; servings: number }[] = [];
      // Undo everything (food and any rows already converted) so nothing is left half-converted.
      const rollBack = async (msg: string) => {
        await Promise.all(touched.map((r) => sb.from(r.table).update({ servings: r.servings }).eq("id", r.id)));
        await sb
          .from("foods")
          .update({ serving_size: food.serving_size, serving_unit: food.serving_unit, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fibre: food.fibre, sugar: food.sugar })
          .eq("id", food.id);
        setSaving(false);
        setError(`Couldn't update the meals that use this food, so nothing was changed. (${msg})`);
      };
      for (const table of ["meal_items", "log_entries"] as const) {
        const { data, error: qErr } = await sb.from(table).select("id, servings").eq("food_id", food.id);
        if (qErr) return rollBack(qErr.message);
        const rows = (data ?? []) as { id: string; servings: number }[];
        rows.forEach((r) => touched.push({ table, id: r.id, servings: r.servings })); // remember originals first
        const results = await Promise.all(
          rows.map((r) => sb.from(table).update({ servings: rescaleServings(r.servings, food.serving_size, serving) }).eq("id", r.id)),
        );
        const bad = results.find((r) => r.error);
        if (bad?.error) return rollBack(bad.error.message);
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!food && (
        <div className="rounded-2xl bg-secondary p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Snap or upload a nutrition label and I&apos;ll fill the form in. You can check
            and edit everything before saving.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && readLabel(e.target.files[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
          >
            {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {reading ? "Reading label…" : "Photo of nutrition label"}
          </Button>
        </div>
      )}

      {fromPhoto && (
        <p className="rounded-xl border border-primary/40 px-3 py-2 text-sm">
          ✨ Filled from your photo. Please double-check the numbers before saving.
        </p>
      )}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Greek yoghurt" />
      </div>
      <div>
        <Label htmlFor="brand">Brand (optional)</Label>
        <Input id="brand" value={f.brand} onChange={(e) => set("brand", e.target.value)} />
      </div>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div>
          <Label htmlFor="serving">Serving size</Label>
          <Input id="serving" type="number" inputMode="decimal" step="any" value={f.serving_size} onChange={(e) => changeServing(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="unit">Unit</Label>
          <Select id="unit" value={f.serving_unit} onChange={(e) => set("serving_unit", e.target.value)}>
            <option value="g">g</option>
            <option value="ml">ml</option>
          </Select>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-secondary p-3 text-sm">
        <input
          type="checkbox"
          checked={scale}
          onChange={(e) => toggleScale(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[hsl(var(--primary))]"
        />
        <span>
          <span className="font-medium">Adjust nutrition when I change the serving size</span>
          <span className="block text-muted-foreground">
            Keeps the same nutrition per {f.serving_unit}, so doubling the serving size doubles the numbers.
            {food && scale && Number(f.serving_size) > 0 && Math.abs(Number(f.serving_size) - food.serving_size) > 1e-9 && (
              <> Meals and logs that use this food keep the same amount in {f.serving_unit}.</>
            )}
          </span>
        </span>
      </label>

      <p className="text-sm text-muted-foreground">Nutrition per {Number(f.serving_size) > 0 ? `${f.serving_size} ${f.serving_unit}` : "serving"}</p>
      <div className="grid grid-cols-2 gap-3">
        {NUMERIC.map((k) => (
          <div key={k}>
            <Label htmlFor={k}>{LABELS[k]}</Label>
            <Input id={k} type="number" inputMode="decimal" step="any" min="0" value={f[k]} onChange={(e) => changeNutrition(k, e.target.value)} />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || reading}>
          {saving ? "Saving…" : food ? "Save changes" : "Add food"}
        </Button>
      </div>
    </form>
  );
}
