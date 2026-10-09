import dns from "node:dns/promises";
import net from "node:net";

/** True for loopback / private / link-local addresses (SSRF guard). */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) links are supported.");
  const addrs = net.isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await dns.lookup(url.hostname, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("That address isn't allowed.");
  }
  return url;
}

const MAX_BYTES = 2_000_000;

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchHtml(raw: string): Promise<string> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The site returned ${res.status}.`);
    return readLimited(res);
  }
  throw new Error("Too many redirects.");
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRecipe(node: any): any | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  const t = node["@type"];
  if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
  return findRecipe(node["@graph"]);
}

/** Turn a recipe page into compact text for Claude: structured Recipe data if present, else visible text. */
export function pageToText(html: string): string {
  for (const m of Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      const recipe = findRecipe(JSON.parse(m[1]));
      if (recipe) {
        const ing: string[] = recipe.recipeIngredient ?? [];
        return [
          `Recipe: ${recipe.name ?? ""}`,
          recipe.recipeYield ? `Yield: ${[].concat(recipe.recipeYield).join(", ")}` : "",
          "Ingredients:",
          ...ing.map((i) => `- ${i}`),
        ].filter(Boolean).join("\n");
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? "";
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = [title, meta("og:description") || meta("description"), body]
    .map((s) => decode(s).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return text.slice(0, 20_000);
}

export async function fetchRecipeText(url: string): Promise<string> {
  return pageToText(await fetchHtml(url));
}
