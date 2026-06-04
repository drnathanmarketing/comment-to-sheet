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

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    return Response.json({ error: 'Groq API key is not configured. Add GROQ_API_KEY to your .env.local file.' }, { status: 500 });
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

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: content.trim() },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      return Response.json({ error: 'No response received from AI. Please try again.' }, { status: 500 });
    }

    return Response.json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error occurred.';
    return Response.json({ error: `AI request failed: ${message}` }, { status: 500 });
  }
}
