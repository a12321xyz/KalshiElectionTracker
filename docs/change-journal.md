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

## Mover selection threshold
- Recorded the threshold that promotes markets into mover lists.

## Market detail field mapping
- Added a concise mapping note for market detail response fields.

## Rate limit window size
- Documented the one minute sliding window used by API rate limiting.

## Rate limit bucket pruning
- Captured stale bucket pruning behavior in the limiter map.

## Client IP extraction order
- Noted the header precedence used to resolve request IP addresses.

## Forwarded chain parsing
- Explained right side preference when parsing forwarded IP chains.

## Fallback IP behavior
- Documented unknown fallback behavior when no valid header is present.

## Bucket capacity safeguard
- Added notes on oldest bucket eviction at the map capacity limit.

## Cleanup interval
- Recorded the periodic cleanup cadence for limiter maintenance.

## API runtime selection
- Documented why both API routes stay on the node runtime.

## Ticker validation rule
- Added regex constraint notes for market detail ticker input.

## Dashboard request ceiling
- Documented the current per minute request cap for dashboard calls.

## Market request ceiling
- Documented the per minute request cap for market detail calls.

## Retry After header
- Captured how retry wait time is surfaced on rate limited responses.

## Empty snapshot shape
- Added notes on fields returned when no election markets are found.

## Event summary truncation
- Documented the current event summary cap used in dashboard payloads.

## Top markets cap
- Recorded the top market list size limit in the snapshot model.

## Movers cap behavior
- Added notes on the twelve item cap used in mover selection.

## Volume aggregation
- Documented how total volume is aggregated across merged markets.

## Average probability metric
- Recorded the formula used for dashboard average probability.

## Positive mover counting
- Noted that positive mover count tracks markets above zero move points.

## Market chunk sizing
- Documented why ticker requests are chunked before batch fetches.

## Ticker dedupe
- Added notes on deduplicating tickers before market refresh calls.

## Open events pagination
- Documented the two page fetch path for open events queries.

## Second page fetch condition
- Recorded that page two only runs when a cursor is present.

## Query normalization
- Added notes on serializing query values before request dispatch.

## Path normalization
- Documented forced leading slash normalization for API paths.

## Cold start snapshot flow
- Captured the behavior when snapshot cache is empty at startup.

## Background refresh fallback
- Added notes for fallback behavior when background refresh fails.

## In flight dedupe
- Documented shared in flight snapshot promises to prevent duplicate work.

## Cache reset on failure
- Noted that snapshot cache is cleared when a cold start fetch throws.

## Upstream no store setting
- Captured that upstream calls bypass fetch level caching.

## Accept header default
- Documented JSON accept header defaults for upstream requests.

## API error message wording
- Added rationale for concise user facing API error messages.

## Maintenance follow up checklist
- Added a short checklist to keep future minor edits consistent.
