import type { Food, Macros } from "@/lib/types";

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Macros for `servings` servings of a food (1 serving = food.serving_size g/ml). */
export function foodMacros(food: Macros, servings: number): Macros {
  return {
    calories: food.calories * servings,
    protein: food.protein * servings,
    carbs: food.carbs * servings,
    fat: food.fat * servings,
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(addMacros, ZERO_MACROS);
}

/** Amount in g/ml <-> servings, for a given food. */
export const amountToServings = (food: Pick<Food, "serving_size">, amount: number) =>
  amount / food.serving_size;
export const servingsToAmount = (food: Pick<Food, "serving_size">, servings: number) =>
  servings * food.serving_size;

/** Round for display/storage without float noise (e.g. 1.4999999 -> 1.5). */
export const round = (n: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Total macros of a meal, given its items with their foods embedded. */
export function mealTotals(meal: { meal_items: { servings: number; foods: Macros }[] }): Macros {
  return sumMacros(meal.meal_items.map((i) => foodMacros(i.foods, i.servings)));
}

type MealLike = { meal_items: { servings: number; foods: Macros }[] };

/** Total macros of a day template: each meal's totals times its servings. */
export function dayTotals(day: { day_template_meals: { servings: number; meals: MealLike }[] }): Macros {
  return sumMacros(
    day.day_template_meals.map((m) => foodMacros(mealTotals(m.meals), m.servings)),
  );
}
