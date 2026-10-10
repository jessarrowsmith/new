"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderOpen, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionChip } from "@/components/section-chip";
import { MacroSummary } from "@/components/macro-summary";
import { LoadWeekBody, SaveWeekBody } from "@/components/planner/week-dialogs";
import type { DayTemplateFull } from "@/components/day-templates/template-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DAY_SELECT, WEEK_SELECT } from "@/lib/queries";
import { dayTotals, sumMacros, ZERO_MACROS } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { DAY_NAMES, SLOTS, SLOT_META, type Macros, type WeekPlanFull } from "@/lib/types";

const CURRENT = "Current";
const DAYS = [0, 1, 2, 3, 4, 5, 6];
/** Monday = 0 */
const todayIndex = () => (new Date().getDay() + 6) % 7;

export default function PlannerPage() {
  const [days, setDays] = useState<DayTemplateFull[]>([]);
  const [current, setCurrent] = useState<WeekPlanFull | null>(null);
  const [templates, setTemplates] = useState<WeekPlanFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"save" | "load" | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const sb = getSupabase();
    const [d, w] = await Promise.all([
      sb.from("day_templates").select(DAY_SELECT).order("name"),
      sb.from("week_plans").select(WEEK_SELECT).order("name"),
    ]);
    if (d.error || w.error) {
      setError((d.error ?? w.error)!.message);
      return setLoading(false);
    }
    const plans = w.data as unknown as WeekPlanFull[];
    let cur = plans.find((p) => !p.is_template) ?? null;
    if (!cur) {
      // The unique index guarantees only one "Current" exists, even if two loads race.
      const ins = await sb.from("week_plans").insert({ name: CURRENT, is_template: false }).select(WEEK_SELECT).single();
      if (ins.error) {
        const again = await sb.from("week_plans").select(WEEK_SELECT).eq("is_template", false).single();
        if (again.error) {
          setError(ins.error.message);
          return setLoading(false);
        }
        cur = again.data as unknown as WeekPlanFull;
      } else cur = ins.data as unknown as WeekPlanFull;
    }
    setDays(d.data as unknown as DayTemplateFull[]);
    setCurrent(cur);
    setTemplates(plans.filter((p) => p.is_template));
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map(days.map((d) => [d.id, d])), [days]);
  const assignedId = (plan: WeekPlanFull, i: number) =>
    plan.week_plan_days.find((x) => x.day_of_week === i)?.day_template_id ?? null;
  const dayFor = (plan: WeekPlanFull, i: number) => {
    const id = assignedId(plan, i);
    return id ? byId.get(id) ?? null : null;
  };
  const weekTotals = (plan: WeekPlanFull): Macros =>
    sumMacros(DAYS.map((i) => dayFor(plan, i)).filter((d): d is DayTemplateFull => !!d).map(dayTotals));

  async function assign(i: number, dayTemplateId: string | null) {
    if (!current) return;
    const before = current;
    // optimistic: update the screen first, roll back if the save fails
    const rest = current.week_plan_days.filter((x) => x.day_of_week !== i);
    setCurrent({
      ...current,
      week_plan_days: [...rest, { id: `tmp${i}`, week_plan_id: current.id, day_of_week: i, day_template_id: dayTemplateId }],
    });
    const { error: err } = await getSupabase()
      .from("week_plan_days")
      .upsert({ week_plan_id: current.id, day_of_week: i, day_template_id: dayTemplateId }, { onConflict: "week_plan_id,day_of_week" });
    if (err) {
      setCurrent(before);
      setError(err.message);
    } else setError(null);
  }

  async function saveWeek(name: string) {
    if (!current) return;
    const sb = getSupabase();
    const { data, error: err } = await sb.from("week_plans").insert({ name, is_template: true }).select("id").single();
    if (err) throw err;
    const { error: dErr } = await sb.from("week_plan_days").insert(
      DAYS.map((i) => ({ week_plan_id: data.id, day_of_week: i, day_template_id: assignedId(current, i) })),
    );
    if (dErr) {
      await sb.from("week_plans").delete().eq("id", data.id); // don't leave an empty template behind
      throw dErr;
    }
    setDialog(null);
    load();
  }

  async function loadWeek(plan: WeekPlanFull) {
    if (!current) return;
    const { error: err } = await getSupabase()
      .from("week_plan_days")
      .upsert(
        DAYS.map((i) => ({ week_plan_id: current.id, day_of_week: i, day_template_id: assignedId(plan, i) })),
        { onConflict: "week_plan_id,day_of_week" },
      );
    if (err) return setError(err.message);
    setError(null);
    setDialog(null);
    load();
  }

  async function deleteWeek(plan: WeekPlanFull) {
    if (!window.confirm(`Delete the saved week "${plan.name}"?`)) return;
    const { error: err } = await getSupabase().from("week_plans").delete().eq("id", plan.id);
    if (err) return setError(err.message);
    load();
  }

  const planned = current ? DAYS.filter((i) => dayFor(current, i)) : [];
  const total = current ? weekTotals(current) : ZERO_MACROS;
  const average: Macros = planned.length
    ? {
        calories: total.calories / planned.length,
        protein: total.protein / planned.length,
        carbs: total.carbs / planned.length,
        fat: total.fat / planned.length,
      }
    : ZERO_MACROS;
  const today = todayIndex();

  return (
    <>
      <PageHeader
        title="Planner"
        description="Pick a day template for each day of the week."
        action={
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" aria-label="Load a saved week" disabled={!configured} onClick={() => setDialog("load")}>
              <FolderOpen className="h-4 w-4" /> <span className="hidden sm:inline">Load week</span>
            </Button>
            <Button aria-label="Save week" disabled={!configured || !current} onClick={() => setDialog("save")}>
              <Save className="h-4 w-4" /> <span className="hidden sm:inline">Save week</span>
            </Button>
          </div>
        }
      />

      {!configured && (
        <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">
          Supabase isn&apos;t connected yet. Add your keys to <code>.env.local</code> (and Vercel) to plan your week.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-2xl border border-destructive/50 p-4 text-sm text-destructive" role="alert">{error}</p>
      )}

      <SectionChip emoji="🗓️" className="mb-4">This week</SectionChip>

      {loading ? (
        <p className="px-2 text-muted-foreground">Loading…</p>
      ) : !current ? null : (
        <>
          {days.length === 0 && (
            <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">
              You haven&apos;t made any day templates yet. Create some on the Day Templates page, then come back to plan your week.
            </p>
          )}
          <ul className="space-y-3">
            {DAYS.map((i) => {
              const day = dayFor(current, i);
              return (
                <li key={i}>
                  <Card
                    className={cn(
                      "grid gap-3 p-4 md:grid-cols-[8rem_14rem_1fr_17rem] md:items-center",
                      i === today && "border-primary/60 ring-1 ring-primary/30",
                    )}
                  >
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      {DAY_NAMES[i]}
                      {i === today && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">today</span>}
                    </h3>
                    <Select
                      aria-label={`Day template for ${DAY_NAMES[i]}`}
                      value={day?.id ?? ""}
                      onChange={(e) => assign(i, e.target.value || null)}
                    >
                      <option value="">— Nothing planned —</option>
                      {days.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </Select>
                    <ul className="space-y-0.5 text-sm">
                      {day ? (
                        SLOTS.map((slot) => {
                          const names = day.day_template_meals.filter((m) => m.slot === slot).map((m) => m.meals.name);
                          return names.length ? (
                            <li key={slot} className="flex gap-2">
                              <span aria-hidden>{SLOT_META[slot].emoji}</span>
                              <span className="sr-only">{SLOT_META[slot].label}:</span>
                              <span className="min-w-0 truncate">{names.join(", ")}</span>
                            </li>
                          ) : null;
                        })
                      ) : (
                        <li className="text-muted-foreground">Rest day or free choice</li>
                      )}
                    </ul>
                    <MacroSummary macros={day ? dayTotals(day) : ZERO_MACROS} className={cn(!day && "opacity-40")} />
                  </Card>
                </li>
              );
            })}
          </ul>

          <Card className="mt-6 bg-secondary p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-base font-bold">Weekly total</h3>
                <MacroSummary macros={total} />
              </div>
              <div>
                <h3 className="mb-2 text-base font-bold">
                  Daily average <span className="text-sm font-normal text-muted-foreground">({planned.length} planned day{planned.length === 1 ? "" : "s"})</span>
                </h3>
                <MacroSummary macros={average} />
              </div>
            </div>
          </Card>
        </>
      )}

      <Dialog open={dialog === "save"} onClose={() => setDialog(null)} title="Save this week">
        {dialog === "save" && (
          <SaveWeekBody existingNames={templates.map((t) => t.name)} onSave={saveWeek} onCancel={() => setDialog(null)} />
        )}
      </Dialog>
      <Dialog open={dialog === "load"} onClose={() => setDialog(null)} title="Load a saved week">
        {dialog === "load" && (
          <LoadWeekBody
            templates={templates}
            totalsFor={weekTotals}
            dayNameFor={(p, i) => dayFor(p, i)?.name ?? null}
            onLoad={loadWeek}
            onDelete={deleteWeek}
            onCancel={() => setDialog(null)}
          />
        )}
      </Dialog>
    </>
  );
}
