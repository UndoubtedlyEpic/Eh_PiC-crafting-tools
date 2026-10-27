"""Craft log: remember what people crafted, then keep checking the market for that exact item.

Local first and opt-in: everything is written under jewel/craftlog/ on the machine that runs this simulator. Nothing is uploaded; sharing is an
explicit `export` file with no account names. The trade site shows live asking prices only, never what an item sold for, so:
  * `record`  stores the finished item (mods with their rolled values, quality, cost, currencies spent).
  * `snapshot` searches the trade site for that item (two searches: the exact-ish match and the looser same-shape match) and appends the asking prices.
  * `sold`    stores the price the player actually got (typed in by them; the only ground truth for a sale).
  * `report`  writes MARKET_KNOWLEDGE.md: asking-price history per craft, realised profit where a sale was entered, a plain trend when there are enough snapshots.

CLI (from jewel):  python craftlog.py snapshot | report | export | track [hours] | import-sales rows.json | usage-report | pull
HTTP (server.py): POST /api/craft/record, /api/craft/sold, /api/craft/snapshot;  GET /api/craft/list
"""
import json
import os
import statistics
import sys
import time
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, "craftlog")
CRAFTS, HISTORY, SALES = (os.path.join(DIR, n) for n in ("crafts.jsonl", "market_history.jsonl", "sales.jsonl"))
MIN_GAP_S = 20 * 60          # never search the same craft twice within 20 minutes
PAUSE_BETWEEN_S = 45         # the trade API rate-limits hard; space the crafts out


def _read(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def _append(path, row):
    os.makedirs(DIR, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def user_id():
    """Random id made once per machine so exported logs from different players can be told apart without names."""
    p = os.path.join(DIR, "user.id")
    if not os.path.exists(p):
        os.makedirs(DIR, exist_ok=True)
        with open(p, "w") as f:
            f.write(uuid.uuid4().hex[:12])
    return open(p).read().strip()


def record_craft(body):
    """body: {league, base, source, mods:[{side, text, tpl, value, kind}], quality, quality_type, cost_div, spent:{currency: n}, notes}"""
    mods = [m for m in body.get("mods", []) if m.get("tpl")]
    if not body.get("base") or not mods:
        raise ValueError("a craft needs a base type and at least one modifier")
    cid = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4]
    row = {"id": cid, "ts": int(time.time()), "user": user_id(), "league": body.get("league") or "Standard", "base": body["base"],
           "source": body.get("source") or "unknown", "mods": mods, "quality": int(body.get("quality") or 0), "quality_type": body.get("quality_type"), "corrupted": bool(body.get("corrupted")), "enchants": body.get("enchants") or [],
           "cost_div": round(float(body.get("cost_div") or 0), 2), "spent": body.get("spent") or {}, "notes": (body.get("notes") or "")[:300]}
    _append(CRAFTS, row)
    return row


def mark_sold(craft_id, price_div, note=""):
    if craft_id not in {c["id"] for c in _read(CRAFTS)}:
        raise ValueError("unknown craft " + craft_id)
    row = {"craft": craft_id, "ts": int(time.time()), "price_div": float(price_div), "note": note[:300]}
    _append(SALES, row)
    return row


SALES_IMPORT = os.path.join(DIR, "sales_history.jsonl")


def import_sales(rows, source="screenshot"):
    """Sales read from the in-game Sales History panel (a screenshot the player drops in): [{item, base, price_div, quality, mods:[text], note}].
    Stored apart from crafts: these are confirmed sale prices for items that were never logged by the simulator, still real market knowledge.
    Skips a row already stored (same item name and price) so the same screenshot can be imported twice."""
    have = {(r["item"], r["price_div"]) for r in _read(SALES_IMPORT)}
    added = 0
    for r in rows:
        key = (r["item"], float(r["price_div"]))
        if key in have:
            continue
        _append(SALES_IMPORT, {"ts": int(time.time()), "user": user_id(), "source": source, "item": r["item"], "base": r.get("base"),
                               "price_div": float(r["price_div"]), "quality": int(r.get("quality") or 0), "mods": r.get("mods") or [], "note": r.get("note", "")})
        have.add(key)
        added += 1
    return added


USAGE = os.path.join(DIR, "usage.jsonl")
MAX_EVENTS_PER_POST = 500


CONSENT = os.path.join(DIR, "consent.jsonl")


def record_consent(version, action):
    """The player ticked (or withdrew) the agreement box on the page: one line per event with this machine's random id (user, 2026-10-21)."""
    if action not in ("given", "withdrawn"):
        raise ValueError("unknown consent action")
    row = {"ts": int(time.time()), "user": user_id(), "version": str(version), "action": action}
    _append(CONSENT, row)
    return row


def has_consent():
    """True when the latest consent record for this machine is 'given'."""
    rows = _read(CONSENT)
    return bool(rows) and rows[-1]["action"] == "given"


def append_usage(events, consent=False):
    """Every simulator run and hand-mode action, as the page sends them (user, 2026-10-21: save every use for later cost and sales projections).
    Stored locally with this machine's random id; nothing is uploaded."""
    if not consent or not has_consent():   # nothing is stored without the player's agreement
        raise PermissionError("usage data is only saved after the player agrees")
    uid, n = user_id(), 0
    for e in (events or [])[:MAX_EVENTS_PER_POST]:
        if isinstance(e, dict) and e.get("type"):
            e["user"] = uid
            _append(USAGE, e)
            n += 1
    return n


COLLECTED = os.path.join(DIR, "collected.jsonl")
COLLECTOR_CFG = os.path.join(DIR, "collector.json")


def read_collected():
    """Events other players sent to the collection point (after they ticked the agreement box), without the browsers that later withdrew."""
    rows = _read(COLLECTED)
    withdrawn = {r.get("id") for r in rows if r.get("type") == "consent_withdrawn"}
    out = []
    for r in rows:
        if r.get("id") in withdrawn or r.get("type") == "consent_withdrawn":
            continue
        try:
            d = json.loads(r["data"]) if isinstance(r.get("data"), str) else r.get("data")
        except ValueError:
            continue
        if isinstance(d, dict):
            d["_collected_id"] = r.get("id")
            d["_received"] = r.get("received")
            out.append(d)
    return out


def pull():
    """Download the new events from the author's collection point (build/collector/Code.gs) into craftlog/collected.jsonl. The cursor moves on, so each event is fetched once."""
    import urllib.parse
    import urllib.request
    if not os.path.exists(COLLECTOR_CFG):
        raise SystemExit("no collector.json yet: see build/collector/README.md, step 6")
    with open(COLLECTOR_CFG, encoding="utf-8") as f:
        cfg = json.load(f)
    cursor, total = int(cfg.get("cursor") or 2), 0
    while True:
        url = cfg["url"] + "?" + urllib.parse.urlencode({"token": cfg["token"], "from": cursor})
        with urllib.request.urlopen(url, timeout=60) as resp:
            res = json.loads(resp.read().decode("utf-8"))
        if res.get("error"):
            raise SystemExit("the collection point refused: " + str(res["error"]))
        evs = res.get("events") or []
        for e in evs:
            _append(COLLECTED, e)
        total += len(evs)
        cursor = int(res.get("next") or cursor)
        if len(evs) < 2000:
            break
    cfg["cursor"] = cursor
    with open(COLLECTOR_CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=1)
    return total


def read_usage(limit=20000):
    return _read(USAGE)[-limit:]


def usage_report():
    """USAGE_SUMMARY.md: runs grouped by base / route / focus / start / quality, the logged cost and the same run priced at TODAY's prices.
    The orbs used per finished jewel are stored with every run, so a price change can be projected without re-running the simulator."""
    pr = json.loads(open(os.path.join(HERE, "prices.js"), encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))["prices"]
    div = pr["Divine Orb"]
    own, others = read_usage(), read_collected()
    runs = [e for e in own + others if e.get("type") == "sim_run"]
    acts = [e for e in own + others if e.get("type") == "action"]
    groups = {}
    for e in runs:
        s = e.get("settings", {})
        key = (e.get("base"), e.get("strategy"), e.get("focus"), e.get("startMode"), "q" + str(s.get("qualityPct") or 0))
        now = sum(pr.get(k, 0) * v["mean"] for k, v in (e.get("usagePerJewel") or {}).items()) / div + (e.get("extraPerJewel") or 0)
        g = groups.setdefault(key, {"n": 0, "logged": [], "now": [], "profit": []})
        g["n"] += 1
        g["logged"].append(e["result"]["mean"])
        g["now"].append(now)
        if e.get("profit") is not None:
            g["profit"].append(e["profit"])
    lines = ["# Usage summary", "", "%d simulator runs and %d hand-mode actions logged (%d events from this computer, %d collected from other players)." % (len(runs), len(acts), len(own), len(others)), "",
             "| base | route | focus | start | quality | runs | mean cost logged | same runs at today's prices | mean profit logged |", "|---|---|---|---|---|---|---|---|---|"]
    for k, g in sorted(groups.items(), key=lambda kv: str(kv[0])):
        lines.append("| %s | %s | %s | %s | %s | %d | %.0f | %.0f | %s |" % (*[str(x) for x in k], g["n"], statistics.fmean(g["logged"]), statistics.fmean(g["now"]),
                                                                           ("%.0f" % statistics.fmean(g["profit"])) if g["profit"] else "-"))
    path = os.path.join(DIR, "USAGE_SUMMARY.md")
    os.makedirs(DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(chr(10).join(lines) + chr(10))
    return path


def min_for(value, lo, hi):
    """Lowest roll the market search will accept for a mod that rolled `value` in the range lo..hi.
    TODO(human): choose the tolerance policy. This decides what counts as "the exact item" when the log looks for comparable listings:
    exact roll (value), a little below it (value - 1 or value - 2, as you price within 2 of max), or a fraction of the range. A tight policy
    finds few listings but compares like with like; a loose one finds more but mixes in weaker rolls. The default below is the exact roll."""
    return value


def match_requests(craft):
    """Two trade searches for one craft: 'match' (rolls at least the policy minimum, quality at least the item's) and 'shape' (same mods, any roll)."""
    def lines(with_min):
        out = []
        for m in craft["mods"]:
            ln = {"text": m["tpl"]}
            if with_min and m.get("value") is not None:
                lo, hi = m.get("lo", m["value"]), m.get("hi", m["value"])
                ln["min"] = min_for(m["value"], lo, hi)
            out.append((m.get("kind") or "explicit", ln))
        return out
    reqs = {}
    for name, with_min in (("match", True), ("shape", False)):
        by_kind = {}
        for kind, ln in lines(with_min):
            by_kind.setdefault("crafted" if kind == "crafted" else "explicit", []).append(ln)
        reqs[name] = {"league": craft["league"], "base": craft["base"], "rarity": "rare",
                      "qualityMin": craft["quality"] if (with_min and craft["quality"] >= 1) else None, "corrupted": bool(craft.get("corrupted")),
                      "filters": [{"kind": k, "lines": v} for k, v in by_kind.items()]}
    return reqs


def _rates(server, league):
    px = server.ninja_prices(league)["prices"]
    return {"chaos": px.get("Chaos Orb"), "divine": px.get("Divine Orb")}


def _summarise(res, div_ex):
    ex = [l["ex"] for l in res.get("listings", []) if l.get("ex") is not None]
    prices = sorted(round(x / div_ex, 1) for x in ex)
    return {"total": res.get("total", 0), "cheapest": prices[:10], "median_cheapest": statistics.median(prices) if prices else None,
            "missing": res.get("missing", []), "url": res.get("url")}


def snapshot(server, craft, force=False):
    """Search the trade site for this craft now and append the result to market_history.jsonl."""
    last = [h for h in _read(HISTORY) if h["craft"] == craft["id"]]
    if last and not force and time.time() - last[-1]["ts"] < MIN_GAP_S:
        return last[-1]
    rates = _rates(server, craft["league"])
    row = {"craft": craft["id"], "ts": int(time.time())}
    for name, req in match_requests(craft).items():
        req["rates"] = rates
        row[name] = _summarise(server.market(req), rates["divine"])
    _append(HISTORY, row)
    return row


def snapshot_all(server, only_unsold=True):
    sold = {s["craft"] for s in _read(SALES)}
    done = []
    for c in _read(CRAFTS):
        if only_unsold and c["id"] in sold:
            continue
        try:
            done.append(snapshot(server, c))
        except RuntimeError as e:   # rate limited: stop, try again next round
            print("stopped:", e)
            break
        time.sleep(PAUSE_BETWEEN_S)
    return done


def _trend(points):
    """Plain least-squares slope of the median asking price per day; needs 3+ snapshots over 2+ days, otherwise says so."""
    pts = [(t, p) for t, p in points if p is not None]
    if len(pts) < 3 or pts[-1][0] - pts[0][0] < 2 * 86400:
        return None
    xs = [(t - pts[0][0]) / 86400 for t, _ in pts]
    ys = [p for _, p in pts]
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else None


def report():
    crafts, hist, sales = _read(CRAFTS), _read(HISTORY), _read(SALES)
    sold = {s["craft"]: s for s in sales}
    lines = ["# Market knowledge from logged crafts", "", "Asking prices come from live trade listings (never sale prices). `sold` is what the player typed in. "
             "Trends need 3+ snapshots over 2+ days; with fewer there is nothing to extrapolate.", "",
             "| craft | base | mods | cost | snapshots | first ask | latest ask | change | trend /day | sold | realised |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for c in crafts:
        hs = [h for h in hist if h["craft"] == c["id"]]
        med = [(h["ts"], h["match"]["median_cheapest"] if h["match"]["total"] else h["shape"]["median_cheapest"]) for h in hs]
        vals = [p for _, p in med if p is not None]
        first, lastv = (vals[0], vals[-1]) if vals else (None, None)
        chg = ("%+.0f%%" % (100 * (lastv - first) / first)) if first else "-"
        tr = _trend(med)
        s = sold.get(c["id"])
        mods = "; ".join(m["text"] for m in c["mods"])
        lines.append("| %s | %s | %s | %.0f | %d | %s | %s | %s | %s | %s | %s |" % (
            c["id"], c["base"], mods, c["cost_div"], len(hs), first if first is not None else "-", lastv if lastv is not None else "-", chg,
            ("%+.1f" % tr) if tr is not None else "not enough data", ("%.0f" % s["price_div"]) if s else "-", ("%+.0f" % (s["price_div"] - c["cost_div"])) if s else "-"))
    realised = [s["price_div"] - next(c["cost_div"] for c in crafts if c["id"] == s["craft"]) for s in sales if s["craft"] in {c["id"] for c in crafts}]
    lines += ["", "Crafts logged: %d. Sales entered: %d." % (len(crafts), len(sales))]
    if realised:
        lines.append("Realised profit over the sales entered: mean %+.0f div, total %+.0f div." % (statistics.fmean(realised), sum(realised)))
    path = os.path.join(DIR, "MARKET_KNOWLEDGE.md")
    os.makedirs(DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return path


def export(path=None):
    """One file to share on purpose: crafts, snapshots and sales for this machine's anonymous id. No account names are ever stored."""
    path = path or os.path.join(DIR, "export_%s.json" % time.strftime("%Y%m%d"))
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"user": user_id(), "crafts": _read(CRAFTS), "history": _read(HISTORY), "sales": _read(SALES), "sales_history": _read(SALES_IMPORT), "usage": read_usage()}, f, indent=1)
    return path


if __name__ == "__main__":
    import server
    cmd = (sys.argv[1] if len(sys.argv) > 1 else "report")
    if cmd == "snapshot":
        print(len(snapshot_all(server)), "crafts searched")
    elif cmd == "track":
        hours = float(sys.argv[2]) if len(sys.argv) > 2 else 12
        while True:
            print(len(snapshot_all(server)), "crafts searched", time.strftime("%Y-%m-%d %H:%M"), flush=True)
            report()
            time.sleep(hours * 3600)
    elif cmd == "import-sales":
        print(import_sales(json.load(open(sys.argv[2], encoding="utf-8"))), "sales imported")
    elif cmd == "pull":
        print(pull(), "new events collected")
        print(usage_report())
    elif cmd == "usage-report":
        print(usage_report())
    elif cmd == "export":
        print(export())
    print("report:", report())
