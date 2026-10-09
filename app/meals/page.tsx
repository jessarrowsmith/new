"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionChip } from "@/components/section-chip";
import { MacroSummary } from "@/components/macro-summary";
import { MealForm, type MealWithItems } from "@/components/meals/meal-form";
import { ImportDialogBody } from "@/components/meals/import-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { mealTotals, round } from "@/lib/nutrition";
import { MEAL_SELECT } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { Food } from "@/lib/types";

export default function MealsPage() {
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"new" | "import" | MealWithItems | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const sb = getSupabase();
    const [m, f] = await Promise.all([
      sb.from("meals").select(MEAL_SELECT).order("name"),
      sb.from("foods").select("*").order("name"),
    ]);
    if (m.error || f.error) setError((m.error ?? f.error)!.message);
    else {
      setMeals(m.data as unknown as MealWithItems[]);
      setFoods(f.data as Food[]);
    }
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? meals.filter((m) => m.name.toLowerCase().includes(q)) : meals;
  }, [meals, query]);

  async function remove(meal: MealWithItems) {
    if (!window.confirm(`Delete "${meal.name}"?`)) return;
    const { error: err } = await getSupabase().from("meals").delete().eq("id", meal.id);
    if (err) {
      setError(
        err.code === "23503"
          ? `"${meal.name}" is used in a day template or log, so it can't be deleted. Remove it from there first.`
          : err.message,
      );
      return;
    }
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
        title="Meals"
        description="Build meals from your foods, or import a recipe."
        action={
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" aria-label="Import recipe" onClick={() => setDialog("import")} disabled={!configured}>
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
            </Button>
            <Button aria-label="New meal" onClick={() => setDialog("new")} disabled={!configured}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New meal</span>
            </Button>
          </div>
        }
      />

      {!configured && (
        <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">
          Supabase isn&apos;t connected yet. Add your keys to <code>.env.local</code> (and Vercel) to save meals.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-2xl border border-destructive/50 p-4 text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search meals" className="pl-10" aria-label="Search meals" />
      </div>

      <SectionChip emoji="🍽️" className="mb-4">All meals ({shown.length})</SectionChip>

      {loading ? (
        <p className="px-2 text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="px-2 text-muted-foreground">
          {meals.length === 0 ? "No meals yet. Create one from your foods, or import a recipe." : "Nothing matches that search."}
        </p>
      ) : (
        <ul className="grid items-start gap-3 md:grid-cols-2">
          {shown.map((m) => {
            const expanded = open === m.id;
            return (
              <li key={m.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : m.id)}
                    >
                      <h3 className="truncate text-base font-bold">{m.name}</h3>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        {m.meal_items.length} food{m.meal_items.length === 1 ? "" : "s"}
                        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                      </p>
                    </button>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${m.name}`} onClick={() => setDialog(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${m.name}`} onClick={() => remove(m)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <MacroSummary macros={mealTotals(m)} className="mt-3" />
                  {expanded && (
                    <div className="mt-4 space-y-1 border-t pt-3 text-sm">
                      {m.meal_items.map((i) => (
                        <p key={i.id} className="flex justify-between gap-3">
                          <span className="truncate">{i.foods.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {round(i.servings * i.foods.serving_size)}
                            {i.foods.serving_unit}
                          </span>
                        </p>
                      ))}
                      {m.source_url && (
                        <a href={m.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary underline">
                          Recipe source <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "import" ? "Import a recipe" : dialog === "new" ? "New meal" : "Edit meal"}
      >
        {dialog === "import" && <ImportDialogBody foods={foods} onSaved={done} onCancel={() => setDialog(null)} />}
        {dialog === "new" && <MealForm foods={foods} onSaved={done} onCancel={() => setDialog(null)} />}
        {dialog !== null && typeof dialog === "object" && (
          <MealForm meal={dialog} foods={foods} onSaved={done} onCancel={() => setDialog(null)} />
        )}
      </Dialog>
    </>
  );
}
