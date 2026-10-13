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
- `config/rules.json` - Dublin time zone, lookup window length, stale age threshold, shipping titles treated as home delivery, whether order location tags are used to show "now" for each order type, and ingest poll settings.

`locationFromTag.Delivery` is true because the router tags deliveries with the store it allocates. `locationFromTag.Collection` is false because collection tags are written at checkout, and it flips to true once a collection order that changed store shows its tag following the move.

## Scripts

- `npm run dev` - start the development server on this machine only (`127.0.0.1`)
- `npm run build` - create a production build
- `npm run build:standalone` - production build, then copy static files into the standalone folder
- `npm run lint` - run ESLint
- `npm test` - run unit tests

## Ingest

Matrixify publishes one CSV into Azure Blob Storage every hour. The app does not accept uploads; it reads that blob on a timer.

### Matrixify template

- Sheet: Orders
- Format: CSV
- Filter: Created At, relative date, Last 720 hours. "Last 30 days" counts only full days, stops at midnight and misses today.
- Columns (required): ID, Name, Tags, Created At, Cancelled At, Line: Type, Line: ID, Line: Title, Line: SKU, Line: Quantity, Line: Current Quantity, Line: Fulfillable Quantity, Fulfillment: ID, Fulfillment: Status, Fulfillment: Created At, Fulfillment: Location, Fulfillment: Tracking Company, Fulfillment: Shipment Status
- Custom file name: `order_lookup`
- Upload to the storage account over SFTP into the configured container
- Repeat every hour (overwrite the same blob)

### How the app reads it

- Env vars: `ORDER_SOURCE=snapshot`, `ORDER_BLOB_ACCOUNT`, `ORDER_BLOB_CONTAINER`, `ORDER_BLOB_NAME`, `ORDER_BLOB_SAS_URL`, `DATA_DIR` (see `.env.example`).
- The poller starts with the Node server (`src/instrumentation.ts`), checks every `ingest.pollMinutes` (10), downloads into memory, parses, and writes `DATA_DIR/snapshot.json`. The CSV is never saved to disk.
- Orders are keyed by their digits (so `SFP#3601234` and `#3601234` share a key space by number only).
- "Data as of" is the blob's Last modified time.
- On App Service, Always On must be enabled so the poller keeps running.
- If the feed breaks, upload a CSV with the same name through the portal's Storage browser.
- After changing parsing rules, delete `DATA_DIR/snapshot.json` and restart, or wait for the next hourly file.

### Feed access

Two ways to read the blob:

- Entra ID via `DefaultAzureCredential` (managed identity on App Service; `az login` locally). The reading identity needs Storage Blob Data Reader on the container. Set `ORDER_BLOB_ACCOUNT`, `ORDER_BLOB_CONTAINER` and `ORDER_BLOB_NAME`.
- A read-only SAS URL scoped to the one blob, in `ORDER_BLOB_SAS_URL`. This takes precedence over the account settings.

The SAS expires and must be replaced before then. When it expires, the feed stops, the log shows a 403, and the stale banner appears within 3 hours.

### Guards (refuse and keep)

A refusal never replaces the current snapshot:

- `missing_columns` - required Matrixify columns are absent
- `no_orders` - nothing left after the 30-day window
- `not_newer` - blob Last modified is not later than the snapshot's asOf
- `too_few_orders` - new order count is under half of the current snapshot
- `too_large` - blob is over `ingest.maxMegabytes` (not downloaded)

## Local testing

With the app running locally:

- `node scripts/lookup.mjs "#9901001"` - POST a lookup query to `/api/lookup`
- `node scripts/lookup.mjs` - POST an empty query (expects invalid)
- `node scripts/lookup.mjs --status` - GET `/api/status`

Optional environment variables:

- `LOOKUP_BASE_URL` - base URL for `scripts/lookup.mjs` (default `http://localhost:3000`)
- `ORDER_SOURCE` - `fixtures` or `snapshot`. Defaults to `fixtures` outside production and `snapshot` in production. Production refuses `fixtures`.
- `FIXTURE_DATA_AGE_HOURS` - age of the fixture snapshot clock (default `1`)
- `FIXTURE_NO_DATA=1` - fixture source reports no data
- Blob and `DATA_DIR` vars as in `.env.example` when using snapshot ingest

## Deploy

- App Service settings: `ORDER_SOURCE=snapshot`, `ORDER_BLOB_SAS_URL`, `DATA_DIR=/home/data`, `HOSTNAME=0.0.0.0`.
- Always On.
- Startup command: `node server.js`.
- Health check path `/api/health`.
- Application logs on File System with 30-day retention.
- Access restrictions before any real data.

## Status

UI and ingest on invented fixtures and a refuse-and-keep blob poller. Sign-in and logging arrive in later tasks.
