"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionChip } from "@/components/section-chip";
import { MacroSummary } from "@/components/macro-summary";
import { TemplateForm, type DayTemplateFull } from "@/components/day-templates/template-form";
import type { MealWithItems } from "@/components/meals/meal-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DAY_SELECT, MEAL_SELECT } from "@/lib/queries";
import { dayTotals } from "@/lib/nutrition";
import { SLOTS, SLOT_META } from "@/lib/types";

export default function DayTemplatesPage() {
  const [days, setDays] = useState<DayTemplateFull[]>([]);
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"new" | DayTemplateFull | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const sb = getSupabase();
    const [d, m] = await Promise.all([
      sb.from("day_templates").select(DAY_SELECT).order("name"),
      sb.from("meals").select(MEAL_SELECT).order("name"),
    ]);
    if (d.error || m.error) setError((d.error ?? m.error)!.message);
    else {
      setDays(d.data as unknown as DayTemplateFull[]);
      setMeals(m.data as unknown as MealWithItems[]);
    }
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);


  async function duplicate(day: DayTemplateFull) {
    const sb = getSupabase();
    const { data, error: err } = await sb.from("day_templates").insert({ name: `${day.name} (copy)` }).select("id").single();
    if (err) return setError(err.message);
    if (day.day_template_meals.length) {
      const { error: mErr } = await sb.from("day_template_meals").insert(
        day.day_template_meals.map((m) => ({ day_template_id: data.id, meal_id: m.meal_id, slot: m.slot, servings: m.servings })),
      );
      if (mErr) return setError(mErr.message);
    }
    setError(null);
    load();
  }

  async function remove(day: DayTemplateFull) {
    if (!window.confirm(`Delete "${day.name}"?`)) return;
    const { error: err } = await getSupabase().from("day_templates").delete().eq("id", day.id);
    if (err) return setError(err.message);
    setError(null);
    load();
  }

  const done = () => {
    setDialog(null);
    load();
  };

  return (
    <>
      <PageHeader
        title="Day Templates"
        description="Reusable days: breakfast, lunch, dinner and snacks."
        action={
          <Button aria-label="New day" onClick={() => setDialog("new")} disabled={!configured}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New day</span>
          </Button>
        }
      />

      {!configured && (
        <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">
          Supabase isn&apos;t connected yet. Add your keys to <code>.env.local</code> (and Vercel) to save days.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-2xl border border-destructive/50 p-4 text-sm text-destructive" role="alert">{error}</p>
      )}

      <SectionChip emoji="🌿" className="mb-4">All days ({days.length})</SectionChip>

      {loading ? (
        <p className="px-2 text-muted-foreground">Loading…</p>
      ) : days.length === 0 ? (
        <p className="px-2 text-muted-foreground">No days yet. Create one, like &ldquo;High protein day&rdquo; or &ldquo;Light day&rdquo;.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {days.map((d) => (
            <li key={d.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-lg font-bold">{d.name}</h3>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${d.name}`} onClick={() => setDialog(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Duplicate ${d.name}`} onClick={() => duplicate(d)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${d.name}`} onClick={() => remove(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {SLOTS.map((slot) => {
                    const names = d.day_template_meals.filter((m) => m.slot === slot).map((m) => m.meals.name);
                    return (
                      <li key={slot} className="flex gap-2">
                        <span aria-hidden>{SLOT_META[slot].emoji}</span>
                        <span className="sr-only">{SLOT_META[slot].label}:</span>
                        <span className={names.length ? "" : "text-muted-foreground"}>
                          {names.length ? names.join(", ") : "Nothing planned"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <MacroSummary macros={dayTotals(d)} className="mt-4 border-t pt-3" />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        wide
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "new" ? "New day" : "Edit day"}
      >
        {dialog === "new" && <TemplateForm meals={meals} onSaved={done} onCancel={() => setDialog(null)} />}
        {dialog !== null && typeof dialog === "object" && (
          <TemplateForm template={dialog} meals={meals} onSaved={done} onCancel={() => setDialog(null)} />
        )}
      </Dialog>
    </>
  );
}
