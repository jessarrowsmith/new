"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MacroSummary } from "@/components/macro-summary";
import { DAY_NAMES, type WeekPlanFull } from "@/lib/types";
import type { Macros } from "@/lib/types";

export function SaveWeekBody({
  existingNames,
  onSave,
  onCancel,
}: {
  existingNames: string[];
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Give this week a name.");
    if (existingNames.some((x) => x.toLowerCase() === n.toLowerCase())) {
      return setError(`You already have a week called "${n}". Pick a different name.`);
    }
    setSaving(true);
    try {
      await onSave(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Saves a copy of this week&apos;s plan so you can load it again any time.
      </p>
      <div>
        <Label htmlFor="week-name">Name</Label>
        <Input id="week-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard week" />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save week"}</Button>
      </div>
    </form>
  );
}

export function LoadWeekBody({
  templates,
  totalsFor,
  dayNameFor,
  onLoad,
  onDelete,
  onCancel,
}: {
  templates: WeekPlanFull[];
  totalsFor: (plan: WeekPlanFull) => Macros;
  dayNameFor: (plan: WeekPlanFull, dayOfWeek: number) => string | null;
  onLoad: (plan: WeekPlanFull) => Promise<void>;
  onDelete: (plan: WeekPlanFull) => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  if (templates.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No saved weeks yet. Plan a week, then use &ldquo;Save week&rdquo;.</p>
        <div className="flex justify-end"><Button variant="ghost" onClick={onCancel}>Close</Button></div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Loading a week replaces your current plan.</p>
      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-base font-bold">{t.name}</h3>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(t.id);
                    await onLoad(t);
                    setBusy(null);
                  }}
                >
                  {busy === t.id ? "Loading…" : "Load"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${t.name}`}
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(t.id);
                    await onDelete(t);
                    setBusy(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {DAY_NAMES.map((d, i) => `${d.slice(0, 3)}: ${dayNameFor(t, i) ?? "–"}`).join(" · ")}
            </p>
            <MacroSummary macros={totalsFor(t)} className="mt-3" />
          </li>
        ))}
      </ul>
      <div className="flex justify-end"><Button variant="ghost" onClick={onCancel}>Close</Button></div>
    </div>
  );
}
