import { NextResponse } from "next/server";
import { getMarketDetail } from "@/lib/kalshi";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ ticker: string }>;
};

const VALID_TICKER = /^[\w-]{1,64}$/;
const MARKET_RATE_LIMIT = 120; // requests per minute

export async function GET(request: Request, context: RouteContext) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`market:${ip}`, MARKET_RATE_LIMIT);

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
    const { ticker } = await context.params;

    if (!VALID_TICKER.test(ticker)) {
      return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
    }

    const detail = await getMarketDetail(ticker);

    return NextResponse.json(detail, {
      headers: {
        "Cache-Control": "s-maxage=20, stale-while-revalidate=40",
      },
    });
  } catch (error) {
    console.error("[market-detail] Failed to load market:", error);
    return NextResponse.json(
      { error: "Market detail is temporarily unavailable." },
      { status: 500 },
    );
  }
}
