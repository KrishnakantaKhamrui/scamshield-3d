import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  RegistryEntityHash,
  RegistryEntityType,
  RegistryHit,
} from "@/types";

// Store choice: Supabase Postgres, accessed only through server-side REST/RPC.
const SUPABASE_TIMEOUT_MS = 3000;
const MAX_LOOKUP_ENTITIES = 50;

const registryRowSchema = z.object({
  type: z.enum(["phone", "upi", "url", "domain"]),
  value_hash: z.string().regex(/^[a-f0-9]{64}$/),
  display_value: z.string(),
  category: z.string(),
  count: z.number().int().min(1),
});

interface RegistryConfig {
  url: URL;
  serviceKey: string;
}

export interface RegistryLookupResult {
  hits: RegistryHit[];
  available: boolean;
}

function getRegistryConfig(): RegistryConfig | undefined {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const salt = process.env.REGISTRY_HASH_SALT?.trim();
  if (!rawUrl || !serviceKey || !salt || salt.length < 32) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && url.hostname === "localhost")
    ) {
      return undefined;
    }
    return { url, serviceKey };
  } catch {
    return undefined;
  }
}

export function normalizeValue(
  type: RegistryEntityType,
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Invalid registry value.");
  }

  if (type === "phone") {
    let digits = trimmed.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    if (digits.length < 7 || digits.length > 15) {
      throw new Error("Invalid registry value.");
    }
    return digits;
  }

  if (type === "upi") {
    const normalized = trimmed.toLowerCase();
    if (!/^[a-z0-9._+-]{2,64}@[a-z0-9.-]{2,64}$/.test(normalized)) {
      throw new Error("Invalid registry value.");
    }
    return normalized;
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Invalid registry value.");
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.hostname.includes(" ")
  ) {
    throw new Error("Invalid registry value.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (type === "domain") {
    return hostname;
  }

  url.hostname = hostname;
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.href;
}

export function hashValue(type: RegistryEntityType, value: string): string {
  const salt = process.env.REGISTRY_HASH_SALT?.trim();
  if (!salt || salt.length < 32) {
    throw new Error("Registry hashing is not configured.");
  }
  const normalized = normalizeValue(type, value);
  return createHash("sha256")
    .update(`${salt}\0${type}\0${normalized}`, "utf8")
    .digest("hex");
}

function maskPhone(value: string): string {
  return `${value.slice(0, 2)}${"X".repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
}

function maskUpi(value: string): string {
  const [account = "", provider = ""] = value.split("@");
  const visibleLength = Math.max(1, Math.min(3, account.length - 2));
  return `${account.slice(0, visibleLength)}***@${provider}`;
}

function displayValue(type: RegistryEntityType, normalized: string): string {
  if (type === "phone") {
    return maskPhone(normalized);
  }
  if (type === "upi") {
    return maskUpi(normalized);
  }
  const hostname =
    type === "url" ? new URL(normalized).hostname : normalized;
  return hostname.replace(/\./g, "[.]");
}

function safeCategory(category: string): string {
  const normalized = category
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b\S+@\S+\b/g, "")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/[^a-zA-Z0-9 /_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  return normalized || "unspecified";
}

async function fetchWithTimeout(
  url: URL,
  config: RegistryConfig,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportEntity(
  type: RegistryEntityType,
  value: string,
  category: string,
): Promise<boolean> {
  const config = getRegistryConfig();
  if (!config) {
    return false;
  }

  try {
    const normalized = normalizeValue(type, value);
    const valueHash = hashValue(type, normalized);
    const endpoint = new URL("/rest/v1/rpc/report_entity", config.url);
    const response = await fetchWithTimeout(endpoint, config, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_type: type,
        p_value_hash: valueHash,
        p_display_value: displayValue(type, normalized),
        p_category: safeCategory(category),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function lookupEntitiesWithStatus(
  entities: RegistryEntityHash[],
): Promise<RegistryLookupResult> {
  const config = getRegistryConfig();
  if (!config) {
    return { hits: [], available: false };
  }
  if (entities.length === 0) {
    return { hits: [], available: true };
  }

  try {
    const normalizedEntities = [
      ...new Map(
        entities
          .filter((entity) => /^[a-f0-9]{64}$/.test(entity.valueHash))
          .map((entity) => [`${entity.type}:${entity.valueHash}`, entity]),
      ).values(),
    ].slice(0, MAX_LOOKUP_ENTITIES);
    if (normalizedEntities.length === 0) {
      return { hits: [], available: true };
    }

    const endpoint = new URL("/rest/v1/reports", config.url);
    endpoint.searchParams.set(
      "select",
      "type,value_hash,display_value,category,count",
    );
    endpoint.searchParams.set(
      "type",
      `in.(${[...new Set(normalizedEntities.map(({ type }) => type))].join(",")})`,
    );
    endpoint.searchParams.set(
      "value_hash",
      `in.(${normalizedEntities.map(({ valueHash }) => valueHash).join(",")})`,
    );
    const response = await fetchWithTimeout(endpoint, config, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { hits: [], available: false };
    }

    const rows = z.array(registryRowSchema).safeParse(await response.json());
    if (!rows.success) {
      return { hits: [], available: false };
    }
    return {
      hits: rows.data.map((row) => ({
        type: row.type,
        displayValue: row.display_value,
        category: row.category,
        count: row.count,
      })),
      available: true,
    };
  } catch {
    return { hits: [], available: false };
  }
}

export async function lookupEntities(
  entities: RegistryEntityHash[],
): Promise<RegistryHit[]> {
  const result = await lookupEntitiesWithStatus(entities);
  return result.hits;
}
