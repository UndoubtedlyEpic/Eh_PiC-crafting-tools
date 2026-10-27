"""Fetch real per-class modifier weights from Craft of Exile's public data (PoB2's mod data has flat weights of 1)
and write advisor/weights.js: {bases: {baseName: classId}, w: {classId: {modKey: weight}}}.
Weights of 1 in the source mean 'not naturally rollable' (essence/desecration only) and are kept as 1.
Usage: python advisor/tools/fetch_weights.py"""
import json, os, re, sys, urllib.request

BASE = "https://beta.craftofexile.com/"
UA = {"User-Agent": "Mozilla/5.0"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "weights.js")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read().decode("utf-8")


def strip(txt, prefix):
    return json.loads(txt[len(prefix):].rstrip(";\n "))


def main():
    page = get(BASE + "?game=poe2") + get(BASE + "packages/files/package_poe2.js")
    m = re.search(r"json/poe2/([\d.]+)/", page)
    ver = m.group(1) if m else "4.5.5.3"
    data = strip(get(f"{BASE}json/poe2/{ver}/data.json"), "coedata=")
    loc = strip(get(f"{BASE}json/poe2/{ver}/localization/english.json"), "coelang=")
    mods = {str(e["id"]): e["key"] for e in data["mods"]["entries"]}
    bases = {}
    for e in data["items"]["entries"]:
        if e.get("label") is not None and e.get("class") is not None:
            bases[loc[e["label"]]] = e["class"]
    used = set(bases.values())
    w = {}
    for cid, mm in data["classmods"].items():
        if int(cid) in used:
            w[cid] = {mods[k]: v for k, v in mm.items() if k in mods}
    js = "window.CRAFT_WEIGHTS=" + json.dumps({"source": "craftofexile.com v" + ver, "bases": {b: c for b, c in bases.items() if c in {int(k) for k in w}}, "w": w},
                                              separators=(",", ":"), sort_keys=True) + ";\n"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"wrote {len(w)} classes, {len(bases)} bases ({len(js) // 1024} KB) to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    sys.exit(main())
