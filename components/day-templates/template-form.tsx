"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SectionChip } from "@/components/section-chip";
import { MacroSummary } from "@/components/macro-summary";
import { MealPicker } from "@/components/day-templates/meal-picker";
import type { MealWithItems } from "@/components/meals/meal-form";
import { getSupabase } from "@/lib/supabase";
import { foodMacros, mealTotals, round, sumMacros } from "@/lib/nutrition";
import { SLOTS, SLOT_META, type DayTemplate, type DayTemplateMeal, type Slot } from "@/lib/types";

export type DayTemplateFull = DayTemplate & {
  day_template_meals: (DayTemplateMeal & { meals: MealWithItems })[];
};

type Row = { key: string; slot: Slot; meal: MealWithItems; servings: string };

export function TemplateForm({
  template,
  meals,
  onSaved,
  onCancel,
}: {
  template?: DayTemplateFull;
  meals: MealWithItems[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    (template?.day_template_meals ?? []).map((m) => ({
      key: m.id,
      slot: m.slot,
      meal: m.meals,
      servings: String(round(m.servings, 2)),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rowMacros = (r: Row) => foodMacros(mealTotals(r.meal), Number(r.servings) || 0);
  const totals = useMemo(() => sumMacros(rows.map(rowMacros)), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the day a name.");
    if (rows.some((r) => !(Number(r.servings) > 0))) return setError("Every meal needs servings above 0.");

    setSaving(true);
    const sb = getSupabase();
    const fail = (msg: string) => {
      setSaving(false);
      setError(msg);
    };
    let id = template?.id;
    if (template) {
      const { error: err } = await sb.from("day_templates").update({ name: name.trim() }).eq("id", template.id);
      if (err) return fail(err.message);
    } else {
      const { data, error: err } = await sb.from("day_templates").insert({ name: name.trim() }).select("id").single();
      if (err) return fail(err.message);
      id = data.id;
    }

    // Insert the new rows first, then drop the old ones, so a failure never leaves the day empty.
    const oldIds = (template?.day_template_meals ?? []).map((m) => m.id);
    if (rows.length) {
      const { error: insErr } = await sb.from("day_template_meals").insert(
        rows.map((r) => ({ day_template_id: id, meal_id: r.meal.id, slot: r.slot, servings: Number(r.servings) })),
      );
      if (insErr) return fail(insErr.message);
    }
    if (oldIds.length) {
      const { error: delErr } = await sb.from("day_template_meals").delete().in("id", oldIds);
      if (delErr) return fail(delErr.message);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="day-name">Name</Label>
        <Input id="day-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High protein day" />
      </div>

      {SLOTS.map((slot) => {
        const slotRows = rows.filter((r) => r.slot === slot);
        const { label, emoji } = SLOT_META[slot];
        const slotCals = sumMacros(slotRows.map(rowMacros)).calories;
        return (
          <section key={slot} className="space-y-2">
            <SectionChip emoji={emoji} className="py-2 text-base">
              <span className="flex-1">{label}</span>
              {slotRows.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">{Math.round(slotCals)} kcal</span>
              )}
            </SectionChip>
            {slotRows.map((r) => (
              <div key={r.key} className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.meal.name}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(rowMacros(r).calories)} kcal</p>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0"
                  aria-label={`Servings of ${r.meal.name} at ${label}`}
                  className="h-10 w-20"
                  value={r.servings}
                  onChange={(e) => setRows((p) => p.map((x) => (x.key === r.key ? { ...x, servings: e.target.value } : x)))}
                />
                <span className="text-sm text-muted-foreground">×</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${r.meal.name} from ${label}`}
                  onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <MealPicker
              meals={meals}
              label={label}
              onPick={(meal) => setRows((p) => [...p, { key: crypto.randomUUID(), slot, meal, servings: "1" }])}
            />
          </section>
        );
      })}

      {/* Sticky footer: day totals + actions stay visible while scrolling the slots */}
      <div className="sticky -bottom-6 -mx-5 space-y-3 border-t bg-background px-5 pb-6 pt-3">
        <MacroSummary macros={totals} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : template ? "Save changes" : "Create day"}</Button>
        </div>
      </div>
    </form>
  );
}
