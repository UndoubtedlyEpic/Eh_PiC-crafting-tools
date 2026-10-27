"""Fetch every Alloy currency (what it adds, per item class, prefix/suffix, required level) from poe2db and write advisor/alloys.js.
Usage: python advisor/tools/fetch_alloys.py"""
import html, json, os, re, sys, urllib.parse, urllib.request

NAMES = ["Adaptive Alloy", "Celestial Alloy", "Cyclonic Alloy", "Expansive Alloy", "Mystic Alloy", "Prismatic Alloy", "Protective Alloy", "Runic Alloy",
         "Sovereign Alloy", "Swift Alloy", "The Runebinder's Alloy", "The Runefather's Alloy", "Transcendent Alloy"]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "alloys.js")
UA = {"User-Agent": "Mozilla/5.0"}


def get(name):
    url = "https://poe2db.tw/us/" + urllib.parse.quote(name.replace(" ", "_"), safe="_'")
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def text(cell):
    cell = re.sub(r"<br\s*/?>", " / ", cell)
    cell = re.sub(r"<[^>]+>", "", cell)
    return re.sub(r"\s+", " ", html.unescape(cell)).strip()


def main():
    out = []
    for n in NAMES:
        try:
            page = get(n)
        except Exception as e:
            print("failed", n, e); continue
        rows = re.findall(r"<tr><td>(.*?)</td><td>(.*?)</td><td>(Prefix|Suffix)</td><td>(\d+)</td></tr>", page, flags=re.S)
        groups = {}
        for cls, mod, side, lv in rows:
            key = (text(mod), side, int(lv))
            groups.setdefault(key, []).append(text(cls))
        desc = re.search(r"Removes a random modifier[^<]*", page)
        out.append({"name": n, "rows": [{"classes": c, "mod": m, "side": "P" if sd == "Prefix" else "S", "lv": lv} for (m, sd, lv), c in groups.items()]})
        print(n, len(rows), "rows")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.CRAFT_ALLOYS=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    sys.exit(main())
