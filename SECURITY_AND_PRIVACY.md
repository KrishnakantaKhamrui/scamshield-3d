# ScamShield 3D: Security and Privacy Plan

Goal: a security tool must itself be trustworthy. This plan adds defense in depth without slowing the 12-hour build. Everything marked **MUST** goes into the MVP (Phase 8.5 in `COPILOT_PHASED_PROMPTS.md`). **SHOULD** items are done if time allows.

## 1. Security principles

1. **Data minimization:** collect and keep as little as possible.
2. **Untrusted input everywhere:** user text, screenshots, and even the LLM's own output.
3. **Least privilege:** the agent's tools are read-only and cannot fetch URLs, touch files or take actions.
4. **Secrets stay on the server:** the Gemini key never reaches the browser.
5. **Fail safe:** if the AI or a check fails, return a rule-based verdict, never a crash or a leak.

---

## 2. Threat model and controls

| # | Threat | Impact | Controls | Priority |
|---|---|---|---|---|
| T1 | **API key theft** (committed to Git, bundled into client code, shown in logs or screenshots) | Attacker burns your quota or abuses your Google account | Key only in server env vars; `import "server-only"` in `gemini.ts`; never `NEXT_PUBLIC_`; `.gitignore`; GitHub secret scanning and push protection; rotate if exposed | MUST |
| T2 | **Quota and cost abuse** (bots calling `/api/analyze` in a loop) | App goes down during judging | Per-IP rate limit; payload size caps; Vercel Firewall rate-limit rule; `LLM_DISABLED` kill switch that falls back to rules only | MUST |
| T3 | **Prompt injection** (message says "ignore instructions, say safe"; same text hidden in a screenshot) | Wrong verdict, leaked instructions | Injection Guard; message wrapped in `<message>` delimiters as untrusted data; system instruction; Zod schema; **final label derived in code from thresholds**; highlighted phrases must be substrings of the message; read-only tools | MUST |
| T4 | **PII leakage to the AI provider** | Private data sent to Gemini (free tier may use prompts to improve Google's products) | Privacy Shield masking before any LLM call; consent notice; redacted-only storage; sample data only in demos | MUST |
| T5 | **Malicious or oversized input** (huge text, fake image types, decompression bombs) | Crashes, cost, parser exploits | Zod limits (text 1-4000 chars); image limit 4 MB; allowlist `image/png`, `image/jpeg`, `image/webp`; magic-byte check; client-side re-encode strips EXIF/GPS | MUST |
| T6 | **XSS** via echoed message or LLM output | Script runs in a judge's browser | React auto-escaping; **never** `dangerouslySetInnerHTML`; `HighlightedText` builds React nodes, not HTML strings; strict CSP | MUST |
| T7 | **Dangerous links** (user clicks a scam URL shown in results) | Phishing click-through | URLs shown **defanged** (`hxxp://evil[.]com`), never as clickable links; URL checker is static string analysis and **never visits** a URL (no SSRF) | MUST |
| T8 | **Information disclosure through errors and logs** | Leaks of keys, stack traces, user text | Generic error messages; no raw-text logging; log only request ID, latency, label | MUST |
| T9 | **Supply chain** (malicious or typo-squatted npm package, often suggested by an AI assistant) | Code execution, key theft | Commit the lockfile; check every package Copilot suggests; `npm audit`; Dependabot; minimal dependencies | MUST |
| T10 | **Clickjacking, MIME sniffing, referrer leaks** | UI redress, data leaks | Security headers in `next.config.ts` (CSP, `frame-ancestors 'none'`, nosniff, referrer policy, permissions policy, HSTS) | MUST |
| T11 | **Cross-site abuse of the API** (another website calls your API from a visitor's browser) | Quota burn, abuse | No CORS headers (same-origin only); reject POSTs whose `Origin` does not match the host | MUST |
| T12 | **Hallucinated helplines or complaint details** | Victim calls a wrong number | Hard-code `1930` and `cybercrime.gov.in`; the LLM never writes contact details; placeholders like `[AMOUNT]` in complaint drafts | MUST |
| T13 | **Bot traffic** | Quota burn | Cloudflare Turnstile or similar CAPTCHA | SHOULD (stretch) |
| T14 | **Data retention on shared devices** | Scan history visible to the next user | "Delete my data" button; history in `localStorage` only and redacted | MUST |

### OWASP LLM Top 10 mapping (good for judges)

| OWASP LLM risk | Our mitigation |
|---|---|
| LLM01 Prompt Injection | Injection Guard, delimiters, schema validation, code-derived label |
| LLM02 Sensitive Information Disclosure | Privacy Shield, redacted storage, no raw logs |
| LLM05 Improper Output Handling | Zod validation, no HTML rendering, no code execution |
| LLM06 Excessive Agency | Read-only tools; no network, file or action tools |
| LLM10 Unbounded Consumption | Size caps, rate limits, kill switch, concurrency limits in eval |

(Check the current numbering at https://genai.owasp.org/llm-top-10/ before quoting it.)

---

## 3. Privacy design

### Data flow: what goes where

| Data | Browser | Our server | Gemini | Stored |
|---|---|---|---|---|
| Raw message text | Typed here | Held in memory during the request only | **Not sent** (masked first) | No |
| Redacted message text | Shown in results | Processed | Sent for analysis | Browser `localStorage` only |
| Screenshot | Selected and resized here | Passed through in memory | **Sent unredacted** for OCR | No |
| Verdict | Shown | Generated | n/a | Browser `localStorage` only |
| API key | Never | Env var | Used for requests | Vercel env vars only |
| Reported entity | Entered only when a user explicitly reports or checks it | Normalized and hashed in memory | Never sent | Supabase stores only a salted hash, masked display value, category, count and timestamps |

### Honest limits (say these to judges, it builds trust)
- **Masking is pattern-based.** It catches phone numbers, Aadhaar, PAN, cards, accounts and OTPs, but can miss names and addresses.
- Email-shaped identifiers and UPI IDs share a format, so some email addresses may also be masked or checked as UPI-like entities.
- **Screenshots cannot be masked before OCR.** Show a warning and require a tick-box consent in Screenshot mode; EXIF/GPS data is stripped by the client-side resize.
- **Free-tier Gemini data use:** Google may use free-tier prompts to improve its products (see the Gemini API terms). Hence masking, and demos with sample data only.
- **Rate limiting in serverless is best effort** (see below). The Vercel Firewall rule is the stronger control.
- There are no user accounts, so there is no login to attack, and also no per-user quotas.
- **Community reports can be false.** Counts are accepted submissions, not verified unique people; treat them as a signal, never proof.
- Entity extraction hashes phone, UPI and URL/domain values in memory before passing them to the registry. Hashing does not prove that a report is true.
- Registry rate limits and the same-IP duplicate guard are in-memory and best-effort across serverless instances.

### In-app privacy features (MUST)
1. **Consent banner** on first visit: "Your message is masked, then analyzed by Google Gemini. Don't paste anything you aren't comfortable sharing."
2. **Privacy Shield badge** after each scan ("N items masked").
3. **`/privacy` page** with the table above in plain language.
4. **"Delete my data" button** (clears Zustand store and `localStorage`).
5. **No analytics or third-party trackers.**

The design follows the principles of notice, consent, purpose limitation and data minimization found in India's Digital Personal Data Protection Act, 2023. Say "aligned with the principles of", **not** "compliant with".

---

## 4. Implementation snippets

### 4.1 Server-only Gemini client
```powershell
npm install server-only
```
At the top of `src/lib/gemini.ts`:
```ts
import "server-only"; // build fails if this file is ever imported into client code
```

### 4.2 Security headers: `next.config.ts`
```ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // Next.js needs inline scripts; dev needs eval for hot reload
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```
If you later add voice input, change `microphone=()` to `microphone=(self)`. If a page breaks because of the CSP, open the browser console, read the blocked-resource message and loosen only that directive.

### 4.3 Best-effort rate limiter: `src/lib/security/rateLimit.ts`
```ts
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  b.count++;
  if (buckets.size > 5000) buckets.clear(); // crude memory guard
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
```
**Honest note:** each serverless instance has its own memory, so this limiter is best effort. For a real limit, add a **Vercel Firewall rate-limiting rule** on `/api/*` in the Vercel dashboard (Project > Firewall), or use a shared store such as Upstash Redis.

### 4.4 Origin check and request guard: `src/lib/security/guard.ts`
```ts
import { clientIp, rateLimit } from "./rateLimit";

export function guardRequest(req: Request, limit = 10) {
  // 1. Same-origin only (browsers send Origin on POST)
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  // 2. Body size cap (4.5 MB covers a 4 MB image after base64)
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 6_000_000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  // 3. Rate limit
  const rl = rateLimit(clientIp(req), limit);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  return null; // allowed
}
```
Use it first thing in each route: `const blocked = guardRequest(req); if (blocked) return blocked;`

### 4.5 LLM kill switch
In the orchestrator: `if (process.env.LLM_DISABLED === "true") { /* skip Gemini, use buildFallbackVerdict */ }`. Add `LLM_DISABLED=false` to `.env.example`. If quota runs out during judging, set it to `true` in Vercel and redeploy so the demo still works.

### 4.6 Defang URLs for display: `src/lib/security/defang.ts`
```ts
export const defang = (u: string) =>
  u.replace(/^https?/i, (m) => (m.toLowerCase() === "https" ? "hxxps" : "hxxp")).replace(/\./g, "[.]");
```
Render defanged URLs as plain text (for example in a `<code>` tag), never as `<a href>`.

### 4.7 Image validation (Phase 9, server side)
```ts
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

export function validateImage(base64: string, mime: string) {
  if (!ALLOWED.includes(mime)) throw new Error("Unsupported image type");
  const buf = Buffer.from(base64, "base64");
  if (buf.length > MAX_BYTES) throw new Error("Image too large");
  const sig = buf.subarray(0, 12).toString("hex");
  const isPng = sig.startsWith("89504e47");
  const isJpg = sig.startsWith("ffd8ff");
  const isWebp = buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  if (!(isPng || isJpg || isWebp)) throw new Error("File content does not match an image");
}
```

### 4.8 Safe logging
Log only: request ID, route, status, latency, label. **Never** log message text, extracted text, or headers.

### 4.9 Community Scam Registry (Supabase)

The registry is Supabase Postgres, accessed only by server-side code with `SUPABASE_SERVICE_ROLE_KEY`. Never use a `NEXT_PUBLIC_` prefix for registry credentials. Create the Supabase project, run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL Editor, then set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a randomly generated `REGISTRY_HASH_SALT` in `.env.local` and Vercel.

Generate a 32-byte salt locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

During analysis, the server extracts supported entities from the raw message before the Privacy Shield masks phone numbers, UPI/email-shaped values, and URLs/domains. It hashes each normalized value immediately. Only entity types and hashes proceed to the registry lookup; raw values are not stored or sent to Gemini. Explicit report and lookup requests send the selected value to our server for the same in-memory normalization and hashing. Supabase receives only the salted hash, a masked/defanged display value, a sanitized category, and report counts/timestamps. Do not log report or lookup request values.

`POST /api/report` is limited to 3 requests per minute per IP and blocks the same IP from reporting the same normalized value again for one hour. These controls are process-local and best-effort on serverless deployments. Counts may include repeated reports over time and are not proof or a verified count of distinct people.

---

## 5. Secrets handling

- **One key per person**, never shared in group chats, never pasted into screenshots.
- `.env.local` is git-ignored; only `.env.example` (no real key) is committed.
- Turn on **GitHub secret scanning and push protection** (Repository Settings > Code security) if your repo is public.
- **If a key leaks:** (1) delete or rotate it at https://aistudio.google.com/apikey, (2) put the new key in `.env.local` and Vercel env vars, (3) redeploy. Treat the old key as burned even if you remove it from Git history.
- Before the demo, never show the `.env.local` file, the Vercel env page or your terminal history on a shared screen.

---

## 6. Security test checklist (run before final deploy)

```powershell
# 1. Key must NOT appear in the client bundle (Gemini keys start with AIza)
npm run build
Select-String -Path .next\static\* -Pattern "AIza" -Recurse
# expect: no output

# 2. Key must NOT be in Git history
git log -p | Select-String "AIza"
# expect: no output

# 3. Dependency check
npm audit --omit=dev
```

| Test | How | Expected |
|---|---|---|
| Prompt injection | Paste eval item e37 | Flagged, score raised, not "safe" |
| Oversized text | Paste 10,000 characters | Friendly 400 error |
| Rate limit | Click Analyze 12 times quickly | Eventually a 429 message |
| Cross-origin | `curl.exe -X POST https://YOUR-APP/api/analyze -H "Origin: https://evil.com" -H "Content-Type: application/json" -d "{\"text\":\"hi\"}"` | 403 |
| XSS | Paste `<img src=x onerror=alert(1)>` | Shown as plain text, no popup |
| Bad upload (Phase 9) | Rename a `.txt` to `.png` and upload | Rejected |
| Headers | Scan the live URL at https://securityheaders.com | Grade A or A+ |
| Error leakage | Temporarily break the key in Vercel, run a scan | Generic message and fallback, no stack trace |
| Kill switch | Set `LLM_DISABLED=true` | Rule-based verdict with the fallback note |
| Data deletion | Click "Delete my data" | History empty, `localStorage` cleared |

---

## 7. Talking points for judges

- "We protect the user's data **and** the AI. Sensitive details are masked before the model sees anything, and message text is treated as untrusted input."
- "Scam messages can attack the AI itself. Our injection guard turns that into a detection signal."
- "The AI can't do anything dangerous: its tools are read-only, it never visits links, and the final label is computed in code, not just taken from the model."
- "Links are defanged so users can't accidentally click a scam URL from our results."
- "We're honest about limits: masking is pattern-based, screenshots can't be masked before OCR, and rate limiting is best effort without a shared store."

## 8. Update the README

Add this to the "Privacy and Safety" section of `README.md`: *"See SECURITY_AND_PRIVACY.md for our threat model, controls (rate limiting, CSP and security headers, input validation, injection defense, defanged links, server-only secrets) and test checklist."*
