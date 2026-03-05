import type { DashboardEvent, DashboardMarket, DashboardSnapshot, MarketDetail } from "@/lib/types";

const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

const DIRECT_ELECTION_PATTERN =
  /\b(election|electoral|primary|runoff|referendum|ballot|vote|voter|seat|majority|general election|by-election)\b/i;
const OFFICE_RACE_PATTERN = /\b(president|prime minister|parliament|senate|house|governor|mayor|mp)\b/i;
const COMPETITIVE_PATTERN = /\b(win|wins|won|control|party|seat|majority|elected)\b/i;
const EXCLUSION_PATTERN = /\b(say during|mention|speech|interview|press conference)\b/i;

type RawEvent = {
  event_ticker: string;
  title: string;
  sub_title?: string;
  category?: string;
  markets?: RawMarket[];
};

type RawMarket = {
  ticker: string;
  event_ticker: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string;
  close_time?: string;
  updated_time?: string;
  last_price_dollars?: string;
  previous_price_dollars?: string;
  previous_yes_bid_dollars?: string;
  previous_yes_ask_dollars?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  volume_24h_fp?: string;
  open_interest_fp?: string;
  liquidity_dollars?: string;
  rules_primary?: string;
  rules_secondary?: string;
  result?: string;
};

type EventsResponse = {
  events: RawEvent[];
  cursor?: string;
};

type MarketsResponse = {
  markets: RawMarket[];
  cursor?: string;
};

type MarketResponse = {
  market: RawMarket;
};

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_REQUEST_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;
const SNAPSHOT_TTL_MS = 25_000;
const REQUEST_TIMEOUT_MS = 8_000;
const OPEN_MARKET_STATUS = "open";

let snapshotCache: { value: DashboardSnapshot; expiresAt: number } | null = null;
let snapshotInFlight: Promise<DashboardSnapshot> | null = null;

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toPercent(dollarProbability: number): number {
  return clamp(dollarProbability * 100, 0, 100);
}

export function toProbability(market: RawMarket): number {
  const last = toNumber(market.last_price_dollars);
  if (last !== null && last > 0) {
    return toPercent(last);
  }

  const yesBid = toNumber(market.yes_bid_dollars);
  const yesAsk = toNumber(market.yes_ask_dollars);

  if (yesBid !== null && yesAsk !== null) {
    return toPercent((yesBid + yesAsk) / 2);
  }

  if (yesBid !== null) {
    return toPercent(yesBid);
  }

  if (yesAsk !== null) {
    return toPercent(yesAsk);
  }

  return 50;
}

export function toMovePoints(market: RawMarket, impliedProbability: number): number {
  const previous = toPreviousProbability(market);
  if (previous === null) {
    return 0;
  }

  return impliedProbability - previous;
}

export function toPreviousProbability(market: RawMarket): number | null {
  const previousLast = toNumber(market.previous_price_dollars);
  return previousLast !== null && previousLast > 0 ? toPercent(previousLast) : null;
}

function eventMarketText(event: RawEvent, market: RawMarket): string {
  return [
    event.title,
    event.sub_title,
    market.title,
    market.subtitle,
    market.yes_sub_title,
    market.no_sub_title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isStrictElectionMarket(event: RawEvent, market: RawMarket): boolean {
  const text = eventMarketText(event, market);

  if (EXCLUSION_PATTERN.test(text)) {
    return false;
  }

  if (DIRECT_ELECTION_PATTERN.test(text)) {
    return true;
  }

  const hasOffice = OFFICE_RACE_PATTERN.test(text);
  const isCompetitive = COMPETITIVE_PATTERN.test(text);
  const hasContext = /\b(next|general|202\d|203\d)\b/i.test(text);

  return hasOffice && isCompetitive && hasContext;
}

function toDashboardMarket(market: RawMarket, event: RawEvent): DashboardMarket {
  const impliedProbability = toProbability(market);
  const movePoints = toMovePoints(market, impliedProbability);

  return {
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    eventTitle: event.title,
    eventSubtitle: event.sub_title ?? "",
    marketTitle: market.title ?? market.yes_sub_title ?? market.ticker,
    yesLabel: market.yes_sub_title ?? "Yes",
    noLabel: market.no_sub_title ?? "No",
    status: market.status ?? "unknown",
    closeTime: market.close_time ?? null,
    updatedTime: market.updated_time ?? null,
    impliedProbability,
    movePoints,
    lastPrice: toNumber(market.last_price_dollars),
    previousPrice: toNumber(market.previous_price_dollars),
    yesBid: toNumber(market.yes_bid_dollars),
    yesAsk: toNumber(market.yes_ask_dollars),
    noBid: toNumber(market.no_bid_dollars),
    noAsk: toNumber(market.no_ask_dollars),
    volume24h: toNumber(market.volume_24h_fp) ?? 0,
    openInterest: toNumber(market.open_interest_fp) ?? 0,
  };
}

async function requestKalshi<T>(path: string, query?: Record<string, string | number | boolean>): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${KALSHI_BASE_URL}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }

  let attempt = 0;

  while (attempt <= MAX_REQUEST_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);

      if (attempt >= MAX_REQUEST_RETRIES) {
        throw error;
      }

      attempt += 1;
      await wait(RETRY_BASE_DELAY_MS * attempt);
      continue;
    }

    clearTimeout(timeout);

    if (!response.ok) {
      if (TRANSIENT_STATUSES.has(response.status) && attempt < MAX_REQUEST_RETRIES) {
        attempt += 1;
        await wait(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      throw new Error(`Kalshi request failed with status ${response.status} for ${url.pathname}`);
    }

    return (await response.json()) as T;
  }

  throw new Error(`Kalshi request failed after retries for ${url.pathname}`);
}

async function fetchOpenEventsWithNestedMarkets(): Promise<RawEvent[]> {
  // Fetch page 1
  const page1 = await requestKalshi<EventsResponse>("/events", {
    status: "open",
    with_nested_markets: true,
    limit: 200,
  });

  const events = [...page1.events];

  // If there's a cursor, fetch page 2 in parallel with any downstream processing
  if (page1.cursor) {
    const page2 = await requestKalshi<EventsResponse>("/events", {
      status: "open",
      with_nested_markets: true,
      limit: 200,
      cursor: page1.cursor,
    });
    events.push(...page2.events);
  }

  return events;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchMarketsByTickers(tickers: string[]): Promise<Map<string, RawMarket>> {
  const uniqueTickers = Array.from(new Set(tickers));
  const marketMap = new Map<string, RawMarket>();
  const tickerChunks = chunk(uniqueTickers, 90);

  const responses = await Promise.all(
    tickerChunks.map((tickerChunk) =>
      requestKalshi<MarketsResponse>("/markets", {
        status: "open",
        mve_filter: "exclude",
        limit: 1000,
        tickers: tickerChunk.join(","),
      }),
    ),
  );

  for (const response of responses) {
    for (const market of response.markets) {
      marketMap.set(market.ticker, market);
    }
  }

  return marketMap;
}

function buildEventSummaries(markets: DashboardMarket[]): DashboardEvent[] {
  const grouped = new Map<string, DashboardEvent>();

  for (const market of markets) {
    if (!grouped.has(market.eventTicker)) {
      grouped.set(market.eventTicker, {
        eventTicker: market.eventTicker,
        title: market.eventTitle,
        subtitle: market.eventSubtitle,
        category: "Politics",
        totalVolume24h: 0,
        marketCount: 0,
        topMarkets: [],
      });
    }

    const eventBucket = grouped.get(market.eventTicker);
    if (!eventBucket) {
      continue;
    }

    eventBucket.totalVolume24h += market.volume24h;
    eventBucket.marketCount += 1;
    eventBucket.topMarkets.push(market);
  }

  return Array.from(grouped.values())
    .map((event) => ({
      ...event,
      topMarkets: event.topMarkets
        .sort((left, right) => right.volume24h - left.volume24h || Math.abs(right.movePoints) - Math.abs(left.movePoints))
        .slice(0, 3),
    }))
    .sort((left, right) => right.totalVolume24h - left.totalVolume24h)
    .slice(0, 10);
}

async function buildDashboardSnapshotFresh(): Promise<DashboardSnapshot> {
  const openEvents = await fetchOpenEventsWithNestedMarkets();

  const candidateMarkets = new Map<string, { event: RawEvent; market: RawMarket }>();

  for (const event of openEvents) {
    for (const market of event.markets ?? []) {
      if (isStrictElectionMarket(event, market)) {
        candidateMarkets.set(market.ticker, { event, market });
      }
    }
  }

  if (candidateMarkets.size === 0) {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        trackedMarkets: 0,
        trackedEvents: 0,
        totalVolume24h: 0,
        averageProbability: 0,
        positiveMovers: 0,
      },
      allMarkets: [],
      topMarkets: [],
      movers: [],
      events: [],
    };
  }

  const freshOpenMarkets = await fetchMarketsByTickers(Array.from(candidateMarkets.keys()));

  const mergedMarkets: DashboardMarket[] = Array.from(candidateMarkets.values()).map(({ event, market }) => {
    const freshMarket = freshOpenMarkets.get(market.ticker);
    return toDashboardMarket(freshMarket ?? market, event);
  });

  const sortedByVolume = mergedMarkets
    .slice()
    .sort((left, right) => right.volume24h - left.volume24h || Math.abs(right.movePoints) - Math.abs(left.movePoints));

  const rankedByMove = mergedMarkets
    .slice()
    .sort((left, right) => Math.abs(right.movePoints) - Math.abs(left.movePoints) || right.volume24h - left.volume24h);

  const movers = rankedByMove.filter((market) => Math.abs(market.movePoints) >= 0.5).slice(0, 12);

  if (movers.length < 12) {
    for (const market of rankedByMove) {
      if (movers.some((candidate) => candidate.ticker === market.ticker)) {
        continue;
      }

      movers.push(market);

      if (movers.length === 12) {
        break;
      }
    }
  }

  const topMarkets = sortedByVolume.slice(0, 30);
  const events = buildEventSummaries(mergedMarkets);

  const totalVolume24h = mergedMarkets.reduce((total, market) => total + market.volume24h, 0);
  const averageProbability =
    mergedMarkets.length > 0
      ? mergedMarkets.reduce((total, market) => total + market.impliedProbability, 0) / mergedMarkets.length
      : 0;
  const positiveMovers = mergedMarkets.filter((market) => market.movePoints > 0).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      trackedMarkets: mergedMarkets.length,
      trackedEvents: new Set(mergedMarkets.map((market) => market.eventTicker)).size,
      totalVolume24h,
      averageProbability,
      positiveMovers,
    },
    allMarkets: sortedByVolume,
    topMarkets,
    movers,
    events,
  };
}

export async function buildDashboardSnapshot(): Promise<DashboardSnapshot> {
  const now = Date.now();

  // Serve fresh cache immediately
  if (snapshotCache && snapshotCache.expiresAt > now) {
    return snapshotCache.value;
  }

  // Stale-while-revalidate: return stale data instantly, refresh in background
  if (snapshotCache && snapshotCache.expiresAt <= now) {
    if (!snapshotInFlight) {
      snapshotInFlight = buildDashboardSnapshotFresh()
        .then((snapshot) => {
          snapshotCache = { value: snapshot, expiresAt: Date.now() + SNAPSHOT_TTL_MS };
          return snapshot;
        })
        .catch((err) => {
          console.error("[kalshi] Background refresh failed:", err);
          return snapshotCache!.value;
        })
        .finally(() => {
          snapshotInFlight = null;
        });
    }
    return snapshotCache.value;
  }

  // Cold start — no cache at all, must wait
  if (!snapshotInFlight) {
    snapshotInFlight = buildDashboardSnapshotFresh();
  }

  try {
    const snapshot = await snapshotInFlight;
    snapshotCache = {
      value: snapshot,
      expiresAt: Date.now() + SNAPSHOT_TTL_MS,
    };
    return snapshot;
  } catch (err) {
    snapshotCache = null;
    throw err;
  } finally {
    snapshotInFlight = null;
  }
}

export async function getMarketDetail(ticker: string): Promise<MarketDetail> {
  const response = await requestKalshi<MarketResponse>(`/markets/${encodeURIComponent(ticker)}`);
  const market = response.market;

  const impliedProbability = toProbability(market);

  return {
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    title: market.title ?? market.yes_sub_title ?? market.ticker,
    yesLabel: market.yes_sub_title ?? "Yes",
    noLabel: market.no_sub_title ?? "No",
    status: market.status ?? "unknown",
    closeTime: market.close_time ?? null,
    updatedTime: market.updated_time ?? null,
    impliedProbability,
    movePoints: toMovePoints(market, impliedProbability),
    lastPrice: toNumber(market.last_price_dollars),
    previousPrice: toNumber(market.previous_price_dollars),
    yesBid: toNumber(market.yes_bid_dollars),
    yesAsk: toNumber(market.yes_ask_dollars),
    noBid: toNumber(market.no_bid_dollars),
    noAsk: toNumber(market.no_ask_dollars),
    volume24h: toNumber(market.volume_24h_fp) ?? 0,
    openInterest: toNumber(market.open_interest_fp) ?? 0,
    liquidity: toNumber(market.liquidity_dollars),
    result: market.result ?? "",
    rulesPrimary: market.rules_primary ?? "",
    rulesSecondary: market.rules_secondary ?? "",
  };
}
