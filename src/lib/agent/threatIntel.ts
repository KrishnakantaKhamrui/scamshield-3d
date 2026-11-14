import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type {
  ThreatIntelEvidence,
  ThreatIntelSource,
} from "@/types";

const GOOGLE_SOURCE = "Google Safe Browsing";
const URLHAUS_SOURCE = "URLhaus";
const OPENPHISH_SOURCE = "OpenPhish";
const SOURCE_NAMES = [GOOGLE_SOURCE, URLHAUS_SOURCE, OPENPHISH_SOURCE];
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_URLHAUS_LOOKUPS = 20;
const URLHAUS_CONCURRENCY = 5;

// Google Safe Browsing Lookup API v4: threatMatches.find, verified against Google's current docs.
const SAFE_BROWSING_ENDPOINT =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const URLHAUS_ENDPOINT = "https://urlhaus-api.abuse.ch/v1/url/";

const googleResponseSchema = z
  .object({
    matches: z
      .array(
        z
          .object({
            threatType: z.enum([
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
            ]),
            threat: z.object({ url: z.string().url() }).passthrough(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const urlhausResponseSchema = z
  .object({ query_status: z.string() })
  .passthrough();

interface NormalizedUrl {
  full: string;
  host: string;
}

interface PhishFeed {
  urls: Set<string>;
  hosts: Set<string>;
}

interface CachedUrlResult {
  expiresAt: number;
  sources: ThreatIntelSource[];
  skipped: string[];
}

const urlCache = new Map<string, CachedUrlResult>();
let phishFeedPromise: Promise<PhishFeed> | undefined;

function emptyResult(): ThreatIntelEvidence {
  return { score: 0, flags: [], sources: [], skipped: [] };
}

function normalizeUrl(value: string): NormalizedUrl | undefined {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    url.username = "";
    url.password = "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");

    return { full: url.href, host: url.hostname };
  } catch {
    return undefined;
  }
}

function getCachedResult(url: string, now: number): CachedUrlResult | undefined {
  const cached = urlCache.get(url);
  if (!cached) {
    return undefined;
  }
  if (now >= cached.expiresAt) {
    urlCache.delete(url);
    return undefined;
  }
  return cached;
}

function cacheResult(
  url: string,
  sources: ThreatIntelSource[],
  skipped: string[],
): void {
  const now = Date.now();
  for (const [cachedUrl, result] of urlCache) {
    if (now >= result.expiresAt) {
      urlCache.delete(cachedUrl);
    }
  }
  while (urlCache.size >= 5000) {
    const oldest = urlCache.keys().next();
    if (oldest.done) {
      break;
    }
    urlCache.delete(oldest.value);
  }

  urlCache.set(url, {
    expiresAt: now + CACHE_TTL_MS,
    sources,
    skipped,
  });
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error("Threat lookup failed.");
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function skippedDetail(error: unknown): string {
  const isTimeout =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError";
  return isTimeout
    ? "Skipped (lookup timed out)."
    : "Skipped (lookup unavailable).";
}

async function loadPhishFeed(): Promise<PhishFeed> {
  if (!phishFeedPromise) {
    phishFeedPromise = (async () => {
      const feedPath = path.join(process.cwd(), "data", "phish-feed.txt");
      const contents = await readFile(feedPath, "utf8");
      const urls = new Set<string>();
      const hosts = new Set<string>();

      for (const line of contents.split(/\r?\n/)) {
        const normalized = normalizeUrl(line.trim());
        if (normalized) {
          urls.add(normalized.full);
          hosts.add(normalized.host);
        }
      }

      return { urls, hosts };
    })().catch((error: unknown) => {
      phishFeedPromise = undefined;
      throw error;
    });
  }
  return phishFeedPromise;
}

async function checkGoogleSafeBrowsing(
  urls: NormalizedUrl[],
  apiKey: string,
): Promise<Map<string, string[]>> {
  const endpoint = new URL(SAFE_BROWSING_ENDPOINT);
  endpoint.searchParams.set("key", apiKey);

  const response = googleResponseSchema.parse(
    await fetchJsonWithTimeout(endpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "scamshield3d", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: urls.map(({ full }) => ({ url: full })),
        },
      }),
    }),
  );
  const requestedUrls = new Set(urls.map(({ full }) => full));
  const matches = new Map<string, string[]>();

  for (const match of response.matches ?? []) {
    const normalized = normalizeUrl(match.threat.url);
    if (!normalized || !requestedUrls.has(normalized.full)) {
      continue;
    }
    const threatTypes = matches.get(normalized.full) ?? [];
    if (!threatTypes.includes(match.threatType)) {
      threatTypes.push(match.threatType);
    }
    matches.set(normalized.full, threatTypes);
  }

  return matches;
}

async function checkUrlhaus(
  url: NormalizedUrl,
  authKey: string,
): Promise<ThreatIntelSource> {
  try {
    const response = urlhausResponseSchema.parse(
      await fetchJsonWithTimeout(URLHAUS_ENDPOINT, {
        method: "POST",
        headers: {
          "Auth-Key": authKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ url: url.full }),
      }),
    );
    if (
      response.query_status !== "ok" &&
      response.query_status !== "no_results"
    ) {
      throw new Error("Threat lookup failed.");
    }
    const hit = response.query_status === "ok";
    return {
      name: URLHAUS_SOURCE,
      hit,
      detail: hit ? "Listed as malware." : "No match.",
    };
  } catch (error) {
    return {
      name: URLHAUS_SOURCE,
      hit: false,
      detail: skippedDetail(error),
    };
  }
}

async function mapConcurrent<T, U>(
  items: T[],
  concurrency: number,
  mapItem: (item: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapItem(items[index]);
      }
    }),
  );
  return results;
}

function aggregateResults(
  urls: NormalizedUrl[],
  results: Map<string, CachedUrlResult>,
): ThreatIntelEvidence {
  const perUrlResults = urls.flatMap((url) => {
    const result = results.get(url.full);
    return result ? [result] : [];
  });
  const sources = SOURCE_NAMES.map((name): ThreatIntelSource => {
    const hits = perUrlResults.filter((result) =>
      result.sources.some((source) => source.name === name && source.hit),
    ).length;
    const skipped = perUrlResults.filter((result) =>
      result.skipped.includes(name),
    ).length;

    return {
      name,
      hit: hits > 0,
      detail:
        hits > 0
          ? `Matched ${hits} URL(s).`
          : skipped > 0
            ? `Skipped for ${skipped} URL(s).`
            : "No matches.",
    };
  });
  const flags = sources.flatMap((source) => {
    if (!source.hit) {
      return [];
    }
    if (source.name === GOOGLE_SOURCE) {
      return ["Listed as phishing or malware by Google Safe Browsing."];
    }
    if (source.name === URLHAUS_SOURCE) {
      return ["Listed as malware by URLhaus."];
    }
    return ["Listed as phishing by OpenPhish."];
  });
  const skipped = sources
    .filter((source) =>
      perUrlResults.some((result) => result.skipped.includes(source.name)),
    )
    .map((source) => source.name);
  const hitCount = perUrlResults.reduce(
    (count, result) =>
      count + result.sources.filter((source) => source.hit).length,
    0,
  );

  return {
    score: hitCount > 1 ? 100 : hitCount === 1 ? 90 : 0,
    flags,
    sources,
    skipped,
  };
}

function allSourcesSkippedResult(): ThreatIntelEvidence {
  return {
    score: 0,
    flags: [],
    sources: SOURCE_NAMES.map((name) => ({
      name,
      hit: false,
      detail: "Skipped (lookup unavailable).",
    })),
    skipped: [...SOURCE_NAMES],
  };
}

export async function checkThreatIntel(
  urls: string[],
  enabled = process.env.THREAT_INTEL_ENABLED === "true",
): Promise<ThreatIntelEvidence> {
  if (!enabled) {
    return emptyResult();
  }

  try {
    if (!Array.isArray(urls) || urls.length === 0) {
      return emptyResult();
    }
    const normalizedUrls = [
      ...new Map(
        urls.flatMap((value) => {
          if (typeof value !== "string") {
            return [];
          }
          const normalized = normalizeUrl(value);
          return normalized ? [[normalized.full, normalized] as const] : [];
        }),
      ).values(),
    ];
    if (normalizedUrls.length === 0) {
      return emptyResult();
    }

    const now = Date.now();
    const results = new Map<string, CachedUrlResult>();
    const uncachedUrls: NormalizedUrl[] = [];
    for (const url of normalizedUrls) {
      const cached = getCachedResult(url.full, now);
      if (cached) {
        results.set(url.full, cached);
      } else {
        uncachedUrls.push(url);
      }
    }

    if (uncachedUrls.length === 0) {
      return aggregateResults(normalizedUrls, results);
    }

    const googleKey = process.env.SAFE_BROWSING_API_KEY?.trim();
    const urlhausKey = process.env.URLHAUS_AUTH_KEY?.trim();
    let googleMatches = new Map<string, string[]>();
    let googleSkippedDetail: string | undefined;
    if (!googleKey) {
      googleSkippedDetail = "Skipped (API key not configured).";
    } else {
      try {
        googleMatches = await checkGoogleSafeBrowsing(uncachedUrls, googleKey);
      } catch (error) {
        googleSkippedDetail = skippedDetail(error);
      }
    }

    let feed: PhishFeed | undefined;
    let feedSkippedDetail: string | undefined;
    try {
      feed = await loadPhishFeed();
    } catch {
      feedSkippedDetail = "Skipped (local feed unavailable).";
    }

    const urlhausResults = new Map<string, ThreatIntelSource>();
    if (!urlhausKey) {
      for (const url of uncachedUrls) {
        urlhausResults.set(url.full, {
          name: URLHAUS_SOURCE,
          hit: false,
          detail: "Skipped (API key not configured).",
        });
      }
    } else {
      const urlsToCheck = uncachedUrls.slice(0, MAX_URLHAUS_LOOKUPS);
      const checked = await mapConcurrent(
        urlsToCheck,
        URLHAUS_CONCURRENCY,
        (url) => checkUrlhaus(url, urlhausKey),
      );
      urlsToCheck.forEach((url, index) => {
        urlhausResults.set(url.full, checked[index]);
      });
      for (const url of uncachedUrls.slice(MAX_URLHAUS_LOOKUPS)) {
        urlhausResults.set(url.full, {
          name: URLHAUS_SOURCE,
          hit: false,
          detail: "Skipped (per-request lookup limit reached).",
        });
      }
    }

    for (const url of uncachedUrls) {
      const googleThreatTypes = googleMatches.get(url.full) ?? [];
      const googleSource: ThreatIntelSource = googleSkippedDetail
        ? {
            name: GOOGLE_SOURCE,
            hit: false,
            detail: googleSkippedDetail,
          }
        : {
            name: GOOGLE_SOURCE,
            hit: googleThreatTypes.length > 0,
            detail:
              googleThreatTypes.length > 0
                ? `Matched threat type(s): ${googleThreatTypes.join(", ")}.`
                : "No matches.",
          };
      const urlhausSource =
        urlhausResults.get(url.full) ??
        ({
          name: URLHAUS_SOURCE,
          hit: false,
          detail: "Skipped (lookup unavailable).",
        } satisfies ThreatIntelSource);

      let openPhishSource: ThreatIntelSource;
      if (!feed) {
        openPhishSource = {
          name: OPENPHISH_SOURCE,
          hit: false,
          detail: feedSkippedDetail ?? "Skipped (local feed unavailable).",
        };
      } else {
        const fullUrlHit = feed.urls.has(url.full);
        const hostHit = feed.hosts.has(url.host);
        openPhishSource = {
          name: OPENPHISH_SOURCE,
          hit: fullUrlHit || hostHit,
          detail: fullUrlHit
            ? "Matched full URL."
            : hostHit
              ? "Matched normalized host."
              : "No matches.",
        };
      }

      const sources = [googleSource, urlhausSource, openPhishSource];
      const skipped = sources
        .filter((source) => source.detail?.startsWith("Skipped"))
        .map((source) => source.name);
      cacheResult(url.full, sources, skipped);
      const cached = getCachedResult(url.full, Date.now());
      if (cached) {
        results.set(url.full, cached);
      }
    }

    return aggregateResults(normalizedUrls, results);
  } catch {
    return allSourcesSkippedResult();
  }
}
