import { describe, it, expect } from "vitest";
import {
    toNumber,
    clamp,
    toPercent,
    toProbability,
    toMovePoints,
    toPreviousProbability,
    isStrictElectionMarket,
} from "./kalshi";

/* ── toNumber ──────────────────────────── */

describe("toNumber", () => {
    it("returns null for null/undefined/empty string", () => {
        expect(toNumber(null)).toBeNull();
        expect(toNumber(undefined)).toBeNull();
        expect(toNumber("")).toBeNull();
    });

    it("parses numeric strings", () => {
        expect(toNumber("0.42")).toBe(0.42);
        expect(toNumber("100")).toBe(100);
        expect(toNumber("0")).toBe(0);
    });

    it("passes through numbers", () => {
        expect(toNumber(3.14)).toBe(3.14);
        expect(toNumber(0)).toBe(0);
    });

    it("returns null for non-finite values", () => {
        expect(toNumber("NaN")).toBeNull();
        expect(toNumber("Infinity")).toBeNull();
        expect(toNumber("abc")).toBeNull();
    });
});

/* ── clamp ─────────────────────────────── */

describe("clamp", () => {
    it("clamps below minimum", () => {
        expect(clamp(-5, 0, 100)).toBe(0);
    });

    it("clamps above maximum", () => {
        expect(clamp(150, 0, 100)).toBe(100);
    });

    it("returns the value if within range", () => {
        expect(clamp(50, 0, 100)).toBe(50);
    });
});

/* ── toPercent ──────────────────────────── */

describe("toPercent", () => {
    it("converts dollar probability to percentage", () => {
        expect(toPercent(0.42)).toBeCloseTo(42, 5);
        expect(toPercent(1.0)).toBe(100);
        expect(toPercent(0)).toBe(0);
    });

    it("clamps extreme values", () => {
        expect(toPercent(1.5)).toBe(100);
        expect(toPercent(-0.1)).toBe(0);
    });
});

/* ── toProbability ─────────────────────── */

describe("toProbability", () => {
    const baseMarket = {
        ticker: "TEST-YES",
        event_ticker: "TEST",
    };

    it("uses last_price_dollars when available", () => {
        const market = { ...baseMarket, last_price_dollars: "0.65" };
        expect(toProbability(market)).toBeCloseTo(65, 5);
    });

    it("falls back to mid of yes_bid / yes_ask", () => {
        const market = { ...baseMarket, yes_bid_dollars: "0.40", yes_ask_dollars: "0.50" };
        expect(toProbability(market)).toBeCloseTo(45, 5);
    });

    it("falls back to yes_bid only", () => {
        const market = { ...baseMarket, yes_bid_dollars: "0.30" };
        expect(toProbability(market)).toBeCloseTo(30, 5);
    });

    it("falls back to yes_ask only", () => {
        const market = { ...baseMarket, yes_ask_dollars: "0.70" };
        expect(toProbability(market)).toBeCloseTo(70, 5);
    });

    it("returns 50 when no pricing data available", () => {
        expect(toProbability(baseMarket)).toBe(50);
    });

    it("ignores zero last_price_dollars and uses bid/ask", () => {
        const market = { ...baseMarket, last_price_dollars: "0", yes_bid_dollars: "0.20" };
        expect(toProbability(market)).toBeCloseTo(20, 5);
    });
});

/* ── toPreviousProbability ─────────────── */

describe("toPreviousProbability", () => {
    const baseMarket = { ticker: "TEST-YES", event_ticker: "TEST" };

    it("returns previous probability from previous_price_dollars", () => {
        const market = { ...baseMarket, previous_price_dollars: "0.55" };
        expect(toPreviousProbability(market)).toBeCloseTo(55, 5);
    });

    it("returns null when previous_price_dollars is missing", () => {
        expect(toPreviousProbability(baseMarket)).toBeNull();
    });

    it("returns null when previous_price_dollars is zero", () => {
        const market = { ...baseMarket, previous_price_dollars: "0" };
        expect(toPreviousProbability(market)).toBeNull();
    });
});

/* ── toMovePoints ──────────────────────── */

describe("toMovePoints", () => {
    const baseMarket = { ticker: "TEST-YES", event_ticker: "TEST" };

    it("returns difference between current and previous probability", () => {
        const market = { ...baseMarket, previous_price_dollars: "0.40" };
        // impliedProbability = 45, previous = 40 → move = +5
        expect(toMovePoints(market, 45)).toBeCloseTo(5, 5);
    });

    it("returns 0 when no previous price", () => {
        expect(toMovePoints(baseMarket, 60)).toBe(0);
    });

    it("handles negative moves", () => {
        const market = { ...baseMarket, previous_price_dollars: "0.80" };
        // impliedProbability = 70, previous = 80 → move = -10
        expect(toMovePoints(market, 70)).toBeCloseTo(-10, 5);
    });
});

/* ── isStrictElectionMarket ────────────── */

describe("isStrictElectionMarket", () => {
    function makeEvent(title: string, sub_title?: string) {
        return { event_ticker: "EVT", title, sub_title };
    }

    function makeMarket(title: string, subtitle?: string) {
        return { ticker: "MKT-YES", event_ticker: "EVT", title, subtitle };
    }

    it("matches direct election keywords", () => {
        const event = makeEvent("2026 US General Election");
        const market = makeMarket("Who will win?");
        expect(isStrictElectionMarket(event, market)).toBe(true);
    });

    it("matches office + competitive + context pattern", () => {
        const event = makeEvent("Who will be the next president");
        const market = makeMarket("Will Republicans win the 2028 race?");
        expect(isStrictElectionMarket(event, market)).toBe(true);
    });

    it("excludes speech/mention markets", () => {
        const event = makeEvent("Presidential Debate");
        const market = makeMarket("Will the candidate say during the debate?");
        expect(isStrictElectionMarket(event, market)).toBe(false);
    });

    it("rejects unrelated markets", () => {
        const event = makeEvent("NBA Season");
        const market = makeMarket("Will Lakers finish top 4?");
        expect(isStrictElectionMarket(event, market)).toBe(false);
    });

    it("matches senate races", () => {
        const event = makeEvent("2026 Senate Races");
        const market = makeMarket("Will Democrats win the Senate seat in Ohio?");
        expect(isStrictElectionMarket(event, market)).toBe(true);
    });

    it("matches governor races", () => {
        const event = makeEvent("State Elections 2026");
        const market = makeMarket("Who wins the governor seat in ballot?");
        expect(isStrictElectionMarket(event, market)).toBe(true);
    });
});
