import { NextResponse } from "next/server";
import { CLAUDE_MODEL, getAnthropic } from "@/lib/anthropic";
import { fetchRecipeText } from "@/lib/fetch-recipe";

export const runtime = "nodejs";
export const maxDuration = 45;

const PASTE_HINT =
  "I couldn't read that link (sites like TikTok and Instagram often block this). Paste the recipe text or caption instead.";

const RECIPE_TOOL = {
  name: "record_recipe",
  description: "Record a recipe's name, servings and ingredients with estimated nutrition.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "Recipe name" },
      servings: { type: "number", description: "How many servings the whole recipe makes (1 if unclear)" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string", description: "The ingredient line as written" },
            name: { type: "string", description: "Simple food name, e.g. 'chicken breast', 'olive oil'" },
            amount: { type: "number", description: "Total amount for the WHOLE recipe, in grams or ml" },
            unit: { type: "string", enum: ["g", "ml"] },
            calories_per_100: { type: "number", description: "Estimated kcal per 100 g/ml" },
            protein_per_100: { type: "number" },
            carbs_per_100: { type: "number" },
            fat_per_100: { type: "number" },
            fibre_per_100: { type: "number" },
            sugar_per_100: { type: "number" },
          },
          required: [
            "original", "name", "amount", "unit", "calories_per_100",
            "protein_per_100", "carbs_per_100", "fat_per_100", "fibre_per_100", "sugar_per_100",
          ],
        },
      },
    },
    required: ["name", "servings", "ingredients"],
  },
};

export async function POST(req: Request) {
  try {
    const { url, text } = (await req.json()) as { url?: string; text?: string };
    const pasted = text?.trim() ?? "";
    let source = pasted;

    if (!pasted && url?.trim()) {
      try {
        source = await fetchRecipeText(url.trim());
      } catch {
        return NextResponse.json({ error: PASTE_HINT }, { status: 422 });
      }
      if (source.length < 80) return NextResponse.json({ error: PASTE_HINT }, { status: 422 });
    }
    if (!source) return NextResponse.json({ error: "Paste a link or the recipe text." }, { status: 400 });

    const res = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      tools: [RECIPE_TOOL],
      tool_choice: { type: "tool", name: RECIPE_TOOL.name },
      messages: [
        {
          role: "user",
          content:
            "Extract the recipe below. For each ingredient give the total amount for the whole recipe converted to grams or ml (use typical weights: 1 egg ≈ 50 g, 1 tbsp oil ≈ 14 g, 1 cup flour ≈ 120 g, a pinch ≈ 1 g, 'to taste' ≈ 2 g). Estimate nutrition per 100 g/ml from general food knowledge; these are estimates the user will review. Ignore anything that isn't an ingredient. If it is not a recipe, return no ingredients.\n\n<recipe_source>\n" +
            source.slice(0, 20_000) +
            "\n</recipe_source>",
        },
      ],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ error: "Couldn't find a recipe in that." }, { status: 422 });
    }
    const recipe = block.input as { ingredients?: unknown[] };
    if (!recipe.ingredients?.length) {
      return NextResponse.json({ error: "I couldn't find any ingredients in that. Try pasting the ingredient list." }, { status: 422 });
    }
    return NextResponse.json({ recipe, source_url: url?.trim() || null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: message.includes("ANTHROPIC_API_KEY") ? 503 : 500 });
  }
}
