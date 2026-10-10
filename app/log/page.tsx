"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TargetsBody } from "@/components/log/targets-body";
import type { DailyLogFull } from "@/components/log/log-types";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { LOG_SELECT } from "@/lib/queries";
import { entryMacros, sumMacros } from "@/lib/nutrition";
import { monthGrid, toISO } from "@/lib/dates";
import { useTargets } from "@/lib/use-settings";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function LogCalendarPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [kcal, setKcal] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const { targets, save } = useTargets();
  const configured = isSupabaseConfigured();
  const today = toISO(now);

  useEffect(() => {
    if (!configured) return;
    const first = toISO(new Date(ym.y, ym.m, 1));
    const last = toISO(new Date(ym.y, ym.m + 1, 0));
    getSupabase()
      .from("daily_logs")
      .select(LOG_SELECT)
      .gte("log_date", first)
      .lte("log_date", last)
      .then(({ data, error: err }) => {
        if (err) return setError(err.message);
        setError(null);
        const out: Record<string, number> = {};
        for (const l of data as unknown as DailyLogFull[]) {
          if (l.log_entries.length) out[l.log_date] = sumMacros(l.log_entries.map(entryMacros)).calories;
        }
        setKcal(out);
      });
  }, [ym, configured]);

  const shift = (n: number) => setYm((p) => {
    const d = new Date(p.y, p.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const title = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Daily Log"
        description="Tap a day to see or add what you ate."
        action={
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" aria-label="Set targets" onClick={() => setShowTargets(true)} disabled={!configured}>
              <Target className="h-4 w-4" /> <span className="hidden sm:inline">Targets</span>
            </Button>
            <Link
              href={`/log/${today}`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Log today
            </Link>
          </div>
        }
      />

      {!configured && (
        <p className="mb-4 rounded-2xl bg-secondary p-4 text-sm">
          Supabase isn&apos;t connected yet. Add your keys to <code>.env.local</code> (and Vercel) to save your log.
        </p>
      )}
      {error && <p className="mb-4 rounded-2xl border border-destructive/50 p-4 text-sm text-destructive" role="alert">{error}</p>}

      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground sm:gap-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {monthGrid(ym.y, ym.m).flat().map((date, i) =>
            date ? (
              <Link
                key={date}
                href={`/log/${date}`}
                aria-label={`${date}${kcal[date] ? `, ${Math.round(kcal[date])} calories logged` : ""}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition-colors hover:bg-secondary sm:aspect-[4/3]",
                  date === today && "border-primary bg-secondary font-bold",
                )}
              >
                <span className="text-base">{Number(date.slice(8))}</span>
                {kcal[date] ? (
                  <span className="mt-0.5 text-[10px] tabular-nums text-cal sm:text-xs">{Math.round(kcal[date])}</span>
                ) : (
                  <span className="mt-0.5 text-[10px] sm:text-xs">&nbsp;</span>
                )}
              </Link>
            ) : (
              <div key={`pad${i}`} />
            ),
          )}
        </div>
      </Card>

      <Dialog open={showTargets} onClose={() => setShowTargets(false)} title="Daily targets">
        {showTargets && (
          <TargetsBody
            targets={targets}
            onSave={async (t) => {
              await save(t);
              setShowTargets(false);
            }}
            onCancel={() => setShowTargets(false)}
          />
        )}
      </Dialog>
    </>
  );
}
