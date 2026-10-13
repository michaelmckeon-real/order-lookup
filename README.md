# Order Lookup

Order Lookup is a small internal tool for Harvey Norman Ireland staff to look up the last known location of an order by its order number.

## Non-goals

- No customer details
- No prices or payment data
- No tracking numbers or links
- Exact match only; no partial search
- Ireland only
- No connection to DOT

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui (Radix)
- lucide-react
- Geist via `next/font`

## Config

- `config/locations.json` - store names, non-store locations (finding stock and supplier), and optional display name overrides for raw location strings.
- `config/rules.json` - Dublin time zone, lookup window length, stale age threshold, shipping titles treated as home delivery, and whether order location tags are used to show "now" for each order type.

`locationFromTag.Delivery` is true because the router tags deliveries with the store it allocates. `locationFromTag.Collection` is false because collection tags are written at checkout, and it flips to true once a collection order that changed store shows its tag following the move.

## Scripts

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run lint` - run ESLint
- `npm test` - run unit tests

## Local testing

With the app running locally:

- `node scripts/lookup.mjs "#9901001"` - POST a lookup query to `/api/lookup`
- `node scripts/lookup.mjs` - POST an empty query (expects invalid)
- `node scripts/lookup.mjs --status` - GET `/api/status`

Optional environment variables:

- `LOOKUP_BASE_URL` - base URL for `scripts/lookup.mjs` (default `http://localhost:3000`)
- `ORDER_SOURCE` - `fixtures` or `snapshot`. Defaults to `fixtures` outside production and `snapshot` in production. Production refuses `fixtures` and returns no data. `snapshot` returns no data until CSV ingest lands.
- `FIXTURE_DATA_AGE_HOURS` - age of the fixture snapshot clock (default `1`)
- `FIXTURE_NO_DATA=1` - fixture source reports no data

## Status

UI on invented fixtures. Sign-in, logging and ingest arrive in later tasks.
