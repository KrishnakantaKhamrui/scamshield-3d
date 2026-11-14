import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SEED = 20261114;
const SAMPLE_PER_CLASS = 40;
const SOURCE = "UCI SMS Spam Collection";
const DATASET_LABEL = "English, non-India, tests generalization";

interface CsvMessage {
  label: "ham" | "spam";
  text: string;
}

function parseDelimited(contents: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (quoted) {
      if (character === '"' && contents[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && contents[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quoted field.");
  }
  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }
  return rows;
}

function readMessages(contents: string): CsvMessage[] {
  const cleanContents = contents.replace(/^\uFEFF/, "");
  const firstLine = cleanContents.split(/\r?\n/, 1)[0] ?? "";
  const firstTab = firstLine.indexOf("\t");
  const firstComma = firstLine.indexOf(",");
  const delimiter =
    firstTab >= 0 && (firstComma < 0 || firstTab < firstComma)
      ? "\t"
      : ",";
  const rows = parseDelimited(cleanContents, delimiter);
  const firstRow = (rows[0] ?? []).map((value) => value.trim().toLowerCase());
  const labelHeaders = ["label", "v1", "category", "class"];
  const textHeaders = ["text", "v2", "message", "sms"];
  const labelIndex = firstRow.findIndex((value) =>
    labelHeaders.includes(value),
  );
  const textIndex = firstRow.findIndex((value) =>
    textHeaders.includes(value),
  );
  const hasHeader = labelIndex >= 0 && textIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const labelColumn = hasHeader ? labelIndex : 0;
  const textColumn = hasHeader ? textIndex : 1;

  return dataRows.flatMap((row) => {
    const rawLabel = row[labelColumn]?.trim().toLowerCase();
    const text = row[textColumn]?.trim();
    if (!text || (rawLabel !== "ham" && rawLabel !== "spam")) {
      return [];
    }
    return [{ label: rawLabel, text }];
  });
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function sampleWithoutReplacement<T>(
  values: T[],
  count: number,
  random: () => number,
): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, count);
}

async function main(): Promise<void> {
  const dataDirectory = path.resolve(process.cwd(), "data");
  const csvPath = path.join(dataDirectory, "public", "sms_spam.csv");
  let contents: string;
  try {
    contents = await readFile(csvPath, "utf8");
  } catch {
    throw new Error(
      "Place the UCI SMS Spam Collection CSV at data/public/sms_spam.csv.",
    );
  }

  const messages = readMessages(contents);
  const random = seededRandom(SEED);
  const ham = sampleWithoutReplacement(
    messages.filter((message) => message.label === "ham"),
    SAMPLE_PER_CLASS,
    random,
  );
  const spam = sampleWithoutReplacement(
    messages.filter((message) => message.label === "spam"),
    SAMPLE_PER_CLASS,
    random,
  );
  if (ham.length !== SAMPLE_PER_CLASS || spam.length !== SAMPLE_PER_CLASS) {
    throw new Error("CSV must contain at least 40 ham and 40 spam messages.");
  }

  const items = [
    ...spam.map((message, index) => ({
      id: `public-spam-${String(index + 1).padStart(3, "0")}`,
      label: "scam" as const,
      category: "public-sms-spam",
      text: message.text,
    })),
    ...ham.map((message, index) => ({
      id: `public-ham-${String(index + 1).padStart(3, "0")}`,
      label: "safe" as const,
      category: "public-sms-ham",
      text: message.text,
    })),
  ];
  const document = {
    source: SOURCE,
    label: DATASET_LABEL,
    seed: SEED,
    generatedAt: new Date().toISOString(),
    items,
  };

  await writeFile(
    path.join(dataDirectory, "eval-public.json"),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Prepared ${spam.length} spam and ${ham.length} ham messages (seed ${SEED}) at data/eval-public.json.`,
  );
}

main().catch((error: unknown) => {
  console.error(
    "Public evaluation preparation failed:",
    error instanceof Error ? error.message : "Unknown error.",
  );
  process.exitCode = 1;
});
