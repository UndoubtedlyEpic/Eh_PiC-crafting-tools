#!/usr/bin/env python3
"""fetch_cultivation.py — read the Vaal Cultivation Orb page on poe2db and store every
cultivable unique's own modifier pool as data, so nothing about it is hardcoded.

    python fetch_cultivation.py                    # writes ../cultivation.json
    python fetch_cultivation.py --html page.html   # parse a saved copy instead of fetching

Per item the page lists two kinds of lines:
  base        the unique's normal modifiers (plain text)
  cultivated  the candidates the Vaal Cultivation Orb can swap in (light red text, class mutatedMod)
The orb "replaces up to 2 modifiers on a Corrupted Vaal Unique" (page text). Each piece has its own pool.

Source page: https://poe2db.tw/us/Vaal_Cultivation_Orb  (re-run after a patch; poe2db changes with the game).
Stdlib only.
"""
import argparse, datetime, html, json, os, re, sys, urllib.request

URL = "https://poe2db.tw/us/Vaal_Cultivation_Orb"


def clean(fragment):
    t = re.sub(r"<[^>]+>", "", fragment)
    t = html.unescape(t).replace("�", "-").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", t).strip()


def parse(page):
    a = page.find('id="CultivatedUniques"')
    if a < 0:
        sys.exit("CultivatedUniques section not found: the page layout changed")
    b = page.find("Cultivated Mods", a + 1000)
    region = page[a:b if b > 0 else len(page)]
    items = {}
    for blk in re.split(r'<div class="col"><div class="d-flex border-top rounded">', region)[1:]:
        m = re.search(r'<div class="flex-grow-1 ms-2"><a class="UniqueItems UniqueItem"[^>]*href="[^"]+">([^<]+)</a>', blk)
        if not m:
            continue
        name = html.unescape(m.group(1)).strip()
        split = blk.find('class="mt-2 mutatedMods"')
        base_part, cult_part = (blk[:split], blk[split:]) if split >= 0 else (blk, "")
        base = [clean(x) for x in re.findall(r'<div class="explicitMod">(.*?)</div>', base_part, flags=re.S)]
        cult = [clean(x) for x in re.findall(r'<div class="poe2 mutatedMod"><div>(.*?)</div></div>', cult_part, flags=re.S)]
        items[name] = {"base": [x for x in base if x], "cultivated": [x for x in cult if x]}
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cultivation.json"))
    a = ap.parse_args()
    if a.html:
        page = open(a.html, "rb").read().decode("utf-8", errors="replace")
    else:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", errors="replace")
    items = parse(page)
    out = {
        "source": URL,
        "fetched": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
        "rule": "Vaal Cultivation Orb replaces up to 2 modifiers on a Corrupted Vaal Unique with cultivated modifiers",
        "items": items,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    n_c = sum(len(v["cultivated"]) for v in items.values())
    print(f"{len(items)} items, {n_c} cultivated candidate lines -> {os.path.abspath(a.out)}")
    empty = [k for k, v in items.items() if not v["cultivated"]]
    if empty:
        print("no cultivated lines parsed for:", ", ".join(empty))


if __name__ == "__main__":
    main()
