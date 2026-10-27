# Tablet pricing guide

Which affixes and combinations to look for on a Precursor Tablet, what they sell for, and a check for a tablet you found (paste it from the game).
Market only: there is no crafting in it. Prices are asking prices from the trade site, never sales.

## Run
Double-click `start.bat`, or:
```bash
cd tablet
python server.py            # http://127.0.0.1:8767/tablet_sim.html
```
Open it through the server; the page loads its data with `fetch()` and does not work from a file.

## What is here
| Item | What it is |
|---|---|
| `tablet_sim.html`, `tablet_sim.js` | the guide |
| `tablet_pools.json`, `tablet_market.js` | affix pools per tablet type (from poe2db) and the market tables built from the scans |
| `tablet_scan_<type>.json`, `tablet_floor.json`, `tablet_exact_*.json` | saved trade-site scan results |
| `tablet_analyze.py` | rebuilds `tablet_market.js` from the saved scans (offline) |
| `tools/fetch_tablet_pools.py` | refreshes `tablet_pools.json` from poe2db |
| `prices.js`, `theme/` | the orb prices and the eH_PiC theme |

## Things to know
- The scripts that ran the trade-site scans are not in this repository; the saved results are. `tablet_analyze.py` turns them into the tables the page shows.
- The page's links to the jewel simulator (port 8766) and the hub (port 8765) only work while those servers run.
