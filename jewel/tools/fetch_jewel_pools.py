"""Fetch the natural and desecrated mod pools of the three coloured jewels from poe2db into jewel/jewel_pools.json.

poe2db and Craft of Exile both list weight 1 for every jewel mod, so within a colour every mod is equally likely.
Usage: python jewel/tools/fetch_jewel_pools.py
"""
import html
import json
import pathlib
import re
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
OUT = pathlib.Path(__file__).resolve().parents[1] / "jewel_pools.json"
ENTRY = re.compile(r'\{"Name":"((?:[^"\\]|\\.)*)","Level":"(\d+)","ModGenerationTypeID":"(\d)","ModFamilyList":\[((?:"[^"]+",?)*)\],(?:"type":"[^"]*",)?"DropChance":(\d+),"str":"((?:[^"\\]|\\.)*)"')


def clean(s):
    s = s.encode("utf-8").decode("unicode_escape", errors="ignore") if "\\u" in s else s
    s = s.replace('\\"', '"').replace("\\/", "/")
    s = re.sub(r"<br\s*/?>", " / ", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip().replace("—", "-").replace("–", "-")


def pools(page):
    out = {}
    for key in ("normal", "desecrated"):
        i = page.find(f'"{key}":[{{')
        if i < 0:
            continue
        j = i + 1
        depth, k = 0, page.index("[", i)
        for k in range(page.index("[", i), len(page)):
            if page[k] == "[":
                depth += 1
            elif page[k] == "]":
                depth -= 1
                if depth == 0:
                    break
        block = page[i:k + 1]
        rows = []
        for m in ENTRY.finditer(block):
            rows.append({"name": m.group(1), "level": int(m.group(2)), "side": "P" if m.group(3) == "1" else "S",
                         "family": re.findall(r'"([^"]+)"', m.group(4)), "weight": int(m.group(5)), "text": clean(m.group(6))})
        out[key] = rows
    return out


def main():
    res = {}
    for colour in ("Ruby", "Emerald", "Sapphire"):
        req = urllib.request.Request(f"https://poe2db.tw/us/{colour}", headers={"User-Agent": UA})
        page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        res[colour] = pools(page)
        n = res[colour]
        print(colour, {k: (len(v), sum(1 for r in v if r['side'] == 'P'), sum(1 for r in v if r['side'] == 'S')) for k, v in n.items()})
    OUT.write_text(json.dumps({"source": "poe2db.tw jewel pages (weights are all 1)", "pools": res}, indent=1), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
