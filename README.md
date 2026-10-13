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

## Scripts

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run lint` - run ESLint

## Status

Scaffold only. Lookup, data and sign-in arrive in later tasks.
