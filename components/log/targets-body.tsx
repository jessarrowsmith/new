"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Macros } from "@/lib/types";

const FIELDS: { key: keyof Macros; label: string }[] = [
  { key: "calories", label: "Calories (kcal)" },
  { key: "protein", label: "Protein (g)" },
  { key: "carbs", label: "Carbs (g)" },
  { key: "fat", label: "Fat (g)" },
];

export function TargetsBody({
  targets,
  onSave,
  onCancel,
}: {
  targets: Macros;
  onSave: (t: Macros) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Record<keyof Macros, string>>({
    calories: String(targets.calories),
    protein: String(targets.protein),
    carbs: String(targets.carbs),
    fat: String(targets.fat),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n: Macros = {
      calories: Number(v.calories),
      protein: Number(v.protein),
      carbs: Number(v.carbs),
      fat: Number(v.fat),
    };
    if (Object.values(n).some((x) => !(x > 0))) return setError("Each target must be a number above 0.");
    setSaving(true);
    try {
      await onSave(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string }).message ?? "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Your daily goals. The progress bars in your log use these.</p>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`t-${f.key}`}>{f.label}</Label>
            <Input id={`t-${f.key}`} type="number" inputMode="decimal" step="any" min="0" value={v[f.key]} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save targets"}</Button>
      </div>
    </form>
  );
}
