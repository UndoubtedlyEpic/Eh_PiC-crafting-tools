"""Turn the tablet market scans (tablet_scan_<type>.json) into tablet_market.js for the tablet helper page.

For each tablet type:
  mods   - every affix seen: side, how many sampled listings carry it, median asking price (div), price lift (mean log10 price with the affix minus without it;
           +0.3 is about double), share of its listings asking 10+ div, the rolled range seen, and the trade-site stat id.
  combos - affix pairs and triples that appear on at least MIN_N sampled listings: count, median ask, quartiles and a consistency flag
           (p75/p25 <= 3 and at least 4 listings), ranked by median ask. Only listings with 2+ affixes can form a combo.
The scan takes the same number of listings from every price band, so the lift is not biased by how common an affix is, but the COUNTS are a sample, not market share.
Usage: python tablet/tablet_analyze.py
"""
import itertools
import json
import math
import pathlib
import re
import statistics

HERE = pathlib.Path(__file__).resolve().parent
MIN_N = 5   # a shape needs at least 5 sampled listings to be a price (poe2-trade-price-research rule)
TYPES = ["Breach Tablet", "Expedition Tablet", "Delirium Tablet", "Ritual Tablet", "Irradiated Tablet", "Overseer Tablet", "Abyss Tablet", "Temple Tablet"]


def norm(t):
    t = re.sub(r"[+-]?\d+(\.\d+)?", "#", t)
    t = re.sub(r"\b(an?) (?=additional)", "# ", t, flags=re.I)   # "an additional Shrine" and "2 additional Shrines" are the same affix
    t = re.sub(r"(?<=[A-Za-z])s\b", "", t)   # singular and plural alike
    return re.sub(r"\s+", " ", re.sub(r"#+", "#", t)).strip().lower()


def quart(v):
    v = sorted(v)
    if len(v) < 4:
        return v[0], statistics.median(v), v[-1]
    q = statistics.quantiles(v, n=4)
    return q[0], q[1], q[2]


def wquart(pairs):
    """Weighted quartiles of (price, weight) pairs: each sampled listing stands for as many real listings as its price band holds, so the cheap end counts for what it is worth."""
    pairs = sorted(pairs)
    tot = sum(w for _, w in pairs)
    out = []
    for q in (0.25, 0.5, 0.75):
        acc = 0
        for v, w in pairs:
            acc += w
            if acc >= q * tot:
                out.append(v)
                break
    return out[0], out[1], out[2]


def analyse(tablet):
    f = HERE / f"tablet_scan_{tablet.replace(' ', '_')}.json"
    if not f.exists():
        return None
    D = json.loads(f.read_text(encoding="utf-8"))
    seen, rows = set(), []
    for r in D["rows"]:
        if r["id"] in seen or r["div"] is None or r.get("corrupted") or not r["mods"]:
            continue
        seen.add(r["id"])
        r["_m"] = {}
        for m in r["mods"]:
            k = norm(m["text"])
            side = "P" if str(m.get("tier") or "").startswith("P") else "S" if str(m.get("tier") or "").startswith("S") else "?"
            r["_m"][k] = (m, side)
        rows.append(r)
    counts, per_band = D.get("counts", {}), {}
    for r in rows:
        per_band[(r["rarity"], r["band"])] = per_band.get((r["rarity"], r["band"]), 0) + 1
    for r in rows:
        tot = counts.get(f"{r['rarity']}:{r['band']}") or per_band[(r["rarity"], r["band"])]
        r["_w"] = max(tot, 1) / per_band[(r["rarity"], r["band"])]   # real listings this sampled row stands for
    out = {"listings": len(rows), "counts": counts, "mods": [], "combos": []}
    if len(rows) < 20:
        return out
    lp = {id(r): math.log10(max(r["div"], 0.01)) for r in rows}
    all_keys = {k for r in rows for k in r["_m"]}
    for k in all_keys:
        w = [r for r in rows if k in r["_m"]]
        wo = [r for r in rows if k not in r["_m"]]
        if len(w) < 5 or not wo:
            continue
        m, side = w[0]["_m"][k]
        rng = [mm for r in w for mm in [r["_m"][k][0]["mag"]]]
        lo = hi = None
        vals = []
        for r in w:
            t = r["_m"][k][0]["text"]
            n = re.findall(r"\d+(?:\.\d+)?", t)
            if n:
                vals.append(float(n[0]))
        if vals:
            lo, hi = min(vals), max(vals)
        out["mods"].append({"text": re.sub(r"\s+", " ", m["text"]), "sample": re.sub(r"\s+", " ", m["text"]), "side": side, "n": len(w), "median": round(wquart([(r["div"], r["_w"]) for r in w])[1], 2),
                            "lift": round(statistics.mean(lp[id(r)] for r in w) - statistics.mean(lp[id(r)] for r in wo), 2),
                            "share10": round(sum(r["_w"] for r in w if r["div"] >= 10) / sum(r["_w"] for r in w), 2), "seen": [lo, hi], "stat": (m.get("hash") or "").replace("stat.", "", 1) or None})
    out["mods"].sort(key=lambda x: (-x["lift"], -x["n"]))
    combos = {}
    for r in rows:
        keys = sorted(r["_m"])
        for size in (2, 3):
            for c in itertools.combinations(keys, size):
                combos.setdefault(c, []).append((r["div"], r["_w"]))
    for c, prices in combos.items():
        if len(prices) < MIN_N:
            continue
        q1, med, q3 = wquart(prices)
        sides = []
        samples, stats = [], []
        for k in c:
            r0 = next(r for r in rows if k in r["_m"])
            samples.append(re.sub(r"\s+", " ", r0["_m"][k][0]["text"]))
            stats.append((r0["_m"][k][0].get("hash") or "").replace("stat.", "", 1) or None)
        out["combos"].append({"mods": samples, "sample": samples, "stats": stats, "n": len(prices), "median": round(med, 2), "q1": round(q1, 2), "q3": round(q3, 2),
                              "consistent": bool(len(prices) >= 8 and q1 > 0 and q3 / q1 <= 3)})
    out["combos"].sort(key=lambda x: (-int(x["consistent"]), -x["median"]))
    out["combos"] = out["combos"][:60]
    return out


def attach_floors(res):
    f = HERE / "tablet_floor.json"
    if not f.exists():
        return
    F = json.loads(f.read_text(encoding="utf-8"))
    for t, a in res.items():
        for kind in ("mods", "combos"):
            for x in a[kind]:
                key = " + ".join(sorted(x["stats"])) if kind == "combos" else (x.get("stat") or "")
                hit = F.get(t, {}).get(key)
                if hit:
                    x["listed"], x["listed_at"] = hit["total"], hit["at_median"]


def main():
    res = {}
    for t in TYPES:
        a = analyse(t)
        if a is not None:
            res[t] = a
            print(t, a["listings"], "listings", len(a["mods"]), "mods", len(a["combos"]), "combos")
    # attach_floors(res) is off: tablet_floor.json counted only divine-priced listings of 0.5+ div (the same blind spot the old scan had), so its 'listed now' numbers were wrong
    (HERE / "tablet_market.js").write_text("// built by tablet_analyze.py from tablet_scan_<type>.json (asks, status any, rare and magic tablets)\nwindow.TABLET_MARKET = " + json.dumps(res, indent=0, separators=(",", ":")) + ";\n", encoding="utf-8")
    print("wrote tablet_market.js")


if __name__ == "__main__":
    main()
