import "server-only";

import { hashValue } from "@/lib/registry";
import { findUrls } from "@/lib/agent/urlChecker";
import type {
  RegistryEntityHash,
  RegistryEntityType,
} from "@/types";

const phonePattern =
  /(?<![\d])(?:\+?91[\s().-]?)?(?:0[\s().-]?)?[6-9](?:[\s().-]?\d){9}(?![\d])/g;
const upiPattern =
  /(?<![\w.+-])[a-z0-9._+-]{2,64}@[a-z0-9.-]{2,64}(?![\w.-])/gi;

export async function extractEntityHashes(
  rawText: string,
): Promise<RegistryEntityHash[]> {
  const entities = new Map<string, RegistryEntityHash>();
  const addHash = (type: RegistryEntityType, rawValue: string): void => {
    try {
      const valueHash = hashValue(type, rawValue);
      entities.set(`${type}:${valueHash}`, { type, valueHash });
    } catch {
      // Invalid or unconfigured registry values are ignored without retaining them.
    }
  };

  for (const match of rawText.matchAll(phonePattern)) {
    addHash("phone", match[0]);
  }
  for (const match of rawText.matchAll(upiPattern)) {
    addHash("upi", match[0]);
  }
  for (const value of findUrls(rawText)) {
    const type: RegistryEntityType =
      /^https?:\/\//i.test(value) || /^www\./i.test(value) || /[/?#]/.test(value)
        ? "url"
        : "domain";
    addHash(type, value);
  }

  return [...entities.values()];
}
