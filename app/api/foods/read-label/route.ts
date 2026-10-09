import { NextResponse } from "next/server";
import { CLAUDE_MODEL, getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof ALLOWED)[number];

const LABEL_TOOL = {
  name: "record_nutrition_label",
  description: "Record the nutrition facts read from a food label photo.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "Product name, or best guess" },
      brand: { type: ["string", "null"], description: "Brand if visible" },
      serving_size: { type: "number", description: "Serving size amount" },
      serving_unit: { type: "string", enum: ["g", "ml"] },
      calories: { type: "number", description: "kcal per serving" },
      protein: { type: "number", description: "grams per serving" },
      carbs: { type: "number", description: "grams per serving" },
      fat: { type: "number", description: "grams per serving" },
      fibre: { type: "number", description: "grams per serving, 0 if absent" },
      sugar: { type: "number", description: "grams per serving, 0 if absent" },
    },
    required: [
      "name", "serving_size", "serving_unit", "calories",
      "protein", "carbs", "fat", "fibre", "sugar",
    ],
  },
};

export async function POST(req: Request) {
  try {
    const { image, mediaType } = (await req.json()) as {
      image?: string; // base64, no data: prefix
      mediaType?: string;
    };
    if (!image || !ALLOWED.includes(mediaType as MediaType)) {
      return NextResponse.json({ error: "Send a JPEG, PNG, WebP or GIF image." }, { status: 400 });
    }

    const res = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      tools: [LABEL_TOOL],
      tool_choice: { type: "tool", name: LABEL_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as MediaType, data: image } },
            {
              type: "text",
              text:
                "Read this nutrition label. Report values PER SERVING (not per 100g) unless only per-100g values are shown, in which case use a 100 g serving. Use g or ml for the serving unit. Calories are kcal, not kJ. Use 0 for any nutrient not listed.",
            },
          ],
        },
      ],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ error: "Couldn't read that label. Try a clearer photo." }, { status: 422 });
    }
    return NextResponse.json({ food: block.input });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
