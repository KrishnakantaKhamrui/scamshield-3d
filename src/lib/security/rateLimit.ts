interface RateLimitBucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, RateLimitBucket>();

function enforceBucketLimit(
  now: number,
  key: string,
  currentBucket: RateLimitBucket,
): void {
  if (buckets.size <= 5000) {
    return;
  }

  for (const [bucketKey, storedBucket] of buckets) {
    if (now >= storedBucket.reset) {
      buckets.delete(bucketKey);
    }
  }
  if (buckets.size > 5000) {
    buckets.clear();
    buckets.set(key, currentBucket);
  }
}

export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.reset) {
    const newBucket = { count: 1, reset: now + windowMs };
    buckets.set(key, newBucket);
    enforceBucketLimit(now, key, newBucket);
    return { ok: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  enforceBucketLimit(now, key, bucket);
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
  };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}
