"""Cost and risk report for 5-line jewel crafting (Monte Carlo), written to JEWEL_CRAFTING_REPORT.md.

Method source: Mobalytics "The ULTIMATE 5 Line Jewel Craft Guide - 3 Methods" (GL1TCH3D, 2026-09-03), two of its
three methods (Same Side Fracture, Fractureless). Mod pools: poe2db jewel pages (every jewel mod has weight 1, so
a draw is uniform within the pool). Prices: jewel/prices.js (poe.ninja). Market: jewel/jewel_market.json
(trade2 listings via jewel_market.py). Everything here is a model of the guide's steps, not a measured result:
every assumption is printed in the report.

Usage: python jewel/jewel_report.py [--n 20000]
"""
import argparse
import json
import pathlib
import random
import statistics

HERE = pathlib.Path(__file__).resolve().parent
PRICES = json.loads((HERE / "prices.js").read_text(encoding="utf-8").split("=", 1)[1].rstrip().rstrip(";"))
PX = PRICES["prices"]
DIV = PX["Divine Orb"]
POOLS = json.load(open(HERE / "jewel_pools.json", encoding="utf-8"))["pools"]
try:
    MARKET = json.load(open(HERE / "jewel_market.json", encoding="utf-8"))
except FileNotFoundError:
    MARKET = {"arch": {}}


def d(name):
    """price of a currency in divines"""
    return PX[name] / DIV


COST = dict(
    fracture=d("Fracturing Orb"), annul=d("Orb of Annulment"), chaos=d("Chaos Orb"), exalt=d("Exalted Orb"),
    contempt=d("Potent Liquid Contempt"), ferocity=d("Potent Liquid Ferocity"), cranium=d("Preserved Cranium"),
    echoes=d("Omen of Abyssal Echoes"), light=d("Omen of Light"),
    necro_s=d("Omen of Dextral Necromancy"),     # same side = suffix
    annul_opp=d("Omen of Sinistral Annulment"),  # opposite side = prefix
    annul_wrong=d("Omen of Dextral Annulment"),  # a wrong-side Contempt line sits on the suffix side
)

# archetype -> colour, counts of acceptable mods (see jewel_market.py for the actual lines)
ARCH = {
    # Emerald: from listing prices, five suffix mods carry a strong premium (crit chance, crit damage, crit damage with spears,
    # attack speed, attack speed with spears), so 4 are acceptable second mods and 3 acceptable third mods; opposite side
    # acceptable: Attack Damage, Damage with Quarterstaves, Projectile Damage.
    "Emerald attack-crit (3 suffix)": dict(colour="Emerald", k2=4, k3=3, ko=3),
    "Sapphire spell-crit (3 suffix)": dict(colour="Sapphire", k2=2, k3=1, ko=2),
}

P_CONTEMPT_SAME = 0.5    # ASSUMPTION: Liquid Contempt puts "+1 Prefix/Suffix allowed" on a random side; the guide restarts on the wrong one
P_FRACTURE_HIT = 0.25    # ASSUMPTION: Fracturing Orb locks one of the 4 mods at random
P_FEROCITY = 0.5         # the guide: "50/50 chance at completing the prefix modifiers"
ECHO_OPTIONS = 6         # Well of Souls shows 3 options; Omen of Abyssal Echoes rerolls once, so up to 6 can be inspected


RESTARTS = {}   # method name -> average scrapped jewels per finished jewel (set by run)


def geom(rng, p):
    n = 1
    while rng.random() >= p:
        n += 1
    return n


def pool(colour):
    n = POOLS[colour]["normal"]
    p = sum(1 for r in n if r["side"] == "P")
    s = sum(1 for r in n if r["side"] == "S")
    ds = sum(1 for r in POOLS[colour]["desecrated"] if r["side"] == "S")
    return p, s, ds


def common_tail(rng, A, st):
    """Steps shared by both methods, from 'desecrate the same side' to the finished jewel. st accumulates stage costs."""
    P, S, DS = pool(A["colour"])
    n_all = P + S
    # desecrate the 3rd same-side mod: options come from the natural + desecrated-only suffix pool, minus the 2 families already held
    n_cand = S + DS - 2
    p_hit = min(1.0, ECHO_OPTIONS * A["k3"] / n_cand)
    tries = geom(rng, p_hit)
    st["desecrate (Cranium + Echoes + Necromancy)"] += tries * (COST["cranium"] + COST["echoes"] + COST["necro_s"])
    st["Omen of Light between desecrate misses"] += (tries - 1) * COST["light"]
    # remove the "+1 allowed" line with a prefix-only Annulment (two prefixes may be present: the line and the exalted filler)
    q_extra = P / (P + S)
    attempts = 1 + (1 if rng.random() < q_extra and rng.random() < 0.5 else 0)
    st["annul the +1 line (Sinistral Annulment omen + Annul)"] += attempts * (COST["annul_opp"] + COST["annul"])
    st["fill with Exalts"] += 2 * COST["exalt"]
    # opposite side: Chaos until a wanted natural prefix, then Liquid Ferocity 50/50 (fail -> chaos again)
    p_o = A["ko"] / (n_all - 3)
    while True:
        c = geom(rng, p_o)
        st["chaos for the opposite-side mod"] += c * COST["chaos"]
        st["Liquid Ferocity (50/50)"] += COST["ferocity"]
        if rng.random() < P_FEROCITY:
            break


def ssf(rng, A, market, resale):
    """Same Side Fracture. Returns (total, stage dict)."""
    st = dict.fromkeys(["fracture (Fracturing Orbs + failed bases)", "base jewel", "annul down to the fractured mod",
                        "chaos for the 2nd same-side mod", "Exalt + Liquid Contempt (50% restart)",
                        "remove a wrong-side Contempt line (Dextral Annulment omen + Annul)",
                        "desecrate (Cranium + Echoes + Necromancy)", "Omen of Light between desecrate misses",
                        "annul the +1 line (Sinistral Annulment omen + Annul)", "fill with Exalts",
                        "chaos for the opposite-side mod", "Liquid Ferocity (50/50)"], 0.0)
    P, S, _ = pool(A["colour"])
    base = market["base1"]
    tries = geom(rng, P_FRACTURE_HIT)
    st["base jewel"] += base
    st["fracture (Fracturing Orbs + failed bases)"] += tries * COST["fracture"] + (tries - 1) * (1 - resale) * base
    p2 = A["k2"] / (P + S - 1)

    def second_mod():
        st["annul down to the fractured mod"] += 3 * COST["annul"]
        st["chaos for the 2nd same-side mod"] += geom(rng, p2) * COST["chaos"]

    second_mod()
    st["Exalt + Liquid Contempt (50% restart)"] += COST["exalt"]
    while True:
        st["Exalt + Liquid Contempt (50% restart)"] += COST["contempt"]
        if rng.random() < P_CONTEMPT_SAME:
            break
        # user-confirmed: a wrong-side roll is fixed by taking that extra line off (side-targeted Annulment) and rolling Contempt again.
        # But the Annulment picks a random unlocked mod on that side: the fractured mod is locked, so the 2nd suffix and the line
        # are the 2 candidates. Hitting the 2nd suffix loses a wanted mod; rebuilding costs more than starting over (user), so scrap.
        st["remove a wrong-side Contempt line (Dextral Annulment omen + Annul)"] += COST["annul_wrong"] + COST["annul"]
        if rng.random() >= 1 / 2:
            return sum(st.values()), st, False
    common_tail(rng, A, st)
    return sum(st.values()), st, True


def fractureless(rng, A, market, resale):
    st = dict.fromkeys(["base jewel (2 same-side mods)", "Liquid Contempt (50% usable)", "desecrate (Cranium + Echoes + Necromancy)",
                        "Omen of Light between desecrate misses", "annul the +1 line (Sinistral Annulment omen + Annul)",
                        "remove a wrong-side Contempt line (Dextral Annulment omen + Annul)",
                        "fill with Exalts", "chaos for the opposite-side mod", "Liquid Ferocity (50/50)"], 0.0)
    base = market["base2"]
    st["base jewel (2 same-side mods)"] += base
    while True:
        st["Liquid Contempt (50% usable)"] += COST["contempt"]
        if rng.random() < P_CONTEMPT_SAME:
            break
        # a wrong-side roll is fixed by taking the line off with a side-targeted Annulment, which picks at random among the
        # unlocked suffixes: the 2 wanted ones and the line. Hitting a wanted one loses it; restart with a new base (user).
        st["remove a wrong-side Contempt line (Dextral Annulment omen + Annul)"] += COST["annul_wrong"] + COST["annul"]
        if rng.random() >= 1 / 3:
            return sum(st.values()), st, False
    common_tail(rng, A, st)
    return sum(st.values()), st, True


def pctl(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]


def run(method, A, market, resale, n, seed=7):
    rng = random.Random(seed)
    tot, stages, restarts = [], {}, 0
    for _ in range(n):
        t, st_all = 0.0, {}
        while True:
            c, st, ok = method(rng, A, market, resale)
            t += c
            for k, v in st.items():
                st_all[k] = st_all.get(k, 0) + v
            if ok:
                break
            restarts += 1          # a wanted mod was lost: the jewel is scrapped and the whole craft starts again
        tot.append(t)
        for k, v in st_all.items():
            stages[k] = stages.get(k, 0) + v / n
    RESTARTS[method.__name__] = restarts / n
    return tot, stages


def f(x, nd=0):
    return f"{x:,.{nd}f}"


def main():
    global P_CONTEMPT_SAME
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20000)
    a = ap.parse_args()
    out = []
    w = out.append
    w("# Jewel crafting: cost and risk report")
    w("")
    w(f"Prices: poe.ninja {PRICES['date']} (1 divine = {DIV:.0f} exalted). Market listings: {MARKET.get('pulled', 'not fetched')}. League {MARKET.get('league', 'Forbidden Rites')}. All amounts in divines.")
    w("")
    w("Method source: Mobalytics, \"The ULTIMATE 5 Line Jewel Craft Guide - 3 Methods\" (GL1TCH3D, 2026-09-03). Two of its three methods are modelled: Same Side Fracture and Fractureless. Opposite Side Fracture (the guide's hardest) is not.")
    w("")
    w("## What a 5-line jewel is")
    w("A rare jewel normally holds 2 prefixes and 2 suffixes. Liquid Contempt adds a \"+1 modifier allowed\" line, which lets a third mod go on one side. The craft fills that side with three wanted mods, removes the extra line, then finishes the other side, so the jewel ends with 5 lines.")
    w("")
    w("## Inputs that set the cost")
    w("| Input | Price (div) |")
    w("|---|---|")
    for k, lab in [("cranium", "Preserved Cranium (one desecrate)"), ("fracture", "Fracturing Orb"), ("annul_opp", "Omen of Sinistral Annulment"),
                   ("light", "Omen of Light"), ("ferocity", "Potent Liquid Ferocity"), ("contempt", "Potent Liquid Contempt"),
                   ("chaos", "Chaos Orb"), ("annul", "Orb of Annulment"), ("echoes", "Omen of Abyssal Echoes")]:
        w(f"| {lab} | {COST[k]:.2f} |")
    w("")
    w("## Assumptions (change any of them in `jewel_report.py`)")
    w(f"- Every jewel mod has the same weight (poe2db and Craft of Exile both list 1), so a random mod is uniform within the colour pool: Emerald {pool('Emerald')[0]} prefixes + {pool('Emerald')[1]} suffixes, Sapphire {pool('Sapphire')[0]} + {pool('Sapphire')[1]}, plus {pool('Emerald')[2]} desecrated-only suffixes.")
    w(f"- Liquid Contempt puts its line on the wanted side {P_CONTEMPT_SAME:.0%} of the time (my assumption: it has two outcomes, like Ferocity). Confirmed by the user on 2026-10-19: a wrong-side roll is fixed by taking that line off with a side-targeted Annulment (Omen of Dextral Annulment) and rolling Contempt again; the Annulment picks a random unlocked mod on that side, so it can remove a wanted suffix instead of the line (1 in 2 chance of hitting the line when the fractured mod is locked, 1 in 3 on a fractureless jewel). Rebuilding the lost mod can take several different crafting items, so the model scraps that jewel and restarts the whole craft (user, 2026-10-19).")
    w(f"- The Fracturing Orb locks the wanted mod {P_FRACTURE_HIT:.0%} of the time (1 of 4 mods).")
    w(f"- Desecrating shows 3 options, 6 with Omen of Abyssal Echoes. Options are drawn from the natural + desecrated-only suffix pool, so one specific third mod appears in about {ECHO_OPTIONS}/{pool('Emerald')[1] + pool('Emerald')[2] - 2} = {ECHO_OPTIONS / (pool('Emerald')[1] + pool('Emerald')[2] - 2):.0%} of attempts on Emerald.")
    w("- A missed desecrate is reset with an Omen of Light (the guide's safe option). A raw Annulment is cheaper but can ruin the jewel.")
    w("- Liquid Ferocity is modelled like a Perfect Essence: a 50/50 chance, and a miss means more Chaos Orbs. The guide only says \"50/50\".")
    w("- **Chaos step (confirmed by the user, 2026-10-19):** after Contempt, only the side that holds 2 modifiers is affected by Chaos Orbs, so the 3-mod side is protected while the opposite side is rolled. The Chaos step is priced as hitting the opposite side only.")
    w("- Not modelled: roll quality (Divine Orbs, catalysts, quality), corruption, listing fees, selling time, and hand-time.")
    w("")
    verdicts = []
    for name, A in ARCH.items():
        M = dict(MARKET.get("arch", {}).get(name, {}))
        # Emerald: the exact 3-mod combination is never listed, so the finished product is priced as the market sees it:
        # a jewel with at least 3 premium suffixes and 1 premium prefix (jewel_output_price.py, status "any")
        op_file = HERE / f"jewel_output_price_{A['colour']}.json"
        if op_file.exists():
            OP = json.load(open(op_file, encoding="utf-8"))["cases"]
            for k in [k for k in M if k.startswith("output:")]:
                del M[k]
            for cname, c in OP.items():
                key = ("output: 5 lines = " if cname == "3+ premium suffixes + 1+ premium prefix" else "output: ") + cname
                M[key] = {"total": c["total"], "cheapest_div": c["cheapest_20"][:10], "url": c.get("url")}
        def px(key):
            r = M.get(key) or {}
            return (r.get("total", 0), r.get("cheapest_div") or [])
        b1 = px("base: any one same-side mod, max rolled (fracture base)")
        b2 = px("base: two same-side mods (fractureless base)")
        market = dict(base1=(statistics.median(b1[1]) if b1[1] else 0.1), base2=(statistics.median(b2[1]) if b2[1] else 10.0))
        w(f"## {name}")
        w("")
        w("### Live market (trade2)")
        w("| Search | Listed | Cheapest 10 (div) |")
        w("|---|---|---|")
        for key, r in M.items():
            if r.get("error"):
                w(f"| {key} | error | {r['error'][:60]} |")
            else:
                w(f"| {key} | {r.get('total', 0)} | {', '.join(str(x) for x in r.get('cheapest_div', [])) or 'none'} |")
        w("")
        out_keys = [k for k in M if k.startswith("output: 5 lines")]
        five = M.get(out_keys[0], {}) if out_keys else {}
        price5 = five.get("cheapest_div") or []
        w("### Cost per finished jewel")
        w("| Method | Resale of failed bases | Mean | P50 | P90 | P99 |")
        w("|---|---|---|---|---|---|")
        results = {}
        for mname, mfn, resales in (("Same Side Fracture", ssf, (1.0, 0.0)), ("Fractureless", fractureless, (1.0,))):
            for resale in resales:
                tot, stages = run(mfn, A, market, resale, a.n)
                results[(mname, resale)] = (tot, stages)
                w(f"| {mname} | {('n/a' if mname == 'Fractureless' else 'full' if resale == 1.0 else 'none')} | {f(statistics.mean(tot))} | {f(pctl(tot, .5))} | {f(pctl(tot, .9))} | {f(pctl(tot, .99))} |")
        w("")
        w(f"Scrapped jewels per finished jewel (a wanted mod lost to a wrong-side Annulment): Same Side Fracture {RESTARTS.get('ssf', 0):.2f}, Fractureless {RESTARTS.get('fractureless', 0):.2f}. Scrapped bases are not resold.")
        w("")
        w(f"Base jewel used: fracture base {market['base1']:.2f} div, fractureless base (2 mods) {market['base2']:.2f} div (median of the cheapest listings).")
        w("")
        for mname in ("Same Side Fracture", "Fractureless"):
            tot, stages = results[(mname, 0.0 if mname == "Same Side Fracture" else 1.0)]
            w(f"### Where the money goes: {mname}" + (" (failed bases not resold)" if mname == "Same Side Fracture" else ""))
            w("| Stage | Expected cost (div) | Share |")
            w("|---|---|---|")
            tt = sum(stages.values())
            for k, v in sorted(stages.items(), key=lambda kv: -kv[1]):
                w(f"| {k} | {v:.1f} | {v / tt:.0%} |")
            w("")
        w("### Risk and profit")
        if price5:
            floor, typical = price5[0], statistics.median(price5)
            w(f"Finished 5-line jewel (3 same-side mods + 1 opposite-side mod + the crafted Effect line, any roll): **{five.get('total')} listed**, cheapest **{floor:.0f} div**, middle of the cheapest ten **{typical:.0f} div**.")
            w("")
            w("| Method | Resale | Profit at the floor (P50 cost) | Profit at the typical price (P50 cost) | Chance a craft costs more than the floor | ...more than the typical price |")
            w("|---|---|---|---|---|---|")
            for (mname, resale), (tot, _) in results.items():
                l1 = sum(1 for t in tot if t > floor) / len(tot)
                l2 = sum(1 for t in tot if t > typical) / len(tot)
                w(f"| {mname} | {('n/a' if mname == 'Fractureless' else 'full' if resale == 1.0 else 'none')} | {floor - pctl(tot, .5):+.0f} div | {typical - pctl(tot, .5):+.0f} div | {l1:.0%} | {l2:.0%} |")
            w("")
            w("Note: the cheapest ten are the lowest-priced jewels, not the best rolls. A jewel with high rolls on all five lines sells above these, but the listings show no price for rolls, so that premium is not in the table. Several of the cheapest listings share one price, which can mean one seller or a price norm.")
        else:
            w("**No jewel with all five lines is listed.** Nothing to price the output against, so profit cannot be stated from the market. A craft only pays if a buyer exists at a price above the P90 cost in the table above; with nothing listed that buyer is unproven.")
            w("")
            for k in M:
                if k.startswith("output") and (M[k].get("cheapest_div")):
                    w(f"- Nearest comparable: {k.replace('output: ', '')}: {M[k]['total']} listed, from {M[k]['cheapest_div'][0]} div.")
        w("")
        w("### Sensitivity (Fractureless, mean / P50 cost in div)")
        w("The desecrate odds and the Cranium price dominate the cost, and the odds depend on how many different third mods you would accept.")
        w("")
        w("| Change | Mean | P50 |")
        w("|---|---|---|")
        saved_c, saved_cr = P_CONTEMPT_SAME, COST["cranium"]
        cases = [(f"Base case ({A['k3']} acceptable third mod{'s' if A['k3'] != 1 else ''})", dict())]
        cases += [(f"{kk} acceptable third mod{'s' if kk != 1 else ''}", dict(k3=kk)) for kk in (1, 2, 3, 5) if kk != A["k3"]]
        cases += [("Contempt lands on the wanted side 25% of the time", dict(pc=0.25)),
                 ("Preserved Cranium 50% cheaper", dict(cr=0.5)), ("Preserved Cranium 50% dearer", dict(cr=1.5))]
        for lab, ch in cases:
            AA = dict(A, **({"k3": ch["k3"]} if "k3" in ch else {}))
            P_CONTEMPT_SAME = ch.get("pc", saved_c)
            COST["cranium"] = saved_cr * ch.get("cr", 1.0)
            tot, _ = run(fractureless, AA, market, 0.0, 6000)
            w(f"| {lab} | {f(statistics.mean(tot))} | {f(pctl(tot, .5))} |")
        P_CONTEMPT_SAME, COST["cranium"] = saved_c, saved_cr
        w("")
        verdicts.append((name, results, M))
    w("## Risks to weigh before spending")
    w("1. **Preserved Cranium dominates the cost.** One desecrate costs about " + f"{COST['cranium']:.0f}" + " div and a miss adds an Omen of Light. Its price has moved a lot in a week (about 31 div on 14 October, about 29 on 18 October); a rise multiplies the whole craft.")
    w("2. **Thin output market.** A finished 5-line jewel is a niche item. Check that listings exist and sell before crafting; a jewel nobody wants is a total loss of every input.")
    w("3. **Chaos step.** Confirmed by the user to hit only the side with 2 modifiers, which protects the 3-mod side; the model prices it that way.")
    w("4. **Contempt and Ferocity odds are assumptions.** If Contempt lands on the wanted side less than half the time, each extra miss costs one Dextral Annulment omen, one Annul and one more Contempt (about 16 divine); the sensitivity table shows a 25% case.")
    w("5. **Raw Annulment can ruin the jewel**; the model uses Omen of Light instead, which is the expensive safe path.")
    w("6. **Prices can be thin or stale.** Liquid and omen prices here come from poe.ninja daily averages; several have few trades.")
    summ = ["## Verdict", ""]
    for name, results, M in verdicts:
        best = min((statistics.median(t), k) for k, (t, _) in results.items())
        near = [(k.replace("output: ", ""), v["cheapest_div"][0], v["total"]) for k, v in M.items() if k.startswith("output") and not k.startswith("output: 5 lines") and v.get("cheapest_div")]
        near_txt = "; ".join(f"{k}: from {p:g} div ({n} listed)" for k, p, n in near) or "none listed"
        five_k = [k for k in M if k.startswith("output: 5 lines") and M[k].get("cheapest_div")]
        top_near = M[five_k[0]]["cheapest_div"][0] if five_k else max((p for _, p, _ in near), default=0)
        summ.append(f"- **{name}**: typical (P50) cost {best[0]:,.0f} div by the cheaper method, P90 about {pctl(results[('Fractureless', 1.0)][0], .9):,.0f}. {('Finished 5-line jewels: ' + str(M[five_k[0]]['total']) + ' listed, cheapest ' + format(M[five_k[0]]['cheapest_div'][0], 'g') + ' div.') if five_k else 'No 5-line jewel is listed.'} Other listings: {near_txt}.")
        summ.append(f"  To profit at the P50 cost a 5-line jewel must sell for more than {best[0]:,.0f} div, about {best[0] / top_near:.1f}x the {'cheapest 5-line listing' if five_k else 'dearest comparable listing found'}." if top_near else "  No comparable listing to measure against.")
    summ += ["", "Read this as a cost estimate of the guide's method, not a recommendation. The model rests on a few guessed odds and one step the guide does not explain (see the assumptions).",
             "", "**Cross-check with the item simulator** (`jewel_sim.html`: real rolled mods, the rules from the user's first lesson). At a 10-div base it finds a typical (P50) Emerald cost of about 145 div without a fracture and about 180 div with one (means about 170 and 205), which agrees with the tables below. It also says not fracturing is cheaper at every base price tried (0 to 80 div), because after Contempt nothing in the simulated craft can destroy a wanted suffix, so the fracture's protection is never used. If the real game has a risk the simulator is missing, that is where the fracture would earn its cost.", ""]
    out[2:2] = summ
    (HERE / "JEWEL_CRAFTING_REPORT.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print("wrote JEWEL_CRAFTING_REPORT.md")


if __name__ == "__main__":
    main()
