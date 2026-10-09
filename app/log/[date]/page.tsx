"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { SectionChip } from "@/components/section-chip";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { AddEntryBody } from "@/components/log/add-entry-body";
import { TargetsBody } from "@/components/log/targets-body";
import type { DailyLogFull, LogEntryFull } from "@/components/log/log-types";
import type { DayTemplateFull } from "@/components/day-templates/template-form";
import type { MealWithItems } from "@/components/meals/meal-form";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DAY_SELECT, LOG_SELECT, MEAL_SELECT, WEEK_SELECT } from "@/lib/queries";
import { entryMacros, round, sumMacros } from "@/lib/nutrition";
import { addDays, formatLong, isValidISO, parseISO, toISO, weekdayIndex } from "@/lib/dates";
import { useTargets } from "@/lib/use-settings";
import { SLOTS, SLOT_META, type Food, type Slot, type WeekPlanFull } from "@/lib/types";

/** Amount shown for an entry: grams/ml for a food, servings for a meal. */
function EntryRow({
  entry,
  onChange,
  onCommit,
  onDelete,
}: {
  entry: LogEntryFull;
  onChange: (servings: number) => void;
  onCommit: (servings: number) => void;
  onDelete: () => void;
}) {
  const food = entry.foods;
  const toDisplay = (servings: number) => String(round(food ? servings * food.serving_size : servings, 2));
  const [text, setText] = useState(toDisplay(entry.servings));
  const name = food?.name ?? entry.meals?.name ?? "Removed item";
  const unit = food ? food.serving_unit : entry.servings === 1 ? "serving" : "servings";
  const toServings = (t: string) => (food ? Number(t) / food.serving_size : Number(t));

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="text-sm tabular-nums text-muted-foreground">{Math.round(entryMacros(entry).calories)} kcal</p>
      </div>
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        aria-label={`Amount of ${name}`}
        className="h-11 w-20 px-2 text-center"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const s = toServings(e.target.value);
          if (s > 0) onChange(s);
        }}
        onBlur={() => {
          const s = toServings(text);
          if (s > 0) {
            onCommit(s);
            setText(toDisplay(s));
          } else setText(toDisplay(entry.servings)); // reject empty / 0
        }}
      />
      <span className="w-12 text-sm text-muted-foreground">{unit}</span>
      <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function DayLogPage({ params }: { params: { date: string } }) {
  const date = params.date;
  const valid = isValidISO(date);
  const configured = isSupabaseConfigured();
  const { targets, save: saveTargets } = useTargets();

  const [log, setLog] = useState<DailyLogFull | null>(null);
  const [entries, setEntries] = useState<LogEntryFull[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [templates, setTemplates] = useState<DayTemplateFull[]>([]);
  const [planned, setPlanned] = useState<DayTemplateFull | null>(null);
  const [pickTemplate, setPickTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addSlot, setAddSlot] = useState<Slot | null>(null);
  const [showTargets, setShowTargets] = useState(false);

  const load = useCallback(async () => {
    if (!configured || !valid) return setLoading(false);
    const sb = getSupabase();
    const [l, f, m, t, w] = await Promise.all([
      sb.from("daily_logs").select(LOG_SELECT).eq("log_date", date).maybeSingle(),
      sb.from("foods").select("*").order("name"),
      sb.from("meals").select(MEAL_SELECT).order("name"),
      sb.from("day_templates").select(DAY_SELECT).order("name"),
      sb.from("week_plans").select(WEEK_SELECT).eq("is_template", false).maybeSingle(),
    ]);
    const failed = [l, f, m, t].find((r) => r.error);
    if (failed?.error) {
      setError(failed.error.message);
      return setLoading(false);
    }
    const lg = l.data as unknown as DailyLogFull | null;
    setLog(lg);
    setEntries([...(lg?.log_entries ?? [])].sort((a, b) => a.logged_at.localeCompare(b.logged_at)));
    setFoods(f.data as Food[]);
    setMeals(m.data as unknown as MealWithItems[]);
    const tpls = t.data as unknown as DayTemplateFull[];
    setTemplates(tpls);
    // suggestion: whatever the weekly planner has for this weekday
    const plan = w.data as unknown as WeekPlanFull | null;
    const tid = plan?.week_plan_days.find((d) => d.day_of_week === weekdayIndex(parseISO(date)))?.day_template_id;
    setPlanned(tpls.find((x) => x.id === tid) ?? null);
    setLoading(false);
  }, [configured, valid, date]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => sumMacros(entries.map(entryMacros)), [entries]);

  /** The log row is created lazily on the first thing you add. */
  async function ensureLog(): Promise<string> {
    if (log) return log.id;
    const { data, error: err } = await getSupabase()
      .from("daily_logs")
      .upsert({ log_date: date }, { onConflict: "log_date" })
      .select("id")
      .single();
    if (err) throw err;
    return data.id as string;
  }

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string }).message ?? "Something went wrong.");
    }
    await load();
  }

  const addEntry = (slot: Slot, row: { food_id?: string; meal_id?: string }) =>
    run(async () => {
      const id = await ensureLog();
      const { error: err } = await getSupabase().from("log_entries").insert({ daily_log_id: id, slot, servings: 1, ...row });
      if (err) throw err;
    });

  async function commitServings(entry: LogEntryFull, servings: number) {
    const { error: err } = await getSupabase().from("log_entries").update({ servings }).eq("id", entry.id);
    if (err) {
      setError(err.message);
      load();
    }
  }

  const removeEntry = (entry: LogEntryFull) => {
    setEntries((p) => p.filter((e) => e.id !== entry.id));
    return run(async () => {
      const { error: err } = await getSupabase().from("log_entries").delete().eq("id", entry.id);
      if (err) throw err;
    });
  };

  const loadTemplate = (tpl: DayTemplateFull) => {
    if (entries.length && !window.confirm(`Replace today's ${entries.length} logged item${entries.length === 1 ? "" : "s"} with "${tpl.name}"?`)) return;
    return run(async () => {
      const sb = getSupabase();
      const id = await ensureLog();
      if (entries.length) {
        const { error: dErr } = await sb.from("log_entries").delete().eq("daily_log_id", id);
        if (dErr) throw dErr;
      }
      if (tpl.day_template_meals.length) {
        const { error: iErr } = await sb.from("log_entries").insert(
          tpl.day_template_meals.map((m) => ({ daily_log_id: id, meal_id: m.meal_id, slot: m.slot, servings: m.servings })),
        );
        if (iErr) throw iErr;
      }
      const { error: uErr } = await sb.from("daily_logs").update({ day_template_id: tpl.id }).eq("id", id);
      if (uErr) throw uErr;
    });
  };

  if (!valid) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        That isn&apos;t a valid date. <Link className="text-primary underline" href="/log">Back to the calendar</Link>
      </p>
    );
  }

  const isToday = date === toISO(new Date());

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/log" className="text-sm text-primary underline">← Calendar</Link>
        <Button variant="outline" size="sm" onClick={() => setShowTargets(true)} disabled={!configured}>
          <Target className="h-4 w-4" /> Targets
        </Button>
      </div>
      <div className="mb-5 flex items-center justify-between gap-2">
        <Link href={`/log/${addDays(date, -1)}`} aria-label="Previous day" className="rounded-full p-2 hover:bg-secondary">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
          {formatLong(date)}
          {isToday && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle text-xs font-medium">today</span>}
        </h1>
        <Link href={`/log/${addDays(date, 1)}`} aria-label="Next day" className="rounded-full p-2 hover:bg-secondary">
          <ChevronRight className="h-6 w-6" />
        </Link>
      </div>

      {!configured && (
        <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">Supabase isn&apos;t connected yet. Add your keys to <code>.env.local</code> (and Vercel) to log food.</p>
      )}
      {error && <p className="mb-4 rounded-2xl border border-destructive/50 p-4 text-sm text-destructive" role="alert">{error}</p>}

      {/* Running totals: stays on screen while you scroll the day on a phone */}
      <Card className="sticky top-14 z-20 mb-5 space-y-3 p-3 shadow-md sm:p-4 md:top-2">
        <ProgressBar large label="Calories" value={totals.calories} target={targets.calories} colorClass="bg-cal" />
        <div className="grid grid-cols-3 gap-3">
          <ProgressBar stacked label="Protein" unit="g" value={totals.protein} target={targets.protein} colorClass="bg-protein" />
          <ProgressBar stacked label="Carbs" unit="g" value={totals.carbs} target={targets.carbs} colorClass="bg-carbs" />
          <ProgressBar stacked label="Fat" unit="g" value={totals.fat} target={targets.fat} colorClass="bg-fat" />
        </div>
      </Card>

      {loading ? (
        <p className="px-2 text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          {configured && (
            <Card className="space-y-3 bg-secondary p-4">
              <p className="flex items-center gap-2 font-bold">
                <Sparkles className="h-4 w-4" /> Start from a day template
              </p>
              {planned && (
                <Button className="w-full sm:w-auto" onClick={() => loadTemplate(planned)}>
                  Use planner&apos;s {parseISO(date).toLocaleDateString(undefined, { weekday: "long" })}: {planned.name}
                </Button>
              )}
              <div className="flex gap-2">
                <Select aria-label="Day template to load" value={pickTemplate} onChange={(e) => setPickTemplate(e.target.value)}>
                  <option value="">Choose a day template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  disabled={!pickTemplate}
                  onClick={() => {
                    const t = templates.find((x) => x.id === pickTemplate);
                    if (t) loadTemplate(t);
                  }}
                >
                  Load
                </Button>
              </div>
            </Card>
          )}

          {SLOTS.map((slot) => {
            const rows = entries.filter((e) => e.slot === slot);
            const { label, emoji } = SLOT_META[slot];
            return (
              <section key={slot} className="space-y-2">
                <SectionChip emoji={emoji} className="py-2.5">
                  <span className="flex-1">{label}</span>
                  {rows.length > 0 && (
                    <span className="text-sm font-normal tabular-nums text-muted-foreground">
                      {Math.round(sumMacros(rows.map(entryMacros)).calories)} kcal
                    </span>
                  )}
                </SectionChip>
                {rows.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    onChange={(s) => setEntries((p) => p.map((x) => (x.id === e.id ? { ...x, servings: s } : x)))}
                    onCommit={(s) => commitServings(e, s)}
                    onDelete={() => removeEntry(e)}
                  />
                ))}
                <Button variant="outline" className="h-12 w-full" disabled={!configured} onClick={() => setAddSlot(slot)}>
                  <Plus className="h-4 w-4" /> Add to {label.toLowerCase()}
                </Button>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={addSlot !== null} onClose={() => setAddSlot(null)} title={addSlot ? `Add to ${SLOT_META[addSlot].label.toLowerCase()}` : ""}>
        {addSlot && (
          <AddEntryBody
            foods={foods}
            meals={meals}
            onAddFood={(f) => {
              setAddSlot(null);
              addEntry(addSlot, { food_id: f.id });
            }}
            onAddMeal={(m) => {
              setAddSlot(null);
              addEntry(addSlot, { meal_id: m.id });
            }}
          />
        )}
      </Dialog>
      <Dialog open={showTargets} onClose={() => setShowTargets(false)} title="Daily targets">
        {showTargets && (
          <TargetsBody
            targets={targets}
            onSave={async (t) => {
              await saveTargets(t);
              setShowTargets(false);
            }}
            onCancel={() => setShowTargets(false)}
          />
        )}
      </Dialog>
    </>
  );
}
