#!/usr/bin/env python3
"""fetch_corruption.py - build advisor/corrupt.js: everything the crafting advisor knows about corruption.

    python advisor/tools/fetch_corruption.py

Inputs (all local except the Sacrifice orb page):
  pob2/src/Data/ModCorrupted.lua        corruption enchantments (weightKey/weightVal per item tag, level, text)
  advisor/cultivation.json           Vaal uniques and their Vaal Cultivation Orb pools (tools/fetch_cultivation.py)
  pob2/src/Data/Uniques/*.lua           which item class and base each unique is
  https://poe2db.tw/us/Stackable_Currency   the four Orbs of Sacrifice
Outcome lists are written from Maxroll's "Corruption Outcomes" page (updated May 22 2026 for 0.4) and are marked as such in the output;
GGG publishes no odds, so the page asks the user for the weights.
"""
import html, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
import importlib.util
_spec = importlib.util.spec_from_file_location("fetch_timelost_pools", os.path.join(HERE, "fetch_timelost_pools.py"))
_ft = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ft)   # modsview() reads the ModsView JSON on a poe2db class page; rows() cleans its mod lines
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "advisor", "corrupt.js")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def enchants():
    t = open(os.path.join(ROOT, "pob2", "src", "Data", "ModCorrupted.lua"), encoding="utf-8").read()
    out = []
    for m in re.finditer(r'\["(\w+)"\] = \{ type = "(\w+)", affix = "([^"]*)", (.*?)statOrder', t):
        mid, typ, body = m.group(1), m.group(2), m.group(4)
        lines = re.findall(r'"((?:[^"\\]|\\.)*)"', body)
        rest = t[m.end(): t.find("\n", m.end())]
        lv = re.search(r"level = (\d+)", rest)
        grp = re.search(r'group = "(\w+)"', rest)
        wk = re.search(r"weightKey = \{([^}]*)\}", rest)
        wv = re.search(r"weightVal = \{([^}]*)\}", rest)
        out.append({"id": mid, "special": typ != "Corrupted", "l": lines, "lv": int(lv.group(1)) if lv else 1, "g": grp.group(1) if grp else mid,
                    "wk": re.findall(r'"(\w+)"', wk.group(1)) if wk else [], "wv": [int(x) for x in re.findall(r"\d+", wv.group(1))] if wv else []})
    return out


def uniques():
    cult = json.load(open(os.path.join(ROOT, "advisor", "cultivation.json"), encoding="utf-8"))
    cls_of = {"amulet": "Amulet", "axe": "Axe", "belt": "Belt", "body": "Body Armour", "boots": "Boots", "bow": "Bow", "claw": "Claw", "crossbow": "Crossbow",
              "dagger": "Dagger", "flail": "Flail", "focus": "Focus", "gloves": "Gloves", "helmet": "Helmet", "jewel": "Jewel", "mace": "Mace", "quiver": "Quiver",
              "ring": "Ring", "sceptre": "Sceptre", "shield": "Shield", "spear": "Spear", "staff": "Staff", "sword": "Sword", "talisman": "Talisman", "wand": "Wand"}
    d = os.path.join(ROOT, "pob2", "src", "Data", "Uniques")
    where = {}
    for f in os.listdir(d):
        if not f.endswith(".lua") or f[:-4] not in cls_of:
            continue
        lines = open(os.path.join(d, f), encoding="utf-8").read().split("\n")
        for i, ln in enumerate(lines):
            if ln.strip() in cult["items"] and i + 1 < len(lines):
                where[ln.strip()] = (cls_of[f[:-4]], lines[i + 1].strip())
    res = []
    for name, v in cult["items"].items():
        c, b = where.get(name, ("Other", "(not in the PoB unique list)"))
        res.append({"name": name, "cls": c, "base": b, "mods": v["base"], "cultivated": v["cultivated"]})
    res.sort(key=lambda x: (x["cls"], x["name"]))
    return res, cult


def sacrifice():
    h = urllib.request.urlopen(urllib.request.Request("https://poe2db.tw/us/Stackable_Currency", headers={"User-Agent": UA}), timeout=40).read().decode("utf-8", "ignore")
    out = []
    for m in re.finditer(r">([A-Z][a-z]+'s Orb of Sacrifice)</a><div>(.*?)</div></div></div></div>", h, flags=re.S):
        out.append({"name": m.group(1), "text": re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m.group(2)))).replace("Stack Size: 1 / 10", "").strip()})
    return out


# poe2db class pages: item type (as in the crafter's base list) -> page slug. Armour pages are split by attribute.
SLUGS = {"Spear": "Spears", "Wand": "Wands", "Staff": "Staves", "Sceptre": "Sceptres", "Bow": "Bows", "Crossbow": "Crossbows", "Dagger": "Daggers", "Claw": "Claws",
         "Flail": "Flails", "Talisman": "Talismans", "Quiver": "Quivers", "Belt": "Belts", "Amulet": "Amulets", "Ring": "Rings", "Focus": "Foci",
         "One Hand Sword": "One_Hand_Swords", "Two Hand Sword": "Two_Hand_Swords", "One Hand Axe": "One_Hand_Axes", "Two Hand Axe": "Two_Hand_Axes",
         "One Hand Mace": "One_Hand_Maces", "Two Hand Mace": "Two_Hand_Maces"}
ARMOUR = {"Body Armour": "Body_Armours", "Helmet": "Helmets", "Gloves": "Gloves", "Boots": "Boots", "Shield": "Shields"}
ATTRS = ("str", "dex", "int", "str_dex", "str_int", "dex_int", "str_dex_int")


def class_pools():
    """Per item type: the corruption enchantments (equal odds), their versions after an Orb of Sacrifice, and the otherworldly/minion/caster
    modifier pools an Altered Collarbone can add (rings, amulets, belts). Armour types are keyed 'Type|attr'."""
    out = {}
    targets = [(k, v) for k, v in SLUGS.items()] + [(f"{t}|{a}", f"{slug}_{a}") for t, slug in ARMOUR.items() for a in ATTRS]
    for key, slug in targets:
        try:
            req = urllib.request.Request("https://poe2db.tw/us/" + slug, headers={"User-Agent": UA})
            page = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
            mv = _ft.modsview(page)
        except Exception:
            continue
        out[key] = {"corrupted": _ft.rows(mv.get("corrupted") or []), "upgrade": _ft.rows(mv.get("corruption_upgrade") or []),
                    "breach": {k: _ft.rows(mv.get(k) or []) for k in ("breach_otherworldly", "breach_minion", "breach_caster") if mv.get(k)}}
    return out


# Outcome lists per item group, as written by Maxroll (May 2026). "odds" is unknown: GGG has not published it.
OUTCOMES = {
    "source": "https://maxroll.gg/poe2/resources/corruption-outcomes (updated 2026-05-22 for 0.4); Orb of Sacrifice from poe2db",
    "rare": ["Nothing happens", "1 to 3 modifiers are randomised", "A corruption enchantment is added", "Special: +1 socket (ignores the limit), or for wands and staves quality up to 23%"],
    "unique": ["Nothing happens", "Modifier values are divined (anywhere from 0.78x to 1.22x of the current roll; unscalable values do not change)", "A corruption enchantment is added", "Special: +1 socket (ignores the limit), or for wands and staves quality up to 23%"],
    "socketable": ["helmet", "gloves", "boots", "body armour", "shield", "focus", "martial weapons (not wands, staves, rings, amulets, belts)"],
    "rareJewel": ["Nothing happens", "1 to 3 modifiers are randomised", "A corruption enchantment is added", "A modifier is added or removed, ignoring the normal limit (for example 3 prefixes and 2 suffixes)"],
    "uniqueJewel": ["No change (about 50%)", "A corruption enchantment is added", "Modifier magnitudes get a 0.78x to 1.22x multiplier"],
    "other": [
        "Architect's Orb (Temple of Atziri): 50% adds a second corruption enchantment, 50% destroys the item. It can only add an enchantment.",
        "Vaal Infuser (Temple of Atziri): adds 1-2% quality beyond 20% (up to 30%) or corrupts the item without changing anything else.",
        "Vaal Cultivation Orb: on a Vaal unique it replaces up to 2 modifiers from a hidden pool; on a non-Vaal unique it turns the item into a new corrupted unique of the same class.",
        "Orb of Sacrifice (Atziri): on a corrupted Rare of the right type it upgrades the corruption enchantment and removes a random modifier.",
        "Skill gems: nothing, +/-1 level, +/-1 socket, or -7% to +3% quality (Crystallised Corruption gives a second outcome, 50% destroys the gem).",
    ],
}


def main():
    en = enchants()
    un, cult = uniques()
    sac = sacrifice()
    classes = class_pools()
    data = {"fetched": __import__("datetime").date.today().isoformat(), "enchants": en, "uniques": un, "sacrifice": sac, "classes": classes, "outcomes": OUTCOMES,
            "cultivationRule": cult.get("rule"), "cultivationSource": cult.get("source")}
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.CRAFT_CORRUPT=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(len(en), "enchantments,", len(un), "vaal uniques,", len(sac), "sacrifice orbs,", len(classes), "class pages ->", OUT)
    print([u["name"] for u in un if u["cls"] == "?"])


if __name__ == "__main__":
    sys.exit(main())
