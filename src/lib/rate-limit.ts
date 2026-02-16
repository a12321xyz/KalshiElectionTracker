import { isIP } from "node:net";

/**
 * Simple in-memory sliding-window rate limiter.
 * Not suitable for multi-instance deployments — use Redis-backed limiter for that.
 */

const windowMs = 60_000; // 1 minute window
const maxBuckets = 10_000;

interface Entry {
    timestamps: number[];
    lastSeen: number;
}

const buckets = new Map<string, Entry>();

function normalizeIp(raw: string | null): string | null {
    if (!raw) {
        return null;
    }

    const value = raw.trim();
    if (!value) {
        return null;
    }

    if (isIP(value)) {
        return value;
    }

    const ipv4WithPort = value.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
    if (ipv4WithPort && isIP(ipv4WithPort[1])) {
        return ipv4WithPort[1];
    }

    const ipv6WithPort = value.match(/^\[([a-fA-F0-9:]+)\](?::\d+)?$/);
    if (ipv6WithPort && isIP(ipv6WithPort[1])) {
        return ipv6WithPort[1];
    }

    return null;
}

function extractForwardedIp(rawForwardedFor: string | null): string | null {
    if (!rawForwardedFor) {
        return null;
    }

    const forwardedChain = rawForwardedFor
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    // Prefer the right-most valid entry because proxies append addresses.
    for (let index = forwardedChain.length - 1; index >= 0; index -= 1) {
        const normalized = normalizeIp(forwardedChain[index]);
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

function pruneBuckets(now: number): void {
    for (const [key, entry] of buckets) {
        entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < windowMs);
        if (entry.timestamps.length === 0 && now - entry.lastSeen >= windowMs) {
            buckets.delete(key);
        }
    }
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
    pruneBuckets(Date.now());
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
    pruneBuckets(now);

    let entry = buckets.get(key);
    if (!entry) {
        if (buckets.size >= maxBuckets) {
            let oldestKey: string | null = null;
            let oldestSeen = Number.POSITIVE_INFINITY;

            for (const [bucketKey, bucketValue] of buckets) {
                if (bucketValue.lastSeen < oldestSeen) {
                    oldestSeen = bucketValue.lastSeen;
                    oldestKey = bucketKey;
                }
            }

            if (oldestKey) {
                buckets.delete(oldestKey);
            }
        }

        entry = { timestamps: [], lastSeen: now };
        buckets.set(key, entry);
    }

    entry.lastSeen = now;

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < windowMs);

    if (entry.timestamps.length >= maxRequests) {
        const oldest = entry.timestamps[0];
        const retryAfterMs = windowMs - (now - oldest);
        return { allowed: false, retryAfterMs };
    }

    entry.timestamps.push(now);
    return { allowed: true };
}

/** Extract a best-effort client IP from trusted proxy headers. */
export function getClientIp(request: Request): string {
    const directProxyIp = normalizeIp(request.headers.get("x-real-ip")) ?? normalizeIp(request.headers.get("cf-connecting-ip"));
    if (directProxyIp) {
        return directProxyIp;
    }

    const forwardedIp = extractForwardedIp(request.headers.get("x-forwarded-for"));
    if (forwardedIp) {
        return forwardedIp;
    }

    return "unknown";
}
