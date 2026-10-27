# PoE2 crafting tools

Three small local web tools for Path of Exile 2 crafting. They run on your own computer, read public market data (poe.ninja, poe2db, the public trade
site) and never ask for a login.

| Tool | What it does | Start it |
|---|---|---|
| [`advisor/`](advisor/) | Crafting advisor: finds the cheapest next step for an item and plans multi-step crafts, with a practice emulator and a cost tracker | `advisor/start.bat` (port 8765) |
| [`jewel/`](jewel/) | Jewel simulator: Ruby, Emerald, Sapphire, Diamond and Time-Lost jewels by hand or as whole strategies, with cost per finished jewel and profit | `jewel/start.bat` (port 8766) |
| [`tablet/`](tablet/) | Tablet pricing guide: which affixes and combinations sell for profit on each Precursor Tablet type, and a check for a tablet you found | `tablet/start.bat` (port 8767) |

Each tool is standalone: its own folder, README, launcher and copies of the shared files (`server.py`, `prices.js`, `theme/`). You need Python 3 only.
`advisor/hub.html` is a small page that links the three while their servers are running.

## Things to know
- Prices are asking prices from trade listings and poe.ninja, never sales. Rules in the simulators come from named sources and from player testing; they are
  not the real game, so check a number against the game before betting currency on it.
- Market data (mod pools, price tables, scan results) is committed. The scripts that refresh it from the trade site rely on a private paced client and are
  not part of this repository; the fetchers that read poe2db and poe.ninja are.
- `advisor/tools/fetch_corruption.py` needs a checkout of Path of Building PoE2 at `./pob2` (https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2).

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md). Suggestions, bug reports and pull requests are welcome.

## License
Not chosen yet.
