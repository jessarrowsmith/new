import type { Food } from "@/lib/types";

export const SHOPPING_CATEGORIES = [
  "Produce",
  "Protein",
  "Dairy & eggs",
  "Grains & bread",
  "Pantry",
  "Frozen",
  "Snacks & drinks",
  "Other",
] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
  Produce: "🥬",
  Protein: "🍗",
  "Dairy & eggs": "🥛",
  "Grains & bread": "🍞",
  Pantry: "🫙",
  Frozen: "🧊",
  "Snacks & drinks": "🥤",
  Other: "🛍️",
};

type PlanDay = {
  day_template_meals: {
    servings: number;
    meals: { meal_items: { servings: number; foods: Food }[] };
  }[];
};

export type ListItem = {
  key: string;
  name: string;
  quantity: number; // total g or ml
  unit: "g" | "ml";
  category: string | null; // null = not categorised yet
  foodIds: string[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Everything needed for the days in a plan, with the same food (same name and unit) added up
 * across every meal and every day. A food's `servings` are multiples of its serving size.
 */
export function buildShoppingList(days: PlanDay[]): ListItem[] {
  const map = new Map<string, ListItem>();
  for (const day of days) {
    for (const dm of day.day_template_meals) {
      for (const item of dm.meals.meal_items) {
        const food = item.foods;
        const amount = item.servings * dm.servings * food.serving_size;
        const key = `${norm(food.name)}|${food.serving_unit}`;
        const cur = map.get(key);
        if (cur) {
          cur.quantity += amount;
          if (!cur.foodIds.includes(food.id)) cur.foodIds.push(food.id);
          cur.category ??= food.category;
        } else {
          map.set(key, { key, name: food.name, quantity: amount, unit: food.serving_unit, category: food.category, foodIds: [food.id] });
        }
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** 1250 g -> "1.25 kg", 340 ml -> "340 ml". */
export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity == null) return "";
  const big = Math.round(quantity) >= 1000 && (unit === "g" || unit === "ml"); // 999.6 g shows as 1 kg
  const value = big ? quantity / 1000 : quantity;
  const shown = big ? Math.round(value * 100) / 100 : Math.round(value);
  const u = unit === "g" ? (big ? "kg" : "g") : unit === "ml" ? (big ? "L" : "ml") : (unit ?? "");
  return `${shown} ${u}`.trim();
}

/** Plain-text list of what is still to buy, grouped by category, for copying or sharing. */
export function shoppingListText(items: { name: string; quantity: number | null; unit: string | null; category: string; checked: boolean }[]): string {
  const todo = items.filter((i) => !i.checked);
  const cats = [...SHOPPING_CATEGORIES, ...Array.from(new Set(todo.map((i) => i.category))).filter((c) => !(SHOPPING_CATEGORIES as readonly string[]).includes(c))];
  return cats
    .map((cat) => {
      const rows = todo.filter((i) => i.category === cat);
      if (!rows.length) return "";
      return `${CATEGORY_EMOJI[cat] ? `${CATEGORY_EMOJI[cat]} ` : ""}${cat}\n` + rows.map((i) => `• ${i.name}${i.quantity != null ? ` — ${formatQuantity(i.quantity, i.unit)}` : ""}`).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}
