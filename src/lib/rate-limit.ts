/**
 * Simple in-memory sliding-window rate limiter.
 * Not suitable for multi-instance deployments — use Redis-backed limiter for that.
 */

const windowMs = 60_000; // 1 minute window

interface Entry {
    timestamps: number[];
}

const buckets = new Map<string, Entry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
        entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
        if (entry.timestamps.length === 0) buckets.delete(key);
    }
}, 5 * 60_000).unref?.();

/**
 * Check whether a request from `key` (typically an IP) should be allowed.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        buckets.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= maxRequests) {
        const oldest = entry.timestamps[0];
        const retryAfterMs = windowMs - (now - oldest);
        return { allowed: false, retryAfterMs };
    }

    entry.timestamps.push(now);
    return { allowed: true };
}

/** Extract a best-effort client IP from the request headers. */
export function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return request.headers.get("x-real-ip") ?? "unknown";
}
