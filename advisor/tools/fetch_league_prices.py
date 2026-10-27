#!/usr/bin/env python3
"""fetch_league_prices.py - snapshot poe.ninja exchange prices for every PoE2 league into advisor/prices_leagues.js.

    python advisor/tools/fetch_league_prices.py

The published website cannot call other sites, so its "Fetch current prices" button loads this snapshot (the local page, started
with start.bat, fetches live instead). Prices are in Exalted Orbs, the same conversion as fetch_prices.py. Re-run and republish to refresh.
"""
import datetime, json, os, sys, time, urllib.parse, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prices_leagues.js")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
TYPES = ("Currency", "Ritual", "Abyss", "Essences", "Delirium", "Breach", "Expedition")


def get(url):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read().decode("utf-8"))


def league_prices(league):
    out = {}
    for typ in TYPES:
        try:
            nj = get("https://poe.ninja/poe2/api/economy/exchange/current/overview?league=%s&type=%s" % (urllib.parse.quote_plus(league), typ))
        except Exception:
            continue
        rate = nj.get("core", {}).get("rates", {}).get("exalted")  # exalts per divine; thin leagues may not list it
        if not rate:
            continue
        names = {i["id"]: i["name"] for i in nj["items"]}
        for ln in nj["lines"]:
            n = names.get(ln["id"])
            if n and ln.get("primaryValue"):
                out[n] = round(ln["primaryValue"] * rate, 4)
    return out


def main():
    leagues = [l["id"] for l in get("https://www.pathofexile.com/api/trade2/data/leagues")["result"]]
    today = datetime.date.today().isoformat()
    data = {}
    for lg in leagues:
        p = league_prices(lg)
        if p:
            data[lg] = {"date": today, "prices": p}
        print(lg, len(p))
        time.sleep(0.5)
    js = "window.CRAFT_LEAGUE_PRICES=" + json.dumps({"fetched": today, "leagues": data}, sort_keys=True, separators=(",", ":")) + ";\n"
    open(OUT, "w", encoding="utf-8").write(js)
    print("wrote", os.path.normpath(OUT), len(js) // 1024, "KB")


if __name__ == "__main__":
    sys.exit(main())
