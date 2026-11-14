export interface UrlCheckResult {
  urls: string[];
  score: number;
  flags: string[];
}

const shorteners = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "cutt.ly",
  "rb.gy",
]);

const trustedDomains = [
  "sbi.co.in",
  "onlinesbi.sbi",
  "hdfcbank.com",
  "icicibank.com",
  "axisbank.com",
  "paytm.com",
  "phonepe.com",
  "amazon.in",
  "flipkart.com",
  "incometax.gov.in",
  "uidai.gov.in",
];

const brandKeywords = [
  "sbi",
  "hdfc",
  "icici",
  "axis",
  "paytm",
  "phonepe",
  "gpay",
  "upi",
  "kyc",
  "pan",
  "aadhaar",
  "incometax",
  "irctc",
  "amazon",
  "flipkart",
  "fedex",
  "bluedart",
];

const urlPattern =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|(?<![@\w.-])[a-z0-9_-]+\.apk(?:\?[^\s<>"']*)?|(?<![@\w.-])(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/[^\s<>"']*)?(?![\w@-])|(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:\/[^\s<>"']*)?(?![\w@-])/gi;

function trimUrl(value: string): string {
  return value.replace(/[.,!?;:)}\]]+$/g, "");
}

export function findUrls(text: string): string[] {
  return Array.from(text.matchAll(urlPattern), (match) => trimUrl(match[0])).filter(
    Boolean,
  );
}

function isTrustedDomain(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "gov.in" ||
    host.endsWith(".gov.in") ||
    trustedDomains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
  );
}

function isIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

export function checkUrls(text: string): UrlCheckResult {
  const urls = [...new Set(findUrls(text))];
  const flags: string[] = [];
  let score = 0;

  function addFlag(flag: string, points: number): void {
    flags.push(flag);
    score = Math.min(100, score + points);
  }

  for (const value of urls) {
    const hasScheme = /^https?:\/\//i.test(value);
    const normalized = /^www\./i.test(value) ? `https://${value}` : value;
    let url: URL;

    try {
      url = new URL(hasScheme ? normalized : `https://${normalized}`);
    } catch {
      continue;
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const labels = hostname.split(".");
    const tld = labels[labels.length - 1] ?? "";
    const trusted = isTrustedDomain(hostname);

    const shortener = [...shorteners].find(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (shortener) {
      addFlag(`URL shortener: ${shortener}`, 30);
    }
    if (
      ["xyz", "top", "online", "shop", "click", "site", "icu", "live", "work", "info", "buzz"].includes(tld)
    ) {
      addFlag(`Suspicious URL ending: .${tld}`, 25);
    }
    if (isIpv4(hostname)) {
      addFlag("URL uses an IP address", 35);
    }
    if (labels.some((label) => label.startsWith("xn--"))) {
      addFlag("URL uses punycode", 25);
    }
    if (url.protocol !== "https:") {
      addFlag("URL does not use HTTPS", 12);
    }

    const hyphenCount = (hostname.match(/-/g) ?? []).length;
    const digitCount = (hostname.match(/\d/g) ?? []).length;
    if (hyphenCount >= 3) {
      addFlag("URL domain has many hyphens", 12);
    }
    if (digitCount >= 4) {
      addFlag("URL domain has many digits", 12);
    }

    if (!trusted && brandKeywords.some((brand) => hostname.includes(brand))) {
      addFlag("URL domain imitates a known brand", 30);
    }
    if (hostname.endsWith(".apk") || url.pathname.toLowerCase().includes(".apk")) {
      addFlag("URL points to an APK file", 30);
    }
  }

  return { urls, score, flags };
}
