// api/redirect.js — Vercel serverless (Popcash-friendly, fast 302 + HMAC)
// Goals:
// - Fast 302 redirect (happy path, no blocking I/O before redirect)
// - HMAC(ts+nonce) for forensic proof (sent to Popcash tracking endpoint)
// - Conservative bot/DC blocking (minimize false positives)
// - Minimal/no external logging by default

import crypto from "crypto";

const ALLOWED_PARAMS = new Set([
  // common tracking params (expand if Popcash needs others)
  "click_id", "clickid", "zoneid", "zone", "pubid", "subid", "aff_sub",
  "geo", "country", "cid", "utm_source", "utm_medium", "source", "ref"
]);

// simple bot substrings (lowercase)
const BOT_SIGNS = [
  "bot","spider","crawler","curl","wget","phantomjs","headless",
  "selenium","puppeteer","playwright","python-requests","python-urllib",
  "axios","node-fetch","libwww-perl","java/","scrapy"
];

const POPCASH = process.env.POPCASH_URL;       // required
const SECRET = process.env.SECRET_SIGN || ""; // required, strong
const DC_PREFIXES = (process.env.DC_PREFIXES || "104.,107.").split(",").map(s => s.trim()).filter(Boolean);
const LOG_WEBHOOK = process.env.LOG_WEBHOOK || "";
const ASYNC_LOG = String(process.env.ASYNC_LOG || "0") === "1";

// quick warnings (non-blocking)
if (POPCASH && !POPCASH.startsWith("https://")) {
  console.warn("Warning: POPCASH_URL should use https://");
}
if (SECRET.length < 16) {
  console.warn("Warning: SECRET_SIGN is short (<16). Use at least 32 hex chars.");
}

// get client IP (prefer cloudflare header if present)
function getClientIP(req) {
  const header = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  return String(header).split(",")[0].trim();
}

// quick datacenter prefix check (string startsWith, cheap)
function isDatacenterIP(ip = "") {
  if (!ip) return false;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  return DC_PREFIXES.some(p => p && ip.startsWith(p));
}

// permissive bot detection: only flag when UA clearly contains known bot indicia
// NOTE: we DO NOT treat empty UA as bot (more permissive for ad networks)
function isClearBotUA(ua = "") {
  if (!ua) return false;
  const low = ua.toLowerCase();
  return BOT_SIGNS.some(s => low.includes(s));
}

// canonicalize params deterministically
function canonicalQsFromParams(params) {
  const entries = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

// add ts + nonce, sign canonical string with HMAC-SHA256
function signParamsWithTsAndNonce(params) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(4).toString("hex"); // cheap & fast
  params.set("ts", ts);
  params.set("nonce", nonce);
  const canonical = canonicalQsFromParams(params);
  const h = crypto.createHmac("sha256", SECRET);
  h.update(canonical);
  const sign = h.digest("hex");
  return { sign, ts, nonce, canonical };
}

function buildFinalUrl(base, params) {
  const qs = params.toString();
  return base + (qs ? (base.includes("?") ? "&" : "?") + qs : "");
}

// non-blocking async log (fire-and-forget) — optional
function asyncLog(payload) {
  if (!ASYNC_LOG || !LOG_WEBHOOK) return;
  try {
    // global fetch exists in Vercel runtime; do not await
    fetch(LOG_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => { /* swallow errors */ });
  } catch (e) { /* ignore to avoid blocking redirect */ }
}

export default function handler(req, res) {
  try {
    if (!POPCASH || !SECRET) {
      console.error("Missing POPCASH_URL or SECRET_SIGN in environment");
      return res.status(500).send("Server misconfiguration");
    }

    const ua = (req.headers["user-agent"] || "").toString();
    const ip = getClientIP(req);
    const referer = req.headers["referer"] || "";

    // conservative block: only when UA clearly bot AND IP is datacenter
    const clearBot = isClearBotUA(ua);
    const dc = isDatacenterIP(ip);
    if (clearBot && dc) {
      asyncLog({ event: "blocked", reason: "bot_and_dc", ip, ua, referer, time: new Date().toISOString() });
      return res.status(403).send("Forbidden");
    }

    // collect only allowed params (fast)
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (ALLOWED_PARAMS.has(k) && v != null && v !== "") params.set(k, String(v));
    }

    // forward referer optionally for mapping
    if (referer) params.set("ref", referer);

    // sign (adds ts + nonce)
    const { sign, ts, nonce } = signParamsWithTsAndNonce(params);
    params.set("sign", sign);

    // final redirect URL
    const finalUrl = buildFinalUrl(POPCASH, params);

    // optional async audit log (no PII unless you pass it)
    asyncLog({
      event: "redirect",
      time: new Date().toISOString(),
      ip,
      ua,
      referer,
      click_id: params.get("click_id") || params.get("clickid") || null,
      zoneid: params.get("zoneid") || params.get("zone") || null,
      ts,
      nonce
    });

    // immediate 302 redirect (happy path)
    return res.redirect(302, finalUrl);
  } catch (err) {
    console.error("Redirect error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
