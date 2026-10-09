"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Share2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionChip } from "@/components/section-chip";
import { Button } from "@/components/ui/button";
import type { DayTemplateFull } from "@/components/day-templates/template-form";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DAY_SELECT, WEEK_SELECT } from "@/lib/queries";
import { buildShoppingList, CATEGORY_EMOJI, formatQuantity, SHOPPING_CATEGORIES, shoppingListText } from "@/lib/shopping";
import { cn } from "@/lib/utils";
import type { ShoppingItem, WeekPlanFull } from "@/lib/types";

/** Clipboard API needs https; fall back to a hidden textarea so Copy still works elsewhere. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("Couldn't copy. Select the text and copy it manually.");
  }
}

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const { data, error: err } = await getSupabase().from("shopping_items").select("*").order("name");
    if (err) setError(err.message);
    else setItems(data as ShoppingItem[]);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, [load]);

  async function generate() {
    if (items.length > 0 && !window.confirm("Replace the current list with a new one from your week plan? Ticked items will be cleared.")) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const sb = getSupabase();
      const [plan, days] = await Promise.all([
        sb.from("week_plans").select(WEEK_SELECT).eq("is_template", false).maybeSingle(),
        sb.from("day_templates").select(DAY_SELECT),
      ]);
      if (plan.error) throw plan.error;
      if (days.error) throw days.error;
      const byId = new Map((days.data as unknown as DayTemplateFull[]).map((d) => [d.id, d]));
      const planDays = ((plan.data as unknown as WeekPlanFull | null)?.week_plan_days ?? [])
        .map((d) => (d.day_template_id ? byId.get(d.day_template_id) : undefined))
        .filter((d): d is DayTemplateFull => !!d);
      if (planDays.length === 0) {
        setError("Your week plan is empty. Assign day templates on the Planner first.");
        return;
      }

      const list = buildShoppingList(planDays);
      if (list.length === 0) {
        setError("Your planned days don't contain any foods yet.");
        return;
      }

      // Claude sorts foods it hasn't seen before; the answer is saved on the food so it's only ever asked once.
      const unknown = list.filter((i) => !i.category);
      if (unknown.length) {
        try {
          const res = await fetch("/api/shopping/categorise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: unknown.map((i) => i.name) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Categorising failed.");
          const byCategory = new Map<string, string[]>();
          for (const i of unknown) {
            const cat = (data.categories as Record<string, string>)[i.name];
            if (!cat) continue;
            i.category = cat;
            byCategory.set(cat, [...(byCategory.get(cat) ?? []), ...i.foodIds]);
          }
          for (const [category, ids] of Array.from(byCategory)) await sb.from("foods").update({ category }).in("id", ids);
        } catch (e) {
          setNotice(`I couldn't sort some items into categories (${e instanceof Error ? e.message : "unknown error"}). They're under "Other". Generate again to retry.`);
        }
      }

      // Insert the new list first, then remove the old rows, so a failure never leaves you with nothing.
      const oldIds = items.map((i) => i.id);
      const { error: insErr } = await sb.from("shopping_items").insert(
        list.map((i) => ({ name: i.name, quantity: Math.round(i.quantity), unit: i.unit, category: i.category ?? "Other", checked: false })),
      );
      if (insErr) throw insErr;
      if (oldIds.length) {
        const { error: delErr } = await sb.from("shopping_items").delete().in("id", oldIds);
        if (delErr) throw delErr;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string }).message ?? "Couldn't generate the list.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggle(item: ShoppingItem) {
    const checked = !item.checked;
    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, checked } : x)));
    const { error: err } = await getSupabase().from("shopping_items").update({ checked }).eq("id", item.id);
    if (err) {
      setItems((p) => p.map((x) => (x.id === item.id ? { ...x, checked: item.checked } : x)));
      setError(err.message);
    }
  }

  const text = useMemo(() => shoppingListText(items), [items]);
  const groups = useMemo(() => {
    const extra = Array.from(new Set(items.map((i) => i.category))).filter((c) => !(SHOPPING_CATEGORIES as readonly string[]).includes(c));
    return [...SHOPPING_CATEGORIES, ...extra]
      .map((cat) => {
        const rows = items.filter((i) => i.category === cat);
        // unticked first, ticked sink to the bottom of each group
        return { cat, rows: [...rows.filter((r) => !r.checked), ...rows.filter((r) => r.checked)] };
      })
      .filter((g) => g.rows.length > 0);
  }, [items]);
  const ticked = items.filter((i) => i.checked).length;

  async function copy() {
    try {
      await copyText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't copy.");
    }
  }

  return (
    <>
      <PageHeader
        title="Shopping List"
        description="Everything you need for this week's plan."
        action={
          <Button aria-label="Generate from week plan" onClick={generate} disabled={!configured || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">{generating ? "Generating…" : items.length ? "Regenerate" : "Generate"}</span>
          </Button>
        }
      />

      {!configured && (
        <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">
          Supabase isn&apos;t connected yet. Add your keys to <code>.env.local</code> (and Vercel) to build your list.
        </p>
      )}
      {error && <p className="mb-4 rounded-2xl border border-destructive/50 p-4 text-sm text-destructive" role="alert">{error}</p>}
      {notice && <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm" role="status">{notice}</p>}

      {loading ? (
        <p className="px-2 text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-secondary p-6 text-center">
          <p className="mb-1 text-lg font-bold">No list yet</p>
          <p className="text-muted-foreground">
            Plan your week on the <Link href="/planner" className="text-primary underline">Planner</Link>, then press Generate and I&apos;ll
            add everything up and sort it by aisle.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-bold text-foreground">{ticked}</span> of {items.length} ticked
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copy} disabled={!text}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
              </Button>
              {canShare && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!text}
                  onClick={() => navigator.share({ title: "Shopping list", text }).catch(() => {})}
                >
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {groups.map(({ cat, rows }) => (
              <section key={cat} className="space-y-1">
                <SectionChip emoji={CATEGORY_EMOJI[cat] ?? "🛍️"} className="mb-2 py-2.5">
                  <span className="flex-1">{cat}</span>
                  <span className="text-sm font-normal text-muted-foreground">{rows.length}</span>
                </SectionChip>
                <ul>
                  {rows.map((i) => (
                    <li key={i.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 hover:bg-secondary active:bg-secondary">
                        <input
                          type="checkbox"
                          checked={i.checked}
                          onChange={() => toggle(i)}
                          className="h-6 w-6 shrink-0 cursor-pointer rounded accent-[hsl(var(--primary))]"
                        />
                        <span className={cn("min-w-0 flex-1 truncate text-base", i.checked && "text-muted-foreground line-through")}>{i.name}</span>
                        <span className={cn("shrink-0 text-sm tabular-nums text-muted-foreground", i.checked && "line-through")}>
                          {formatQuantity(i.quantity, i.unit)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
