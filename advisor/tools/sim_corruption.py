"""sim_corruption.py - Monte Carlo of the ambiguous corruption interactions in PoE2 (what the guides do not pin down).

    python advisor/tools/sim_corruption.py            # prints every section; results are summarised in advisor/SIMULATIONS.md

A corrupted item cannot be modified again by currency, so one Vaal Orb uses up one item. Every section compares the competing readings of a rule
and reports what changes in numbers, so the page can use the safe one and say how wide the uncertainty is.
"""
import json, os, random, re
from collections import Counter

N = 400_000
random.seed(20261019)
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def pct(x):
    return f"{x:6.2%}"


# ---------------------------------------------------------------- 1. outcome draw when the socket outcome is impossible
def draw(can_socket, hyp, omen):
    pool = ["SOCKET", "REROLL", "ENCHANT"] + ([] if omen else ["NOTHING"])
    if not can_socket and hyp == "H2":
        pool.remove("SOCKET")
    r = random.choice(pool)
    return "NOTHING" if (r == "SOCKET" and not can_socket) else r


def sec1():
    print("== 1. Items that cannot gain a socket (ring, amulet, belt): what does the socket outcome do?")
    print("   H1 = it stays in the draw and does nothing (Maxroll: impossible results leave no visible change, even with the Omen)")
    print("   H2 = impossible outcomes are removed before the draw")
    for omen in (False, True):
        for label, can, hyp, n_ench in (("can socket (armour, martial weapon), 9 enchants", True, "-", 9), ("ring/amulet/belt H1, 12 enchants", False, "H1", 12), ("ring/amulet/belt H2, 12 enchants", False, "H2", 12)):
            c = Counter(draw(can, hyp, omen) for _ in range(N))
            p = c["ENCHANT"] / N / n_ench
            print(f"   omen={omen!s:<5} {label:<48} nothing {pct(c['NOTHING']/N)} reroll {pct(c['REROLL']/N)} enchant {pct(c['ENCHANT']/N)} socket {pct(c['SOCKET']/N)}"
                  f"  P(specific enchant) {pct(p)}  items burned per hit {1/p:5.1f}")
    print()


# ---------------------------------------------------------------- 2. reroll count and which modifiers it hits
def sec2():
    print("== 2. '1-3 modifiers are randomised': how often does a given good modifier survive? (item has m modifiers)")
    dists = {"k uniform 1-3": (1, 2, 3), "k always 1": (1,), "k always 3": (3,), "k weighted 1:2:3 (mostly 1)": (1, 1, 1, 2, 2, 3)}
    for m in (4, 5, 6):
        for name, ks in dists.items():
            keep = sum(random.random() >= random.choice(ks) / m for _ in range(N)) / N
            print(f"   {m} modifiers, {name:<30} good modifier kept in the rerolled case: {pct(keep)}")
    print("   (with equal outcomes a rerolled item is 25%; overall P(good mod kept) = 75% + 25% x kept)\n")


# ---------------------------------------------------------------- 3. Sacrifice orb removal
def sec3():
    print("== 3. Orb of Sacrifice: 'removes a random Modifier' - which modifiers can it hit?")
    for n_mods, fractured, desecrated in ((4, 0, 0), (5, 1, 0), (6, 1, 1), (6, 2, 0)):
        for name, pool in (("any modifier incl. fractured", n_mods), ("fractured protected", n_mods - fractured), ("fractured and desecrated protected", n_mods - fractured - desecrated)):
            hit_good = 1 / pool
            print(f"   {n_mods} mods ({fractured} fractured, {desecrated} desecrated): {name:<38} chance the ONE modifier you want is removed: {pct(hit_good)}; kept per orb {pct(1-hit_good)}")
    print()


# ---------------------------------------------------------------- 4. Architect's Orb and double enchantment
def sec4():
    print("== 4. Architect's Orb (50% second enchantment, 50% destroyed) after a first wanted enchantment")
    print("   Reading A: the second enchantment is random from the pool (same one allowed)  | Reading B: the first one is excluded (Crystallised Corruption works that way)")
    for n_pool in (9, 12, 14):
        for name, pool in (("A same allowed", n_pool), ("B first excluded", n_pool - 1)):
            p_both = 0.5 / pool  # second is a specific wanted second enchantment
            print(f"   {n_pool} enchants, {name:<18}: chance a specific second enchant lands {pct(p_both)}, item destroyed 50%, orbs per success if you always rebuy the item {1/p_both:5.1f}")
    print()


# ---------------------------------------------------------------- 5. unique divine and rounding
def sec5():
    print("== 5. Unique corruption 'divine' (multiplier 0.78x-1.22x in 0.01 steps), value rounding trunc(v*m+0.5)")
    mult = [i / 100 for i in range(78, 123)]
    for base in (3, 5, 10, 20, 40, 100, 400):
        up = down = same = 0
        for _ in range(N):
            v = int(base * random.choice(mult) + 0.5)
            up += v > base
            down += v < base
            same += v == base
        print(f"   current value {base:>3}: higher {pct(up/N)}  lower {pct(down/N)}  unchanged {pct(same/N)}")
    print("   Reading with truncation instead of rounding (trunc(v*m)) biases everything down:")
    for base in (3, 10, 40, 100):
        up = down = 0
        for _ in range(N):
            v = int(base * random.choice(mult))
            up += v > base
            down += v < base
        print(f"   current value {base:>3}: higher {pct(up/N)}  lower {pct(down/N)}")
    print()


# ---------------------------------------------------------------- 6. Vaal Cultivation Orb
def sec6():
    path = os.path.join(ROOT, "advisor", "cultivation.json")
    items = json.load(open(path, encoding="utf-8"))["items"]
    print("== 6. Vaal Cultivation Orb: replaces 'up to 2' modifiers from the item's pool. Count and selection are unpublished.")
    print("   Readings for the replacement count: R1 always 2 | R2 1 or 2, 50/50 | R3 poe2wiki's unconfirmed hypothesis, 2 mods 20% of the time and 1 mod 80%")
    pools = sorted(len(v["cultivated"]) for v in items.values())
    print(f"   pool sizes over {len(pools)} Vaal uniques: min {pools[0]}, median {pools[len(pools)//2]}, max {pools[-1]}")
    for n_pool in (3, 5, 8):
        for name, ks in (("R1 always 2", (2,)), ("R2 1 or 2", (1, 2)), ("R3 20% two", (1, 1, 1, 1, 2))):
            hit = 0
            for _ in range(N):
                k = random.choice(ks)
                if 0 in random.sample(range(n_pool), min(k, n_pool)):
                    hit += 1
            p = hit / N
            print(f"   pool {n_pool}: {name:<12} chance a specific cultivated modifier appears per orb {pct(p)}  orbs per hit {1/p:5.1f}  (cost at 3333 ex each: {3333/p:8.0f} ex)")
    print()


if __name__ == "__main__":
    for f in (sec1, sec2, sec3, sec4, sec5, sec6):
        f()
