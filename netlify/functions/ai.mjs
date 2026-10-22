// Stylist AI on Netlify: outfit styling and photo labelling, for signed-in users only.
// It uses Claude when ANTHROPIC_API_KEY is set in Netlify's environment variables, otherwise Gemini
// when GEMINI_API_KEY is set; with neither, the app stays in Demo mode. Keys never go into the page.
// The app calls this at /.netlify/functions/ai with { prompt, images, quick } and gets { result } back,
// where result is the JSON object the prompt asks for.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

// Supabase checks who's calling. The publishable key is public (it's in the page too).
const SB_URL = "https://rofoseeoftutmmkuuzfk.supabase.co";
const SB_KEY = "sb_publishable_R0QGGx2xRxwneDmEdwZoOw_MWRe_v7F";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SYSTEM =
  "You are the styling assistant inside Stylist, a wardrobe app. " +
  "Reply with only the JSON the request asks for: no other text and no code fences.";
// Netlify stops a function after roughly 26 seconds, so give up on the AI a little before that.
const TIMEOUT_MS = 22_000;

const reply = (body, status = 200) => Response.json(body, { status });
const provider = () => process.env.ANTHROPIC_API_KEY ? "claude" : process.env.GEMINI_API_KEY ? "gemini" : null;

// Pull the JSON object out of the model's text, tolerating stray code fences.
export function parseJson(text) {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return undefined;
}

// Each provider returns { text } or { error, status }.
let claude;
async function askClaude(prompt, images, quick) {
  claude ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  let response;
  try {
    response = await claude.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Labelling a photo is quick work; styling outfits gets a little more thought.
      output_config: { effort: quick ? "low" : "medium" },
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
    if (error instanceof Anthropic.RateLimitError) return { error: "rate_limited", status: 429 };
    if (error instanceof Anthropic.BadRequestError) return { error: images.length ? "image_rejected" : "bad_request", status: 400 };
    if (error instanceof Anthropic.AuthenticationError) return { error: "ai_not_configured", status: 503 };
    if (error instanceof Anthropic.APIConnectionError) return { error: "timeout", status: 504 };
    if (error instanceof Anthropic.APIError) return { error: "ai_error", status: 502 };
    throw error;
  }
  if (response.stop_reason === "refusal") return { error: "refused", status: 422 };
  return { text: response.content.filter((b) => b.type === "text").map((b) => b.text).join("") };
}

let gemini;
async function askGemini(prompt, images) {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: TIMEOUT_MS } });
  try {
    const interaction = await gemini.interactions.create({
      model: "gemini-3.8-flash",
      input: [
        { type: "text", text: `${SYSTEM}\n\n${prompt}` },
        ...images.map((i) => ({ type: "image", data: i.data, mime_type: i.media_type })),
      ],
    });
    return { text: interaction.output_text || "" };
  } catch (error) {
    // The Interactions API throws its own error classes (RateLimitError and friends); all carry the HTTP status.
    const code = typeof error?.status === "number" ? error.status : null;
    if (code === null) return { error: "timeout", status: 504 };
    if (code === 429) return { error: "rate_limited", status: 429 };
    if (code === 400) return { error: images.length ? "image_rejected" : "bad_request", status: 400 };
    if (code === 401 || code === 403) return { error: "ai_not_configured", status: 503 };
    return { error: "ai_error", status: 502 };
  }
}

export default async (req) => {
  // Lets the app check that AI is reachable and set up; without a key the app stays in Demo mode.
  if (req.method === "GET") return reply({ ok: !!provider() });
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

  const which = provider();
  if (!which) return reply({ error: "ai_not_configured" }, 503);
  const answer = which === "claude" ? await askClaude(prompt, images, !!body.quick) : await askGemini(prompt, images);
  if (answer.error) return reply({ error: answer.error }, answer.status);
  const result = parseJson(answer.text);
  return result === undefined ? reply({ error: "bad_json" }, 502) : reply({ result });
};
