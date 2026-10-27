// MOON-RZ Academy — Edge Function "tutor"
// Proxy SÉCURISÉ vers l'API Claude (Anthropic). La clé ANTHROPIC_API_KEY reste
// un secret côté serveur — elle n'est JAMAIS exposée au client.
// Déploiement: voir DEPLOY.md (dashboard Supabase, projet qouzioeghhlcwxkcxplj).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Origines autorisées (PWA statique). Repli sur la 1re si l'origine est inconnue.
const ALLOW = [
  "https://tamanada.github.io",
  "https://moon-rz.x",
  "http://localhost:5599",
  "http://127.0.0.1:5599",
];
function cors(origin: string | null) {
  const ok = origin && ALLOW.some((o) => origin.startsWith(o)) ? origin : ALLOW[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const LANG: Record<string, string> = {
  en: "English", fr: "French", es: "Spanish", pt: "Portuguese", de: "German",
  ru: "Russian", tr: "Turkish", ar: "Arabic", zh: "Chinese", ja: "Japanese",
  ko: "Korean", hi: "Hindi", id: "Indonesian", vi: "Vietnamese", th: "Thai", my: "Burmese",
};

const SYSTEM = (lang: string) => `You are the MOON-RZ Academy Tutor — a warm, encouraging crypto & Web3 educator for beginners.
Scope: blockchain, Bitcoin, Ethereum, wallets, security, DeFi, NFTs, trading, technical indicators (RSI, MACD, etc.), chart patterns and tokenomics.
RULES:
- Reply in ${lang}. Keep it concise (~120 words max), simple and friendly, with the occasional emoji and a clear analogy.
- EDUCATIONAL ONLY. Never give financial, investment, legal or tax advice. Never tell anyone to buy/sell a specific asset and never predict prices.
- Always promote safety: never share a seed phrase or private key; beware scams & phishing; DYOR (do your own research); only risk what you can afford to lose.
- If asked "what should I buy?" or for a price prediction, gently decline and redirect to learning & risk management.
- If the question is off-topic (not crypto/Web3/finance education), say briefly it's outside your scope and invite a crypto question.
- Encourage: one lesson a day, practice on the simulator, stay curious. You are part of MOON-RZ Academy ("Learn · Practice · Earn 🌕").`;

// --- Rate limit en mémoire (anti-abus de coût). Limite: RL_MAX requêtes par
// fenêtre glissante RL_WINDOW_MS, par IP. NB: l'état est par isolate et repart
// à zéro après un cold start — c'est un garde-fou léger, pas une garantie dure.
// Pour une limite stricte multi-instances, passer sur une table Postgres ou un KV.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 12;
const hits = new Map<string, number[]>();
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || "unknown";
}
// Retourne 0 si autorisé, sinon le nombre de secondes à attendre.
function rateLimited(ip: string): number {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) {
    hits.set(ip, arr);
    return Math.ceil((RL_WINDOW_MS - (now - arr[0])) / 1000);
  }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > RL_WINDOW_MS) hits.delete(k);
    }
  }
  return 0;
}

Deno.serve(async (req: Request) => {
  const h = cors(req.headers.get("origin"));
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...h, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return J({ error: "post_only" }, 405);

  const wait = rateLimited(clientIp(req));
  if (wait > 0) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...h, "Content-Type": "application/json", "Retry-After": String(wait) },
    });
  }

  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return J({ error: "not_configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question ?? "").slice(0, 1000).trim();
    const lang = LANG[String(body?.lang ?? "en")] ?? "English";
    if (!question) return J({ error: "empty" }, 400);

    const history = Array.isArray(body?.history) ? body.history : [];
    const msgs = history
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-6)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1000) }));
    msgs.push({ role: "user", content: question });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: SYSTEM(lang),
        messages: msgs,
      }),
    });

    if (!r.ok) return J({ error: "upstream", detail: (await r.text()).slice(0, 300) }, 502);
    const data = await r.json();
    const answer = (data?.content?.[0]?.text ?? "").trim();
    return J({ answer });
  } catch (e) {
    return J({ error: "exception", detail: String(e).slice(0, 200) }, 500);
  }
});
