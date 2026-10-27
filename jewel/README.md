# Jewel simulator

Hand-playable and Monte-Carlo jewel crafting simulator (Ruby, Emerald, Sapphire, Diamond and the Time-Lost versions): cost per finished jewel,
profit against asking prices, catalysts, fracture, desecrate, corruption, paste a jewel from the game, a craft log. Not the game: every rule
comes from a named source or from player testing.

## Run
Double-click `start.bat`, or:
```bash
cd jewel
python server.py            # http://127.0.0.1:8766/jewel_sim.html
```
The server is needed for the craft log, usage data and the market lookup. The page also works from a plain static host (see below).

## Share a copy
```bash
python tools/build_share.py      # writes share_dist/ (static files, nothing personal)
```

## What is here
| Item | What it is |
|---|---|
| `jewel_sim.html`, `jewel_sim.js`, `_card_part.js` | the simulator and its item card |
| `jewel_pools.json`, `jewel_mod_tags.json`, `base_prices.js`, `prices.js` | mod pools, catalyst tags, asking prices, orb prices |
| `jewel_*_<base>.json`, `jewel_5line_*.json`, `jewel_market.json` | saved trade-site price scans that feed `base_prices.js` |
| `jewel_5line_analyze.py`, `jewel_demand_analyze.py`, `jewel_report.py`, `jewel_market.py` | analysis of the saved scans, and a report of cost and risk (`JEWEL_CRAFTING_REPORT.md`) |
| `server.py`, `craftlog.py`, `craftlog/` | local server, craft log and usage data (`craftlog/` is created on first use and is git-ignored) |
| `collector/` | optional Google Apps Script that receives usage data from a hosted copy |
| `tools/` | `build_share.py`, `build_base_prices.py`, and the poe2db pool fetchers |
| `theme/` | the eH_PiC theme |

## Things to know
- The scripts that ran the trade-site price scans are not in this repository; the saved results are.
- The page's links to the tablet guide and the hub point at their local ports (8767 and 8765), so they only work while those servers run. The shared copy leaves them out.
- All prices are asking prices from the trade site, never sales.
