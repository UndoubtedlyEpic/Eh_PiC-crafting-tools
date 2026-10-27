"""Fetch the Time-Lost jewel mod pools (natural, desecrated, Delirium liquid, corruption) from poe2db into jewel/jewel_pools.json
as "Time-Lost Ruby / Emerald / Sapphire / Diamond". The pages embed `new ModsView({...})` JSON. Weights are all 1 (poe2db cannot read them).
The "liquid" list is the crafted modifiers the Ancient Liquid Emotions add (each Liquid: a guaranteed crafted mod on a rare jewel).
Usage: python jewel/tools/fetch_timelost_pools.py
"""
import html
import json
import pathlib
import re
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
OUT = pathlib.Path(__file__).resolve().parents[1] / "jewel_pools.json"
BASES = ("Ruby", "Emerald", "Sapphire", "Diamond")


def clean(s):
    s = re.sub(r"<br\s*/?>", " / ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"local jewel effect base radius \[\d+\]", "", s)
    s = re.sub(r"\(\s*([\d.]+)\s*[—–-]\s*([\d.]+)\s*\)", r"(\1-\2)", s)
    s = re.sub(r"([\d)])\s+%", r"\1%", s)
    s = re.sub(r"\+\s*\(", "+(", s)
    s = re.sub(r"\s+,", ",", re.sub(r"\s+", " ", s)).strip()
    return re.sub(r"(\s*/)+$", "", s).strip()


def modsview(page):
    i = page.index("new ModsView(") + len("new ModsView(")
    depth, j, instr, esc = 0, i, False, False
    while True:
        c = page[j]
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = False
        elif c == '"':
            instr = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return json.loads(page[i:j + 1])


def rows(lst, liquid=False):
    out = []
    for m in lst:
        side = {"1": "P", "2": "S"}.get(str(m.get("ModGenerationTypeID")), "C")   # C = corruption implicit
        r = {"name": clean(m["Name"]), "level": int(m.get("Level") or 1), "side": side, "family": list(m.get("ModFamilyList") or []), "weight": 1, "text": clean(m["str"])}
        if liquid:
            r["code"] = m.get("Code")
        out.append(r)
    return out


def main():
    data = json.loads(OUT.read_text(encoding="utf-8"))
    for base in BASES:
        req = urllib.request.Request(f"https://poe2db.tw/us/Time-Lost_{base}", headers={"User-Agent": UA})
        mv = modsview(urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace"))
        pool = {"normal": rows(mv["normal"]), "desecrated": rows(mv["desecrated"]), "liquid": rows(mv["liquid"], True),
                "corrupted": rows(mv["corrupted"]), "corruption_upgrade": rows(mv["corruption_upgrade"])}
        data["pools"]["Time-Lost " + base] = pool
        print("Time-Lost", base, {k: (len(v), sum(1 for r in v if r["side"] == "P"), sum(1 for r in v if r["side"] == "S")) for k, v in pool.items()})
    # the regular Diamond (user, 2026-10-21): it can roll every mod of the Ruby, Sapphire and Emerald pools
    req = urllib.request.Request("https://poe2db.tw/us/Diamond", headers={"User-Agent": UA})
    mv = modsview(urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace"))
    data["pools"]["Diamond"] = {"normal": rows(mv["normal"]), "desecrated": rows(mv["desecrated"]), "liquid": [], "corrupted": rows(mv.get("corrupted") or []),
                                "corruption_upgrade": rows(mv.get("corruption_upgrade") or [])}
    dn = {m["text"] for m in data["pools"]["Diamond"]["normal"]}
    union = {m["text"] for c in ("Ruby", "Sapphire", "Emerald") for m in data["pools"][c]["normal"]}
    print("Diamond", len(dn), "mods; union of Ruby+Sapphire+Emerald:", len(union), "; missing from Diamond:", len(union - dn), sorted(union - dn)[:5])
    # the regular coloured jewels also have corruption enchantments (Vaal Orb, Architect's Orb); the first pool fetch did not keep them
    for colour in ("Ruby", "Emerald", "Sapphire"):
        req = urllib.request.Request(f"https://poe2db.tw/us/{colour}", headers={"User-Agent": UA})
        mv = modsview(urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace"))
        data["pools"][colour]["corrupted"] = rows(mv.get("corrupted") or [])
        data["pools"][colour]["corruption_upgrade"] = rows(mv.get("corruption_upgrade") or [])
        print(colour, "corruption enchantments:", len(data["pools"][colour]["corrupted"]))
    data["source"] = data.get("source", "") + "; Time-Lost and regular Diamond pools from poe2db (ModsView JSON)"
    OUT.write_text(json.dumps(data, indent=1), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
