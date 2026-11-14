import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

const FEED_URL = "https://openphish.com/feed.txt";

function isValidFeedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const response = await fetch(FEED_URL, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error("OpenPhish feed download failed.");
  }

  const downloaded = await response.text();
  const urls = [
    ...new Set(
      downloaded
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && isValidFeedUrl(line)),
    ),
  ];
  if (urls.length === 0) {
    throw new Error("OpenPhish feed contained no valid URLs.");
  }

  const dataDirectory = path.resolve(process.cwd(), "data");
  const feedPath = path.join(dataDirectory, "phish-feed.txt");
  const temporaryPath = `${feedPath}.tmp`;
  await writeFile(temporaryPath, `${urls.join("\n")}\n`, "utf8");
  await rename(temporaryPath, feedPath);
  console.log(`Updated phishing feed with ${urls.length} valid URLs.`);
}

main().catch(() => {
  console.error("Feed update failed; the existing feed was left unchanged.");
  process.exitCode = 1;
});
