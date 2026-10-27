# Jewel crafting: cost and risk report

## Verdict

- **Emerald attack-crit (3 suffix)**: typical (P50) cost 144 div by the cheaper method, P90 about 264. Finished 5-line jewels: 280 listed, cheapest 100 div. Other listings: 3+ premium suffixes: from 17 div (689 listed); 3+ premium suffixes + crafted Effect of Suffixes: from 90 div (653 listed); 3+ premium suffixes + 1+ premium prefix + crafted Effect of Suffixes: from 100 div (265 listed); all of: 3+ premium suffixes + 2+ premium prefixes: from 408 div (2 listed).
  To profit at the P50 cost a 5-line jewel must sell for more than 144 div, about 1.4x the cheapest 5-line listing.
- **Sapphire spell-crit (3 suffix)**: typical (P50) cost 216 div by the cheaper method, P90 about 549. Finished 5-line jewels: 90 listed, cheapest 100 div. Other listings: 3 same-side + crafted Effect line (no natural opposite mod): from 100 div (115 listed); 3 same-side + 1 opposite-side (no crafted line): from 100 div (91 listed); 3 same-side only: from 80 div (121 listed); 2 same-side + 2 opposite-side (4 natural lines): from 1 div (147 listed).
  To profit at the P50 cost a 5-line jewel must sell for more than 216 div, about 2.2x the cheapest 5-line listing.

Read this as a cost estimate of the guide's method, not a recommendation. The model rests on a few guessed odds and one step the guide does not explain (see the assumptions).

**Cross-check with the item simulator** (`jewel_sim.html`: real rolled mods, the rules from the user's first lesson). At a 10-div base it finds a typical (P50) Emerald cost of about 145 div without a fracture and about 180 div with one (means about 170 and 205), which agrees with the tables below. It also says not fracturing is cheaper at every base price tried (0 to 80 div), because after Contempt nothing in the simulated craft can destroy a wanted suffix, so the fracture's protection is never used. If the real game has a risk the simulator is missing, that is where the fracture would earn its cost.

Prices: poe.ninja 2026-10-18 (1 divine = 708 exalted). Market listings: 2026-10-19 04:40 UTC. League Forbidden Rites. All amounts in divines.

Method source: Mobalytics, "The ULTIMATE 5 Line Jewel Craft Guide - 3 Methods" (GL1TCH3D, 2026-09-03). Two of its three methods are modelled: Same Side Fracture and Fractureless. Opposite Side Fracture (the guide's hardest) is not.

## What a 5-line jewel is
A rare jewel normally holds 2 prefixes and 2 suffixes. Liquid Contempt adds a "+1 modifier allowed" line, which lets a third mod go on one side. The craft fills that side with three wanted mods, removes the extra line, then finishes the other side, so the jewel ends with 5 lines.

## Inputs that set the cost
| Input | Price (div) |
|---|---|
| Preserved Cranium (one desecrate) | 28.56 |
| Fracturing Orb | 11.56 |
| Omen of Sinistral Annulment | 20.75 |
| Omen of Light | 8.81 |
| Potent Liquid Ferocity | 6.16 |
| Potent Liquid Contempt | 2.69 |
| Chaos Orb | 0.10 |
| Orb of Annulment | 0.44 |
| Omen of Abyssal Echoes | 0.08 |

## Assumptions (change any of them in `jewel_report.py`)
- Every jewel mod has the same weight (poe2db and Craft of Exile both list 1), so a random mod is uniform within the colour pool: Emerald 30 prefixes + 44 suffixes, Sapphire 23 + 35, plus 3 desecrated-only suffixes.
- Liquid Contempt puts its line on the wanted side 50% of the time (my assumption: it has two outcomes, like Ferocity). Confirmed by the user on 2026-10-19: a wrong-side roll is fixed by taking that line off with a side-targeted Annulment (Omen of Dextral Annulment) and rolling Contempt again; the Annulment picks a random unlocked mod on that side, so it can remove a wanted suffix instead of the line (1 in 2 chance of hitting the line when the fractured mod is locked, 1 in 3 on a fractureless jewel). Rebuilding the lost mod can take several different crafting items, so the model scraps that jewel and restarts the whole craft (user, 2026-10-19).
- The Fracturing Orb locks the wanted mod 25% of the time (1 of 4 mods).
- Desecrating shows 3 options, 6 with Omen of Abyssal Echoes. Options are drawn from the natural + desecrated-only suffix pool, so one specific third mod appears in about 6/45 = 13% of attempts on Emerald.
- A missed desecrate is reset with an Omen of Light (the guide's safe option). A raw Annulment is cheaper but can ruin the jewel.
- Liquid Ferocity is modelled like a Perfect Essence: a 50/50 chance, and a miss means more Chaos Orbs. The guide only says "50/50".
- **Chaos step (confirmed by the user, 2026-10-19):** after Contempt, only the side that holds 2 modifiers is affected by Chaos Orbs, so the 3-mod side is protected while the opposite side is rolled. The Chaos step is priced as hitting the opposite side only.
- Not modelled: roll quality (Divine Orbs, catalysts, quality), corruption, listing fees, selling time, and hand-time.

## Emerald attack-crit (3 suffix)

### Live market (trade2)
| Search | Listed | Cheapest 10 (div) |
|---|---|---|
| base: any one same-side mod, max rolled (fracture base) | 7161 | 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0 |
| base: two same-side mods (fractureless base) | 914 | 0.04, 7.0, 7.0, 9.0, 10.0, 10.0, 12.0, 13.0, 14.0, 14.0 |
| output: 3+ premium suffixes | 689 | 17.0, 20.0, 70.0, 70.0, 80.0, 85.0, 90.0, 90.0, 90.0, 100.0 |
| output: 5 lines = 3+ premium suffixes + 1+ premium prefix | 280 | 100.0, 105.0, 110.0, 115.0, 120.0, 123.0, 130.0, 140.0, 150.0, 150.0 |
| output: 3+ premium suffixes + crafted Effect of Suffixes | 653 | 90.0, 100.0, 105.0, 110.0, 110.0, 120.0, 120.0, 120.0, 123.0, 125.0 |
| output: 3+ premium suffixes + 1+ premium prefix + crafted Effect of Suffixes | 265 | 100.0, 105.0, 110.0, 120.0, 123.0, 130.0, 140.0, 150.0, 150.0, 150.0 |
| output: all of: 3+ premium suffixes + 2+ premium prefixes | 2 | 408.0, 1000.0 |

### Cost per finished jewel
| Method | Resale of failed bases | Mean | P50 | P90 | P99 |
|---|---|---|---|---|---|
| Same Side Fracture | full | 221 | 197 | 370 | 581 |
| Same Side Fracture | none | 221 | 197 | 370 | 581 |
| Fractureless | n/a | 162 | 144 | 264 | 445 |

Scrapped jewels per finished jewel (a wanted mod lost to a wrong-side Annulment): Same Side Fracture 0.51, Fractureless 0.66. Scrapped bases are not resold.

Base jewel used: fracture base 0.00 div, fractureless base (2 mods) 10.00 div (median of the cheapest listings).

### Where the money goes: Same Side Fracture (failed bases not resold)
| Stage | Expected cost (div) | Share |
|---|---|---|
| desecrate (Cranium + Echoes + Necromancy) | 72.2 | 33% |
| fracture (Fracturing Orbs + failed bases) | 69.1 | 31% |
| annul the +1 line (Sinistral Annulment omen + Annul) | 25.6 | 12% |
| remove a wrong-side Contempt line (Dextral Annulment omen + Annul) | 13.7 | 6% |
| Omen of Light between desecrate misses | 13.4 | 6% |
| Liquid Ferocity (50/50) | 12.4 | 6% |
| Exalt + Liquid Contempt (50% restart) | 5.4 | 2% |
| chaos for the opposite-side mod | 4.8 | 2% |
| chaos for the 2nd same-side mod | 2.7 | 1% |
| annul down to the fractured mod | 2.0 | 1% |
| fill with Exalts | 0.0 | 0% |
| base jewel | 0.0 | 0% |

### Where the money goes: Fractureless
| Stage | Expected cost (div) | Share |
|---|---|---|
| desecrate (Cranium + Echoes + Necromancy) | 71.2 | 44% |
| annul the +1 line (Sinistral Annulment omen + Annul) | 25.5 | 16% |
| base jewel (2 same-side mods) | 16.6 | 10% |
| remove a wrong-side Contempt line (Dextral Annulment omen + Annul) | 13.6 | 8% |
| Omen of Light between desecrate misses | 13.1 | 8% |
| Liquid Ferocity (50/50) | 12.3 | 8% |
| Liquid Contempt (50% usable) | 5.4 | 3% |
| chaos for the opposite-side mod | 4.7 | 3% |
| fill with Exalts | 0.0 | 0% |

### Risk and profit
Finished 5-line jewel (3 same-side mods + 1 opposite-side mod + the crafted Effect line, any roll): **280 listed**, cheapest **100 div**, middle of the cheapest ten **122 div**.

| Method | Resale | Profit at the floor (P50 cost) | Profit at the typical price (P50 cost) | Chance a craft costs more than the floor | ...more than the typical price |
|---|---|---|---|---|---|
| Same Side Fracture | full | -97 div | -75 div | 93% | 84% |
| Same Side Fracture | none | -97 div | -75 div | 93% | 84% |
| Fractureless | n/a | -44 div | -23 div | 79% | 63% |

Note: the cheapest ten are the lowest-priced jewels, not the best rolls. A jewel with high rolls on all five lines sells above these, but the listings show no price for rolls, so that premium is not in the table. Several of the cheapest listings share one price, which can mean one seller or a price norm.

### Sensitivity (Fractureless, mean / P50 cost in div)
The desecrate odds and the Cranium price dominate the cost, and the odds depend on how many different third mods you would accept.

| Change | Mean | P50 |
|---|---|---|
| Base case (3 acceptable third mods) | 162 | 144 |
| 1 acceptable third mod | 347 | 269 |
| 2 acceptable third mods | 208 | 176 |
| 5 acceptable third mods | 126 | 114 |
| Contempt lands on the wanted side 25% of the time | 207 | 182 |
| Preserved Cranium 50% cheaper | 127 | 114 |
| Preserved Cranium 50% dearer | 197 | 168 |

## Sapphire spell-crit (3 suffix)

### Live market (trade2)
| Search | Listed | Cheapest 10 (div) |
|---|---|---|
| base: any one same-side mod, max rolled (fracture base) | 10000 | 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0 |
| base: two same-side mods (fractureless base) | 1123 | 0.01, 0.07, 0.5, 1.0, 1.0, 2.0, 4.0, 4.0, 4.0, 5.0 |
| output: 5 lines = 3 same-side + 1 opposite-side + crafted Effect line | 90 | 100.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0 |
| output: 3 same-side + crafted Effect line (no natural opposite mod) | 115 | 100.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0 |
| output: 3 same-side + 1 opposite-side (no crafted line) | 91 | 100.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0 |
| output: 3 same-side only | 121 | 80.0, 100.0, 100.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0, 114.0 |
| output: 2 same-side + 2 opposite-side (4 natural lines) | 147 | 1.0, 12.0, 20.0, 22.0, 25.0, 28.0, 28.0, 30.0, 30.0, 30.0 |

### Cost per finished jewel
| Method | Resale of failed bases | Mean | P50 | P90 | P99 |
|---|---|---|---|---|---|
| Same Side Fracture | full | 350 | 292 | 632 | 1,110 |
| Same Side Fracture | none | 350 | 292 | 632 | 1,110 |
| Fractureless | n/a | 277 | 216 | 549 | 994 |

Scrapped jewels per finished jewel (a wanted mod lost to a wrong-side Annulment): Same Side Fracture 0.50, Fractureless 0.65. Scrapped bases are not resold.

Base jewel used: fracture base 0.00 div, fractureless base (2 mods) 1.50 div (median of the cheapest listings).

### Where the money goes: Same Side Fracture (failed bases not resold)
| Stage | Expected cost (div) | Share |
|---|---|---|
| desecrate (Cranium + Echoes + Necromancy) | 168.6 | 48% |
| fracture (Fracturing Orbs + failed bases) | 69.7 | 20% |
| Omen of Light between desecrate misses | 43.0 | 12% |
| annul the +1 line (Sinistral Annulment omen + Annul) | 25.3 | 7% |
| remove a wrong-side Contempt line (Dextral Annulment omen + Annul) | 13.6 | 4% |
| Liquid Ferocity (50/50) | 12.3 | 4% |
| chaos for the opposite-side mod | 5.6 | 2% |
| Exalt + Liquid Contempt (50% restart) | 5.4 | 2% |
| chaos for the 2nd same-side mod | 4.3 | 1% |
| annul down to the fractured mod | 2.0 | 1% |
| fill with Exalts | 0.0 | 0% |
| base jewel | 0.0 | 0% |

### Where the money goes: Fractureless
| Stage | Expected cost (div) | Share |
|---|---|---|
| desecrate (Cranium + Echoes + Necromancy) | 169.3 | 61% |
| Omen of Light between desecrate misses | 43.3 | 16% |
| annul the +1 line (Sinistral Annulment omen + Annul) | 25.4 | 9% |
| remove a wrong-side Contempt line (Dextral Annulment omen + Annul) | 13.4 | 5% |
| Liquid Ferocity (50/50) | 12.4 | 4% |
| chaos for the opposite-side mod | 5.5 | 2% |
| Liquid Contempt (50% usable) | 5.3 | 2% |
| base jewel (2 same-side mods) | 2.5 | 1% |
| fill with Exalts | 0.0 | 0% |

### Risk and profit
Finished 5-line jewel (3 same-side mods + 1 opposite-side mod + the crafted Effect line, any roll): **90 listed**, cheapest **100 div**, middle of the cheapest ten **114 div**.

| Method | Resale | Profit at the floor (P50 cost) | Profit at the typical price (P50 cost) | Chance a craft costs more than the floor | ...more than the typical price |
|---|---|---|---|---|---|
| Same Side Fracture | full | -192 div | -178 div | 97% | 95% |
| Same Side Fracture | none | -192 div | -178 div | 97% | 95% |
| Fractureless | n/a | -116 div | -102 div | 87% | 82% |

Note: the cheapest ten are the lowest-priced jewels, not the best rolls. A jewel with high rolls on all five lines sells above these, but the listings show no price for rolls, so that premium is not in the table. Several of the cheapest listings share one price, which can mean one seller or a price norm.

### Sensitivity (Fractureless, mean / P50 cost in div)
The desecrate odds and the Cranium price dominate the cost, and the odds depend on how many different third mods you would accept.

| Change | Mean | P50 |
|---|---|---|
| Base case (1 acceptable third mod) | 278 | 217 |
| 2 acceptable third mods | 168 | 141 |
| 3 acceptable third mods | 130 | 116 |
| 5 acceptable third mods | 101 | 94 |
| Contempt lands on the wanted side 25% of the time | 310 | 253 |
| Preserved Cranium 50% cheaper | 193 | 160 |
| Preserved Cranium 50% dearer | 363 | 282 |

## Risks to weigh before spending
1. **Preserved Cranium dominates the cost.** One desecrate costs about 29 div and a miss adds an Omen of Light. Its price has moved a lot in a week (about 31 div on 14 October, about 29 on 18 October); a rise multiplies the whole craft.
2. **Thin output market.** A finished 5-line jewel is a niche item. Check that listings exist and sell before crafting; a jewel nobody wants is a total loss of every input.
3. **Chaos step.** Confirmed by the user to hit only the side with 2 modifiers, which protects the 3-mod side; the model prices it that way.
4. **Contempt and Ferocity odds are assumptions.** If Contempt lands on the wanted side less than half the time, each extra miss costs one Dextral Annulment omen, one Annul and one more Contempt (about 16 divine); the sensitivity table shows a 25% case.
5. **Raw Annulment can ruin the jewel**; the model uses Omen of Light instead, which is the expensive safe path.
6. **Prices can be thin or stale.** Liquid and omen prices here come from poe.ninja daily averages; several have few trades.
