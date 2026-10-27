# Crafting advisor audit: every rule against credible sources (2026-10-21)

Sources used (all read for this audit):
- **poe2db** item pages and omen list (game item text): https://poe2db.tw/us/Stackable_Currency, https://poe2db.tw/us/Omen, https://poe2db.tw/us/Item_Rarity
- **Craft of Exile** PoE2 data 4.5.5.3 (method constraints and minimum mod levels, mod weights): https://beta.craftofexile.com
- **poe2wiki**: Desecrated modifier, Infuser: https://www.poe2wiki.net/wiki/Desecrated_modifier, https://www.poe2wiki.net/wiki/Infuser
- Guides: Mobalytics (Lolcohol, Perra, BigDaddy Gaming), Maxroll corruption outcomes, TimeSaver, a 1,734-Infuser test.
- **Path of Building** data (mods, bases, runes, corruption enchantments).
Status: VERIFIED = a game text or datamine says it; SOURCED = a guide or wiki says it; USER = confirmed by the user; ASSUMED = nobody publishes it, the number is a placeholder.

## Wrong before this audit, now fixed
| What was wrong | What the sources say | Fixed in |
|---|---|---|
| Whittling removed an unwanted mod before a wanted one | poe2db: "your next Chaos Orb will remove the lowest level modifier" (the level at which the mod becomes available); ties are random | `engine.js` `removeOne`: removal chances computed from mod levels (wanted mods at the average level of the accepted tiers, unwanted mods drawn from the pool's level distribution); checked against a direct simulation (7.59% vs 7.61%); emulator already removed the lowest level |
| Reveal offered three plain weighted options | poe2wiki: at least one option is an exclusive desecrated mod when the item level is 65 or higher and the type has one for that side | engine `optionOutcomes`, emulator `offers` |
| Orb of Alchemy only on normal items | poe2db: "Upgrades a Normal or Magic item to a Rare item with 4 random modifiers"; Craft of Exile constraint `rarity_not_rare` | engine and emulator |
| Quivers got Ribs | poe2db: Jawbone "Desecrates a Rare Weapon or Quiver" | engine `boneClass`, emulator |
| Catalysts (and the Catalysing Infuser) worked on belts | poe2db: "on a ring or amulet" | emulator |
| Omen of Crystallisation used with alloys (removed, then restored) | poe2db's omen text names only "Perfect or Corrupted Essence", but two crafters use it with alloys: the BigDaddy Gaming guide and Belton's +8 wand video ("dextral crystallisation and the celestial alloy"). Restored and marked observed in play, not game text | engine, emulator, method cards, notes |
| Vaal Infuser corrupted instead of adding quality | poe2wiki and the 1,734-use test: always adds 1 or 2%, then 5% per point above the maximum to corrupt | emulator (earlier today) |
| Magic item limit listed as unverified | poe2db Item Rarity: "Magic items can have 2 Modifiers; a Prefix and a Suffix" | assumptions text, engine comment |

## Verified (game text or datamine)
| Rule in the advisor | Source |
|---|---|
| Transmutation: normal item to magic with 1 mod. Augmentation: magic item, new mod. Regal: magic to rare, adds 1 mod. Exalted: rare, adds a mod (needs an open slot). Chaos: removes a random mod and adds a new one (rare). Annulment: removes a random mod (magic or rare). Divine: randomises numeric values | poe2db item texts; Craft of Exile constraints |
| Greater and Perfect minimum mod levels: Transmutation and Augmentation 44 and 70, Regal, Exalted and Chaos 35 and 50 | Craft of Exile `min_mod_level` properties |
| Fracturing Orb: rare item with at least 4 modifiers, locks one random mod | poe2db, Craft of Exile (`minimum_4_explicits`) |
| Omen of Greater Exaltation (two mods), Sinistral and Dextral Exaltation (prefix or suffix only), Sinistral and Dextral Erasure (Chaos removes only prefixes or suffixes), Sinistral and Dextral Annulment, Omen of Light (Annulment removes only desecrated mods), Sinistral and Dextral Necromancy, Abyssal Echoes (reroll the options once) | poe2db omen texts |
| Lich omens (Sovereign = Ulaman, Liege = Amanamu, Blackblooded = Kurgal): guarantee a random modifier of that family on a weapon or jewellery desecration | poe2db omen texts |
| Bones: Jawbone weapons and quivers, Rib armour, Collarbone amulet, ring and belt, Cranium jewels; Gnawed bones have maximum item level 64; Ancient bones have minimum modifier level 40 | poe2db item texts |
| A desecrated mod takes a prefix or suffix slot while unrevealed; if the item is full a random modifier is removed; an item with a desecrated mod cannot be desecrated again; reveal gives one of three; Echoes rerolls once | poe2wiki Desecrated modifier; Craft of Exile (`not_desecrated`) |
| Lesser, normal and Greater essences: magic item to rare with a guaranteed mod. Perfect and Corrupted essences: rare item, remove a random mod and add a guaranteed mod; Crystallisation omens limit the removal side | poe2db item texts and omen texts |
| Essence of the Breach: jewellery, adds +20% to Maximum Quality. Essence of the Abyss: Mark of the Abyssal Lord | poe2db |
| Alloys: rare item, remove a random modifier and add a guaranteed modifier (the list of alloy mods per item class) | poe2db alloy pages |
| Catalysts: ring or amulet, add quality enhancing mods of one tag, replace other quality types; the tag of each catalyst | poe2db |
| Artificer's Orb (Augment Socket on martial weapon, wand, staff, armour); Scrap, Whetstone, Etcher (quality by item type); Vaal Infusers (four kinds, need maximum quality, +10% beyond, chance to corrupt) | poe2db texts, poe2wiki Infuser |
| Fluxes: Blazing, Chilling and Crackling convert the other two resistance types, Void converts Fire, Cold and Lightning to Chaos | poe2db |
| Orbs of Sacrifice: Yaomac's weapons and quivers, Kopec's armour, Kamasa's amulets, rings and belts, Yugul's jewels; upgrade a corruption enchantment and remove a random mod | poe2db |
| Corruption enchantments per item type and their Sacrifice upgrades; the Altered Collarbone "otherworldly" pools | poe2db class pages |
| Vaal Cultivation Orb: replaces up to 2 modifiers on a corrupted Vaal unique; the 48 Vaal uniques and their pools | poe2db |
| Mod pool, tiers, slots (including "-1 Prefix allowed" implicits), bases, weights, socket-bound augment pools | Path of Building data, Craft of Exile weights |
| Prices | poe.ninja exchange (live in the local copy, daily snapshot on the website) |

## Sourced (guides or wiki, not game text)
| Rule | Source |
|---|---|
| Vaal Orb outcomes equally likely (nothing, 1 to 3 mods randomised, an enchantment, a socket or other special) | Switchblade Gaming (0.5.4), TimeSaver, U4N, Maxroll; one 100-item test fits |
| Architect's Orb: 50% a second enchantment, 50% destroyed | TimeSaver |
| Catalysts add 5% quality each, up to 20% | stratlore, poe2fun |
| Scrap quality gain: 5% normal, 2% magic, 1% rare | poedb Armourer's Scrap page |
| Infuser: +1% (+2% about 1 in 6 at item level 82); corruption chance 5% per point above the maximum | poe2wiki Infuser, 1,734-use test (reproduced: 10.2% reach 30% against about 11%) |
| Sovereign, Liege and Blackblooded omens and the Well of Souls pool (normal pool plus exclusive mods) | poe2wiki Desecrated modifier |
| Essence of the Abyss swap loop to remove a bad desecrated mod | Lolcohol, Blood Mage Cast Speed Ring guide |
| Chaos spam, fracture and annul-down methods | Mobalytics guides (Lolcohol, Perra, BigDaddy Gaming) |

## Confirmed by the user
Annulment can remove a desecrated mod. A desecrated mod counts towards the 4 mods a Fracturing Orb needs but cannot be fractured, which is why an unrevealed bone gives a 1 in 3 chance. Omen of Corruption no longer exists. Alloys and quality timing (alloy after mod-removing steps, Breach quality removed right after the fracture).

## Assumed (placeholders, listed in the code)
- Whittling: levels of unwanted mods are drawn from the pool, and a wanted mod sits at the average level of the tiers accepted (the state does not store each mod's tier).
- Exclusive desecrated mods all have equal weight (the wiki says they are uneven and unpublished).
- Whetstone and Etcher gain the same quality as the Scrap per use.
- Omen of Catalysing Exaltation: weight x5 at 20% quality and x7.5 at 40% (poe2wiki, unconfirmed).
- Altered Collarbone: each offer has a 1 in 3 chance to be otherworldly; Artificer's Orb stops at 3 sockets; the Infuser's +2% chance scales down below item level 82.
- Desecrated and crafted mod weights are flat (Craft of Exile has no weights for them except the socket-bound augment pools).
- Alloy with a Crystallisation omen: observed in two crafters' work, not in the omen's text.
- Magic item rarity limits for Vaal Orb rerolls, equal odds per enchantment (poe2db lists no weights).

## Not modelled
Omen of Putrefaction, Recombinators, Hinekora's Lock, omens with no market price (Sinistral and Dextral Alchemy and Coronation, Greater Annulment, Homogenising, Corruption), the exact odds of the Vaal Cultivation Orb, the number of sockets an item can hold.

## How to re-run this audit
1. `python advisor/tools/fetch_weights.py`, `fetch_prices.py`, `fetch_alloys.py`, `fetch_corruption.py` refresh the data.
2. Read https://poe2db.tw/us/Stackable_Currency and https://poe2db.tw/us/Omen again after each patch and compare with the table above (the audit script pattern is in the commit that added this file).

## Open rules from the 0.5 video pass (2026-10-21)
- One crafted modifier at a time (0.5 patch notes, quoted by Belton and a forum thread): NOT enforced by the engine or the emulator; which currencies count is unclear.
- Sanctification range: poe2db says 78%-122%, Belton says 80%-120% (corruption 78%-122%): not modelled.
- +1 suffix modifier rune is one per character (Belton): not modelled.
- Perfect Essence removing from the full side: not modelled (advisor removes any unlocked mod).
- Omen of Putrefaction: text verified on poe2db, not modelled.
