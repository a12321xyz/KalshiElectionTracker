# Change Journal

This file tracks small, low-risk maintenance updates so behavior-focused work can stay separate.

## Journal kickoff
- Added a dedicated journal to keep minor follow-up edits organized.

## Dashboard cache headers
- Recorded the current Cache Control profile used by the dashboard endpoint.

## Market cache headers
- Noted that market detail responses mirror the dashboard cache behavior.

## Request timeout baseline
- Documented the current upstream timeout guard used for Kalshi requests.

## Retry backoff defaults
- Added notes for retry delay growth across transient failures.

## Transient status handling
- Captured which upstream status codes are treated as retry eligible.

## Snapshot TTL behavior
- Documented the dashboard snapshot cache time to live value.

## Stale while revalidate flow
- Explained when stale data is served during background refresh.

## Candidate market filtering
- Added context on strict election filtering before market ranking.

## Election keyword patterns
- Documented the positive keyword patterns used by market filtering.

## Exclusion keyword intent
- Clarified why speech and interview phrasing is excluded.

## Probability fallback order
- Logged the field precedence used to compute implied probability.

## Move point calculation
- Captured how current probability is compared to previous pricing.

## Event grouping strategy
- Added notes on grouping markets into event level summaries.

## Top market ranking rule
- Documented the volume first ranking method for featured markets.
