# Corruption simulations: ambiguous rules and how much they matter

Script: `advisor/tools/sim_corruption.py` (Monte Carlo, 400,000 trials per line; `python advisor/tools/sim_corruption.py` reproduces everything).
Engine checks: `Crafter.solve` with `whittleMode` ("junk", "random", "wanted") and `magicLimit` (1 or 2).
A corrupted item cannot be modified again, so every Vaal Orb uses up one item. Cost per wanted enchantment = (item + Vaal Orb [+ Omen]) / chance per item.

## Odds source
No official table. Four guides (Switchblade 0.5.4, TimeSaver, U4N, Maxroll) give four outcomes at about 25% each. An old 100-item test (29/28/22/21%) fits equal odds (chi-square 2.0, 3 degrees of freedom). The page uses equal odds.

## 1. Socket outcome impossible (ring, amulet, belt)
| Reading | Nothing | Reroll | Enchant | Items burned per specific enchant (12 enchants) |
|---|---|---|---|---|
| Armour or martial weapon (can socket, 9 enchants) | 25% | 25% | 25% | 36 |
| Ring, H1: the socket draw stays and does nothing | 50% | 25% | 25% | 48 |
| Ring, H2: impossible outcomes removed before the draw | 33% | 33% | 33% | 36 |
Maxroll says an impossible result leaves no visible change, which supports H1, so the page uses H1. (Omen of Corruption no longer exists, so no omen variants are shown.)
Finding: a ring needs 1.33x the items per enchant under H1 (identical under H2).

## 2. "1 to 3 modifiers randomised"
Chance a given good modifier survives a reroll (uniform 1-3): 4 mods 50%, 5 mods 60%, 6 mods 67%. If it is always 1 reroll: 75-83%. Always 3: 25-50%.
Overall chance the modifier survives a corruption: 75% + 25% x that. Range across readings: 81-96%.

## 3. Orb of Sacrifice removal
"Removes a random modifier": the chance the one modifier you want is removed is 1/n where n counts the modifiers it can hit. With 6 mods, 1 fractured, 1 desecrated it ranges 16.7% (anything) to 25% (fractured and desecrated protected). Treat 25% on a 4-mod item as the baseline; fractured mods are probably safe, which only helps.

## 4. Architect's Orb (50% second enchantment, 50% destroyed)
Specific second enchantment lands 5.6% (9 enchants, same one allowed) or 6.3% (first excluded); 4.2% / 4.6% with 12; 3.6% / 3.9% with 14. Half the items are destroyed either way.

## 5. Unique "divine" (0.78x-1.22x, rounding)
Value 3: 13% higher, 13% lower, 73% unchanged. Value 10: 40% / 38% / 22%. Value 40: 47% / 47% / 7%. Value 100+: 49% / 49% / 2%. Standard rounding is neutral. If the game truncates instead, everything is biased down: value 3 can never rise, value 10 rises 29% and falls 49%. Small values are mostly unchanged either way.

## 6. Vaal Cultivation Orb ("up to 2" modifiers replaced)
Pools run 2 to 10 modifiers (median 4). Chance a specific cultivated modifier appears per orb, by pool size 3 / 5 / 8:
always 2 replaced: 67% / 40% / 25%; 1 or 2 equally: 50% / 30% / 19%; poe2wiki's unconfirmed hypothesis (2 replaced 20% of the time): 40% / 24% / 15%.
At 3,333 ex per orb the cost for a specific modifier ranges from about 5,000 ex (pool 3, always 2) to about 22,000 ex (pool 8, hypothesis). The wide range is the honest answer until the count rule is known.

## 7. Crafting-engine assumptions (Whittling and the magic item limit)
Spear, three wanted mods (Physical Damage, Attack Speed, Critical), item level 82:
| Setting | Fractured-base plan | Fresh-rare plan |
|---|---|---|
| Whittling removes unwanted first (default) | 1,973.6 ex | 4,791.8 ex |
| Whittling random | 1,973.6 ex | 4,791.7 ex |
| Whittling hits a wanted mod first | 1,973.6 ex | 4,791.7 ex |
| Magic item limit 1 or 2 | - | 4,791.8 ex both |
No sensitivity: the cheapest plans here do not use Whittling or depend on the magic-item limit. Re-test when a plan includes Whittling.
