"""Rank jewel mods by how strongly they go with a high listing price (reads jewel_demand_<colour>.json).

For every mod line: how many of the dearest listings carry it versus the cheapest, and the median price with and without it.
Also lists the dearest listings so the winning combinations are visible, and prints the suggested target set
(3 same-side mods + 1 opposite-side mod) for jewel_market.py / jewel_report.py.
Usage: python jewel/jewel_demand_analyze.py [Emerald]
"""
import json
import pathlib
import re
import statistics
import sys

HERE = pathlib.Path(__file__).resolve().parent
colour = sys.argv[1] if len(sys.argv) > 1 else "Emerald"
D = json.load(open(HERE / f"jewel_demand_{colour}.json", encoding="utf-8"))
POOL = json.load(open(HERE / "jewel_pools.json", encoding="utf-8"))["pools"][colour]["normal"]


def clean(m):
    """listing mods are dicts: {'description': '22% increased [Projectile] Damage', 'mods': [{'tier': 'P1', ...}]}"""
    if isinstance(m, dict):
        t = m.get("description", "")
        side = (m.get("mods") or [{}])[0].get("tier", "?")[:1]
        flags = m.get("flags") or {}
    else:
        t, side, flags = str(m), "?", {}
    t = re.sub(r"\[([^\]|]*\|)?([^\]]*)\]", r"\2", t)
    return t, side, flags


def norm(t):
    t = re.sub(r"\([\d.]+-[\d.]+\)", "#", t)
    t = re.sub(r"[+-]?\d+(\.\d+)?", "#", t)
    return re.sub(r"\s+", " ", re.sub(r"#+", "#", t)).strip().lower()


SIDE = {norm(r["text"]): r["side"] for r in POOL}
rows = D["rows"]
print(f"{colour}: {len(rows)} listings, totals {D['totals']}")
if not rows:
    sys.exit()
prices = sorted(r["div"] for r in rows)
print("price range %.0f - %.0f div, median %.0f" % (prices[0], prices[-1], statistics.median(prices)))
hi_cut = statistics.quantiles(prices, n=4)[2]       # top quartile
lo_cut = statistics.quantiles(prices, n=4)[0]       # bottom quartile
hi = [r for r in rows if r["div"] >= hi_cut]
lo = [r for r in rows if r["div"] <= lo_cut]

mods = {}
for r in rows:
    seen = set()
    for kind, m in r["mods"]:
        text, side, flags = clean(m)
        m = text
        k = norm(m)
        SIDE.setdefault(k, side if side in "PS" else "?")
        if "effect of suffixes" in k or "effect of prefixes" in k or k in seen:
            continue
        seen.add(k)
        mods.setdefault(k, {"text": m, "kind": kind, "rows": []})["rows"].append(r)
    r["_mods"] = seen

out = []
for k, v in mods.items():
    rs = v["rows"]
    if len(rs) < 4:
        continue
    with_p = [x["div"] for x in rs]
    without = [x["div"] for x in rows if k not in x["_mods"]]
    share_hi = sum(1 for x in hi if k in x["_mods"]) / max(1, len(hi))
    share_lo = sum(1 for x in lo if k in x["_mods"]) / max(1, len(lo))
    out.append((statistics.median(with_p) - (statistics.median(without) if without else 0), k, v["text"], v["kind"], len(rs), statistics.median(with_p),
                statistics.median(without) if without else float("nan"), share_hi, share_lo))
out.sort(reverse=True)
print("\nMods ranked by median-price premium (listing counts >= 4):")
print(f"{'premium':>8} {'with':>7} {'without':>8} {'n':>4} {'in top 25%':>10} {'in bottom 25%':>13}  side  mod")
for prem, k, text, kind, n, mw, mo, sh, sl in out[:25]:
    print(f"{prem:>8.0f} {mw:>7.0f} {mo:>8.0f} {n:>4} {sh:>10.0%} {sl:>13.0%}   {SIDE.get(k, '?'):>1}    {text[:70]}  [{kind}]")

print("\nDearest 12 listings:")
for r in sorted(rows, key=lambda r: -r["div"])[:12]:
    print(f"  {r['div']:>7.0f} div  {'corrupted' if r['corrupted'] else 'clean    '}  " + " | ".join(clean(m)[0][:42] for _, m in r["mods"]))

# suggested target: best 3 suffix + best 2 prefix by premium among frequent mods, counted separately
for side, label in (("S", "suffix"), ("P", "prefix")):
    best = [(p, t) for p, k, t, kind, n, mw, mo, sh, sl in out if SIDE.get(k) == side and n >= 6][:4]
    print(f"\nTop {label} mods by premium: " + "; ".join(f"{t} ({p:+.0f})" for p, t in best))
