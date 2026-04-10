# MarketMeh

A full-featured desktop markets dashboard built with Electron, React, and Express. Real-time quotes, interactive charts, AI-powered insights, portfolio tracking, and more — all in a clean dark interface.

**No API keys required to get started.** Core features (quotes, charts, movers, sectors, watchlist) work out of the box using free Yahoo Finance data.

## Features

- **Real-time Quotes** — live prices, change, open/high/low, PE ratio, market cap, dividend yield, 52-week range
- **Interactive Charts** — area, line, and candlestick styles with SMA 20/50 overlays and volume bars (1D–5Y ranges)
- **Watchlist** — save and track your favorite stocks with sparkline previews
- **Portfolio** — track positions with cost basis, calculate real-time P&L
- **Sectors** — heatmap of all 11 S&P sector ETFs with drill-down to constituents
- **Stock Screener** — filter by sector, price, P/E, volume, market cap (advanced mode)
- **AI Insights** — Claude or ChatGPT-powered stock analysis with multi-horizon outlook
- **Analyst Data** — price targets, buy/hold/sell consensus, recent upgrades and downgrades
- **Market Movers** — top gainers and losers
- **Global Assets** — crypto (BTC, ETH), forex (EUR/USD), commodities (gold, silver, oil)
- **News Feed** — latest financial headlines with sentiment tagging
- **Settings** — configure API keys, chart defaults, simple/advanced mode, AI refresh rate

## Getting Started

```bash
git clone https://github.com/Intiseier/markets-app.git
cd markets-app
npm install
```

### Run in browser

```bash
npm run dev
```

Opens at `http://localhost:5173` with the API server on port `3001`.

### Run as desktop app

```bash
npm run electron
```

Launches the Electron window with the full stack running locally.

## API Keys (Optional)

All keys are optional — the app works without any of them. Add keys to unlock additional features:

| Key | What It Unlocks | Get a Free Key |
|-----|----------------|----------------|
| `FMP_API_KEY` | Analyst price targets, rating consensus, upgrades/downgrades | [financialmodelingprep.com](https://financialmodelingprep.com/) |
| `TWELVEDATA_API_KEY` | Analyst data fallback if FMP is unavailable | [twelvedata.com](https://twelvedata.com/) |
| `ANTHROPIC_API_KEY` | AI-powered stock analysis via Claude | [console.anthropic.com](https://console.anthropic.com/) |
| `OPENAI_API_KEY` | AI-powered stock analysis via ChatGPT (alternative to Claude) | [platform.openai.com](https://platform.openai.com/) |
| `NEWS_API_KEY` | Enhanced financial news feed | [newsapi.org](https://newsapi.org/) |

**Two ways to add keys:**

1. **Environment variables** — copy `.env.example` to `.env` and fill in your keys
2. **Settings page** — add keys directly in the app's Settings tab (persisted locally)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start UI + API in parallel (browser mode) |
| `npm run dev:api` | Start API server only (with hot reload) |
| `npm run dev:ui` | Start Vite dev server only |
| `npm run electron` | Full dev stack with Electron window |
| `npm run build` | TypeScript + Vite production build |
| `npm run build:server` | Bundle API server for Electron packaging |
| `npm run electron:build` | Build distributable Electron app (Windows/Mac/Linux) |
| `npm run icons` | Regenerate app icons from source |

## Tech Stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS 4, TanStack React Query, React Router 7
- **Backend** — Express 5, TypeScript
- **Desktop** — Electron 35
- **AI** — Anthropic SDK (Claude) / OpenAI SDK (ChatGPT) with rule-based fallback
- **Data** — Yahoo Finance (free), Financial Modeling Prep, Twelve Data, NewsAPI

## Architecture

```
MarketMeh
├── electron/          Electron main process
├── server/            Express API (port 3001)
│   ├── routes/        API endpoints (/markets, /settings)
│   ├── lib/           Settings store, AI provider, data helpers
│   └── data/          Local JSON storage (gitignored)
├── src/               React SPA
│   ├── components/    Pages + shared UI components
│   ├── hooks/         Data fetching hooks (TanStack Query)
│   ├── types/         TypeScript interfaces
│   └── lib/           API client
└── resources/         App icons
```

Data is stored locally in `server/data/` — your watchlist, portfolio, settings, and API keys never leave your machine.

## License

MIT
