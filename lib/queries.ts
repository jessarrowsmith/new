/** Supabase select strings with nested relations, shared between pages. */
export const MEAL_SELECT = "*, meal_items(id, meal_id, food_id, servings, foods(*))";
export const DAY_SELECT = `*, day_template_meals(id, day_template_id, meal_id, slot, servings, meals(${MEAL_SELECT}))`;
export const WEEK_SELECT = "*, week_plan_days(id, week_plan_id, day_of_week, day_template_id)";
export const LOG_SELECT = `id, log_date, day_template_id, log_entries(id, daily_log_id, food_id, meal_id, slot, servings, logged_at, foods(*), meals(${MEAL_SELECT}))`;
