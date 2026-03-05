"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import type { DashboardMarket, DashboardSnapshot, MarketDetail } from "@/lib/types";
import styles from "./election-dashboard.module.css";

const REFRESH_INTERVAL_MS = 45_000;
const PAGE_SIZE = 25;
const TOAST_DURATION_MS = 3_200;
const DASHBOARD_ENDPOINT = "/api/dashboard";
const MARKET_ENDPOINT_PREFIX = "/api/market/";
const SWIPE_CLOSE_THRESHOLD = 80;
const LIVE_UPDATES_LABEL = "Updates every 45 seconds";
const STATS_FLASH_MS = 450;

type SortKey = "volume" | "probability" | "move" | "close";
type FilterTag = "all" | "senate" | "governor" | "president" | "house" | "election";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "volume", label: "Volume (24h)" },
  { value: "probability", label: "Probability" },
  { value: "move", label: "Biggest Move" },
  { value: "close", label: "Close Time" },
];

const FILTER_OPTIONS: { value: FilterTag; label: string }[] = [
  { value: "all", label: "All" },
  { value: "president", label: "Presidential" },
  { value: "senate", label: "Senate" },
  { value: "house", label: "House" },
  { value: "governor", label: "Governor" },
  { value: "election", label: "Election" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ── helpers ─────────────────────────── */

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatPrice(value: number | null): string {
  if (value === null) return "--";
  return `$${value.toFixed(4)}`;
}

function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pts`;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatCloseTime(value: string | null): string {
  if (!value) return "TBD";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function moveToneClass(value: number): string {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return styles.neutral;
}

function probabilityBarColor(p: number): string {
  if (p < 30) return `var(--bar-low)`;
  if (p < 60) return `var(--bar-mid)`;
  return `var(--bar-high)`;
}

function categoryFor(market: DashboardMarket): string {
  const text = `${market.marketTitle} ${market.eventTitle}`.toLowerCase();
  if (text.includes("president") || text.includes("presidential")) return "Presidential";
  if (text.includes("senate") || text.includes("senator")) return "Senate";
  if (text.includes("house") || text.includes("representative")) return "House";
  if (text.includes("governor") || text.includes("gubernatorial")) return "Governor";
  return "Election";
}

function buildSparklinePath(probability: number, ticker: string): string {
  // Deterministic pseudo-sparkline based on ticker hash + probability
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ((hash << 5) - hash + ticker.charCodeAt(i)) | 0;
  }
  const points: number[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const seed = Math.abs(Math.sin(hash + i * 1.7)) * 4 - 2;
    const base = probability + seed * (1 - i / steps);
    points.push(Math.max(0, Math.min(100, base)));
  }
  // Ensure last point is the current probability
  points[steps] = probability;

  // Auto-scale with minimum range to avoid amplifying tiny noise into big spikes
  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const range = Math.max(maxY - minY, 8); // minimum 8-point range keeps it calm
  const midY = (minY + maxY) / 2;
  const padding = 0.25; // 25% padding top & bottom

  const w = 80;
  const h = 20;
  return points
    .map((y, i) => {
      const x = (i / steps) * w;
      const normalized = (y - midY) / range + 0.5; // center on midpoint
      const yp = h - (padding + Math.max(0, Math.min(1, normalized)) * (1 - 2 * padding)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${yp.toFixed(1)}`;
    })
    .join(" ");
}

function matchesFilter(market: DashboardMarket, filter: FilterTag): boolean {
  if (filter === "all") return true;
  const text = `${market.marketTitle} ${market.eventTitle} ${market.yesLabel}`.toLowerCase();
  return text.includes(filter);
}

function sortMarkets(markets: DashboardMarket[], key: SortKey): DashboardMarket[] {
  return [...markets].sort((a, b) => {
    switch (key) {
      case "volume":
        return b.volume24h - a.volume24h;
      case "probability":
        return b.impliedProbability - a.impliedProbability;
      case "move":
        return Math.abs(b.movePoints) - Math.abs(a.movePoints);
      case "close": {
        const aTime = a.closeTime ? new Date(a.closeTime).getTime() : Infinity;
        const bTime = b.closeTime ? new Date(b.closeTime).getTime() : Infinity;
        return aTime - bTime;
      }
      default:
        return 0;
    }
  });
}

function uniqueMarkets(snapshot: DashboardSnapshot | null): DashboardMarket[] {
  if (!snapshot) return [];
  const byTicker = new Map<string, DashboardMarket>();
  for (const m of snapshot.allMarkets) byTicker.set(m.ticker, m);
  for (const m of snapshot.movers) byTicker.set(m.ticker, m);
  for (const e of snapshot.events) {
    for (const m of e.topMarkets) byTicker.set(m.ticker, m);
  }
  return Array.from(byTicker.values());
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

type Toast = { id: number; message: string; type: "success" | "error" };

/* ── Skeleton ────────────────────────── */

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className={styles.skeletonList}>
      {Array.from({ length: count }, (_, i) => (
        <div className={styles.skeletonCard} key={i} style={{ animationDelay: `${i * 40}ms` }}>
          <div className={styles.skeletonLineShort} />
          <div className={styles.skeletonLineMedium} />
          <div className={styles.skeletonLineBar} />
          <div className={styles.skeletonLineMeta} />
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ──────────────────── */

export function ElectionDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIssue, setRefreshIssue] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [filter, setFilter] = useState<FilterTag>("all");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [statsFlash, setStatsFlash] = useState(false);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const toastIdRef = useRef(0);
  const dashboardRequestIdRef = useRef(0);
  const statsFlashTimerRef = useRef<number | null>(null);
  const toastTimerIdsRef = useRef<number[]>([]);
  const listRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (statsFlashTimerRef.current !== null) {
        window.clearTimeout(statsFlashTimerRef.current);
      }

      for (const timerId of toastTimerIdsRef.current) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  /* ── Drawer swipe-to-close ─────────── */
  const swipeStartX = useRef(0);
  const swipeCurrentX = useRef(0);
  const handleSwipeStart = useCallback((e: ReactTouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeCurrentX.current = e.touches[0].clientX;
  }, []);
  const handleSwipeMove = useCallback((e: ReactTouchEvent) => {
    swipeCurrentX.current = e.touches[0].clientX;
  }, []);
  const handleSwipeEnd = useCallback(() => {
    const delta = swipeCurrentX.current - swipeStartX.current;
    if (delta > SWIPE_CLOSE_THRESHOLD) setSelectedTicker(null);
  }, []);

  /* ── Toast helper ─────────────────── */

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);

    const timerId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimerIdsRef.current = toastTimerIdsRef.current.filter((activeTimerId) => activeTimerId !== timerId);
    }, TOAST_DURATION_MS);

    toastTimerIdsRef.current.push(timerId);
  }, []);

  /* ── Data fetching ────────────────── */

  const loadDashboard = useCallback(
    async (silent = false) => {
      const requestId = ++dashboardRequestIdRef.current;

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch(DASHBOARD_ENDPOINT, { cache: "no-store" });
        if (!response.ok) throw new Error(`Dashboard request failed (${response.status}).`);

        const nextSnapshot = (await response.json()) as DashboardSnapshot;

        if (requestId !== dashboardRequestIdRef.current) {
          return;
        }

        setSnapshot(nextSnapshot);
        setLastRefresh(nextSnapshot.generatedAt);
        setRefreshIssue(null);
        setError(null);

        // Trigger stat value flash animation
        if (statsFlashTimerRef.current !== null) {
          window.clearTimeout(statsFlashTimerRef.current);
        }

        setStatsFlash(true);
        statsFlashTimerRef.current = window.setTimeout(() => {
          setStatsFlash(false);
          statsFlashTimerRef.current = null;
        }, 450);

        if (silent) addToast("Data refreshed", "success");
      } catch (requestError) {
        if (requestId !== dashboardRequestIdRef.current) {
          return;
        }

        const message = requestError instanceof Error ? requestError.message : "Could not load dashboard data.";
        if (silent && snapshotRef.current) {
          setRefreshIssue(message);
          addToast("Refresh failed — using previous data", "error");
        } else {
          setError(message);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    void loadDashboard(false);
    const timer = window.setInterval(() => void loadDashboard(true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  /* ── Filtering, sorting, pagination ── */

  const filteredAllMarkets = useMemo(() => {
    if (!snapshot) return [];
    const haystack = query.trim().toLowerCase();

    let results = snapshot.allMarkets;

    if (filter !== "all") {
      results = results.filter((m) => matchesFilter(m, filter));
    }

    if (haystack) {
      results = results.filter((m) => {
        const text = `${m.marketTitle} ${m.eventTitle} ${m.ticker}`.toLowerCase();
        return text.includes(haystack);
      });
    }

    return sortMarkets(results, sortKey);
  }, [query, snapshot, sortKey, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredAllMarkets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedMarkets = filteredAllMarkets.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page on search/filter/sort change
  useEffect(() => {
    setPage(0);
  }, [query, sortKey, filter]);

  // Scroll to top of list on page change
  useEffect(() => {
    if (listRef.current && page > 0) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [page]);

  const filteredMovers = useMemo(() => {
    if (!snapshot) return [];
    const haystack = query.trim().toLowerCase();
    if (!haystack) return snapshot.movers;
    return snapshot.movers.filter((m) => {
      const text = `${m.marketTitle} ${m.eventTitle} ${m.ticker}`.toLowerCase();
      return text.includes(haystack);
    });
  }, [query, snapshot]);

  /* ── Market detail drawer ─────────── */

  const highlightedMarket = useMemo(() => {
    if (!snapshot || !selectedTicker) return null;
    return uniqueMarkets(snapshot).find((m) => m.ticker === selectedTicker) ?? null;
  }, [selectedTicker, snapshot]);

  useEffect(() => {
    if (!selectedTicker) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let ignore = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await fetch(`${MARKET_ENDPOINT_PREFIX}${encodeURIComponent(selectedTicker)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Market detail request failed (${response.status}).`);
        const nextDetail = (await response.json()) as MarketDetail;
        if (!ignore) setDetail(nextDetail);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load market detail.";
        if (!ignore) setDetailError(message);
      } finally {
        if (!ignore) setDetailLoading(false);
      }
    };

    void loadDetail();
    return () => {
      ignore = true;
    };
  }, [selectedTicker]);

  /* ── Keyboard navigation ──────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTicker) {
        setSelectedTicker(null);
        return;
      }

      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTextEntryTarget(e.target)) {
        return;
      }

      if (selectedTicker) {
        return;
      }

      if (e.key === "ArrowLeft" && safePage > 0) {
        setPage((p) => p - 1);
      }

      if (e.key === "ArrowRight" && safePage < totalPages - 1) {
        setPage((p) => p + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTicker, safePage, totalPages]);

  useEffect(() => {
    if (!selectedTicker) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseRef.current?.focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const drawer = drawerRef.current;
      if (!drawer) {
        return;
      }

      const focusableElements = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.tabIndex !== -1 && element.offsetParent !== null,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trapFocus);

    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = originalBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [selectedTicker]);

  const stats = snapshot?.summary;

  /* ── Render ────────────────────────── */

  return (
    <div className={styles.shell}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Live Kalshi election markets</p>
          <h1 className={styles.title}>Kalshi Election Tracker</h1>
          <p className={styles.subtitle}>Live odds, momentum shifts, and top-volume races in one view.</p>
        </div>

        <div className={styles.heroMeta}>
          <div className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden="true" />
            <span>{LIVE_UPDATES_LABEL}</span>
          </div>
          <p className={styles.timestamp}>Last updated: {lastRefresh ? relativeTime(lastRefresh) : "--"}</p>
          <button className={styles.refreshButton} type="button" disabled={loading} onClick={() => void loadDashboard(false)}>
            {loading ? "Updating\u2026" : "Update now"}
          </button>
        </div>
      </header>

      {error ? <div className={styles.alertError}>{error}</div> : null}
      {refreshIssue ? <div className={styles.alertWarn}>Using previous snapshot. {refreshIssue}</div> : null}

      {/* ── Stats ──────────────────────── */}

      <section className={styles.statsGrid}>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Tracked Markets</p>
          <p className={`${styles.statValue} ${statsFlash ? styles.statValueFlash : ""}`}>{stats ? stats.trackedMarkets : "--"}</p>
          <p className={styles.statHint}>Strict election filter</p>
        </article>

        <article className={styles.statCard}>
          <p className={styles.statLabel}>Tracked Events</p>
          <p className={`${styles.statValue} ${statsFlash ? styles.statValueFlash : ""}`}>{stats ? stats.trackedEvents : "--"}</p>
          <p className={styles.statHint}>Open election events</p>
        </article>

        <article className={styles.statCard}>
          <p className={styles.statLabel}>24h Volume</p>
          <p className={`${styles.statValue} ${statsFlash ? styles.statValueFlash : ""}`}>{stats ? formatCount(stats.totalVolume24h) : "--"}</p>
          <p className={styles.statHint}>Contracts across tracked markets</p>
        </article>

        <article className={styles.statCard}>
          <p className={styles.statLabel}>Avg Implied Probability</p>
          <p className={`${styles.statValue} ${statsFlash ? styles.statValueFlash : ""}`}>{stats ? formatPercent(stats.averageProbability) : "--"}</p>
          <p className={styles.statHint}>{stats ? `${stats.positiveMovers} markets up today` : "Movement unavailable"}</p>
        </article>
      </section>

      {/* ── Toolbar ─────────────────────── */}

      <section className={styles.toolbar}>
        <label htmlFor="market-search" className={styles.searchWrap}>
          <span className={styles.searchLabel}>Search markets</span>
          <input
            id="market-search"
            className={styles.searchInput}
            type="search"
            placeholder="Try 'senate', 'governor', or a ticker"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <p className={styles.toolbarInfo}>
          {filteredAllMarkets.length} market{filteredAllMarkets.length !== 1 ? "s" : ""} found
          {filteredAllMarkets.length > PAGE_SIZE ? ` · Page ${safePage + 1} of ${totalPages}` : ""}.
        </p>

        <div className={styles.sortFilterRow}>
          <select
            className={styles.sortSelect}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort markets by"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>

          <div className={styles.filterChips} role="group" aria-label="Filter by category">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.filterChip} ${filter === opt.value ? styles.filterChipActive : ""}`}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content ─────────────────────── */}

      <main className={styles.contentGrid} ref={listRef}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Election Markets</h2>
            <p className={styles.panelSubTitle}>
              {sortKey === "volume" ? "Ranked by 24h volume" : `Sorted by ${SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? sortKey}`}
            </p>
          </div>

          {loading && !snapshot ? <SkeletonCards count={6} /> : null}

          {!loading && filteredAllMarkets.length === 0 ? (
            <div className={styles.emptyWrap}>
              <div className={styles.emptyIcon}>🗳️</div>
              <p className={styles.emptyText}>
                No markets match your search{filter !== "all" ? ` in "${filter}"` : ""}. Try broadening your query or removing filters.
              </p>
            </div>
          ) : null}

          <ul className={styles.marketList}>
            {paginatedMarkets.map((market, index) => (
              <li className={styles.marketItem} key={market.ticker}>
                <button
                  className={`${styles.marketButton} ${selectedTicker === market.ticker ? styles.marketButtonActive : ""}`}
                  type="button"
                  onClick={() => setSelectedTicker(market.ticker)}
                >
                  {/* Hover Preview */}
                  <div className={styles.hoverPreview}>
                    <span>
                      YES <strong>{formatPrice(market.yesBid)}</strong>/<strong>{formatPrice(market.yesAsk)}</strong>
                    </span>
                    <span>
                      OI <strong>{formatCount(market.openInterest)}</strong>
                    </span>
                  </div>

                  <div className={styles.marketHeader}>
                    <span className={styles.rank}>{String(safePage * PAGE_SIZE + index + 1).padStart(2, "0")}</span>
                    <p className={styles.marketTitle}>{market.marketTitle}</p>
                    <span className={`${styles.movePill} ${moveToneClass(market.movePoints)}`}>{formatSigned(market.movePoints)}</span>
                  </div>

                  <p className={styles.marketEvent}>{market.eventTitle}</p>

                  {/* Sparkline */}
                  <div className={styles.sparklineRow}>
                    <svg className={styles.sparkline} viewBox="0 0 80 20" preserveAspectRatio="none" aria-hidden="true">
                      <path className={styles.sparklinePath} d={buildSparklinePath(market.impliedProbability, market.ticker)} />
                    </svg>
                    <span className={styles.sparklineLabel}>{formatPercent(market.impliedProbability)}</span>
                  </div>

                  <div
                    className={styles.probabilityTrack}
                    role="meter"
                    aria-label="Implied probability"
                    aria-valuenow={market.impliedProbability}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className={styles.probabilityFill}
                      style={{
                        width: `${market.impliedProbability}%`,
                        background: probabilityBarColor(market.impliedProbability),
                      }}
                    />
                  </div>

                  <div className={styles.marketMeta}>
                    <span className={styles.categoryBadge}>{categoryFor(market)}</span>
                    <span>Implied {formatPercent(market.impliedProbability)}</span>
                    <span>Vol {formatCount(market.volume24h)}</span>
                    <span>Close {formatCloseTime(market.closeTime)}</span>
                    {lastRefresh ? <span className={styles.updatedBadge}>{relativeTime(lastRefresh)}</span> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className={styles.paginationBar}>
              <button
                className={styles.paginationButton}
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Previous
              </button>
              <span className={styles.paginationInfo}>
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                className={styles.paginationButton}
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next →
              </button>
            </div>
          ) : null}
        </section>

        {/* ── Side stack ──────────────────── */}

        <div className={styles.sideStack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Biggest Movers</h2>
              <p className={styles.panelSubTitle}>Largest probability swings</p>
            </div>

            {loading && !snapshot ? <SkeletonCards count={3} /> : null}

            <ul className={styles.moversList}>
              {filteredMovers.slice(0, 8).map((market) => (
                <li key={market.ticker}>
                  <button className={styles.moverItem} type="button" onClick={() => setSelectedTicker(market.ticker)}>
                    <div>
                      <p className={styles.moverTicker}>{market.ticker}</p>
                      <p className={styles.moverTitle}>{market.marketTitle}</p>
                    </div>
                    <div className={styles.moverNumbers}>
                      <span className={`${styles.moverMove} ${moveToneClass(market.movePoints)}`}>{formatSigned(market.movePoints)}</span>
                      <span className={styles.moverProbability}>{formatPercent(market.impliedProbability)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Leading Events</h2>
              <p className={styles.panelSubTitle}>High-volume election event clusters</p>
            </div>

            <ul className={styles.eventList}>
              {(snapshot?.events ?? []).map((event) => (
                <li className={styles.eventItem} key={event.eventTicker}>
                  <div className={styles.eventTop}>
                    <p className={styles.eventTitle}>{event.title}</p>
                    <span className={styles.eventVolume}>{formatCount(event.totalVolume24h)} vol</span>
                  </div>

                  <p className={styles.eventSubtitle}>{event.subtitle || event.eventTicker}</p>

                  <div className={styles.eventMarkets}>
                    {event.topMarkets.map((market) => (
                      <button
                        className={styles.eventMarketButton}
                        key={market.ticker}
                        type="button"
                        onClick={() => setSelectedTicker(market.ticker)}
                      >
                        <span>{market.yesLabel}</span>
                        <span>{formatPercent(market.impliedProbability)}</span>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      {/* ── Drawer ──────────────────────── */}

      {selectedTicker ? (
        <button type="button" className={styles.overlay} onClick={() => setSelectedTicker(null)} aria-label="Close market detail" />
      ) : null}

      <aside
        ref={drawerRef}
        className={`${styles.drawer} ${selectedTicker ? styles.drawerOpen : ""}`}
        role="dialog"
        aria-modal={selectedTicker ? "true" : undefined}
        aria-labelledby="market-detail-title"
        aria-hidden={!selectedTicker}
        tabIndex={-1}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
        <div className={styles.drawerSwipeHandle} aria-hidden="true" />
        <div className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerKicker}>{highlightedMarket?.eventTitle ?? detail?.eventTicker ?? "Election market"}</p>
            <h3 id="market-detail-title" className={styles.drawerTitle}>
              {highlightedMarket?.marketTitle ?? detail?.title ?? selectedTicker ?? "Market detail"}
            </h3>
          </div>
          <button ref={drawerCloseRef} className={styles.drawerClose} type="button" onClick={() => setSelectedTicker(null)}>
            ✕ Close
          </button>
        </div>

        {detailLoading ? <p className={styles.detailStatus}>Loading market detail...</p> : null}
        {detailError ? <p className={styles.detailError}>{detailError}</p> : null}

        {detail && !detailLoading ? (
          <div className={styles.detailBody}>
            <div className={styles.detailProbabilityWrap}>
              <p className={styles.detailProbabilityLabel}>Implied probability</p>
              <p className={styles.detailProbabilityValue}>{formatPercent(detail.impliedProbability)}</p>
              <div
                className={styles.probabilityTrack}
                role="meter"
                aria-label="Implied probability"
                aria-valuenow={detail.impliedProbability}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className={styles.probabilityFill}
                  style={{
                    width: `${detail.impliedProbability}%`,
                    background: probabilityBarColor(detail.impliedProbability),
                  }}
                />
              </div>
            </div>

            <div className={styles.detailGrid}>
              <article className={styles.quoteCard}>
                <p className={styles.quoteLabel}>YES Bid / Ask</p>
                <p className={styles.quoteValue}>
                  {formatPrice(detail.yesBid)} / {formatPrice(detail.yesAsk)}
                </p>
              </article>
              <article className={styles.quoteCard}>
                <p className={styles.quoteLabel}>NO Bid / Ask</p>
                <p className={styles.quoteValue}>
                  {formatPrice(detail.noBid)} / {formatPrice(detail.noAsk)}
                </p>
              </article>
              <article className={styles.quoteCard}>
                <p className={styles.quoteLabel}>Move Today</p>
                <p className={`${styles.quoteValue} ${moveToneClass(detail.movePoints)}`}>{formatSigned(detail.movePoints)}</p>
              </article>
              <article className={styles.quoteCard}>
                <p className={styles.quoteLabel}>24h Volume</p>
                <p className={styles.quoteValue}>{formatCount(detail.volume24h)}</p>
              </article>
            </div>

            <dl className={styles.definitionList}>
              <div>
                <dt>Ticker</dt>
                <dd>{detail.ticker}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{detail.status}</dd>
              </div>
              <div>
                <dt>Open interest</dt>
                <dd>{formatCount(detail.openInterest)}</dd>
              </div>
              <div>
                <dt>Close time</dt>
                <dd>{formatCloseTime(detail.closeTime)}</dd>
              </div>
              <div>
                <dt>Last trade</dt>
                <dd>{formatPrice(detail.lastPrice)}</dd>
              </div>
              <div>
                <dt>Previous close</dt>
                <dd>{formatPrice(detail.previousPrice)}</dd>
              </div>
            </dl>

            <section className={styles.rulesSection}>
              <h4>Market Rules</h4>
              <p>{detail.rulesPrimary || "Rules not available in current payload."}</p>
              {detail.rulesSecondary ? <p>{detail.rulesSecondary}</p> : null}
            </section>
          </div>
        ) : null}
      </aside>

      {/* ── Toasts ──────────────────────── */}

      {toasts.length > 0 ? (
        <div className={styles.toastContainer}>
          {toasts.map((t) => (
            <div key={t.id} className={`${styles.toast} ${t.type === "success" ? styles.toastSuccess : styles.toastError}`}>
              {t.type === "success" ? "✓" : "⚠"} {t.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
