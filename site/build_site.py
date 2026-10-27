"""Builds the website into _site/: the landing page plus the three tools as plain static files, with fresh prices.

    python site/build_site.py              # fetch fresh prices (poe.ninja, Craft of Exile), then build
    python site/build_site.py --offline    # build from the committed data only (no network)

Only the files a page actually loads are copied (the saved trade-site scans and the maintenance scripts stay out). A failed price fetch is not fatal:
the committed prices are used and the landing page shows their date. After copying, every file a page refers to is checked, and the build stops if one is missing.
"""
import datetime
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_site")
OFFLINE = "--offline" in sys.argv

FILES = {
    "advisor": ["index.html", "app.js", "engine.js", "emulator.js", "data.js", "weights.js", "alloys.js", "corrupt.js", "prices.js", "prices_leagues.js", "toollinks.js"],
    "jewel": ["jewel_sim.html", "jewel_sim.js", "jewel_pools.json", "jewel_mod_tags.json", "base_prices.js", "prices.js", "collect_config.js", "toollinks.js"],
    "tablet": ["tablet_sim.html", "tablet_sim.js", "tablet_pools.json", "tablet_market.js", "toollinks.js"],
}
THEME = ["ehpic.css", "ehpic_banner.jpg"]


def fetch_prices():
    """Run the two public price fetchers. Returns True if the main price file was refreshed."""
    ok = True
    for script in ("advisor/tools/fetch_prices.py", "advisor/tools/fetch_league_prices.py"):
        try:
            r = subprocess.run([sys.executable, os.path.join(ROOT, script)], cwd=ROOT, capture_output=True, text=True, timeout=600)
            print(script, "->", "ok" if r.returncode == 0 else "FAILED (%d): %s" % (r.returncode, (r.stderr or r.stdout).strip()[-300:]))
            if r.returncode != 0:
                ok = False
        except Exception as e:  # noqa: BLE001
            print(script, "-> FAILED:", e)
            ok = False
    return ok


def prices_date():
    s = open(os.path.join(ROOT, "advisor", "prices.js"), encoding="utf-8").read()
    m = re.search(r'"date":\s*"([0-9-]+)"', s)
    return m.group(1) if m else None


def build(fresh):
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for tool, files in FILES.items():
        os.makedirs(os.path.join(OUT, tool, "theme"))
        for f in files:
            shutil.copy(os.path.join(ROOT, tool, f), os.path.join(OUT, tool, f))
        for f in THEME:
            shutil.copy(os.path.join(ROOT, tool, "theme", f), os.path.join(OUT, tool, "theme", f))
    # the jewel simulator uses the same price file as the advisor
    shutil.copy(os.path.join(ROOT, "advisor", "prices.js"), os.path.join(OUT, "jewel", "prices.js"))
    shutil.copy(os.path.join(ROOT, "index.html"), os.path.join(OUT, "index.html"))
    open(os.path.join(OUT, ".nojekyll"), "w").close()
    data = json.load(open(os.path.join(ROOT, "site-data.json"), encoding="utf-8"))
    data["pricesDate"] = prices_date()
    if fresh:
        data["pricesUpdated"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        data.pop("pricesUpdated", None)
    json.dump(data, open(os.path.join(OUT, "site-data.json"), "w", encoding="utf-8"), indent=1)
    return data


def check():
    """Every file a page refers to must exist in the built site."""
    missing = []
    pages = [("index.html", "")] + [(t + "/" + f, t) for t, fs in FILES.items() for f in fs if f.endswith(".html")]
    for page, folder in pages:
        text = open(os.path.join(OUT, page), encoding="utf-8").read()
        text = re.sub(r"<a [^>]*data-tool[^>]*>", "", text)   # these links are rewritten in the browser (toollinks.js)
        refs = re.findall(r'(?:src|href)="([^"#?]+)', text) + re.findall(r'fetch\("([^"?/][^"?]*)', text)
        for ref in refs:
            if ref.startswith(("http", "//", "mailto:", "data:", "/")):
                continue
            path = os.path.normpath(os.path.join(OUT, folder, ref))
            if not os.path.exists(path):
                missing.append((page, ref))
    return missing


def main():
    fresh = False
    if not OFFLINE:
        fresh = fetch_prices()
    data = build(fresh)
    missing = check()
    for page, ref in missing:
        print("MISSING in built site:", page, "->", ref)
    if missing:
        sys.exit(1)
    n = sum(len(fs) + 2 for fs in FILES.values()) + 3
    print("built", OUT, "(%d files); prices %s, %s" % (n, data["pricesDate"], "refreshed " + data["pricesUpdated"] if fresh else "NOT refreshed (committed snapshot)"))


if __name__ == "__main__":
    main()
