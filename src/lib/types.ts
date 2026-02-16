export interface DashboardMarket {
  ticker: string;
  eventTicker: string;
  eventTitle: string;
  eventSubtitle: string;
  marketTitle: string;
  yesLabel: string;
  noLabel: string;
  status: string;
  closeTime: string | null;
  updatedTime: string | null;
  impliedProbability: number;
  movePoints: number;
  lastPrice: number | null;
  previousPrice: number | null;
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  volume24h: number;
  openInterest: number;
}

export interface DashboardEvent {
  eventTicker: string;
  title: string;
  subtitle: string;
  category: string;
  totalVolume24h: number;
  marketCount: number;
  topMarkets: DashboardMarket[];
}

export interface DashboardSnapshot {
  generatedAt: string;
  summary: {
    trackedMarkets: number;
    trackedEvents: number;
    totalVolume24h: number;
    averageProbability: number;
    positiveMovers: number;
  };
  allMarkets: DashboardMarket[];
  topMarkets: DashboardMarket[];
  movers: DashboardMarket[];
  events: DashboardEvent[];
}

export interface MarketDetail {
  ticker: string;
  eventTicker: string;
  title: string;
  yesLabel: string;
  noLabel: string;
  status: string;
  closeTime: string | null;
  updatedTime: string | null;
  impliedProbability: number;
  movePoints: number;
  lastPrice: number | null;
  previousPrice: number | null;
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  volume24h: number;
  openInterest: number;
  liquidity: number | null;
  result: string;
  rulesPrimary: string;
  rulesSecondary: string;
}
