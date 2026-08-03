// Naive per-IP, per-instance rate limiter. On serverless this is a speed bump,
// not a fortress — each warm instance keeps its own counts — but it stops the
// casual "while true; do curl" without dragging in Redis.

const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, max = 30, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now > h.reset) {
    if (hits.size > 10_000) hits.clear(); // crude memory cap
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (h.n >= max) return false;
  h.n++;
  return true;
}

export function clientKey(headers: Headers): string {
  // x-real-ip is set by the platform (Vercel) and can't be spoofed by the client;
  // x-forwarded-for is the fallback, taking the first hop.
  return (
    headers.get("x-real-ip") ??
    (headers.get("x-forwarded-for") ?? "local").split(",")[0].trim()
  );
}
