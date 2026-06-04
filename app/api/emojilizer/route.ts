import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `You are an emoji editor for Facebook posts by Dr Nathan Marketing, a medical agency in Myanmar. Posts are in Burmese, English, or both.

CRITICAL — BURMESE TEXT: Never alter any Myanmar/Burmese Unicode characters (U+1000–U+109F). Only INSERT emojis around the text; never modify, reorder, or autocorrect existing characters.

TITLE: The first line is always the title. Add exactly ONE emoji at the END of it. No emoji at the start. One emoji only.

BODY PLACEMENT:
- Start of a new section or key point → emoji at the start of the line
- Call-to-action lines (contact, register, book) → emoji at the start
- Emotionally weighted sentences (hope, urgency, care, result) → emoji at the end
- Blank lines → leave empty, no emojis

SPECIFIC EMOJI USAGE (follow these exactly):
- 🧑‍🏫  → end of educational / explanatory sentences ("here's why…", "here's how…", expert insight)
- 🤔   → end of rhetorical questions that engage the reader ("ထင်နေတာလား…?")
- ✅   → end of reassuring / solution sentences, OR start of checklist / action-item lines
- ✨   → end of hopeful, encouraging, or positive-benefit sentences; closing lines
- 😔   → end of sentences describing the reader's problem or struggle

NEVER ADD EMOJIS TO:
- ♦️ list items — the ♦️ diamond already acts as the bullet marker; do not add any emoji before or after these lines
- Clinical / ingredient paragraphs (e.g. "Clotrimazole 1% ပါဝင်ပြီး…") — factual medical info, no emoji
- Quoted text lines ("…") — no emoji
- Hashtag lines (#tag) — no emoji

EMOJI REFERENCE — pick the closest match to the post's topic and tone:

  [ Medical Specialties ]
  General health / wellness   → 🌿 💪 🧘 💙 🌱
  Heart / cardiology          → 🫀 ❤️ 💓 🩺 💗
  Brain / neurology / stroke  → 🧠 💡 ⚡ 🔬
  Cancer / oncology           → 🎗️ 💛 🌸 🌼 🕊️
  Bones / orthopedics         → 🦴 🦾 💪 🚶
  Skin / dermatology          → ✨ 🪷 🧴 💆
  Eyes / ophthalmology        → 👁️ 🔍 🌈 💎
  Lungs / breathing           → 🫁 💨 🌬️ 🌿
  Stomach / digestion         → 🌿 🥦 💊 🫃
  Kidney / urology            → 💧 🫘 🩺
  Diabetes / thyroid          → 🩸 ⚖️ 🍃 🔬
  Children / pediatrics       → 👶 🧒 🌈 🎀 🧸 💛
  Women's health / gynecology → 🌸 🌺 💜 🤰 🩷
  Fertility / IVF             → 🌱 🌷 💞 🤍 ✨
  Mental health / psychiatry  → 💙 🌻 🫂 🕊️ 🌊
  Elderly / geriatrics        → 🧓 👴 👵 🤝 💛 🏡
  Dental / oral health        → 🦷 😁 ✨ 🪥
  Physio / rehabilitation     → 🏃 🦾 💪 🔄 🌱
  Nutrition / diet            → 🥗 🍎 🫐 🌿 ⚖️
  Surgery / procedures        → 🏥 🩺 👨‍⚕️ 👩‍⚕️ 🩻
  Emergency / ICU             → 🚨 ⚡ 🏥 🩸
  Vaccines / immunisation     → 💉 🛡️ 🌍 ✅
  Medicine / pharmacy         → 💊 🧬 💉 🔬 🧪
  Lab / diagnostics           → 🔬 🧪 📋 📊 🩻

  [ Services ]
  Appointments / booking      → 📅 📆 🗓️ 📞 📲
  Consultation                → 👨‍⚕️ 💬 🤝 📋
  Telemedicine / home visit   → 🏠 📱 💻 🛵
  Medical travel              → ✈️ 🌍 🏨 🗺️
  Insurance / billing         → 💳 🧾 🏦 📑
  Ambulance / transport       → 🚑 🚨

  [ Content Tone ]
  Promotions / offers         → 🎉 ✨ 🌟 🔥 🎁 💥 🏷️
  Announcements / news        → 📣 📢 🔔 🗞️ 🆕
  Urgency / limited time      → ⏰ ⚡ 🔔 ⚠️ 🚨
  Education / awareness       → 💡 📚 🔍 🧩 📖
  Tips / advice               → 💡 👉 📌 ✏️ 🗒️
  Hope / encouragement        → 🌟 💛 🙏 🌸 🫂 💪
  Gratitude / thank you       → 🙏 💛 🤍 🌸 💐
  Results / success           → ✅ 🏆 👏 🥳 🎊
  Trust / credibility         → 🛡️ ⭐ 🤝 💼 🏅
  Community / team            → 👥 🤝 🫂 💙
  Warning / important notice  → ⚠️ 🔴 📛 🚫
  Testimonials / quotes       → 💬 🗣️ ⭐ 🌟

QUANTITY: 5–9 emojis total per post. Do not emoji every line.
SENSITIVE TOPICS (cancer, surgery, critical illness): dignified emojis only — never 💀☠️😂🤣🤪.
OUTPUT: Return ONLY the enhanced post text. No explanation, no preamble.`;

// ─── Circuit Breaker ─────────────────────────────────────────────────────────
// Module-level state: persists across requests within the same Node.js process.

interface CircuitState {
  failures: number;
  openUntil: number; // epoch ms — 0 means closed
}

const circuits = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 2;     // failures before tripping on non-rate-limit errors
const DEFAULT_COOLDOWN_MS = 90_000; // 90 s fallback if we can't parse retry-after

function getCircuit(key: string): CircuitState {
  if (!circuits.has(key)) circuits.set(key, { failures: 0, openUntil: 0 });
  return circuits.get(key)!;
}

function circuitIsOpen(key: string): boolean {
  const c = getCircuit(key);
  if (c.openUntil === 0) return false;
  if (Date.now() > c.openUntil) {
    // Cooldown expired — reset to half-open (allow one attempt)
    c.openUntil = 0;
    c.failures = 0;
    return false;
  }
  return true;
}

function recordSuccess(key: string) {
  const c = getCircuit(key);
  c.failures = 0;
  c.openUntil = 0;
}

function recordFailure(key: string, cooldownMs?: number) {
  const c = getCircuit(key);
  c.failures += 1;
  // Rate-limit errors trip immediately; other errors trip after threshold
  if (cooldownMs !== undefined || c.failures >= FAILURE_THRESHOLD) {
    c.openUntil = Date.now() + (cooldownMs ?? DEFAULT_COOLDOWN_MS);
  }
}

/** Parse "Please try again in 1h16m12.288s" → milliseconds */
function parseRetryAfter(message: string): number | undefined {
  const match = message.match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/);
  if (!match) return undefined;
  const h = parseFloat(match[1] ?? '0');
  const m = parseFloat(match[2] ?? '0');
  const s = parseFloat(match[3] ?? '0');
  const ms = Math.ceil((h * 3600 + m * 60 + s) * 1000);
  return ms > 0 ? ms : undefined;
}

function maskKey(key: string): string {
  return `...${key.slice(-4)}`;
}

// ─── Dynamic Output Budget ───────────────────────────────────────────────────
// The model echoes the ENTIRE input back plus emojis, so output length tracks
// input length. We estimate input tokens, then size max_tokens to fit the whole
// reply with headroom — generous for long posts, lean for short ones.

const MIN_OUTPUT_TOKENS = 256;   // floor for tiny posts
const MAX_OUTPUT_TOKENS = 6000;  // ceiling — guards quota & model limit

/**
 * Estimate token count, accounting for Myanmar script being token-dense.
 * Latin/ASCII ≈ 4 chars/token; Burmese codepoints fall back to byte-level
 * encoding in Llama's tokenizer, so we budget ~2 tokens each.
 */
function estimateTokens(text: string): number {
  let burmese = 0;
  let other = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // Myanmar (U+1000–U+109F) + Myanmar Extended-A/B (U+AA60–U+AA7F, U+A9E0–U+A9FF)
    if (
      (cp >= 0x1000 && cp <= 0x109f) ||
      (cp >= 0xaa60 && cp <= 0xaa7f) ||
      (cp >= 0xa9e0 && cp <= 0xa9ff)
    ) {
      burmese++;
    } else {
      other++;
    }
  }
  return Math.ceil(burmese * 2 + other / 4);
}

/** Size the output budget from the input: room to echo it all + emojis + slack. */
function computeMaxTokens(content: string): number {
  const inputTokens = estimateTokens(content);
  // 1.35× covers inserted emojis and tokenizer variance; +64 fixed slack.
  const budget = Math.ceil(inputTokens * 1.35) + 64;
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, budget));
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const rawKeys = process.env.GROQ_API_KEY ?? '';
  const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    return Response.json({ error: 'No Groq API keys configured. Add GROQ_API_KEY to .env.local.' }, { status: 500 });
  }

  let content: string;
  try {
    const body = await request.json();
    content = body?.content;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return Response.json({ error: 'Content is required.' }, { status: 400 });
  }

  if (content.length > 63206) {
    return Response.json({ error: 'Content exceeds the Facebook post character limit (63,206).' }, { status: 400 });
  }

  const trimmed = content.trim();
  const maxTokens = computeMaxTokens(trimmed);

  // ── Waterfall: try each key in order, skip keys whose circuit is open ──────
  let lastError = 'All API keys failed.';

  for (const key of keys) {
    if (circuitIsOpen(key)) {
      const remainingSecs = Math.ceil((getCircuit(key).openUntil - Date.now()) / 1000);
      lastError = `Key ${maskKey(key)} is rate-limited — retrying in ${remainingSecs}s.`;
      continue; // fall through to next key
    }

    try {
      const groq = new Groq({ apiKey: key });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.4,
        max_tokens: maxTokens,
      });

      const result = completion.choices[0]?.message?.content;
      if (!result) {
        recordFailure(key);
        lastError = `Key ${maskKey(key)} returned an empty response.`;
        continue;
      }

      recordSuccess(key);
      return Response.json({ result });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number })?.status;

      if (status === 429) {
        // Rate limit — parse wait time from Groq's error message and open circuit
        const cooldown = parseRetryAfter(message);
        recordFailure(key, cooldown ?? DEFAULT_COOLDOWN_MS);
        const waitSecs = Math.ceil((cooldown ?? DEFAULT_COOLDOWN_MS) / 1000);
        lastError = `Key ${maskKey(key)} hit its daily token limit — retrying in ${waitSecs}s.`;
      } else {
        recordFailure(key);
        lastError = `Key ${maskKey(key)} error: ${message}`;
      }
      continue; // fall through to next key
    }
  }

  // All keys exhausted
  return Response.json({ error: lastError }, { status: 503 });
}
