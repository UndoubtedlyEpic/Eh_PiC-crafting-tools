# Crafting advisor

A web page that finds the cheapest next crafting step for an item and plans multi-step crafts. Prices come from poe.ninja and Craft of Exile, in Exalted Orbs.

## Run
Double-click `start.bat`, or:
```bash
cd advisor
python server.py            # http://127.0.0.1:8765/index.html
```
The server serves the pages, fetches live prices and looks up real listings on the public trade site (`/api/market`, no login). `start.bat` opens `hub.html`,
a small page that links the three tools.

## What is here
| Item | What it is |
|---|---|
| `index.html`, `app.js`, `engine.js`, `emulator.js` | the page, its controls, the cost engine and the practice emulator |
| `data.js`, `weights.js`, `alloys.js`, `corrupt.js`, `prices.js`, `prices_leagues.js`, `cultivation.json` | mod pool, real mod weights, alloys, corruption data, prices, Vaal Cultivation pools |
| `tools/` | data refresh from public sources: `fetch_prices.py`, `fetch_weights.py`, `fetch_alloys.py`, `fetch_league_prices.py`, `fetch_cultivation.py`, `fetch_corruption.py`, and `sim_corruption.py` |
| `server.py`, `theme/`, `hub.html` | local server, eH_PiC theme, the link page |
| `AUDIT.md`, `SIMULATIONS.md`, `CRAFTOFEXILE_COMPARISON.md` | audits and comparisons of the advisor's rules against sources |

## Things to know
- Refresh prices: `python tools/fetch_prices.py` (poe.ninja and Craft of Exile).
- `tools/fetch_corruption.py` builds `corrupt.js` from Path of Building data and needs a checkout of PathOfBuilding-PoE2 at `../pob2`.
- `data.js` (the mod pool) was exported from Path of Building by the maintainer; the exporter is not part of this repository.
- The jewel simulator (port 8766) and the tablet guide (port 8767) are separate tools with their own servers.
