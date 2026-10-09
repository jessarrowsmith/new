import type { Food } from "@/lib/types";

const STOP = new Set(["fresh", "large", "small", "medium", "chopped", "diced", "sliced", "of", "the", "and", "a", "organic", "raw", "cooked", "ground"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)); // crude singular
}

/** Best-matching saved food for an ingredient name, or null if nothing is close. */
export function matchFood(name: string, foods: Food[]): Food | null {
  const want = tokens(name);
  if (want.length === 0) return null;
  let best: { food: Food; score: number } | null = null;
  for (const food of foods) {
    const have = new Set(tokens(`${food.name} ${food.brand ?? ""}`));
    const hits = want.filter((t) => have.has(t)).length;
    if (hits === 0) continue;
    // fraction of the wanted words found, lightly penalising foods with lots of extra words
    let score = hits / want.length - (have.size - hits) * 0.02;
    // a multi-word saved food fully contained in the ingredient ("olive oil" in "extra virgin olive oil")
    if (have.size >= 2 && hits === have.size) score = Math.max(score, 0.9);
    if (!best || score > best.score) best = { food, score };
  }
  return best && best.score >= 0.6 ? best.food : null;
}
