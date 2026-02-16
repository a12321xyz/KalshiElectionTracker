import type { Metadata } from "next";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About | Kalshi Election Tracker",
  description: "What this dashboard tracks and how to use Kalshi Election Tracker.",
};

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>About</p>
        <h1 className={styles.title}>Kalshi Election Tracker</h1>
        <p className={styles.copy}>
          This app surfaces active election markets from Kalshi in one place so you can quickly scan implied odds, price moves,
          and top-volume races.
        </p>
        <p className={styles.copy}>
          Data refreshes automatically every 45 seconds, and you can open any market card to review detailed quotes, volume, open interest, and
          rules.
        </p>
      </section>

      {/* ── Features ──────────────────── */}

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Features</h2>
        <ul className={styles.featureList}>
          <li><strong>Live implied odds</strong> — see current probability estimates for every election contract.</li>
          <li><strong>Momentum tracking</strong> — spot the biggest movers at a glance with color-coded move pills.</li>
          <li><strong>Volume leaders</strong> — markets sorted by 24-hour volume so you know where the action is.</li>
          <li><strong>Event clustering</strong> — related markets are grouped by event (e.g., &ldquo;2026 House Control&rdquo;) for context.</li>
          <li><strong>Dark mode</strong> — comfortable viewing in any light, with a one-click toggle.</li>
          <li><strong>Auto-refresh</strong> — data updates every 45 seconds with stale-while-revalidate caching.</li>
          <li><strong>Search &amp; filter</strong> — find specific races by keyword or filter by Presidential, Senate, House, or Governor.</li>
          <li><strong>Market detail drawer</strong> — tap any card to see bid/ask spreads, open interest, last trade, and market rules.</li>
          <li><strong>Mobile-first design</strong> — fully responsive layout with swipe-to-close drawers on touch devices.</li>
        </ul>
      </section>

      {/* ── FAQ ────────────────────────── */}

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>FAQ</h2>

        <details className={styles.faqItem}>
          <summary className={styles.faqQuestion}>What is Kalshi?</summary>
          <p className={styles.faqAnswer}>
            Kalshi is a CFTC-regulated event contracts exchange where users trade on the outcome of real-world events.
            Each contract settles at $1 if the event occurs or $0 if it doesn&rsquo;t, so the price reflects the market&rsquo;s
            implied probability.
          </p>
        </details>

        <details className={styles.faqItem}>
          <summary className={styles.faqQuestion}>How often does the data update?</summary>
          <p className={styles.faqAnswer}>
            The dashboard auto-refreshes every 45 seconds. You can also hit the &ldquo;Update now&rdquo; button for an immediate refresh.
            A stale-while-revalidate cache ensures returning visitors see data instantly while fresh data loads in the background.
          </p>
        </details>

        <details className={styles.faqItem}>
          <summary className={styles.faqQuestion}>What does &ldquo;move&rdquo; mean?</summary>
          <p className={styles.faqAnswer}>
            The move value shows how much a market&rsquo;s implied probability has changed since the previous daily close.
            A &ldquo;+2.0 pts&rdquo; means the market is 2 percentage points higher than yesterday&rsquo;s close.
          </p>
        </details>

        <details className={styles.faqItem}>
          <summary className={styles.faqQuestion}>Which markets are shown?</summary>
          <p className={styles.faqAnswer}>
            Only open markets that match a strict election filter are displayed. This filters out non-election markets and
            markets that have already resolved. The tracker currently covers Presidential, Senate, House, and Governor races.
          </p>
        </details>
      </section>

      {/* ── Data Source & Tech Stack ──── */}

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Data Source</h2>
        <p className={styles.copy}>
          All market data is sourced from the <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className={styles.link}>Kalshi</a> public
          API. This project is not affiliated with, endorsed by, or sponsored by Kalshi. Prices and probabilities are provided for informational
          purposes only and do not constitute financial advice.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Tech Stack</h2>
        <ul className={styles.techList}>
          <li><strong>Next.js</strong> — App Router with server-side rendering</li>
          <li><strong>React</strong> — client-side interactivity</li>
          <li><strong>TypeScript</strong> — end-to-end type safety</li>
          <li><strong>CSS Modules</strong> — scoped, zero-runtime styling</li>
          <li><strong>Vercel</strong> — deployment and edge network</li>
        </ul>
      </section>
    </main>
  );
}
