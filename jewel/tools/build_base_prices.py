"""Turn the asking-price searches (jewel/jewel_base_price_<base>.json, from jewel_base_price.py) into jewel/base_prices.js,
which the jewel simulator reads for the Time-Lost Diamond / Sapphire / Ruby and the regular Diamond.
Each shape lists the mod patterns a jewel must carry to count as that shape; the price is the median of the cheapest 20 asks (null when fewer than 5 listings).
Usage: python jewel/tools/build_base_prices.py"""
import json
import pathlib

C = pathlib.Path(__file__).resolve().parents[1]
NEEDS = {
    "crit chance + crit damage (attacks)": ["Critical Hit Chance for Attacks", "Critical Damage Bonus for Attack Damage"],
    "crit chance + crit damage (attacks) + attack speed": ["Critical Hit Chance for Attacks", "Critical Damage Bonus for Attack Damage", "% increased Attack Speed$"],
    "crit chance + crit damage (spells)": ["Critical Hit Chance for Spells", "Critical Spell Damage Bonus"],
    "crit chance + crit damage (spells) + cast speed": ["Critical Hit Chance for Spells", "Critical Spell Damage Bonus", "% increased Cast Speed$"],
    "crit damage (spells) only": ["Critical Spell Damage Bonus"],
    "rage on melee hit": ["Gain \\d+ Rage on Melee Hit"],
    "rage on melee hit + effect of small passives": ["Gain \\d+ Rage on Melee Hit", "Effect of Small Passive Skills in Radius"],
    "rage when hit": ["Rage when Hit by an Enemy"],
    "2 crit lines (attacks) + Effect": ["Critical Hit Chance for Attacks", "Critical Damage Bonus for Attack Damage"],
    "3 spear-shape crit lines + Effect": ["Critical Hit Chance for Attacks", "Critical Damage Bonus for Attack Damage", "Critical Damage Bonus with Spears"],
    "2 crit lines (spells) + Effect": ["Critical Hit Chance for Spells", "Critical Spell Damage Bonus"],
}
out = {}
for f in sorted(C.glob("jewel_base_price_*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    shapes = {}
    for key, v in d["cases"].items():
        sname, flag, q = [x.strip() for x in key.split("|")]
        on = flag in ("Very Large radius", "with crafted Effect")
        price = v["median_cheapest_20"] if v.get("n", len(v["cheapest_20"])) >= 5 and (v["median_cheapest_20"] or 0) >= 1 else None   # under 1 div = bait listings, not a price
        s = shapes.setdefault(sname, {"name": sname, "needs": NEEDS[sname], "on": {}, "off": {}})
        s["on" if on else "off"]["quality" if q.startswith("quality") else "plain"] = price
    out[d["base"]] = {"mode": "effect" if d["base"] == "Diamond" else "radius", "shapes": list(shapes.values())}
# the second batch (jewel_more_prices.py): regular Sapphire and Ruby shapes, and the cheapest starter jewel per base
MORE = C / "jewel_more_prices.json"
if MORE.exists():
    NEEDS2 = {"2 spell crit lines": ["Critical Hit Chance for Spells", "Critical Spell Damage Bonus"], "2 spell crit lines + cast speed": ["Critical Hit Chance for Spells", "Critical Spell Damage Bonus", "% increased Cast Speed$"],
              "attack + melee damage": ["% increased Attack Damage$", "% increased Melee Damage$"]}
    more = json.loads(MORE.read_text(encoding="utf-8"))
    ok = lambda v: v["median_cheapest_20"] if v.get("n", 0) >= 1 and (v["median_cheapest_20"] or 0) >= 1 and v["total"] >= 1 and v.get("n", 0) >= min(5, v["total"]) else None
    for key, v in more.items():
        parts = [x.strip() for x in key.split("|")]
        if parts[0] in ("sapphire", "ruby"):
            base = parts[0].capitalize()
            ent = out.setdefault(base, {"mode": "effect", "shapes": []})
            sh = next((x for x in ent["shapes"] if x["name"] == parts[1]), None)
            if sh is None:
                sh = {"name": parts[1], "needs": NEEDS2[parts[1]], "on": {}, "off": {}}
                ent["shapes"].append(sh)
            sh["on" if parts[2].startswith("with ") else "off"]["quality" if parts[3].startswith("quality") else "plain"] = ok(v)
        elif parts[0] == "starter":
            out.setdefault(parts[1], {"mode": "radius" if parts[1].startswith("Time-Lost") else "effect", "shapes": []})["starter"] = ok(v) if (v["median_cheapest_20"] or 0) >= 1 else None
(C / "base_prices.js").write_text("// asking prices (div): median of the cheapest 20 rare listings, status any, built by tools/build_base_prices.py from jewel_base_price.py searches\nwindow.BASE_PRICES = " + json.dumps(out, indent=1) + ";\n", encoding="utf-8")
print("wrote base_prices.js for", list(out))
