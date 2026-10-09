import { NextResponse } from "next/server";
import { CLAUDE_MODEL, getAnthropic } from "@/lib/anthropic";
import { SHOPPING_CATEGORIES } from "@/lib/shopping";

export const runtime = "nodejs";
export const maxDuration = 30;

const TOOL = {
  name: "record_categories",
  description: "Assign each shopping list item to a supermarket category.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The item name, exactly as given" },
            category: { type: "string", enum: [...SHOPPING_CATEGORIES] },
          },
          required: ["name", "category"],
        },
      },
    },
    required: ["items"],
  },
};

export async function POST(req: Request) {
  try {
    const { items } = (await req.json()) as { items?: unknown };
    if (!Array.isArray(items) || items.length === 0 || items.length > 200 || items.some((i) => typeof i !== "string")) {
      return NextResponse.json({ error: "Send between 1 and 200 item names." }, { status: 400 });
    }
    const names = items as string[];

    const res = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content:
            "Put each of these supermarket items in the category where you would find it. Use 'Protein' for meat, fish, tofu, legumes and protein powder; 'Dairy & eggs' for milk, yoghurt, cheese, butter and eggs; 'Grains & bread' for rice, oats, pasta, bread, flour and cereal; 'Pantry' for oils, spices, sauces, nuts, nut butters, tinned goods and baking items. Return every item once, with the name exactly as given.\n\n" +
            names.map((n) => `- ${n}`).join("\n"),
        },
      ],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    const out = block && block.type === "tool_use" ? ((block.input as { items?: { name: string; category: string }[] }).items ?? []) : [];
    // Only accept known categories and names we sent; anything else falls back to "Other" on the client.
    const valid = new Set<string>(SHOPPING_CATEGORIES);
    const asked = new Set(names);
    const categories: Record<string, string> = {};
    for (const o of out) if (asked.has(o.name) && valid.has(o.category)) categories[o.name] = o.category;
    return NextResponse.json({ categories });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: message.includes("ANTHROPIC_API_KEY") ? 503 : 500 });
  }
}
