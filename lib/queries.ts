/** Supabase select strings with nested relations, shared between pages. */
export const MEAL_SELECT = "*, meal_items(id, meal_id, food_id, servings, foods(*))";
export const DAY_SELECT = `*, day_template_meals(id, day_template_id, meal_id, slot, servings, meals(${MEAL_SELECT}))`;
