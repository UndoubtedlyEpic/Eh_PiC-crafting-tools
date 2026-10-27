"""Builds a clean, shareable copy of the jewel simulator into jewel/share_dist/ (static files only, nothing personal: no characters, lessons or craft log).
It runs entirely in the browser. Usage: python jewel/tools/build_share.py [--base-url https://example.github.io/jewel-sim/]
The base URL is only used for the Discord/Open Graph preview card (title, description and the banner as the card image); leave it out until the page has an address."""
import pathlib
import re
import shutil
import sys

root = pathlib.Path(__file__).resolve().parents[1]
src, out = root, root / "share_dist"
base = ""
if "--base-url" in sys.argv:
    base = sys.argv[sys.argv.index("--base-url") + 1].rstrip("/") + "/"
if out.exists():
    shutil.rmtree(out)
(out / "theme").mkdir(parents=True)
for f in ("prices.js", "base_prices.js", "jewel_sim.js", "jewel_pools.json", "jewel_mod_tags.json", "collect_config.js"):
    if (src / f).exists():
        shutil.copy(src / f, out / f)
for f in ("ehpic.css", "ehpic_banner.jpg"):
    shutil.copy(src / "theme" / f, out / "theme" / f)
html = (src / "jewel_sim.html").read_text(encoding="utf-8")
title = "eH_PiC Jewel Crafting Simulator"
desc = "Craft a PoE2 jewel by hand or run whole strategies thousands of times: cost per finished jewel, profit against live asking prices, Refined catalyst quality, fracture or not."
og = ('<meta property="og:type" content="website"><meta property="og:title" content="%s"><meta property="og:description" content="%s">'
      '<meta name="description" content="%s"><meta name="theme-color" content="#06030c"><meta name="twitter:card" content="summary_large_image">' % (title, desc, desc))
if base:
    og += '<meta property="og:url" content="%s"><meta property="og:image" content="%stheme/ehpic_banner.jpg"><meta name="twitter:image" content="%stheme/ehpic_banner.jpg">' % (base, base, base)
html = html.replace("<title>Jewel crafting simulator</title>", "<title>%s</title>\n%s" % (title, og), 1)
html = re.sub(r"<a href=\"http://127\.0\.0\.1:87\d\d/[^\"]*\"[^>]*>[^<]*</a>( &middot; )?", "", html)   # links to other tools (local hub) are not part of the shared copy
html = re.sub(r"<script src=\"toollinks\.js\"></script>\s*", "", html)   # its anchors are removed above, so the script is not needed
(out / "index.html").write_text(html, encoding="utf-8")
(out / "README.md").write_text("# eH_PiC Jewel Crafting Simulator\n\nStatic files; open `index.html` through any web server (or host the folder). Runs in the browser. "
                               "Prices are the snapshot in `prices.js`.\n", encoding="utf-8")
print("built", out, "with base url" if base else "without a base url (no preview image yet)")
print(sorted(str(p.relative_to(out)) for p in out.rglob("*") if p.is_file()))
