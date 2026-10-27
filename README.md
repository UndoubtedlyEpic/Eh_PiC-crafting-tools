# PoE2 crafting tools

Three small web tools for Path of Exile 2 crafting. They run in your browser (as a website) or on your own computer, read public market data (poe.ninja,
poe2db, the public trade site) and never ask for a login.

## Website or local?
- **Website:** open the landing page (`index.html`; once the site is published, its address goes here). Nothing to install. Prices are refreshed about once an
  hour; the jewel and tablet market tables are snapshots with their date shown. It cannot search the trade site for live listings and has no craft log.
- **Local:** run a tool on your own computer for live prices, real listing lookups and the craft log (details below).

| Tool | What it does | Start it |
|---|---|---|
| [`advisor/`](advisor/) | Crafting advisor: finds the cheapest next step for an item and plans multi-step crafts, with a practice emulator and a cost tracker | `advisor/start.bat` (port 8765) |
| [`jewel/`](jewel/) | Jewel simulator: Ruby, Emerald, Sapphire, Diamond and Time-Lost jewels by hand or as whole strategies, with cost per finished jewel and profit | `jewel/start.bat` (port 8766) |
| [`tablet/`](tablet/) | Tablet pricing guide: which affixes and combinations sell for profit on each Precursor Tablet type, and a check for a tablet you found | `tablet/start.bat` (port 8767) |

Each tool is standalone: its own folder, README, launcher and copies of the shared files (`server.py`, `prices.js`, `theme/`). You need Python 3 only.
`advisor/hub.html` is a small page that links the three while their servers are running.

## How the website is built
`site/build_site.py` fetches fresh prices (`advisor/tools/fetch_prices.py`, `fetch_league_prices.py`), copies only the files the pages load into `_site/`, and checks
that every file a page refers to exists. The GitHub Actions workflow `.github/workflows/website.yml` runs it every hour and on every push to `main`, then publishes
`_site/` to GitHub Pages (repository Settings > Pages > Source: GitHub Actions). Nothing is committed back. If a price fetch fails, the committed prices are used and the
landing page shows their date. Try it locally with `python site/build_site.py` (or `--offline`), then serve `_site/` with `python -m http.server`.

## Things to know
- Prices are asking prices from trade listings and poe.ninja, never sales. Rules in the simulators come from named sources and from player testing; they are
  not the real game, so check a number against the game before betting currency on it.
- Market data (mod pools, price tables, scan results) is committed. The scripts that refresh it from the trade site rely on a private paced client and are
  not part of this repository; the fetchers that read poe2db and poe.ninja are.
- `advisor/tools/fetch_corruption.py` needs a checkout of Path of Building PoE2 at `./pob2` (https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2).

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md). Suggestions, bug reports and pull requests are welcome.

## License
The code and writing in this repository are licensed under the GNU General Public License v3.0 (see [LICENSE](LICENSE)). You may use and change them, but anything
you distribute that is built from them must stay open source under the same license.

Not covered by that license:
- Game and market data. It belongs to Grinding Gear Games and to the sites it comes from (poe2db, poe.ninja, Craft of Exile).
- The eH_PiC name and the banner artwork in each `theme/` folder. They are the author's brand: all rights reserved. Copies of this repository may include them unchanged,
  but please do not reuse them as branding for your own projects, and replace them with your own art if you publish a modified version.
