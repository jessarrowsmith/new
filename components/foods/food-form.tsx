"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
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

  const set = (k: keyof Fields, v: string) => setF((p) => ({ ...p, [k]: v }));

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
      setF({
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
      });
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
    setSaving(false);
    if (err) return setError(err.message);
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
          <Input id="serving" type="number" inputMode="decimal" step="any" value={f.serving_size} onChange={(e) => set("serving_size", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="unit">Unit</Label>
          <Select id="unit" value={f.serving_unit} onChange={(e) => set("serving_unit", e.target.value)}>
            <option value="g">g</option>
            <option value="ml">ml</option>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Nutrition per serving</p>
      <div className="grid grid-cols-2 gap-3">
        {NUMERIC.map((k) => (
          <div key={k}>
            <Label htmlFor={k}>{LABELS[k]}</Label>
            <Input id={k} type="number" inputMode="decimal" step="any" min="0" value={f[k]} onChange={(e) => set(k, e.target.value)} />
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
