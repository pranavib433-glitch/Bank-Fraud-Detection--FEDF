# Fintech Guardian

A real-time transaction risk monitoring dashboard — a frontend-only fraud
detection UI. Simulates a live feed of incoming transactions, scores each one
for risk, and lets you inspect/clear/escalate flagged transactions.

This is **demo/portfolio code**: all transaction data is generated client-side
with a seeded pseudo-random generator. There is no backend, no real payment
data, and no real fraud-detection model — it's meant as a starting point for
the UI/UX of such a tool, or as a reference for building one.

## Features

- **Live feed simulation** — new transactions stream in every few seconds
- **Risk gauge** — circular score indicator (0–100), color-coded by tier
  (Clear / Elevated / Critical)
- **Filtering & search** — filter by risk tier, search by merchant, location,
  card, or transaction ID
- **Detail panel** — inspect the specific signals that drove a transaction's
  score, with actions to clear or block + escalate held transactions
- **Summary strip** — totals, exposure held, mean risk score across the
  session

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

To build for production:

```bash
npm run build
npm run preview
```

## Project structure

```
fintech-guardian/
├── index.html              # HTML entry point, loads fonts
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx             # React root
    └── FintechGuardian.jsx  # Main app: data generation, components, styles
```

Everything UI-related lives in `FintechGuardian.jsx` — components, mock data
generators, and styles (as a scoped `<style>` block) are all in that one file
for easy copy/paste into other projects. Split it up as you see fit once you
wire in a real backend.

## Wiring up a real backend

To make this a real fraud-detection tool, you'd replace:

- `buildInitialFeed()` / `generateTransaction()` in `FintechGuardian.jsx` with
  a fetch to your transactions API
- The `setInterval` polling loop in the `useEffect` with a WebSocket or
  Server-Sent Events subscription for genuinely live updates
- The `onResolve` handler with a real API call (e.g. `PATCH /transactions/:id`)
  to persist clear/block decisions

## Tech

- React 18
- Vite
- [lucide-react](https://lucide.dev/) for icons
- No CSS framework — styles are hand-written and scoped to this component
