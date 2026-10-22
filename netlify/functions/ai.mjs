// Stylist AI on Netlify: outfit styling and photo labelling through Claude, for signed-in users only.
// The Anthropic API key lives in Netlify's environment variables (ANTHROPIC_API_KEY), never in the page.
// The app calls this at /.netlify/functions/ai with { prompt, images, quick } and gets { result } back,
// where result is the JSON object the prompt asks for.
import Anthropic from "@anthropic-ai/sdk";

// Supabase checks who's calling. The publishable key is public (it's in the page too).
const SB_URL = "https://rofoseeoftutmmkuuzfk.supabase.co";
const SB_KEY = "sb_publishable_R0QGGx2xRxwneDmEdwZoOw_MWRe_v7F";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SYSTEM =
  "You are the styling assistant inside Stylist, a wardrobe app. " +
  "Reply with only the JSON the request asks for: no other text and no code fences.";

let client;
const reply = (body, status = 200) => Response.json(body, { status });

// Pull the JSON object out of Claude's text, tolerating stray code fences.
export function parseJson(text) {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return undefined;
}

export default async (req) => {
  if (req.method === "GET") return reply({ ok: true }); // lets the app check that AI is reachable
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  // Signed-in Stylist users only, so strangers can't spend the API credit.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "not_signed_in" }, 401);
  const who = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!who?.ok) return reply({ error: "not_signed_in" }, 401);

  let body;
  try { body = await req.json(); } catch { return reply({ error: "bad_request" }, 400); }
  const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 12000) : "";
  const images = (Array.isArray(body?.images) ? body.images : [])
    .slice(0, 2)
    .filter((i) => IMAGE_TYPES.includes(i?.media_type) && typeof i.data === "string" && i.data.length < 2_000_000);
  if (!prompt) return reply({ error: "bad_request" }, 400);

  // Netlify stops a function after roughly 26 seconds, so give up on the API a little before that.
  client ??= new Anthropic({ timeout: 22_000, maxRetries: 0 });
  let response;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Labelling a photo is quick work; styling outfits gets a little more thought.
      output_config: { effort: body.quick ? "low" : "medium" },
      // If Claude declines on safety grounds, the API reruns the request on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
          { type: "text", text: prompt },
        ],
      }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return reply({ error: "rate_limited" }, 429);
    if (error instanceof Anthropic.BadRequestError) return reply({ error: images.length ? "image_rejected" : "bad_request" }, 400);
    if (error instanceof Anthropic.AuthenticationError) return reply({ error: "ai_not_configured" }, 503);
    if (error instanceof Anthropic.APIConnectionError) return reply({ error: "timeout" }, 504);
    if (error instanceof Anthropic.APIError) return reply({ error: "ai_error" }, 502);
    throw error;
  }

  if (response.stop_reason === "refusal") return reply({ error: "refused" }, 422);
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const result = parseJson(text);
  return result === undefined ? reply({ error: "bad_json" }, 502) : reply({ result });
};
