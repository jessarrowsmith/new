"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Macros, Settings } from "@/lib/types";

export const DEFAULT_TARGETS: Macros = { calories: 2000, protein: 150, carbs: 200, fat: 65 };

/** The user's calorie and macro targets (single row in `settings`). */
export function useTargets() {
  const [targets, setTargets] = useState<Macros>(DEFAULT_TARGETS);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getSupabase()
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const s = data as Settings | null;
        if (s) setTargets({ calories: s.calorie_target, protein: s.protein_target, carbs: s.carbs_target, fat: s.fat_target });
      });
  }, []);

  const save = useCallback(async (t: Macros) => {
    const { error } = await getSupabase()
      .from("settings")
      .upsert({ id: 1, calorie_target: t.calories, protein_target: t.protein, carbs_target: t.carbs, fat_target: t.fat });
    if (error) throw error;
    setTargets(t);
  }, []);

  return { targets, save };
}
