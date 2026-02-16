import { NextResponse } from "next/server";
import { buildDashboardSnapshot } from "@/lib/kalshi";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const DASHBOARD_RATE_LIMIT = 60; // requests per minute

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`dashboard:${ip}`, DASHBOARD_RATE_LIMIT);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before retrying." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const snapshot = await buildDashboardSnapshot();

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "s-maxage=20, stale-while-revalidate=40",
      },
    });
  } catch (error) {
    console.error("[dashboard] Failed to build snapshot:", error);
    return NextResponse.json(
      { error: "Dashboard data is temporarily unavailable." },
      { status: 500 },
    );
  }
}
