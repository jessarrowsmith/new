"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionChip } from "@/components/section-chip";
import { MacroSummary } from "@/components/macro-summary";
import { FoodForm } from "@/components/foods/food-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Food } from "@/lib/types";

export default function FoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Food | "new" | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const { data, error: err } = await getSupabase().from("foods").select("*").order("name");
    if (err) setError(err.message);
    else setFoods(data as Food[]);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? foods.filter((f) => `${f.name} ${f.brand ?? ""}`.toLowerCase().includes(q))
      : foods;
  }, [foods, query]);

  async function remove(food: Food) {
    if (!window.confirm(`Delete "${food.name}"?`)) return;
    const { error: err } = await getSupabase().from("foods").delete().eq("id", food.id);
    if (err) {
      setError(
        err.code === "23503"
          ? `"${food.name}" is used in a meal or log, so it can't be deleted. Remove it from there first.`
          : err.message,
      );
      return;
    }
    setError(null);
    load();
  }

  return (
    <>
      <PageHeader
        title="Foods"
        description="Everything you eat, with nutrition per serving."
        action={
          <Button onClick={() => setEditing("new")} disabled={!configured}>
            <Plus className="h-4 w-4" /> Add food
          </Button>
        }
      />

      {!configured && (
        <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">
          Supabase isn&apos;t connected yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> (and Vercel) to
          save foods.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-2xl border border-destructive/50 p-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods or brands"
          className="pl-10"
          aria-label="Search foods"
        />
      </div>

      <SectionChip emoji="🥑" className="mb-4">
        All foods ({shown.length})
      </SectionChip>

      {loading ? (
        <p className="px-2 text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="px-2 text-muted-foreground">
          {foods.length === 0
            ? "No foods yet. Add your first one, or snap a nutrition label."
            : "Nothing matches that search."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((f) => (
            <li key={f.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold">{f.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {f.brand ? `${f.brand} · ` : ""}
                      {f.serving_size}
                      {f.serving_unit} serving
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${f.name}`} onClick={() => remove(f)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <MacroSummary macros={f} className="mt-3" />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Fibre {f.fibre}g · Sugar {f.sugar}g
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add food" : "Edit food"}
      >
        {editing !== null && (
          <FoodForm
            food={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
