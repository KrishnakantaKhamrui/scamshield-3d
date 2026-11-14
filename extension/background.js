"use strict";

importScripts("constants.js");

const REQUEST_LIMIT = 6;
const REQUEST_WINDOW_MS = 60_000;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ITEMS = 500;
const REQUEST_TIMEOUT_MS = 20_000;
const SUPPORTED_HOSTS = new Set(["web.whatsapp.com", "mail.google.com"]);

let storageQueue = Promise.resolve();
let installTokenPromise;
const pendingAnalyses = new Map();

function serializedStorage(operation) {
  const task = storageQueue.then(operation);
  storageQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function getInstallToken() {
  if (!installTokenPromise) {
    installTokenPromise = (async () => {
      const { installToken } = await chrome.storage.local.get("installToken");
      if (typeof installToken === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(installToken)) {
        return installToken;
      }

      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      await chrome.storage.local.set({ installToken: token });
      return token;
    })();
  }
  return installTokenPromise;
}

async function getSettings(siteHost) {
  const values = await chrome.storage.local.get([
    "consentAccepted",
    "enabled",
    "protectionPaused",
    "pauseMessage",
    "pausedSites",
    "scannedToday",
    "scamsFoundToday",
    "statsDate",
  ]);
  const statsDate = localDateKey();
  const isSupportedHost = SUPPORTED_HOSTS.has(siteHost);

  return {
    consentAccepted: values.consentAccepted === true,
    enabled: values.enabled === true,
    protectionPaused: values.protectionPaused === true,
    pauseMessage:
      typeof values.pauseMessage === "string" ? values.pauseMessage : "",
    isSitePaused:
      isSupportedHost &&
      Array.isArray(values.pausedSites) &&
      values.pausedSites.includes(siteHost),
    siteSupported: isSupportedHost,
    scannedToday: values.statsDate === statsDate ? values.scannedToday || 0 : 0,
    scamsFoundToday:
      values.statsDate === statsDate ? values.scamsFoundToday || 0 : 0,
  };
}

async function updateStats(label) {
  return serializedStorage(async () => {
    const date = localDateKey();
    const values = await chrome.storage.local.get([
      "statsDate",
      "scannedToday",
      "scamsFoundToday",
    ]);
    const sameDay = values.statsDate === date;
    await chrome.storage.local.set({
      statsDate: date,
      scannedToday: (sameDay ? values.scannedToday || 0 : 0) + 1,
      scamsFoundToday:
        (sameDay ? values.scamsFoundToday || 0 : 0) +
        (label === "scam" ? 1 : 0),
    });
  });
}

async function reserveRequestSlot() {
  return serializedStorage(async () => {
    const now = Date.now();
    const { requestTimestamps = [] } =
      await chrome.storage.local.get("requestTimestamps");
    const active = requestTimestamps.filter(
      (timestamp) => Number.isFinite(timestamp) && now - timestamp < REQUEST_WINDOW_MS,
    );

    if (active.length >= REQUEST_LIMIT) {
      await chrome.storage.local.set({ requestTimestamps: active });
      return false;
    }

    active.push(now);
    await chrome.storage.local.set({ requestTimestamps: active });
    return true;
  });
}

async function hashText(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function getCachedResult(hash) {
  const { analysisCache = {} } =
    await chrome.storage.local.get("analysisCache");
  const cached = analysisCache[hash];
  if (
    !cached ||
    !Number.isFinite(cached.cachedAt) ||
    Date.now() - cached.cachedAt > CACHE_MAX_AGE_MS
  ) {
    return null;
  }
  return cached.verdict;
}

async function cacheResult(hash, verdict) {
  return serializedStorage(async () => {
    const { analysisCache = {} } =
      await chrome.storage.local.get("analysisCache");
    const now = Date.now();
    const retained = Object.entries(analysisCache)
      .filter(
        ([, entry]) =>
          entry &&
          Number.isFinite(entry.cachedAt) &&
          now - entry.cachedAt <= CACHE_MAX_AGE_MS,
      )
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, CACHE_MAX_ITEMS - 1);
    await chrome.storage.local.set({
      analysisCache: Object.fromEntries([
        [hash, { cachedAt: now, verdict }],
        ...retained.filter(([cachedHash]) => cachedHash !== hash),
      ]),
    });
  });
}

async function pauseAfterFailure(message) {
  await chrome.storage.local.set({
    protectionPaused: true,
    pauseMessage: message,
  });
}

async function postAnalysis(text, hash) {
  const allowed = await reserveRequestSlot();
  if (!allowed) {
    return {
      ok: false,
      paused: false,
      message: "The extension limit of 6 checks per minute was reached.",
    };
  }

  const installToken = await getInstallToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${globalThis.SCAMSHIELD_CONFIG.apiOrigin}${globalThis.SCAMSHIELD_CONFIG.analyzePath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ScamShield-Install-Token": installToken,
        },
        body: JSON.stringify({ text }),
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      await pauseAfterFailure(
        "ScamShield could not complete a check. Auto-protect is paused.",
      );
      return {
        ok: false,
        paused: true,
        message: "Protection paused because the ScamShield API is unavailable.",
      };
    }

    const data = await response.json();
    if (
      !data ||
      !["safe", "suspicious", "scam"].includes(data.label) ||
      !Number.isFinite(data.score) ||
      typeof data.scamType !== "string" ||
      !Array.isArray(data.reasons)
    ) {
      await pauseAfterFailure(
        "ScamShield returned an invalid response. Auto-protect is paused.",
      );
      return {
        ok: false,
        paused: true,
        message: "Protection paused because the ScamShield response was invalid.",
      };
    }

    const verdict = {
      label: data.label,
      score: data.score,
      scamType: data.scamType,
      reasons: data.reasons
        .filter((reason) => typeof reason === "string")
        .slice(0, 3),
    };
    await cacheResult(hash, verdict);
    await updateStats(verdict.label);
    return { ok: true, verdict, cached: false };
  } catch {
    await pauseAfterFailure(
      "The ScamShield API could not be reached. Auto-protect is paused.",
    );
    return {
      ok: false,
      paused: true,
      message: "Protection paused because the ScamShield API could not be reached.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeMessage(text, sender) {
  let senderHost = "";
  try {
    senderHost = new URL(sender.url || "").hostname;
  } catch {
    return { ok: false, paused: false, message: "Unsupported page." };
  }

  const settings = await getSettings(senderHost);
  if (
    !settings.consentAccepted ||
    !settings.enabled ||
    settings.protectionPaused
  ) {
    return {
      ok: false,
      paused: settings.protectionPaused,
      message: settings.pauseMessage || "Auto-protect is off.",
    };
  }
  if (settings.isSitePaused || !settings.siteSupported) {
    return { ok: false, paused: false, message: "Protection is paused on this site." };
  }
  if (typeof text !== "string" || text.trim().length < 20 || text.length > 6000) {
    return { ok: false, paused: false, message: "Message is outside the scan limits." };
  }

  const hash = await hashText(text);
  const cached = await getCachedResult(hash);
  if (cached) {
    await updateStats(cached.label);
    return { ok: true, verdict: cached, cached: true };
  }

  const pending = pendingAnalyses.get(hash);
  if (pending) {
    return pending;
  }

  const analysis = postAnalysis(text, hash).finally(() => {
    pendingAnalyses.delete(hash);
  });
  pendingAnalyses.set(hash, analysis);
  return analysis;
}

async function handleMessage(message, sender) {
  if (!message || typeof message.type !== "string") {
    return { ok: false, message: "Invalid extension request." };
  }

  if (message.type === "GET_STATE") {
    return getSettings(message.siteHost);
  }

  if (message.type === "SET_CONSENT") {
    await chrome.storage.local.set({
      consentAccepted: true,
      enabled: true,
      protectionPaused: false,
      pauseMessage: "",
    });
    return { ok: true };
  }

  if (message.type === "SET_ENABLED") {
    const { consentAccepted } =
      await chrome.storage.local.get("consentAccepted");
    const enabled = consentAccepted === true && message.enabled === true;
    const updatedSettings = { enabled };
    if (enabled) {
      updatedSettings.protectionPaused = false;
      updatedSettings.pauseMessage = "";
    }
    await chrome.storage.local.set(updatedSettings);
    return { ok: true, enabled };
  }

  if (message.type === "RESUME") {
    const { consentAccepted } =
      await chrome.storage.local.get("consentAccepted");
    if (consentAccepted !== true) {
      return { ok: false, message: "Consent is required before scanning." };
    }
    await chrome.storage.local.set({
      enabled: true,
      protectionPaused: false,
      pauseMessage: "",
    });
    return { ok: true, enabled: true };
  }

  if (message.type === "SET_SITE_PAUSED") {
    const siteHost = message.siteHost;
    if (!SUPPORTED_HOSTS.has(siteHost)) {
      return { ok: false, message: "Unsupported site." };
    }

    const { pausedSites = [] } = await chrome.storage.local.get("pausedSites");
    const updated = new Set(pausedSites);
    if (message.paused === true) {
      updated.add(siteHost);
    } else {
      updated.delete(siteHost);
    }
    await chrome.storage.local.set({ pausedSites: Array.from(updated) });
    return { ok: true };
  }

  if (message.type === "ANALYZE_TEXT") {
    return analyzeMessage(message.text, sender);
  }

  return { ok: false, message: "Unsupported extension request." };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, message: "Extension request failed." }));
  return true;
});
