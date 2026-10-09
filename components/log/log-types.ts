import type { MealWithItems } from "@/components/meals/meal-form";
import type { Food, LogEntry } from "@/lib/types";

export type LogEntryFull = LogEntry & { foods: Food | null; meals: MealWithItems | null };
export type DailyLogFull = { id: string; log_date: string; day_template_id: string | null; log_entries: LogEntryFull[] };
