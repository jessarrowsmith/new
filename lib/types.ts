export type Slot = "breakfast" | "lunch" | "dinner" | "snack";
export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: "g" | "ml";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number;
  category: string | null;
  source: "manual" | "photo";
  created_at: string;
}

export interface Meal {
  id: string;
  name: string;
  source_url: string | null;
  created_at: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_id: string;
  servings: number;
}

export interface DayTemplate {
  id: string;
  name: string;
  created_at: string;
}

export interface DayTemplateMeal {
  id: string;
  day_template_id: string;
  meal_id: string;
  slot: Slot;
  servings: number;
}

export interface WeekPlan {
  id: string;
  name: string;
  is_template: boolean;
  created_at: string;
}

export interface WeekPlanDay {
  id: string;
  week_plan_id: string;
  day_of_week: number; // 0 = Monday ... 6 = Sunday
  day_template_id: string | null;
}

export interface DailyLog {
  id: string;
  log_date: string; // YYYY-MM-DD
  day_template_id: string | null;
}

export interface LogEntry {
  id: string;
  daily_log_id: string;
  food_id: string | null;
  meal_id: string | null;
  slot: Slot;
  servings: number;
  logged_at: string;
}

export interface Settings {
  id: number;
  calorie_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  checked: boolean;
}
