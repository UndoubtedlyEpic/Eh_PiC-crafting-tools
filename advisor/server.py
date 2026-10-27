"""Local server for the crafting advisor: serves the page and looks up real listings on the official PoE2 trade site.

Run start.bat (or `python server.py`) and open http://127.0.0.1:8765/index.html. Only the public trade search is used:
no login, no POESESSID, no OAuth. Requests are slow on purpose (the trade API rate-limits hard) and cached for 10 minutes.
POST /api/prices {league} -> poe.ninja prices in exalted; GET /api/leagues -> trade league names.
POST /api/market  {league, base, filters:[{lines:[{text,min}], kind}], rates:{chaos,divine}}  ->  listings priced in exalted.
"""
import http.server, json, os, re, socketserver, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8765"))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 PoE2CraftingAdvisor/1.0 (personal use)"
API = "https://www.pathofexile.com/api/trade2"
STATS_CACHE = os.path.join(HERE, "trade_stats.json")
_cache = {}
_last_call = [0.0]


def call(url, body=None):
    wait = 1.2 - (time.time() - _last_call[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"User-Agent": UA, "Accept": "application/json", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            _last_call[0] = time.time()
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        _last_call[0] = time.time()
        if e.code == 429:
            raise RuntimeError("The trade site is rate limiting this computer. Wait %s seconds and try again." % (e.headers.get("Retry-After") or "a minute"))
        raise RuntimeError("Trade site error %s: %s" % (e.code, e.read().decode("utf-8", "ignore")[:200]))


def norm(s):
    s = re.sub(r"\([\d.]+\s*[-—–]\s*[\d.]+\)", "#", str(s))
    s = re.sub(r"\d+(\.\d+)?", "#", s)
    s = re.sub(r"#+", "#", s)
    s = s.lower().replace("+", "").replace("(local)", "")
    return re.sub(r"\s+", " ", s).strip()


def stat_index():
    if "stats" in _cache:
        return _cache["stats"]
    if os.path.exists(STATS_CACHE) and time.time() - os.path.getmtime(STATS_CACHE) < 7 * 86400:
        data = json.load(open(STATS_CACHE, encoding="utf-8"))
    else:
        data = call(API + "/data/stats")
        json.dump(data, open(STATS_CACHE, "w", encoding="utf-8"))
    idx = {}
    for grp in data["result"]:
        for e in grp["entries"]:
            slot = idx.setdefault(norm(e["text"]), {})
            # "#% increased Attack Speed" and its "(Local)" weapon version normalise to the same key: prefer the non-local stat (the one jewels and gear use)
            if e["type"] not in slot or ("(local)" in slot[e["type"] + "#text"].lower() and "(local)" not in e["text"].lower()):
                slot[e["type"]] = e["id"]; slot[e["type"] + "#text"] = e["text"]
    _cache["stats"] = idx
    return idx


def find_stat(text, kind):
    ent = stat_index().get(norm(text))
    if not ent:
        return None
    for t in ([kind] if kind else []) + ["explicit", "desecrated", "fractured", "crafted", "implicit"]:
        if t in ent:
            return ent[t]
    return next(v for k, v in ent.items() if not k.endswith("#text"))


def market(req):
    league, base = req.get("league") or "Standard", req.get("base")
    rates = req.get("rates") or {}
    key = json.dumps([league, base, req.get("filters"), req.get("ilvlMin"), req.get("qualityMin"), req.get("rarity"), req.get("corrupted")], sort_keys=True)
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 600:
        return hit[1]
    stats, missing = [], []
    for f in req.get("filters") or []:
        for ln in f["lines"]:
            sid = ln.get("id") or find_stat(ln["text"], f.get("kind"))
            if not sid:
                missing.append(ln["text"])
                continue
            flt = {"id": sid, "disabled": False}
            if ln.get("min") is not None:
                flt["value"] = {"min": ln["min"]}
            stats.append(flt)
    misc = {"corrupted": {"option": "true" if req.get("corrupted") else "false"}}   # a corrupted craft is looked up among corrupted listings
    if req.get("ilvlMin"):
        misc["ilvl"] = {"min": req["ilvlMin"]}
    if req.get("qualityMin"):
        misc["quality"] = {"min": req["qualityMin"]}   # craft log: same quality or better
    query = {"query": {"status": {"option": "any"}, "stats": [{"type": "and", "filters": stats}],
                       "filters": {"misc_filters": {"filters": misc}}},
             "sort": {"price": "asc"}}
    if req.get("rarity"):
        query["query"]["filters"]["type_filters"] = {"filters": {"rarity": {"option": req["rarity"]}}}
    if base:
        query["query"]["type"] = base
    res = call("%s/search/poe2/%s" % (API, urllib.request.quote(league)), query)
    ids = res.get("result", [])[:10]
    out = {"total": res.get("total", 0), "id": res.get("id"), "missing": missing, "listings": [],
           "url": "https://www.pathofexile.com/trade2/search/poe2/%s/%s" % (urllib.request.quote(league), res.get("id"))}
    if ids:
        got = call("%s/fetch/%s?query=%s" % (API, ",".join(ids), res["id"]))
        for g in got.get("result", []):
            lst = g.get("listing") or {}
            p = lst.get("price") or {}
            cur, amt = p.get("currency"), p.get("amount")
            ex = None
            if amt is not None:
                ex = amt if cur == "exalted" else amt * rates["chaos"] if cur == "chaos" and rates.get("chaos") else amt * rates["divine"] if cur == "divine" and rates.get("divine") else None
            it = g.get("item") or {}
            out["listings"].append({"amount": amt, "currency": cur, "ex": ex, "name": it.get("name") or "", "ilvl": it.get("ilvl")})
    _cache[key] = (time.time(), out)
    return out


NINJA_TYPES = ("Currency", "Ritual", "Abyss", "Essences", "Delirium", "Breach", "Expedition")


def ninja_prices(league):
    """poe.ninja exchange prices for one league, in exalted (same conversion as tools/fetch_prices.py)."""
    key = "ninja|" + league
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 600:
        return hit[1]
    out, failed = {}, []
    for typ in NINJA_TYPES:
        url = "https://poe.ninja/poe2/api/economy/exchange/current/overview?league=%s&type=%s" % (urllib.request.quote(league, safe="").replace("%20", "+"), typ)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            nj = json.loads(urllib.request.urlopen(req, timeout=25).read().decode("utf-8"))
        except Exception as e:
            failed.append(typ)
            continue
        ex_rate = nj.get("core", {}).get("rates", {}).get("exalted")  # exalts per divine; thin leagues may not list it
        if not ex_rate:
            failed.append(typ)
            continue
        names = {i["id"]: i["name"] for i in nj["items"]}
        for ln in nj["lines"]:
            n = names.get(ln["id"])
            if n and ln.get("primaryValue"):
                out[n] = round(ln["primaryValue"] * ex_rate, 4)
    if not out:
        raise RuntimeError("poe.ninja returned no prices for league '%s'. Check the league name (failed: %s)." % (league, ", ".join(failed) or "none"))
    res = {"prices": out, "failed": failed, "league": league, "date": time.strftime("%Y-%m-%d")}
    _cache[key] = (time.time(), res)
    return res


def leagues():
    if "leagues" not in _cache:
        data = call(API + "/data/leagues")
        _cache["leagues"] = [l["id"] for l in data.get("result", [])]
    return _cache["leagues"]


def save_lesson(body):
    """Write a teaching session from jewel_sim.html to lessons/<stamp>_<name>.json and .md (the .md is what gets read back)."""
    name = re.sub(r"[^\w\- ]", "", str(body.get("name") or "lesson")).strip().replace(" ", "_") or "lesson"
    d = os.path.join(HERE, "lessons")
    os.makedirs(d, exist_ok=True)
    stem = "%s_%s" % (time.strftime("%Y%m%d_%H%M%S"), name)
    with open(os.path.join(d, stem + ".json"), "w", encoding="utf-8") as f:
        json.dump(body, f, indent=1)
    lines = ["# Jewel crafting lesson: %s" % name, "", "Colour: %s. Wanted suffixes: %s. Wanted prefixes: %s. Rules: %s" % (
        body.get("colour"), "; ".join(body.get("wanted", {}).get("S", [])), "; ".join(body.get("wanted", {}).get("P", [])), json.dumps(body.get("rules"))), "",
        "Each line is something the user said or did, with the jewel after it and the running cost in divine.", ""]
    for e in body.get("events", []):
        s = int(e.get("t", 0) / 1000)
        tag = {"speech": "USER SAID", "flag": "DOES NOT MATCH THE GAME", "note": "note", "action": "action"}.get(e.get("type"), e.get("type"))
        lines.append("- [%d:%02d] **%s**: %s" % (s // 60, s % 60, tag, e.get("text")))
        if e.get("type") in ("action", "flag"):
            lines.append("  - jewel: %s (cost %.2f div)" % (e.get("state") or "(empty)", e.get("cost", 0)))
    with open(os.path.join(d, stem + ".md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return {"path": "advisor/lessons/" + stem + ".md"}


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def translate_path(self, path):
        return super().translate_path(path)

    def do_POST(self):
        if self.path not in ("/api/market", "/api/prices", "/api/lesson", "/api/craft/record", "/api/craft/sold", "/api/craft/snapshot", "/api/usage", "/api/consent"):
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n).decode("utf-8"))
            if self.path == "/api/lesson":
                data, code = save_lesson(body), 200
            elif self.path == "/api/usage":
                import craftlog
                try:
                    data, code = {"saved": craftlog.append_usage(body.get("events"), bool(body.get("consent")))}, 200
                except PermissionError as e:
                    data, code = {"error": str(e)}, 403
            elif self.path == "/api/consent":
                import craftlog
                data, code = craftlog.record_consent(body.get("version"), body.get("action")), 200
            elif self.path.startswith("/api/craft/"):
                import craftlog
                if self.path.endswith("/record"):
                    data = craftlog.record_craft(body)
                elif self.path.endswith("/sold"):
                    data = craftlog.mark_sold(body["craft"], body["price_div"], body.get("note", ""))
                else:
                    c = next((c for c in craftlog._read(craftlog.CRAFTS) if c["id"] == body["craft"]), None)
                    if not c:
                        raise ValueError("unknown craft")
                    data = craftlog.snapshot(sys.modules[__name__], c, force=bool(body.get("force")))
                code = 200
            else:
                data, code = (market(body) if self.path == "/api/market" else ninja_prices(body.get("league") or "Standard")), 200
        except Exception as e:
            data, code = {"error": str(e)}, 500
        raw = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/api/leagues":
            try:
                raw = json.dumps({"leagues": leagues()}).encode()
            except Exception as e:
                raw = json.dumps({"error": str(e)}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if self.path == "/api/usage":
            import craftlog
            raw = json.dumps({"events": craftlog.read_usage()}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if self.path == "/api/craft/list":
            import craftlog
            raw = json.dumps({"crafts": craftlog._read(craftlog.CRAFTS), "history": craftlog._read(craftlog.HISTORY), "sales": craftlog._read(craftlog.SALES)}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if self.path == "/api/ping":
            raw = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H) as s:
        if "--track" in sys.argv:   # opt-in: re-check the market for every logged, unsold craft every N hours (default 12)
            import threading, craftlog
            hrs = float(sys.argv[sys.argv.index("--track") + 1]) if len(sys.argv) > sys.argv.index("--track") + 1 else 12

            def _track():
                while True:
                    try:
                        craftlog.snapshot_all(sys.modules[__name__]); craftlog.report()
                    except Exception as e:
                        print("craft tracker:", e)
                    time.sleep(hrs * 3600)
            threading.Thread(target=_track, daemon=True).start()
            print("Craft tracker on: re-checking logged crafts every %g h" % hrs)
        print("Crafting advisor on http://127.0.0.1:%d/index.html (Ctrl+C to stop)" % PORT)
        s.serve_forever()
