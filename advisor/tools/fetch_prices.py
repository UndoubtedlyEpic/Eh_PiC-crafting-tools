"""Fetch currency/omen/essence/bone prices (league softcore) from Craft of Exile's public JSON and write
advisor/prices.js, converted to Exalted Orbs. Usage: python advisor/tools/fetch_prices.py"""
import json, os, re, sys, urllib.request, datetime

BASE = "https://beta.craftofexile.com/"
UA = {"User-Agent": "Mozilla/5.0"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prices.js")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8")


def strip(txt, prefix):
    return json.loads(txt[len(prefix):].rstrip(";\n "))


def main():
    page = get(BASE + "?game=poe2")
    ver = re.search(r"json/poe2/([\d.]+)/", get(BASE + "packages/files/package_poe2.js") + page)
    ver = ver.group(1) if ver else "4.5.5.3"
    data = strip(get(f"{BASE}json/poe2/{ver}/data.json"), "coedata=")
    loc = strip(get(f"{BASE}json/poe2/{ver}/localization/english.json"), "coelang=")
    prices = strip(get(f"{BASE}json/poe2/{ver}/prices.json"), "coeprices=")["leagueSoftcore"]
    keys = {e["key"]: loc[e["label"]] for e in data["items"]["entries"]}
    ex = prices["Metadata/Items/Currency/CurrencyAddModToRare"]  # Exalted Orb, priced in Divines
    out = {}
    for k, v in prices.items():
        n = keys.get(k)
        if n and (k.startswith("Metadata/Items/Currency/") or "Omen" in n):
            out[n] = round(v / ex, 4)
    # poe.ninja's exchange is more current and covers omens/bones/essences; it overrides Craft of Exile where both list an item
    league = "Forbidden+Rites"
    ninja = 0
    for typ in ("Currency", "Ritual", "Abyss", "Essences", "Delirium", "Breach", "Expedition"):
        try:
            nj = json.loads(get(f"https://poe.ninja/poe2/api/economy/exchange/current/overview?league={league}&type={typ}"))
        except Exception as e:
            print("poe.ninja", typ, "failed:", e); continue
        ex_rate = nj["core"]["rates"]["exalted"]  # exalts per divine
        names = {i["id"]: i["name"] for i in nj["items"]}
        for ln in nj["lines"]:
            n = names.get(ln["id"])
            if n and ln.get("primaryValue"):
                out[n] = round(ln["primaryValue"] * ex_rate, 4); ninja += 1
    js = "window.CRAFT_PRICES=" + json.dumps({"source": "poe.ninja (Forbidden Rites) over craftofexile.com v" + ver, "date": datetime.date.today().isoformat(),
                                               "unit": "Exalted Orb", "prices": out}, sort_keys=True) + ";\n"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"{ninja} from poe.ninja; wrote {len(out)} prices (1 Exalted = {ex} Divine) to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    sys.exit(main())
