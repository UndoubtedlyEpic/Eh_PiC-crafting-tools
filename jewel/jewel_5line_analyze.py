"""Which mods go with a higher price on 5-line jewels? Reads jewel_5line_<colour>.json (listings sampled evenly across price bands).

Because the scan takes the same number of listings from every band, a mod's average price rank among the listings that carry
it is not biased by how common the mod is. For each mod: how many sampled listings carry it, the average log10 price of
listings with it versus without it, the share of its listings priced 150+ div, and the side (prefix/suffix).
Usage: python jewel/jewel_5line_analyze.py Emerald
"""
import json
import math
import pathlib
import re
import statistics
import sys

HERE = pathlib.Path(__file__).resolve().parent
colour = sys.argv[1] if len(sys.argv) > 1 else "Emerald"
D = json.load(open(HERE / f"jewel_5line_{colour}.json", encoding="utf-8"))


def clean(m):
    t = m.get("description", "") if isinstance(m, dict) else str(m)
    side = ((m.get("mods") or [{}])[0].get("tier", "?")[:1]) if isinstance(m, dict) else "?"
    crafted = bool((m.get("flags") or {}).get("crafted")) if isinstance(m, dict) else False
    return re.sub(r"\[([^\]|]*\|)?([^\]]*)\]", chr(92) + "2", t), side, crafted


def norm(t):
    t = re.sub(r"[+-]?\d+(\.\d+)?", "#", t)
    return re.sub(r"\s+", " ", re.sub(r"#+", "#", t)).strip().lower()


seen, rows = set(), []
for r in D["rows"]:
    if r["id"] in seen or r["div"] is None:
        continue
    seen.add(r["id"])
    r["_m"] = {}
    for kind, m in r["mods"]:
        t, side, crafted = clean(m)
        r["_m"][norm(t)] = (t, side, crafted)
    rows.append(r)
print(f"{colour}: {len(rows)} unique sampled listings")
bands = {}
for r in rows:
    bands.setdefault(r["band"], []).append(r["div"])
for b in sorted(bands, key=lambda x: float(x.split("-")[0])):
    print(f"  band {b:>8} div: {len(bands[b])} sampled, median {statistics.median(bands[b]):.1f}")

lp = {id(r): math.log10(max(r["div"], 0.001)) for r in rows}
mean_all = statistics.mean(lp.values())
stats = []
for k in {k for r in rows for k in r["_m"]}:
    w = [r for r in rows if k in r["_m"]]
    if len(w) < 12:
        continue
    wo = [r for r in rows if k not in r["_m"]]
    text, side, crafted = next(r["_m"][k] for r in w)
    lift = statistics.mean(lp[id(r)] for r in w) - statistics.mean(lp[id(r)] for r in wo)
    hi = sum(1 for r in w if r["div"] >= 150) / len(w)
    stats.append((lift, len(w), hi, side, crafted, text, statistics.median(r["div"] for r in w)))
stats.sort(reverse=True)
print("\nMods ranked by price lift (log10 price with the mod minus without it; +0.3 = about twice the price):")
print(f"{'lift':>6} {'n':>4} {'150+ div':>8} {'median':>7}  side  mod")
for lift, n, hi, side, crafted, text, med in stats[:30]:
    print(f"{lift:>+6.2f} {n:>4} {hi:>8.0%} {med:>7.0f}   {side}   {text[:72]}{' [crafted]' if crafted else ''}")
print("\nLowest lift (mods that go with cheap jewels):")
for lift, n, hi, side, crafted, text, med in stats[-8:]:
    print(f"{lift:>+6.2f} {n:>4} {hi:>8.0%} {med:>7.0f}   {side}   {text[:72]}")
json.dump([{"lift": s[0], "n": s[1], "share_150": s[2], "side": s[3], "text": s[5], "median": s[6]} for s in stats],
          open(HERE / f"jewel_5line_{colour}_mods.json", "w"), indent=1)
