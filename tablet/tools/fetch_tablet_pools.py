"""Fetch the mod pools of the eight Precursor Tablet bases from poe2db (ModsView JSON) into tablet/tablet_pools.json.
A tablet is rare with up to 4 modifiers (Craft of Exile: class affixes = 4, so 2 prefixes + 2 suffixes like a jewel); every mod weighs 1 and has level 1 on poe2db and Craft of Exile.
Usage: python tablet/tools/fetch_tablet_pools.py"""
import json
import pathlib
import re
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import fetch_timelost_pools as F  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[1] / "tablet_pools.json"
TABLETS = {
    "Breach Tablet": "Adds an Otherworldy Breach to a Map",
    "Expedition Tablet": "Adds a Kalguuran Expedition to a Map",
    "Delirium Tablet": "Adds a Mirror of Delirium to a Map",
    "Ritual Tablet": "Adds Ritual Altars to a Map",
    "Irradiated Tablet": "Adds Irradiated to a Map",
    "Overseer Tablet": "Empowers the Map Boss of a Map",
    "Abyss Tablet": "Adds Abysses to a Map",
    "Temple Tablet": "Adds Vaal Beacons to a Map",
}


def main():
    pools = {}
    for name, implicit in TABLETS.items():
        req = urllib.request.Request("https://poe2db.tw/us/" + name.replace(" ", "_"), headers={"User-Agent": F.UA})
        mv = F.modsview(urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace"))
        rows = F.rows(mv["normal"])
        for r in rows:
            r["text"] = re.sub(r"\s+", " ", r["text"]).strip()
            # poe2db drops the number of the Waystone quantity line inside hybrid mods ("% increased Quantity of Waystones"): mark it unknown rather than invent a range
            r["text"] = re.sub(r"(^|/ )% ", lambda m: m.group(1) + "X% ", r["text"])
            r["tpl"] = r["text"]
        pools[name] = {"implicit": implicit, "uses": 10, "normal": rows}
        print(name, len(rows), "mods:", sum(1 for r in rows if r["side"] == "P"), "prefixes,", sum(1 for r in rows if r["side"] == "S"), "suffixes")
    OUT.write_text(json.dumps({"source": "poe2db.tw (ModsView JSON), weights all 1 (poe2db and Craft of Exile list 1 for tablet mods)", "pools": pools}, indent=1), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
