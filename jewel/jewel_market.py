"""Live trade-site prices for jewel crafting inputs and outputs, through the crafter's local server (/api/market).

Needs jewel/server.py running (start.bat). Searches are paced (default 9 s apart) to stay under GGG's limits.
Writes jewel/jewel_market.json: {archetype: {query_name: {total, cheapest_div:[...], url, error}}}.
Usage: python jewel/jewel_market.py [--pace 9]
"""
import argparse
import json
import pathlib
import time
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
SERVER = "http://127.0.0.1:8766/api/market"
LEAGUE = "Forbidden Rites"

# Archetypes: the same-side (3 lines) and opposite-side (2 lines) targets, with the guide's roll ceilings for "max rolled".
ARCH = {
    "Emerald attack-crit (3 suffix)": {
        "base": "Emerald", "side": "S",
        # chosen from listing prices (jewel_5line_analyze.py): these carry the biggest asking-price lift on Emerald 5-liners
        "same": [("(6-16)% increased Critical Hit Chance for Attacks", 15), ("(10-20)% increased Critical Damage Bonus for Attack Damage", 19),
                 ("(2-4)% increased Attack Speed", 4)],
        "opp": [("(5-15)% increased Attack Damage", 14), ("(6-16)% increased Damage with Quarterstaves", 15)],
    },
    "Sapphire spell-crit (3 suffix)": {
        "base": "Sapphire", "side": "S",
        "same": [("(5-15)% increased Critical Hit Chance for Spells", 14), ("(10-20)% increased Critical Spell Damage Bonus", 19),
                 ("(2-4)% increased Cast Speed", 4)],
        "opp": [("(5-15)% increased Spell Damage", 14), ("(5-15)% increased Elemental Damage", 14)],
    },
}


def lines(items, with_min=True):
    return [{"text": t, **({"min": m} if with_min else {})} for t, m in items]


def search(base, items, rates, crafted=None):
    filters = [{"kind": "explicit", "lines": items}]
    if crafted:
        filters.append({"kind": "crafted", "lines": [{"text": crafted}]})
    body = {"league": LEAGUE, "base": base, "filters": filters, "rates": rates}
    req = urllib.request.Request(SERVER, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read().decode())
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"}
    if d.get("error"):
        return {"error": d["error"]}
    px = sorted(l["ex"] / rates["divine"] for l in d.get("listings", []) if l.get("ex") is not None)
    return {"total": d.get("total", 0), "cheapest_div": [round(x, 2) for x in px[:10]], "url": d.get("url"), "missing": d.get("missing", [])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pace", type=float, default=9.0)
    a = ap.parse_args()
    pr = json.loads((HERE / "prices.js").read_text(encoding="utf-8").split("=", 1)[1].rstrip().rstrip(";"))["prices"]
    rates = {"chaos": pr["Chaos Orb"], "divine": pr["Divine Orb"]}
    out = {"pulled": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "league": LEAGUE, "rates": rates, "arch": {}}
    for name, A in ARCH.items():
        res = out["arch"][name] = {}
        same, opp = A["same"], A["opp"]
        queries = {
            # inputs
            "base: any one same-side mod, max rolled (fracture base)": lines(same[:1]),
            "base: two same-side mods (fractureless base)": lines(same[:2]),
            # outputs, from most to least complete
            # outputs carry no roll minimums: the cheapest jewel with these lines at ANY roll is the floor you compete against.
            # The finished jewel's 5th line is the crafted "increased Effect of Suffixes/Prefixes" from Liquid Ferocity (PoB LiquidEmotions.lua).
            "output: 5 lines = 3 same-side + 1 opposite-side + crafted Effect line": lines(same + opp[:1], False),
            "output: 3 same-side + crafted Effect line (no natural opposite mod)": lines(same, False),
            "output: 3 same-side + 1 opposite-side (no crafted line)": lines(same + opp[:1], False),
            "output: 3 same-side only": lines(same, False),
            "output: 2 same-side + 2 opposite-side (4 natural lines)": lines(same[:2] + opp, False),
        }
        EFFECT = "#% increased Effect of Suffixes" if A["side"] == "S" else "#% increased Effect of Prefixes"
        crafted_keys = {"output: 5 lines = 3 same-side + 1 opposite-side + crafted Effect line",
                        "output: 3 same-side + crafted Effect line (no natural opposite mod)"}
        for qn, items in queries.items():
            res[qn] = search(A["base"], items, rates, EFFECT if qn in crafted_keys else None)
            print(name, "|", qn, "->", {k: v for k, v in res[qn].items() if k != "url"}, flush=True)
            if res[qn].get("error") and "rate" in res[qn]["error"].lower():
                print("rate limited, stopping early")
                (HERE / "jewel_market.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
                return
            time.sleep(a.pace)
    if all(r.get("error") for A in out["arch"].values() for r in A.values()):
        raise SystemExit("every search failed (is jewel/server.py running?); keeping the previous jewel_market.json")
    (HERE / "jewel_market.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote jewel_market.json")


if __name__ == "__main__":
    main()
