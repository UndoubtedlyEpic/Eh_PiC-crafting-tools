# Craft of Exile (PoE2, classic and the Craft of Exile 2 beta) versus this advisor

Checked 2026-10-19. Sources: craftofexile.com/changelog, beta.craftofexile.com/whats-new?game=poe2 and /roadmap?game=poe2 (read in the browser pane), poe2db.tw item pages.
Craft of Exile 2 is a full rewrite aiming for a full release before PoE2 1.0, with the old site sunset after it. PoE2 data in the classic site was last updated 2026-05-30 (patch 0.5).

## What we share
Mod pool with real generation weights (we read Craft of Exile's weights), minimum mod levels, Greater and Perfect currencies, essences, omens, desecration with bones and the lich omens, fracturing, Abyssal Echoes, alloys (their 2026-06-10 addition), corrupted modifiers (2025-12-12), special rune mod pools (Chronomancy, Marksman, Destruction, Soul, Decay, Berserking: we added them as socket-bound augments), special bases (Gloam, Tenebrous, Dusk, Penumbra, Distorted, Grasping Mail are in our data), league price choice, custom pricing, item import.

## Where we are ahead
- A solver that finds the cheapest next step and the full recipe by item state (they compute single methods and simulate flowcharts you draw).
- Real market listings from the trade site to price the finished item and a profit warning.
- Corruption: enchantments per item type, Vaal outcome odds with simulations, Orbs of Sacrifice, Vaal uniques and Cultivation pools.
- The user's own method and guide-based methods with instructions for alloys and quality timing.
- A mod picker with Want and Avoid and a replace-this-mod option.

## Where they are ahead (their beta list)
| Feature | In ours? | Worth adding? |
|---|---|---|
| Requirement groups with and/or/not, open prefix/suffix as a requirement | Only "need N of M" targets | Yes: an "open prefix/suffix" requirement is cheap in the solver goal |
| Requirements on values, not just tiers | Tiers only (value sliders only in the trade search) | Maybe: a min-value slider per target |
| Flowchart simulator with several routes, fail-forward routes, condition checks, weighted sums | A linear step list with repeat-until | Only if you want hand-built flows; the solver already finds routes |
| Modifier max item level and generation weights | Min level and weights only | Check whether any PoE2 mods have a max item level |
| Emulator: edit item values, sockets and flags (corrupted, sanctified, mirrored) | Not in ours | Low value for planning |
| Armourer's Scrap, Blacksmith's Whetstone, Artificer's Orb, Vaal Infusers (quality and sockets) | Text notes only | Medium: a quality and socket cost calculator |
| Blazing, Chilling, Crackling and Void Flux (convert resistance mods) | Not in ours (prices exist) | Yes: a real crafting step for resistances |
| Altered Collarbone (desecrates a rare amulet, ring or belt with a chance for "otherworldly" mods) | Not in ours (price 2,597 ex) | Yes: the otherworldly mods are the Genesis Tree "Crafted" mods already in our data (amulet 4, ring 15, belt 16), but the chance is unpublished |
| Architect's Orb, Ancient Infuser, Armourer's Scrap as steps | Architect's Orb info only | Medium |
| Hinekora's Lock (see the next currency result) | Not in ours | Low: about 1.2 million ex |
| Recombinators (combine two items) | Not in ours | Roadmap item for them too; unresolved |
| Omen of Sinistral/Dextral Alchemy, Greater Annulment, Omen of Corruption | Dropped as unobtainable | Correct for now (no market price; you confirmed Corruption is gone) |
| Trade search links with mod value sliders | Search button, tier minimums | Medium: sliders per mod |
| Pin favourite methods, high contrast theme, compact UI, bulk pricing | Partly | Low |
| Item and mod data browser | The mod pick list | Low |

## Their own roadmap gaps (they have not done these either)
Divine Orb, Fracturing Orb, Vaal Orb, Desecration, Temple crafts, Reveal and omens in the calculator; Recombinators, Hinekora's Lock and the Genesis Tree in the emulator. We already have fracturing, desecration, reveal and omens in the solver.

## Jewel crafting methods: Craft of Exile versus the jewel simulator (checked 2026-10-21)
Source: beta.craftofexile.com (PoE2 data 4.5.5.3, the Forbidden Rites patch): the `methods.crafting` list, `omens` list, and the jewel classes 71 to 79 (Emerald 71, Sapphire 72, Ruby 73, Diamond 74, Time-Lost Emerald 76, Sapphire 77, Ruby 78, Diamond 79). Its jewel pools match ours exactly (Emerald 30 prefixes + 44 suffixes, every mod weight 1, every mod level 1 to 100 with one tier).

| Craft of Exile method for jewels | In the simulator | Notes |
|---|---|---|
| Orb of Transmutation (plain, Greater, Perfect) | Not used | Jewels never drop normal (user), so Transmutation has no use |
| Orb of Augmentation (plain, Greater, Perfect) | Yes, with the tier selector | Magic start |
| Regal Orb (plain, Greater, Perfect) | Yes, with the tier selector | Magic start |
| Orb of Alchemy | Yes | |
| Chaos Orb (plain, Greater, Perfect) | Yes, with the tier selector | Erasure omens too |
| Exalted Orb (plain, Greater, Perfect) | Yes, with the tier selector | Dextral/Sinistral omens |
| Orb of Annulment | Yes | Dextral/Sinistral omens |
| Divine Orb | Yes | Rerolls every unlocked mod, the Effect line included |
| Fracturing Orb | Yes | 4 mods needed, once per jewel |
| Vaal Orb | Yes (new) | Outcomes assumed 1 in 4 each (maxroll lists them without odds): nothing, 1 to 3 mods randomised, a corruption enchantment, a mod added or removed ignoring the limit |
| Distilled Emotions (Liquid Emotions) | Yes | Contempt, Ferocity, and the Ancient liquids on Time-Lost jewels |
| Desecrate (Abyssal Bench Ticket for jewels = Preserved Cranium) and Reveal | Yes | Echoes optional, Omen of Light, Necromancy omens |
| Refined Catalysts (13) | Yes | Only Refined ones work on jewels |
| Temple: Architect's Orb | Yes (new) | 50% another corruption enchantment, 50% the jewel is destroyed |
| Generate (normal / magic / rare item) | Yes | The "New" buttons |
| Essences, Fluxes, Recombinators, sockets, quality items, Whittle | Not for jewels | Their `*_base` constraints do not include jewels (Whittling would do nothing: all jewel mods are level 1) |

Omens: Dextral/Sinistral Exaltation, Annulment, Erasure and Necromancy, Light, Abyssal Echoes: all in. New: Omen of Greater Exaltation (an Exalted Orb adds two mods). Not modelled: Omen of Catalysing Exaltation (its quality weighting is unconfirmed), Omen of Whittling (no effect on level-1 mods). Coronation, Homogenising, Greater Annulment and Corruption omens have no market price (not obtainable).

Greater and Perfect orbs: they raise the minimum mod level (Exalted, Chaos, Regal 35 / 50; Augmentation 44 / 70). A jewel mod has one tier at level 1, and a Greater Exalted Orb is seen working on a jewel in a crafting video, so on a jewel they add the same kind of random mod as the plain orb; the simulator changes only the price (Greater Exalted 0.026 div, Perfect 2.95; Greater Chaos 0.30, Perfect 7.5; Greater Regal 0.021, Perfect 0.071; Greater Augmentation 0.005, Perfect 0.26). The whole default Emerald craft costs 170 div with plain orbs, 172 with Greater, 220 with Perfect.

## Craft of Exile PoE2 method list (data.json 4.5.5.3, 88 entries) against this advisor (checked 2026-10-21)
Currencies: Transmutation, Augmentation, Regal, Chaos, Exalted in all three tiers, Alchemy, Annulment, Divine, Fracturing, Vaal (2), Artificer's, Blacksmith's Whetstone, Arcanist's Etcher, Armourer's Scrap, Glassblower's Bauble, Vaal Infusers (4). Also: Distilled Emotions, Essences (6 groups), Desecrate (breach = Altered Collarbone, plus high, mid and low bones), Socketables, 13 Catalysts and 13 Refined Catalysts, Architect's Orb, Fluxes (fire, ice, lightning, chaos), Recombinate (3), Generate normal, magic and rare, Reveal.
- In ours: all tiers of the five core currencies, Alchemy, Annulment, Fracturing, essences, bones (Ancient, Preserved, Gnawed) and Reveal, the omens, alloys, socket-bound augments, Vaal and Architect's as corruption information.
- Not in ours: Divine Orb (value rerolls), the five property currencies and Vaal Infusers (quality and sockets), Altered Collarbone (now listed with its otherworldly pool from poe2db, odds unpublished), Catalysts and Refined Catalysts (text notes only), the four Fluxes (resistance conversion), Recombinators.
- Added from the jewel simulator project in this pass: the eH_PiC theme on the published site, a game-style item card with its colours, "1 in N" wording for small chances, the corruption lists per item type from poe2db's class pages with the Orb of Sacrifice upgrade of each enchantment.
