// [lesson 1] applied. [lesson 2] applied. [lesson 11] Divine rerolls Effect of Suffixes, Divine until an Effect target. [lesson 19] consent gate. [lesson 17] staged odds table, Chaos until both prefixes are targets. [lesson 16] usage log, odds table. [lesson 15] Time-Lost whole-strategy runs. [lesson 14] prefix-focused whole-strategy runs. [lesson 13] magic start, target mods, prefix focus. [lesson 10] jewel quality up to 20%. [lesson 9] sell a fracture miss. [lesson 8] integer rolls, within-N-of-max target. [lesson 7] final Divine on the unlocked suffixes. [lesson 6] Divine before fracture, one fracture only. [lesson 5] premium starting pair. [lesson 4] fracture-first route. [lesson 3] corrected: Exaltation omens are Exalt-only. Jewel crafting simulator: a rolled item you can craft by hand (and narrate), plus a Monte Carlo runner that plays whole strategies
// on the same rules. Rules are marked with their source: [guide] Mobalytics 5-line guide, [user] confirmed by the user, [PoB] data, [assumed].
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PRICES = window.CRAFT_PRICES.prices, DIV = PRICES["Divine Orb"];

  // ---------------------------------------------------------------- random
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let rng = mulberry32((Date.now() & 0x7fffffff) | 1);
  const rint = (n) => Math.floor(rng() * n), pick = (a) => a[rint(a.length)];
  function shuffled(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rint(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }

  // ---------------------------------------------------------------- data
  let POOLS = null, colour = "Emerald", NAT = [], DES = [];
  const norm = (t) => String(t).replace(/\([\d.]+-[\d.]+\)/g, "#").replace(/[+-]?\d+(\.\d+)?/g, "#").replace(/#+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  const rollText = (t) => t.replace(/\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/g, (m, a, b) => { a = +a; b = +b; return Number.isInteger(a) && Number.isInteger(b) ? String(a + rint(b - a + 1)) : (a + rng() * (b - a)).toFixed(1); });
  // [lesson 6] every mod keeps a roll quality q (0 = bottom of its range, 1 = top); a Divine Orb rerolls it
  const renderText = (t, q) => t.replace(/\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/g, (m, a, b) => { a = +a; b = +b; return Number.isInteger(a) && Number.isInteger(b) ? String(Math.round(a + q * (b - a))) : (a + q * (b - a)).toFixed(1); });
  function loadColour(c) {
    colour = c;
    const mk = (m, kind) => ({ side: m.side, text: m.text, norm: norm(m.text), group: kind === "desecrated" ? "D:" + norm(m.text) : m.family.join(","), kind });
    NAT = POOLS[c].normal.map((m) => mk(m, "natural"));
    DES = POOLS[c].desecrated.map((m) => mk(m, "desecrated"));
    // [Time-Lost] the Ancient Liquid Emotions add a guaranteed crafted modifier (poe2db "liquid" list); regular jewels have no such list in the pool file
    LIQ = (POOLS[c].liquid || []).map((m) => ({ name: m.name, side: m.side, text: m.text, norm: norm(m.text), code: m.code }));
  }
  let LIQ = [];
  const isTimeLost = () => colour.indexOf("Time-Lost") === 0;
  const DEFAULT_WANTED = {
    Emerald: { S: ["#% increased critical hit chance for attacks", "#% increased critical damage bonus for attack damage", "#% increased critical damage bonus with spears", "#% increased attack speed", "#% increased attack speed with spears"],
               P: ["#% increased attack damage", "#% increased damage with spears", "#% increased projectile damage",
                   "#% increased projectile damage if you've dealt a melee hit in the past eight seconds",   // [lesson 1] his craft wants this one
                   "#% increased elemental damage", "#% increased projectile speed", "#% increased damage with hits against rare and unique enemies"] },
    // Time-Lost Emerald (radius jewel): the sold ones carry notable crit chance + crit damage + attack speed (suffixes), a small-passive damage prefix and the crafted "Upgrades Radius to Very Large"
    "Time-Lost Emerald": { S: ["notable passive skills in radius also grant #% increased critical hit chance for attacks", "notable passive skills in radius also grant #% increased critical damage bonus for attack damage",
                               "notable passive skills in radius also grant #% increased critical damage bonus with spears", "notable passive skills in radius also grant #% increased attack speed",
                               "notable passive skills in radius also grant #% increased attack speed with spears", "#% increased effect of notable passive skills in radius"],
                           P: ["small passive skills in radius also grant #% increased attack damage", "small passive skills in radius also grant #% increased damage with spears",
                               "small passive skills in radius also grant #% increased projectile damage"] },
    // starting presets only: target mods belong to ONE build and differ per player. The Diamond pools hold every mod of the three coloured jewels (user), so they start from the Emerald preset.
    "Time-Lost Ruby": { S: ["notable passive skills in radius also grant gain # rage on melee hit"], P: ["small passive skills in radius also grant #% increased attack damage", "small passive skills in radius also grant #% increased melee damage", "small passive skills in radius also grant #% increased global physical damage"] },
    "Time-Lost Sapphire": { S: ["notable passive skills in radius also grant #% increased critical hit chance for spells", "notable passive skills in radius also grant #% increased critical spell damage bonus", "notable passive skills in radius also grant #% increased cast speed"],
                            P: ["small passive skills in radius also grant #% increased spell damage"] },
    "Time-Lost Diamond": "TL_EMERALD", Diamond: "EMERALD",
    Sapphire: { S: ["#% increased cast speed", "#% increased critical hit chance for spells", "#% increased critical spell damage bonus"], P: ["#% increased spell damage", "#% increased elemental damage"] },
    Ruby: { S: [], P: ["#% increased attack damage", "#% increased melee damage", "#% increased global physical damage"] },
  };
  DEFAULT_WANTED["Time-Lost Diamond"] = DEFAULT_WANTED["Time-Lost Emerald"]; DEFAULT_WANTED.Diamond = DEFAULT_WANTED.Emerald;
  const Wanted = { S: new Set(), P: new Set() };
  // [lesson 5, user] the starting pair is the most sought-after suffixes: any two of the crit mods; the third suffix can be any other wanted one
  const PREMIUM = { Emerald: ["#% increased critical hit chance for attacks", "#% increased critical damage bonus for attack damage", "#% increased critical damage bonus with spears"],
                    Sapphire: ["#% increased critical hit chance for spells", "#% increased critical spell damage bonus", "#% increased cast speed"], Ruby: [],
                    Diamond: ["#% increased critical hit chance for attacks", "#% increased critical damage bonus for attack damage", "#% increased critical damage bonus with spears"],
                    "Time-Lost Sapphire": ["notable passive skills in radius also grant #% increased critical hit chance for spells", "notable passive skills in radius also grant #% increased critical spell damage bonus", "notable passive skills in radius also grant #% increased cast speed"],
                    "Time-Lost Diamond": ["notable passive skills in radius also grant #% increased critical hit chance for attacks", "notable passive skills in radius also grant #% increased critical damage bonus for attack damage", "notable passive skills in radius also grant #% increased critical damage bonus with spears"],
                    "Time-Lost Emerald": ["notable passive skills in radius also grant #% increased critical hit chance for attacks", "notable passive skills in radius also grant #% increased critical damage bonus for attack damage",
                                          "notable passive skills in radius also grant #% increased critical damage bonus with spears"] };
  const premiumSet = () => FOCUS !== "S" ? new Set() : new Set((PREMIUM[colour] || []).filter((n) => Wanted.S.has(n)));
  const isWanted = (m) => (m.kind === "natural" || m.kind === "desecrated") && Wanted[m.side].has(m.norm);

  // ---------------------------------------------------------------- item and rules
  let uid = 1;
  // [lesson 8] integer ranges roll each whole number with equal odds; q is the position in the range, value() the number rolled
  function rollQ(tpl) {
    const m = /\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/.exec(tpl);
    if (!m) return rng();
    const a = +m[1], b = +m[2];
    if (Number.isInteger(a) && Number.isInteger(b) && b > a) return rint(b - a + 1) / (b - a);
    return rng();
  }
  function rangeOf(m) { const r = /\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/.exec(m.tpl || ""); return r ? [+r[1], +r[2]] : null; }
  const rolledValue = (m) => { const r = rangeOf(m); return r ? Math.round(r[0] + m.q * (r[1] - r[0])) : null; };
  // does this mod meet the roll target? within = "at most N below the maximum"; otherwise a minimum quality fraction
  // [lesson 10] quality (0-20% on jewels) scales the mods of the catalyst's type; with opts.qCounts it counts toward the roll target
  const qMult = (m, s, opts) => (opts && opts.qCounts && s && s.quality && premiumSet().has(m.norm)) ? 1 + s.quality / 100 : 1;
  const rollOk = (m, opts, minQ, s) => { if (opts.within != null && opts.within >= 0) { const r = rangeOf(m); return !r || rolledValue(m) * qMult(m, s, opts) >= r[1] - opts.within; } return m.q * qMult(m, s, opts) >= minQ; };
  const newMod = (src, extra) => { const q = rollQ(src.text); return Object.assign({ id: uid++, side: src.side, text: renderText(src.text, q), tpl: src.text, q, norm: src.norm, group: src.group, kind: src.kind, locked: false }, extra || {}); };
  const count = (s, side) => s.mods.filter((m) => m.side === side).length;
  // a magic jewel holds at most 1 prefix and 1 suffix; a rare one 2 and 2 (plus what Contempt allows)
  const limit = (s, side) => (s.magic && !s.rare ? 1 : 2) + s.mods.filter((m) => m.line && m.line.grants === side).length;
  const groupsOf = (s) => new Set(s.mods.map((m) => m.group));
  const unlocked = (s) => s.mods.filter((m) => !m.locked);
  // [lesson 1, user] when one side holds 3 mods and the other 2, Chaos, Contempt and Ferocity only hit the side with 2
  function twoModSide(s, list) {
    if (!rules.chaosTwoModSide) return list;
    const sc = count(s, "S"), pc = count(s, "P");
    if (sc === 3 && pc === 2) return list.filter((m) => m.side === "P");
    if (pc === 3 && sc === 2) return list.filter((m) => m.side === "S");
    return list;
  }
  const hasLine = (s, key, val) => s.mods.some((m) => m.line && m.line[key] === val);
  const OMEN = { exalt: { S: "Omen of Dextral Exaltation", P: "Omen of Sinistral Exaltation" }, annul: { S: "Omen of Dextral Annulment", P: "Omen of Sinistral Annulment" },
                 necro: { S: "Omen of Dextral Necromancy", P: "Omen of Sinistral Necromancy" },
                 erase: { S: "Omen of Dextral Erasure", P: "Omen of Sinistral Erasure" } };
  // [lesson 22] Craft of Exile's Greater and Perfect orbs raise the minimum mod level (Exalted, Chaos, Regal 35 / 50; Augmentation 44 / 70). Every jewel mod is level 1 with one tier (poe2db and Craft of
  // Exile data), so on a jewel they add the same kind of random mod as the plain orb; only the price changes.
  let ORB_TIER = "";
  const ORB_NAMES = { exalt: ["Exalted Orb", "Greater Exalted Orb", "Perfect Exalted Orb"], chaos: ["Chaos Orb", "Greater Chaos Orb", "Perfect Chaos Orb"],
                      regal: ["Regal Orb", "Greater Regal Orb", "Perfect Regal Orb"], augment: ["Orb of Augmentation", "Greater Orb of Augmentation", "Perfect Orb of Augmentation"] };
  const orbName = (k) => ORB_NAMES[k][ORB_TIER === "Greater" ? 1 : ORB_TIER === "Perfect" ? 2 : 0];
  const chaosCount = (cur) => ORB_NAMES.chaos.reduce((a, n) => a + (cur[n] || 0), 0);
  function use(T, name, n) { n = n || 1; T.cur[name] = (T.cur[name] || 0) + n; }
  function costOf(T) { let d = T.extra || 0; for (const k in T.cur) { const p = PRICES[k]; d += (p == null ? 0 : p) * T.cur[k] / DIV; } return d; }
  const newT = () => ({ cur: {}, extra: 0 });
  let rules = { chaosTwoModSide: true };   // [user] when one side has 3 mods and the other 2, Chaos only affects the 2-mod side

  // [lesson 18, user] a Diamond (regular or Time-Lost) can NEVER hold more than 2 crit damage suffixes at once, in any craft: once two are on it, no crit damage mod is offered
  const CRIT_DMG = /critical (spell )?damage bonus/i;
  const isDiamond = () => /Diamond/.test(colour);
  const critDmgCount = (s) => s.mods.filter((m) => CRIT_DMG.test(m.text)).length;
  function eligible(s, side, withDes) {
    const have = groupsOf(s);
    const capped = isDiamond() && critDmgCount(s) >= 2;
    return NAT.concat(withDes ? DES : []).filter((m) => m.side === side && !have.has(m.group) && !(capped && CRIT_DMG.test(m.text)));
  }
  function addRandom(s, side) {
    const sides = (side ? [side] : ["P", "S"]).filter((x) => count(s, x) < limit(s, x));
    const cands = [].concat(...sides.map((x) => eligible(s, x, false)));
    if (!cands.length) return null;
    const m = newMod(pick(cands)); s.mods.push(m); return m;   // jewel mods all weigh 1: uniform draw [poe2db, Craft of Exile]
  }
  const A = {};   // actions: (s, T, arg) -> result object with .msg
  A.alchemy = (s, T) => { use(T, "Orb of Alchemy"); s.mods = []; for (let i = 0; i < 4; i++) addRandom(s, null); s.rare = true; return { msg: "Alchemy: rare jewel with " + s.mods.length + " mods" }; };
  // [lesson 10, user] jewels take quality up to 20% (not 40%); each catalyst adds opts gain, switching catalyst type would reset it (only one type is used here)
  const QCAP = 20;
  // a catalyst scales every mod whose text names its tag (attack, spell/cast...); a generic line such as "increased critical damage bonus" has no tag and is not scaled
  // only REFINED catalysts apply to jewels (plain ones are ring/amulet only); Reaver = attack tag, Sibilant = caster tag
  // tags from the game's own data (jewel_mod_tags.json, built by tools/export_jewel_tags.py), not guessed from the wording
  let MODTAGS = {};
  const CAT_TAG = { Reaver: "attack", Sibilant: "caster", Skittering: "speed", Adaptive: "attribute", Necrotic: "minion", "Xoph's": "fire", "Tul's": "cold", "Esh's": "lightning", "Chayula's": "chaos", "Uul-Netol's": "physical", Flesh: "life", Neural: "mana", Carapace: "defences" };
  const catalystHits = (name, m) => { const k = Object.keys(CAT_TAG).find((x) => name.indexOf(x) >= 0); return !!k && m.kind !== "unrevealed" && (MODTAGS[m.norm] || []).indexOf(CAT_TAG[k]) >= 0; };
  A.catalyst = (s, T, arg) => {
    const name = (arg && arg.name) || "Refined Reaver Catalyst", gain = (arg && arg.gain) || 1;
    use(T, name);
    const before = s.quality || 0;
    s.quality = Math.min(QCAP, before + gain); s.catName = name;
    const boosted = s.mods.filter((m) => catalystHits(name, m)).map((m) => m.text);   // [lesson 10b, user] only mods carrying the catalyst's tag are scaled
    s.boosted = boosted.length;
    return { msg: name + ": quality " + before + "% to " + s.quality + "%" + (before >= QCAP ? " (already at the 20% cap, wasted)" : "") + "; scales " + (boosted.length ? boosted.join(" / ") : "none of the current mods") };
  };
  A.divine = (s, T) => {   // [lesson 6, user] values are frozen on a fractured mod, so Divine before fracturing
    use(T, "Divine Orb");
    let n = 0; for (const m of s.mods) if (!m.locked && m.tpl) { m.q = rollQ(m.tpl); m.text = renderText(m.tpl, m.q); n++; }
    // [lesson 11, user] the Effect of Suffixes/Prefixes line (40-60, even roll) rerolls in the same Divine
    for (const m of s.mods) if (!m.locked && m.norm === "effect") { m.text = m.text.replace(/\d+%/, (40 + rint(21)) + "%"); n++; }
    return { msg: "Divine Orb rerolled the values of " + n + " mods" };
  };
  // [lesson 13, user] jewels never drop normal, so Transmutation is not used. The magic start is a bought magic jewel with ONE target mod: Augmentation adds a second,
  // Annulment removes one of the mods already on it, Regal makes it rare (and a rare jewel stays rare for good). Exalted and Chaos Orbs need a rare item.
  A.transmute = (s, T) => {   // user 2026-10-22: a blank jewel must be craftable from the start, so Transmutation makes it magic with one random mod
    if (s.rare || s.magic || s.mods.length) return { msg: "Transmutation needs a normal jewel with no mods", fail: true };
    use(T, "Orb of Transmutation"); s.magic = true;
    const m = addRandom(s, null); return { msg: m ? "Transmutation: magic jewel with " + m.text : "Transmutation: no room", mod: m };
  };
  A.augment = (s, T) => {
    if (!s.magic || s.rare) return { msg: "Augmentation needs a magic jewel", fail: true };
    if (s.mods.length >= 2) return { msg: "A magic jewel already has 2 mods", fail: true };
    use(T, orbName("augment"));
    const m = addRandom(s, null); return { msg: m ? "Augmentation added " + m.text : "Augmentation: no room", mod: m };
  };
  A.regal = (s, T) => {
    if (!s.magic || s.rare) return { msg: "Regal Orb needs a magic jewel", fail: true };
    use(T, orbName("regal")); s.rare = true; s.magic = false;
    const m = addRandom(s, null); return { msg: "Regal: rare jewel" + (m ? ", added " + m.text : ""), mod: m };
  };
  // Omen of Greater Exaltation: the Exalted Orb adds TWO modifiers (Craft of Exile omen OmenOnExaltAddTwoMods)
  A.exaltTwo = (s, T, side) => {
    if (s.magic && !s.rare) return { msg: "An Exalted Orb needs a rare jewel (use Regal first)", fail: true };
    use(T, orbName("exalt")); use(T, "Omen of Greater Exaltation"); if (side) use(T, OMEN.exalt[side]); s.rare = true;
    const a = addRandom(s, side), b = addRandom(s, side), got = [a, b].filter(Boolean);
    return { msg: got.length ? "Exalt with the Omen of Greater Exaltation added " + got.map((m) => m.text).join(" and ") : "Exalt failed: no room", mod: a };
  };
  // Corruption (Craft of Exile: Vaal Orb in Currencies, Architect's Orb under Temple). Outcomes of a Vaal Orb on a rare jewel (maxroll, via corrupt.js): nothing happens / 1 to 3 modifiers are
  // randomised / a corruption enchantment is added / a modifier is added or removed ignoring the normal limit. The odds are not published: assumed 1 in 4 each.
  function addEnchant(s) {
    const have = new Set((s.enchants || []).map((e) => e.text0));
    const c = (POOLS[colour].corrupted || []).filter((m) => !have.has(m.text));
    if (!c.length) return null;
    const m = pick(c), q = rollQ(m.text), e = { text0: m.text, fam: m.family.join(","), text: renderText(m.text, q) };   // [lesson 24] fam links it to its upgraded version
    (s.enchants = s.enchants || []).push(e);
    return e;
  }
  A.vaal = (s, T) => {
    if (s.corrupted) return { msg: "The jewel is already corrupted", fail: true };
    use(T, "Vaal Orb"); s.corrupted = true;
    const r = rint(4);
    if (r === 0) return { msg: "Vaal Orb: nothing happens (the jewel is corrupted now)" };
    if (r === 1) {
      const k = 1 + rint(3), swaps = [];
      for (let i = 0; i < k; i++) {
        const c = unlocked(s).filter((m) => m.kind !== "unrevealed" && m.kind !== "crafted");
        if (!c.length) break;
        const old = pick(c); s.mods.splice(s.mods.indexOf(old), 1);
        const nm = addRandom(s, old.side); swaps.push(old.text + " -> " + (nm ? nm.text : "nothing"));
      }
      return { msg: "Vaal Orb randomised " + swaps.length + " mod(s): " + swaps.join("; ") };
    }
    if (r === 2) { const e = addEnchant(s); return { msg: "Vaal Orb: a corruption enchantment was added: " + (e ? e.text : "none left") }; }
    if (rng() < 0.5) {
      const cands = [].concat(eligible(s, "P", false), eligible(s, "S", false));
      if (!cands.length) return { msg: "Vaal Orb: a modifier was to be added but none fits" };
      const m = newMod(pick(cands)); s.mods.push(m); return { msg: "Vaal Orb added " + m.text + " ignoring the limit (now " + count(s, "P") + " prefixes and " + count(s, "S") + " suffixes)", mod: m };
    }
    const c = unlocked(s).filter((m) => m.kind !== "unrevealed");
    if (!c.length) return { msg: "Vaal Orb: a modifier was to be removed but none can be" };
    const old = pick(c); s.mods.splice(s.mods.indexOf(old), 1); return { msg: "Vaal Orb removed " + old.text, removed: old };
  };
  // [lesson 24] Yugul's Orb of Sacrifice (poe2wiki): on a corrupted RARE jewel it upgrades a corruption enchantment and removes a random modifier. The upgraded values are poe2db's
  // "corruption_upgrade" list; an enchantment with no upgraded version (Immune to Maim, ...) cannot be upgraded. Which modifier is removed is not published: assumed any one that is not fractured.
  A.sacrifice = (s, T) => {
    if (!s.corrupted) return { msg: "Yugul's Orb of Sacrifice needs a corrupted jewel", fail: true };
    if (!s.rare) return { msg: "Yugul's Orb of Sacrifice needs a rare jewel", fail: true };
    const ups = POOLS[colour].corruption_upgrade || [], famUp = (e) => ups.find((u) => u.family.join(",") === e.fam);
    const cand = (s.enchants || []).filter((e) => !e.upgraded && e.fam && famUp(e));
    if (!cand.length) return { msg: "No enchantment on this jewel has an upgraded version", fail: true };
    const rem = unlocked(s).filter((m) => m.kind !== "unrevealed");
    if (!rem.length) return { msg: "There is no modifier to remove", fail: true };
    use(T, "Yugul's Orb of Sacrifice");
    const e = pick(cand), u = famUp(e), gone = pick(rem);
    s.mods.splice(s.mods.indexOf(gone), 1);
    const before = e.text; e.text = renderText(u.text, rollQ(u.text)); e.upgraded = true;
    return { msg: "Yugul's Orb of Sacrifice removed " + gone.text + " and upgraded " + before + " to " + e.text, removed: gone };
  };
  A.architect = (s, T) => {   // Temple of Atziri: 50% another corruption enchantment, 50% the jewel is destroyed
    if (!s.corrupted) return { msg: "The Architect's Orb needs a corrupted jewel", fail: true };
    use(T, "Architect's Orb");
    if (rng() < 0.5) { s.destroyed = true; s.mods = []; s.enchants = []; return { msg: "Architect's Orb: the jewel is destroyed" }; }
    const e = addEnchant(s); return { msg: "Architect's Orb: another corruption enchantment: " + (e ? e.text : "none left") };
  };
  A.exalt = (s, T, side) => {
    if (s.magic && !s.rare) return { msg: "An Exalted Orb needs a rare jewel (use Regal first)", fail: true };   // [lesson 13]
    use(T, orbName("exalt")); if (side) use(T, OMEN.exalt[side]); s.rare = true; const m = addRandom(s, side); return { msg: m ? "Exalt added " + m.text : "Exalt failed: no room", mod: m }; };
  A.chaos = (s, T, eraseSide) => {
    if (s.magic && !s.rare) return { msg: "A Chaos Orb needs a rare jewel (use Regal first)", fail: true };
    use(T, orbName("chaos")); if (eraseSide) use(T, OMEN.erase[eraseSide]);   // [lesson 3, user] Erasure omens limit what is REMOVED (about 13-20 div each); only Exalts take Exaltation omens
    const c = twoModSide(s, unlocked(s).filter((m) => m.kind !== "unrevealed" && (!eraseSide || m.side === eraseSide)));
    if (!c.length) return { msg: "Chaos: nothing to remove" };
    const r = pick(c); s.mods = s.mods.filter((m) => m !== r);
    const a = addRandom(s, null);
    return { msg: "Chaos removed " + r.text + (a ? ", added " + a.text : ", nothing added"), removed: r, mod: a };
  };
  A.annul = (s, T, side) => {
    use(T, "Orb of Annulment"); if (side) use(T, OMEN.annul[side]);
    const c = unlocked(s).filter((m) => !side || m.side === side);
    if (!c.length) return { msg: "Annulment: nothing to remove" };
    const r = pick(c); s.mods = s.mods.filter((m) => m !== r);
    return { msg: "Annulment removed " + r.text, removed: r };
  };
  A.fracture = (s, T) => {
    use(T, "Fracturing Orb");
    if (s.mods.some((m) => m.locked)) return { msg: "A jewel can be fractured only once", fail: true };   // [lesson 6, user]
    if (s.mods.length < 4) return { msg: "Fracturing Orb needs 4 mods", fail: true };
    const c = s.mods.filter((m) => !m.locked && m.kind === "natural");   // [rules] a desecrated mod counts toward the 4 but cannot be fractured
    if (!c.length) return { msg: "No mod can be fractured", fail: true };
    const r = pick(c); r.locked = true; return { msg: "Fractured " + r.text, mod: r };
  };
  A.desecrate = (s, T, side, useOmen) => {
    use(T, "Preserved Cranium");
    if (s.mods.some((m) => m.kind === "unrevealed" || m.kind === "desecrated")) return { msg: "Already has a desecrated mod", fail: true };
    // [lesson 1, user] with an empty slot on one side only, the desecrated mod goes there without an omen
    const room = ["P", "S"].filter((x) => count(s, x) < limit(s, x));
    if (side && room.length === 1 && room[0] === side) { /* no omen needed */ }
    else if (side && useOmen !== false) use(T, OMEN.necro[side]);
    side = side || (room.length === 1 ? room[0] : pick(["P", "S"]));
    if (count(s, side) >= limit(s, side)) {   // [rules] on a full side a random mod goes first
      const c = unlocked(s).filter((m) => m.side === side);
      if (!c.length) return { msg: "Side full and every mod locked", fail: true };
      const r = pick(c); s.mods = s.mods.filter((m) => m !== r);
    }
    const u = { id: uid++, side, text: "(unrevealed desecrated modifier)", kind: "unrevealed", locked: false, group: "unrevealed", norm: "unrevealed" };
    s.mods.push(u);
    const draw = () => shuffled(eligible(s, side, true)).slice(0, 3);
    s.pending = { mod: u, options: draw(), rerolled: false, draw };
    return { msg: "Desecrated: pick 1 of " + s.pending.options.length + " options", pending: true };
  };
  A.echoes = (s, T) => { if (!s.pending || s.pending.rerolled) return { msg: "No reroll available", fail: true }; use(T, "Omen of Abyssal Echoes"); s.pending.options = s.pending.draw(); s.pending.rerolled = true; return { msg: "Rerolled the 3 options" }; };
  A.choose = (s, T, i) => {
    const o = s.pending.options[i]; const u = s.pending.mod;
    s.mods = s.mods.filter((m) => m !== u); const m = newMod(o, { kind: "desecrated" }); s.mods.push(m); s.pending = null;
    return { msg: "Chose " + m.text, mod: m };
  };
  A.light = (s, T) => {
    use(T, "Omen of Light"); use(T, "Orb of Annulment");
    const r = s.mods.find((m) => m.kind === "desecrated" || m.kind === "unrevealed");
    if (!r) return { msg: "No desecrated mod to remove", fail: true };
    s.mods = s.mods.filter((m) => m !== r); s.pending = null; return { msg: "Omen of Light removed " + r.text, removed: r };
  };
  // [user, PoB] emotions hit a RANDOM unlocked modifier and replace it; each has a Prefix and a Suffix version
  // [Time-Lost] any Ancient Liquid Emotion: removes a random unlocked modifier (same targeting as Contempt/Ferocity: an assumption until the user confirms) and adds
  // the liquid's guaranteed crafted modifier (poe2db: "Removes a random modifier and Augments a Rare jewel with a new guaranteed Crafted modifier")
  // [user, 2026-10-21] a jewel can hold only ONE crafted modifier at a time, and every Liquid Emotion (Contempt and Ferocity included) counts as one:
  // a liquid cannot be applied while any crafted mod is on the jewel; the old one has to be removed first (Annulment, with an omen to aim it).
  const craftedOn = (s) => s.mods.find((m) => m.kind === "crafted");
  const craftedBlock = (s) => { const c = craftedOn(s); return c ? { msg: "A jewel can hold only one crafted modifier: remove \"" + c.text + "\" first", fail: true } : null; };
  A.liquid = (s, T, code) => {
    const L = LIQ.find((x) => x.code === code);
    if (!L) return { msg: "That liquid has no result on " + colour, fail: true };
    const blocked = craftedBlock(s); if (blocked) return blocked;
    use(T, L.name);
    const c = twoModSide(s, unlocked(s).filter((m) => m.kind !== "unrevealed"));
    if (!c.length) return { msg: "Nothing to hit", fail: true };
    const hit = pick(c); const idx = s.mods.indexOf(hit);
    const q = rollQ(L.text);
    const line = { id: uid++, side: L.side, kind: "crafted", locked: false, group: "liq-" + L.code, norm: L.norm, tpl: L.text, q, text: renderText(L.text, q) };
    s.mods[idx] = line;
    return { msg: L.name.replace("Ancient ", "") + " hit " + hit.text + " (a " + (hit.side === "P" ? "prefix" : "suffix") + "), now " + line.text, hit, line };
  };
  A.contempt = (s, T) => {
    const blocked = craftedBlock(s); if (blocked) return blocked;
    use(T, (isTimeLost() ? "Ancient " : "") + "Potent Liquid Contempt");
    const c = twoModSide(s, unlocked(s).filter((m) => m.kind !== "unrevealed"));
    if (!c.length) return { msg: "Nothing to hit", fail: true };
    const hit = pick(c); const idx = s.mods.indexOf(hit);
    const grants = hit.side === "P" ? "S" : "P";
    const line = { id: uid++, side: hit.side, kind: "crafted", locked: false, group: "line-" + hit.id, norm: "line", line: { grants }, text: "+1 " + (grants === "S" ? "Suffix" : "Prefix") + " Modifier allowed" };
    s.mods[idx] = line;
    return { msg: "Contempt hit " + hit.text + " (a " + (hit.side === "P" ? "prefix" : "suffix") + "), now " + line.text, hit, line };
  };
  A.ferocity = (s, T) => {
    if (isTimeLost()) return A.liquid(s, T, "CraftedJewelRadiusLightningResistance");   // on a Time-Lost jewel Ferocity adds notable Lightning Resistance, not Effect of Suffixes
    const blocked = craftedBlock(s); if (blocked) return blocked;
    use(T, "Potent Liquid Ferocity");
    const c = twoModSide(s, unlocked(s).filter((m) => m.kind !== "unrevealed"));
    if (!c.length) return { msg: "Nothing to hit", fail: true };
    const hit = pick(c); const idx = s.mods.indexOf(hit);
    const effect = hit.side === "P" ? "S" : "P";
    const line = { id: uid++, side: hit.side, kind: "crafted", locked: false, group: "eff-" + hit.id, norm: "effect", line: { effect }, text: (40 + rint(21)) + "% increased Effect of " + (effect === "S" ? "Suffixes" : "Prefixes") };   // roll 40-60 [assumed]
    s.mods[idx] = line;
    return { msg: "Ferocity hit " + hit.text + " (a " + (hit.side === "P" ? "prefix" : "suffix") + "), now " + line.text, hit, line };
  };

  // ---------------------------------------------------------------- strategies (Monte Carlo)
  // asking-price medians for a finished spear-crit Emerald (crit chance + crit damage + spear crit damage + crafted Effect of Suffixes), 2026-10-20 trade search
  // (jewel_spear_price_Emerald.json, quality 15+ column for quality): with the spear damage prefix 405 / 545 div, any prefix 250 / 350 div. Rolls within 2 of max add
  // little (+45 / +5 div at the median), so rolls are not priced. Effect of Suffixes 60 adds about +167 (no quality) / +241 (quality) div (matched search, jewel_effect_quality_price_Emerald.json;
  // only 37 and 68 listings). The cap is 60 (user). Asks, not sales.
  // by prefix (jewel_prefix_price_Emerald.json, spear-shape suffixes + Effect, asks): spear damage 405 / 500, attack damage 378 / 500, projectile damage 340 / 643 (plain / quality 15+); any other prefix 250 / 350 (jewel_spear_price_Emerald.json)
  const PREFIX_SALE = { "#% increased damage with spears": { plain: 405, quality: 500 }, "#% increased attack damage": { plain: 378, quality: 500 }, "#% increased projectile damage": { plain: 340, quality: 643 } };
  const SALE = { other: { plain: 250, quality: 350 }, top: { plain: 167, quality: 241 } };
  const effectValue = (s) => { const m = s.mods.find((x) => x.norm === "effect"); const n = m && /(\d+)%/.exec(m.text); return n ? +n[1] : 0; };
  // the price tables are for ONE shape: attack-crit Emerald (crit chance + crit damage for attacks). Any other target set has no price data here.
  const authorShape = () => FOCUS === "S" && colour === "Emerald" && Wanted.S.has("#% increased critical hit chance for attacks") && Wanted.S.has("#% increased critical damage bonus for attack damage");
  const tlSalePrice = (s) => {
    const has = (re) => s.mods.some((m) => re.test(m.text));
    const lines = (has(/Critical Hit Chance for Attacks/i) ? 1 : 0) + (has(/Critical Damage Bonus for Attack Damage/i) ? 1 : 0) + (has(/% increased Attack Speed$/i) ? 1 : 0);
    if (lines < 2) return null;
    const vl = s.mods.some((m) => /Very Large/i.test(m.text));
    return TL_PRICE[vl ? "vl" : "noVl"][Math.min(3, lines)][(s.quality || 0) >= 15 ? "quality" : "plain"];
  };
  const salePrice = (s) => {
    if (colour !== "Time-Lost Emerald" && colour !== "Emerald" && BP()) { const r = basePrice(s); return r && r.price != null ? r.price : null; }   // [lesson 25]
    if (isTimeLost()) return tlSalePrice(s);
    if (!authorShape()) return null;
    const q = (s.quality || 0) >= 15 ? "quality" : "plain";
    const pre = s.mods.find((m) => m.side === "P" && PREFIX_SALE[m.norm]);
    return (pre ? PREFIX_SALE[pre.norm][q] : SALE.other[q]) + (effectValue(s) >= 60 ? SALE.top[q] : 0);
  };
  // Time-Lost Emerald asking prices (2026-10-21 trade search, jewel_timelost_radius_price_Emerald.json; median of the cheapest 20 listings, rare, status any).
  // Lines = radius crit chance + crit damage for attacks (+ attack speed). null = fewer than 20 listings, no usable price.
  // The crafted "Upgrades Radius to Very Large" is the usual last step; a two-line jewel without it asks about 13 div, with it 235 div (user: leaving it off lowers the price a lot).
  const TL_PRICE = { vl: { 2: { plain: 235, quality: 385 }, 3: { plain: 389.5, quality: 480 } }, noVl: { 2: { plain: 13.5, quality: null }, 3: { plain: null, quality: null } } };
  // [lesson 25] the other bases: asking prices per shape from base_prices.js (median of the cheapest 20 rare listings; jewel_base_price.py). A shape is the set of mods the jewel must carry;
  // the most specific shape the jewel satisfies is used. Radius jewels: with or without the crafted Very Large radius. Regular Diamond: with or without the crafted Effect line.
  const BP = () => (window.BASE_PRICES || {})[colour];
  function basePrice(s) {
    const bp = BP(); if (!bp) return null;
    const texts = s.mods.map((m) => m.text);
    const fit = bp.shapes.filter((sh) => sh.needs.every((n) => texts.some((t) => new RegExp(n, "i").test(t)))).sort((a, b) => b.needs.length - a.needs.length)[0];
    if (!fit) return { shape: null };
    const flag = bp.mode === "radius" ? s.mods.some((m) => /Very Large/i.test(m.text)) : s.mods.some((m) => m.norm === "effect");
    return { shape: fit.name, flag, mode: bp.mode, price: (flag ? fit.on : fit.off)[(s.quality || 0) >= 15 ? "quality" : "plain"] };
  }
  function basePriceText(s) {
    const r = basePrice(s);
    if (!r) return "";
    if (!r.shape) return "<span class='dim'>Asking price: no data for this combination of mods (the price tables cover the usual crit, rage and effect shapes).</span>";
    const label = r.mode === "radius" ? (r.flag ? "Very Large radius" : "NO Very Large radius") : (r.flag ? "with the crafted Effect line" : "NO crafted Effect line");
    const shape = r.shape + ", " + label + ((s.quality || 0) >= 15 ? ", quality 15+" : ", no quality");
    return r.price == null ? `<span class='dim'>Asking price (${esc(shape)}): too few listings to price.</span>` : `Asking price (${esc(shape)}): <b>about ${r.price} div</b> <span class='dim'>(asks, not sales)</span>`;
  }
  const tlPriceText = (s, vl) => {
    if (colour !== "Time-Lost Emerald") return basePriceText(s);   // [lesson 25]
    const has = (re) => s.mods.some((m) => re.test(m.text));
    const lines = (has(/Critical Hit Chance for Attacks/i) ? 1 : 0) + (has(/Critical Damage Bonus for Attack Damage/i) ? 1 : 0) + (has(/Increased Attack Speed$|% increased Attack Speed$/i) ? 1 : 0);
    if (lines < 2) return "<span class='dim'>Asking price: no data for fewer than 2 of crit chance, crit damage and attack speed.</span>";
    const p = TL_PRICE[vl ? "vl" : "noVl"][Math.min(3, lines)][(s.quality || 0) >= 15 ? "quality" : "plain"];
    const shape = lines + " of crit chance / crit damage / attack speed, " + (vl ? "Very Large radius" : "NO Very Large radius") + ((s.quality || 0) >= 15 ? ", quality 15+" : ", no quality");
    return p == null ? `<span class='dim'>Asking price (${shape}): too few listings to price.</span>` : `Asking price (${shape}): <b>about ${p} div</b> <span class='dim'>(asks, not sales)</span>`;
  };
  // [lesson 14, user] F = the side that will hold three mods (the focus), O = the other side. Suffix focus is the default; prefix focus mirrors the whole route:
  // Contempt must give +1 PREFIX, the third mod is desecrated onto a prefix, Ferocity gives Effect of Prefixes, Chaos and Exalts aim at suffixes for the other side.
  let FOCUS = "S";
  const F = () => FOCUS, O = () => (FOCUS === "S" ? "P" : "S");
  const C = {};   // measured counters
  const bump = (k) => { C[k] = (C[k] || 0) + 1; };
  const wantedCount = (s, side) => s.mods.filter((m) => m.side === side && isWanted(m)).length;
  // [lesson 15] the last crafted mod: Ferocity's Effect line on a regular jewel; on a Time-Lost jewel Melancholy (Very Large radius), the usual finishing choice
  const hasFinal = (s) => (isTimeLost() ? s.mods.some((m) => m.kind === "crafted" && /Very Large/i.test(m.text)) : hasLine(s, "effect", F()));
  const applyFinal = (s, T) => (isTimeLost() ? A.liquid(s, T, "CraftedJewelRadiusExtraLargeSize") : A.ferocity(s, T));
  function goal(s) { return wantedCount(s, F()) >= 3 && hasFinal(s) && wantedCount(s, O()) >= 1; }

  function newBase(opts, T) {
    T.extra += opts.basePrice;
    const s = { mods: [], rare: true };
    const fs = opts.focus === "P" ? "P" : "S", os = fs === "S" ? "P" : "S";   // [lesson 13] focus side: the two target mods; the other side gets two fillers
    const prem = opts.premiumPair && fs === "S" ? premiumSet() : null;
    const ws = shuffled(NAT.filter((m) => m.side === fs && Wanted[fs].has(m.norm) && (!prem || !prem.size || prem.has(m.norm)))); const fillers = shuffled(NAT.filter((m) => m.side === os && !Wanted[os].has(m.norm)));
    const used = new Set();
    for (const m of ws) { if (s.mods.length >= 2) break; if (!used.has(m.group)) { used.add(m.group); s.mods.push(newMod(m)); } }
    for (const m of fillers) { if (s.mods.filter((x) => x.side === os).length >= 2) break; if (!used.has(m.group)) { used.add(m.group); s.mods.push(newMod(m)); } }
    return s;
  }
  function buildBase(opts, T) {   // [lesson 2] the user's start: make it rare, chaos spam for a suffix, exalt/annul for another, add prefixes
    T.extra += opts.rawBase;
    const s = { mods: [], rare: false };
    if (opts.magicStart) {
      // [lesson 13, user] a bought magic jewel with one target mod; Augmentation; Annulment is a 50/50 on a two-mod jewel (it can take the target mod off: discard and start over); Regal
      T.extra += opts.magicBase;
      const pool = NAT.filter((m) => Wanted[m.side].has(m.norm) && (!opts.premiumPair || !premiumSet().size || m.side !== F() || premiumSet().has(m.norm)));
      if (!pool.length) return null;
      s.magic = true; s.mods.push(newMod(pick(pool))); bump("builds");
      for (let g = 0; g < 80; g++) {
        if (s.mods.length === 1) { A.augment(s, T); bump("magicAugment"); }
        if (s.mods.length === 2 && s.mods.every((m) => isWanted(m))) break;
        A.annul(s, T, null); bump("magicAnnul");
        if (!s.mods.some((m) => isWanted(m))) { bump("magicLost"); return null; }
      }
      if (!(s.mods.length === 2 && s.mods.every((m) => isWanted(m)))) return null;
      A.regal(s, T); bump("regal");
    } else { A.alchemy(s, T); bump("builds"); }
    const prem = opts.premiumPair ? premiumSet() : null;
    const ws = () => s.mods.filter((m) => m.side === F() && isWanted(m) && (!prem || !prem.size || prem.has(m.norm)));
    for (let g = 0; g < opts.maxBuild; g++) {
      if (ws().length >= 2) break;
      if (ws().length === 0) { A.chaos(s, T, opts.eraseS ? F() : null); bump("buildChaos"); continue; }
      if (count(s, F()) < limit(s, F())) { A.exalt(s, T, F()); continue; }
      A.annul(s, T, null);   // plain Annulment: it can hit the wanted suffix, which sends the loop back to Chaos spam
    }
    if (ws().length < 2) return null;
    while (count(s, O()) < 2) { if (!A.exalt(s, T, O()).mod) break; }
    return s;
  }
  // [lesson 4] fracture first: a cheap jewel with ONE wanted suffix, fracture until that suffix is the locked mod, then build the second
  // wanted suffix with Chaos spam. The locked suffix can never be removed, so nothing later has to rebuild both suffixes.
  function fractureFirstBase(opts, T) {
    T.extra += opts.firstBase;
    const s = { mods: [], rare: true };
    const w1 = newMod(pick(NAT.filter((m) => m.side === F() && Wanted[F()].has(m.norm)))); s.mods.push(w1);
    for (let i = 0; i < 3; i++) if (!addRandom(s, null)) break;
    if (s.mods.length < 4) return null;
    A.fracture(s, T); bump("fracture");
    if (s.mods.find((m) => m.locked) !== w1) { bump("fractureMiss"); return null; }
    bump("fractureHit");
    for (let g = 0; g < opts.maxBuild; g++) {
      if (s.mods.filter((m) => m.side === F() && isWanted(m)).length >= 2) break;
      A.chaos(s, T, null); bump("buildChaos");
    }
    if (s.mods.filter((m) => m.side === F() && isWanted(m)).length < 2) return null;
    while (count(s, O()) < 2) { if (!A.exalt(s, T, O()).mod) break; }
    return s;
  }
  function recover(s, opts, T) {   // after a bad Contempt hit on a fractured jewel: remove the wrong-side line, refill, re-add a wanted suffix
    bump("recoverTries");
    for (let g = 0; g < 120; g++) {
      if (s.mods.some((m) => m.line && m.line.grants === O())) { A.annul(s, T, null); continue; }
      if (count(s, O()) < 2) { A.exalt(s, T, null); continue; }
      if (s.mods.filter((m) => m.side === F() && isWanted(m)).length >= 2) return true;
      if (count(s, F()) < limit(s, F())) { A.exalt(s, T, F()); continue; }
      A.annul(s, T, null);
    }
    return false;
  }
  function preDivine(s, T, opts) {   // Divine until both starting suffixes roll at least preDivineMin, so the locked value is not low
    const prem = opts.premiumPair ? premiumSet() : null;
    const pair = () => s.mods.filter((m) => m.side === F() && isWanted(m) && (!prem || !prem.size || prem.has(m.norm)));
    for (let g = 0; g < 3000; g++) {
      if (pair().every((m) => rollOk(m, opts, opts.preDivineMin, s))) return;
      A.divine(s, T); bump("preDivine");
    }
  }
  function craft(opts, T, fractured) {
    let pre = false, s;
    if (opts.fractureFirst) { s = fractureFirstBase(opts, T); fractured = true; pre = true; }
    else s = opts.build ? buildBase(opts, T) : newBase(opts, T);
    if (!s) return false;
    if (fractured && !pre) {
      if (opts.preDivineMin > 0) preDivine(s, T, opts);
      A.fracture(s, T); bump("fracture");
      const f = s.mods.find((m) => m.locked);
      if (!(f && isWanted(f) && f.side === F())) {
        bump("fractureMiss");
        // [lesson 9, user] a miss is sold for what the market gives (it depends on the prefix); credited only when the pair was Divined first
        if (opts.salvage > 0 && opts.preDivineMin > 0 && !opts.continueOnMiss) { T.extra -= opts.salvage; bump("salvaged"); }
        if (!opts.continueOnMiss) return false;   // [lesson 2] a locked prefix leaves 2 wanted suffixes unlocked: Contempt hits one 2 times in 3
        bump("fractureMissContinued");
      } else bump("fractureHit");
    }
    let ok = false;
    for (let i = 0; i < opts.maxContempt; i++) {
      const r = A.contempt(s, T); bump("contempt");
      if (r.line && r.line.line.grants === F()) { bump("contemptGood"); ok = true; break; }
      bump("contemptBad");
      if (!(fractured && opts.recover) || !recover(s, opts, T)) { bump("scrapBadContempt"); return false; }
    }
    if (!ok) return false;
    // desecrate the 3rd wanted suffix (side omen + Cranium + Echoes), Omen of Light after a miss
    let got = false;
    for (let k = 0; k < opts.maxDesecrate && !got; k++) {
      if (s.mods.some((m) => m.kind === "desecrated" || m.kind === "unrevealed")) A.light(s, T);
      A.desecrate(s, T, null); bump("desecrate");
      let w = s.pending.options.find((o) => o.side === F() && Wanted[F()].has(o.norm));
      if (!w && opts.useEchoes) { A.echoes(s, T); w = s.pending.options.find((o) => o.side === F() && Wanted[F()].has(o.norm)); }   // [lesson 22] Craft of Exile methods: tiers, Greater Exaltation, Vaal, Architect. [lesson 21] the Omen of Abyssal Echoes is optional
      if (w) { A.choose(s, T, s.pending.options.indexOf(w)); got = true; bump("desecrateHit"); }
      else { s.pending = null; }
    }
    if (!got) return false;
    // take the +1 line off the prefix side
    for (let g = 0; g < 60 && hasLine(s, "grants", F()); g++) {
      const before = s.mods.filter((m) => m.side === F() && isWanted(m) && !m.locked).length;
      A.annul(s, T, opts.omenLine ? O() : null);
      if (s.mods.filter((m) => m.side === F() && isWanted(m) && !m.locked).length < before) { bump("lineRemovalDamage"); return false; }
    }
    while (count(s, O()) < 2) { if (!A.exalt(s, T, O()).mod) break; }
    // chaos for a wanted prefix on the 2-mod side, then Ferocity (it must hit a prefix, not a wanted suffix)
    for (let cyc = 0; cyc < 40; cyc++) {
      let g = 0;
      // [lesson 17, user] Chaos spam (it only rerolls prefixes once there are 3 suffixes) until BOTH prefixes are target mods, so when the final liquid takes one, a target prefix is left
      const need = hasFinal(s) ? 1 : (opts.bothPrefixes ? 2 : 1);
      while (wantedCount(s, O()) < need && g++ < opts.maxChaos) A.chaos(s, T);
      if (wantedCount(s, O()) < need) return false;
      if (goal(s)) {
        bump("goalReached");
        // [lesson 7, user] finish with Divine Orbs judged on the unlocked wanted suffixes (the fractured one is frozen; prefixes matter less)
        for (let g = 0; g < 400 && (opts.finalDivineMin > 0 || opts.effectMin > 0); g++) {
          const un = s.mods.filter((m) => m.side === F() && isWanted(m) && !m.locked);
          if (un.every((m) => rollOk(m, opts, opts.finalDivineMin, s)) && effectValue(s) >= (opts.effectMin || 0)) break;
          A.divine(s, T); bump("finalDivine");
        }
        if (opts.qualityPct > 0) {   // [lesson 10, user] quality last, after all modifiers are known
          const n = Math.ceil(Math.min(QCAP, opts.qualityPct) / opts.qualityGain);
          for (let i = 0; i < n; i++) A.catalyst(s, T, { name: opts.catalystName, gain: opts.qualityGain });
          bump("catalysts");
          const wsq = s.mods.filter((m) => m.side === F() && isWanted(m)); C.qWanted = (C.qWanted || 0) + wsq.length; C.qHit = (C.qHit || 0) + wsq.filter((m) => catalystHits(opts.catalystName, m)).length;
        }
        const sp = salePrice(s); if (sp != null) { C.sale = (C.sale || 0) + sp; C.saleN = (C.saleN || 0) + 1; } if (sp != null && s.mods.some((m) => m.side === "P" && m.norm === "#% increased damage with spears")) bump("spearPrefix"); if (effectValue(s) >= 60) bump("effect60");
        const ws = s.mods.filter((m) => m.side === F() && isWanted(m)); C.qSum = (C.qSum || 0) + ws.reduce((a, m) => a + (m.q || 0), 0) / Math.max(1, ws.length); C.qN = (C.qN || 0) + 1; return true;
      }
      const r = applyFinal(s, T); bump("ferocity");
      if (r.hit && r.hit.side === F()) { bump("ferocityBad"); return false; }
      bump("ferocityOnPrefix");
    }
    return false;
  }
  // [lesson 16] orbs and materials used per finished jewel: average, typical (P50), bad luck (P90), worst 1% (P99)
  function curStatsOf(perJewel) {
    const keys = new Set(); perJewel.forEach((p) => Object.keys(p).forEach((k) => { if (k !== "__extra") keys.add(k); }));
    const out = {};
    keys.forEach((k) => {
      const arr = perJewel.map((p) => p[k] || 0).sort((a, b) => a - b), qq = (x) => arr[Math.min(arr.length - 1, Math.floor(x * arr.length))];
      out[k] = { mean: arr.reduce((a, b) => a + b, 0) / arr.length, p50: qq(0.5), p90: qq(0.9), p99: qq(0.99) };
    });
    return out;
  }
  function simulate(opts, N) {
    FOCUS = opts.focus === "P" ? "P" : "S";   // [lesson 14]
    ORB_TIER = opts.orbTier || "";   // [lesson 22]
    for (const k in C) delete C[k];
    const costs = [], scraps = [], chaos = [], perJewel = [];
    for (let n = 0; n < N; n++) {
      const T = newT(); let sc = 0;
      for (let a = 0; a < 300; a++) { if (craft(opts, T, opts.fractured)) break; sc++; bump("scrap"); }
      costs.push(costOf(T)); scraps.push(sc); chaos.push(chaosCount(T.cur)); perJewel.push(Object.assign({}, T.cur, { __extra: T.extra || 0 }));
    }
    costs.sort((a, b) => a - b);
    const q = (p) => costs[Math.min(costs.length - 1, Math.floor(p * costs.length))];
    return { mean: costs.reduce((a, b) => a + b, 0) / N, p50: q(0.5), p90: q(0.9), p99: q(0.99), scrapsPer: scraps.reduce((a, b) => a + b, 0) / N, chaosPer: chaos.reduce((a, b) => a + b, 0) / N, N, costs, curStats: curStatsOf(perJewel), extraPer: perJewel.reduce((a, p) => a + p.__extra, 0) / N };
  }

  // ---------------------------------------------------------------- consent gate (user, 2026-10-21): nobody uses the simulator until they tick the box; ticking it is the permission to save data
  const CONSENT_KEY = "ehpic_consent_v1", CONSENT_VERSION = "1";
  let consented = false;
  const GATED = "header, main, #usageBar, #sharedNote";
  function applyConsent(on) {
    consented = on; $("consentGate").hidden = on;
    document.querySelectorAll(GATED).forEach((el) => { if (on) el.removeAttribute("inert"); else el.setAttribute("inert", ""); });
  }
  function postConsent(action) { try { fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: CONSENT_VERSION, action }) }).catch(() => {}); } catch (e) { /* no server */ } }
  function initConsent() {
    const saved = lsGet(CONSENT_KEY), box = $("consentBox"), go = $("consentGo");
    // say truthfully where the data goes
    fetch("/api/ping").then((r) => r.json()).then(() => { $("consentWhere").textContent = "Where: on the computer that runs this simulator, in a file (jewel/craftlog/usage.jsonl). Nothing is sent anywhere unless you choose to export and share it."; })
      .catch(() => { $("consentWhere").textContent = "Where: in this browser only (its local storage). Nothing is sent anywhere unless you download the file and share it."; })
      .then(() => { if (window.EHPIC_COLLECT_URL) $("consentWhere").textContent += " It is also sent to the simulator's author (a private Google Sheet), with a random code, so the author can build probability tables and price projections from everyone's runs. If you withdraw, a withdrawal note with that code is sent so your rows can be deleted."; });
    applyConsent(!!(saved && saved.version === CONSENT_VERSION));
    box.onchange = () => { go.disabled = !box.checked; };
    go.onclick = () => {
      if (!box.checked) return;
      lsSet(CONSENT_KEY, { version: CONSENT_VERSION, ts: Date.now() });
      applyConsent(true); postConsent("given");
      logUsage("consent", { version: CONSENT_VERSION });
    };
    $("consentWithdraw").onclick = () => {
      usageQueue.length = 0; sendToCollector([{ ts: Date.now(), type: "consent_withdrawn", version: CONSENT_VERSION }], false);   // the one thing sent on withdrawal: it lets the author delete this browser's rows
      try { localStorage.removeItem(CONSENT_KEY); } catch (e) { /* ignore */ }
      postConsent("withdrawn"); box.checked = false; go.disabled = true; applyConsent(false);
    };
  }

  // ---------------------------------------------------------------- usage log (user, 2026-10-21): every run and every hand-mode action is saved for later projections
  const PAGE_VERSION = "v42", USAGE_KEY = "ehpic_usage_v1";
  const usageQueue = []; let usageTimer = null, itemId = 0, stepN = 0;
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  function logUsage(type, payload) {
    if (!consented) return;   // [lesson 19] nothing is saved before the player has agreed
    usageQueue.push(Object.assign({ ts: Date.now(), type, page: PAGE_VERSION, base: colour, pricesDate: window.CRAFT_PRICES.date, divineEx: DIV }, payload || {}));
    if (!usageTimer) usageTimer = setTimeout(flushUsage, 2500);
  }
  // [lesson 20] the collection point: after the player has agreed, events also go to the author's Google Sheet when window.EHPIC_COLLECT_URL is set (collect_config.js)
  function collectorId() {   // a random code made here, not an identity: it lets a withdrawal or deletion request be honoured
    let id = null; try { id = localStorage.getItem("ehpic_cid"); } catch (e) { /* storage blocked */ }
    if (!id) { id = "c" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); try { localStorage.setItem("ehpic_cid", id); } catch (e) { /* ignore */ } }
    return id;
  }
  function sendToCollector(batch, viaBeacon) {
    const url = window.EHPIC_COLLECT_URL; if (!url || !batch.length) return;
    const body = JSON.stringify({ id: collectorId(), consent: true, events: batch });   // text/plain and no-cors: Apps Script web apps answer no CORS preflight
    try {
      if (viaBeacon && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=utf-8" }));
      else fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }).catch(() => {});
    } catch (e) { /* the collector is best effort; the local copy is kept anyway */ }
  }
  async function flushUsage() {
    usageTimer = null; if (!usageQueue.length || !consented) return;
    const batch = usageQueue.splice(0, usageQueue.length);
    let saved = false;
    try {
      const r = await fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: batch, consent: true }) });
      saved = r.ok;
    } catch (e) { saved = false; }
    if (!saved) lsSet(USAGE_KEY, (lsGet(USAGE_KEY) || []).concat(batch).slice(-4000));   // no local server (a shared copy): keep them in this browser until downloaded
    sendToCollector(batch, false);
  }
  window.addEventListener("pagehide", () => { if (consented && usageQueue.length) { sendToCollector(usageQueue.slice(), true); try { navigator.sendBeacon("/api/usage", new Blob([JSON.stringify({ events: usageQueue, consent: true })], { type: "application/json" })); } catch (e) { /* ignore */ } } });
  async function downloadUsage() {
    let events = lsGet(USAGE_KEY) || [];
    try { const r = await fetch("/api/usage"); if (r.ok) events = (await r.json()).events.concat(events); } catch (e) { /* static copy */ }
    const blob = new Blob([events.map((e) => JSON.stringify(e)).join("\n")], { type: "application/x-ndjson" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ehpic_usage_" + Date.now() + ".jsonl"; a.click();
  }

  // ---------------------------------------------------------------- probability table for the chosen target mods (user, 2026-10-21)
  function oddsRows() {
    const foc = $("focus").value === "P" ? "P" : "S", oth = foc === "S" ? "P" : "S";
    const nat = (side) => NAT.filter((m) => m.side === side), tgt = (side) => nat(side).filter((m) => Wanted[side].has(m.norm));
    const N = { S: nat("S").length, P: nat("P").length }, Tn = { S: tgt("S").length, P: tgt("P").length };
    // the desecrate options are drawn from the natural AND the desecrated mods of that side (the simulator's eligible() does the same)
    const des = (side) => NAT.concat(DES).filter((m) => m.side === side), dt = (side) => des(side).filter((m) => Wanted[side].has(m.norm));
    const name = (side) => (side === "S" ? "Dextral" : "Sinistral");
    const pd = dt(foc).length / Math.max(1, des(foc).length);
    return [
      ["Exalt or Chaos (no omen) adds a target mod", (Tn.S + Tn.P) / Math.max(1, N.S + N.P)],
      ["Exalt with the " + name(foc) + " omen adds a target mod on the " + (foc === "S" ? "suffix" : "prefix") + " side", Tn[foc] / Math.max(1, N[foc])],
      ["Exalt with the " + name(oth) + " omen adds a target mod on the " + (oth === "S" ? "suffix" : "prefix") + " side", Tn[oth] / Math.max(1, N[oth])],
      ["Desecrate: a target mod among the 3 options", 1 - Math.pow(1 - pd, 3)],
      ["Desecrate with Abyssal Echoes: a target mod among 6 options", 1 - Math.pow(1 - pd, 6)],
      ["Contempt lands the side you need (no fracture)", 0.5],
      ["Contempt lands the side you need (a fractured mod on the three-mod side)", 2 / 3],
      ["The final liquid spares your target mod on the other side (2 mods there)", 0.5],
    ];
  }
  const rollsFor = (p, q) => (p >= 1 ? 1 : p <= 0 ? null : Math.ceil(Math.log(1 - q) / Math.log(1 - p)));
  // each stage of the route with its own odds ---------------------------------------------------------------
  const pctile = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))];
  function stageOneSim(trials) {   // two target suffixes: Chaos spam for the first, Dextral Exalts for the second, plain Annulment when the side is full
    const prem = $("premiumPair").checked ? premiumSet() : null, erase = $("eraseS").checked, chaos = [];
    for (let n = 0; n < trials; n++) {
      const T = newT(), s = { mods: [], rare: false }; A.alchemy(s, T);
      const ws = () => s.mods.filter((m) => m.side === F() && isWanted(m) && (!prem || !prem.size || prem.has(m.norm)));
      for (let g = 0; g < 3000 && ws().length < 2; g++) {
        if (ws().length === 0) A.chaos(s, T, erase ? F() : null);
        else if (count(s, F()) < limit(s, F())) A.exalt(s, T, F());
        else A.annul(s, T, null);
      }
      chaos.push(chaosCount(T.cur));
    }
    chaos.sort((x, y) => x - y);
    return { avg: chaos.reduce((x, y) => x + y, 0) / trials, n50: pctile(chaos, 0.5), n90: pctile(chaos, 0.9), n99: pctile(chaos, 0.99) };
  }
  // exact: two prefix slots. Each Chaos removes one of the two at random and adds a random prefix that cannot repeat a group already on the jewel, so the chance of adding a target depends on how
  // many targets are still unheld: (T - r) / (N - 1) with r targets among the remaining prefixes. Done when `need` targets are held.
  function prefixChaosDist(T, N, need) {
    if (T < need || N < 2) return null;
    const pa = (r) => Math.max(0, (T - r) / (N - 1)), p0 = T / N;
    let d = [0, 0, 0];
    d[2] = p0 * ((T - 1) / (N - 1)); d[1] = p0 * (1 - (T - 1) / (N - 1)) + (1 - p0) * (T / (N - 1)); d[0] = 1 - d[1] - d[2];
    let done = d.slice(need).reduce((x, y) => x + y, 0), mean = 0, n50 = null, n90 = null, n99 = null;
    d = d.map((v, k) => (k >= need ? 0 : v));
    for (let step = 0; step < 40000 && n99 === null; step++) {
      if (n50 === null && done >= 0.5) n50 = step; if (n90 === null && done >= 0.9) n90 = step; if (n99 === null && done >= 0.99) n99 = step;
      mean += 1 - done;
      const nd = [0, 0, 0];
      for (let k = 0; k < need; k++) {
        const v = d[k]; if (!v) continue;
        for (const [r, pr] of [[k - 1, k / 2], [k, (2 - k) / 2]]) {
          if (pr <= 0 || r < 0) continue;
          const pt = pa(r); nd[r + 1] += v * pr * pt; nd[r] += v * pr * (1 - pt);
        }
      }
      for (let k = need; k <= 2; k++) { done += nd[k]; nd[k] = 0; }
      d = nd;
    }
    return { avg: mean, n50, n90, n99 };
  }
  // [lesson 17b, user] the third suffix is almost always a desecrated mod. Its odds depend on WHICH two target suffixes are already on the jewel: those groups can no longer be offered,
  // so fewer targets remain and the pool is a little smaller. One row per possible starting pair.
  function desecratePairs(foc) {
    const pool = NAT.concat(DES).filter((m) => m.side === foc);
    let tg = NAT.filter((m) => m.side === foc && Wanted[foc].has(m.norm));
    const prem = foc === "S" && $("premiumPair").checked ? premiumSet() : null;
    if (prem && prem.size) tg = tg.filter((m) => prem.has(m.norm));
    const out = [];
    for (let i = 0; i < tg.length; i++) {
      for (let j = i + 1; j < tg.length; j++) {
        const a = tg[i], b = tg[j]; if (a.group === b.group) continue;
        const capped = isDiamond() && CRIT_DMG.test(a.text) && CRIT_DMG.test(b.text);   // two crit damage suffixes already held: no third one is offered
        const elig = pool.filter((m) => m.group !== a.group && m.group !== b.group && !(capped && CRIT_DMG.test(m.text))), left = elig.filter((m) => Wanted[foc].has(m.norm));
        const p1 = left.length / Math.max(1, elig.length);
        out.push({ a: a.text, b: b.text, left: left.length, eligible: elig.length, p3: 1 - Math.pow(1 - p1, 3), p6: 1 - Math.pow(1 - p1, 6) });
      }
    }
    return out;
  }
  function stageRows() {
    const foc = $("focus").value === "P" ? "P" : "S", oth = foc === "S" ? "P" : "S", saved = FOCUS; FOCUS = foc;
    try {
      const nat = (side) => NAT.filter((m) => m.side === side), tgt = (side) => nat(side).filter((m) => Wanted[side].has(m.norm));
      const pOther = tgt(oth).length / Math.max(1, nat(oth).length);
      const pairs = desecratePairs(foc), avg = (k) => (pairs.length ? pairs.reduce((x, y) => x + y[k], 0) / pairs.length : 0);
      const p3 = avg("p3"), p6 = avg("p6");
      const need = $("bothPrefixes").checked ? 2 : 1;
      const side = (x) => (x === "S" ? "suffix" : "prefix");
      const rows = [];
      if (tgt(foc).length < 2) rows.push({ stage: "1. Two target " + side(foc) + "es on the jewel", unit: "Chaos Orbs", p: null, avg: null, hint: "tick at least 2 target " + side(foc) + "es" });
      if (tgt(foc).length >= 2) { const s1 = stageOneSim(400); rows.push({ stage: "1. Two target " + side(foc) + "es on the jewel (Chaos spam for the first, " + (foc === "S" ? "Dextral" : "Sinistral") + " Exalts for the second)", unit: "Chaos Orbs", p: null, ...s1 }); }
      const geo = (p) => (p > 0 ? { avg: 1 / p, n50: rollsFor(p, 0.5), n90: rollsFor(p, 0.9), n99: rollsFor(p, 0.99) } : null);
      rows.push({ stage: "2. Liquid Contempt gives +1 " + side(foc) + " (the other outcome is +1 " + side(oth) + ")", unit: "Contempt", p: 0.5, ...geo(0.5) });
      const echoes = $("useEchoes").checked, pe = echoes ? p6 : p3;
      rows.push({ stage: echoes ? "3. Desecrate: a target third " + side(foc) + " among the 3 options, and if there is none, one reroll of the 3 options with an Omen of Abyssal Echoes (average over your possible starting pairs, see the list below)"
                                : "3. Desecrate: a target third " + side(foc) + " among the 3 options, no Echoes (average over your possible starting pairs, see the list below)",
                  unit: "Preserved Cranium", p: pe, ...geo(pe), hint: pe > 0 ? null : "no target left after your pair: tick at least 3 target " + side(foc) + "es" });
      const dist = prefixChaosDist(tgt(oth).length, nat(oth).length, need);
      rows.push({ stage: "4. " + (need === 2 ? "Two" : "One") + " target " + side(oth) + (need === 2 ? "es" : "") + " by Chaos spam (once there are 3 " + side(foc) + "es Chaos only rerolls " + side(oth) + "es), so the final liquid can take one and still leave a target", unit: "Chaos Orbs", p: pOther, ...(dist || { avg: null }), hint: dist ? null : "tick at least " + need + " target " + side(oth) + "es" });
      rows.push({ stage: "5. The final liquid takes one " + side(oth) + " and a target " + side(oth) + " is left", unit: "final liquid", p: need === 2 ? 1 : 0.5, ...geo(need === 2 ? 1 : 0.5) });
      const names = { 1: "Two target " + side(foc) + "es", 2: "Contempt: +1 " + side(foc), 3: "Third " + side(foc) + " by desecration" + (echoes ? " (Echoes reroll)" : " (no Echoes)"),
                      4: (need === 2 ? "Two" : "One") + " target " + side(oth) + (need === 2 ? "es" : "") + " by Chaos spam", 5: "Final liquid leaves a target " + side(oth) };
      return rows.map((r) => Object.assign(r, { short: names[parseInt(r.stage, 10)] }));
    } finally { FOCUS = saved; }
  }
  // the same numbers as sentences: "expect about N of this orb"
  function plainSentences(st) {
    const f = (v) => (v == null ? "an unbounded number" : v < 10 ? (Math.round(v * 10) / 10) : Math.round(v));
    const items = st.filter((r) => r.avg != null).map((r) => `<li>${esc(r.stage.replace(/ \(.*$/, ""))}: expect about <b>${f(r.avg)} ${esc(r.unit)}</b>. Half of crafts need more than ${f(r.n50)}, 1 in 10 need more than ${f(r.n90)}, and 1 in 100 need more than ${f(r.n99)}.</li>`).join("");
    return items ? `<ul class="oddsList">${items}</ul>` : "";
  }
  function desecrateTableHtml() {
    const foc = $("focus").value === "P" ? "P" : "S", pairs = desecratePairs(foc), echoes = $("useEchoes").checked;
    if (!pairs.length) return "";
    const short = (x) => esc(x.replace(/^Notable Passive Skills in Radius also grant /, "").replace(/^Small Passive Skills in Radius also grant /, ""));
    const plain = (p) => { const a = rollsFor(p, 0.5), c = rollsFor(p, 0.9); return a == null ? "never" : a + " typically, " + c + " if unlucky"; };
    return `<table><tr><th>Third ${foc === "S" ? "suffix" : "prefix"} by desecration: if the jewel already holds...</th><th class="n">Target mods left to find</th><th class="n">Mods in the pool</th><th class="n">Chance a Cranium shows a target (3 options)</th>${echoes ? '<th class="n">Chance with one Echoes reroll (3 more options)</th>' : ""}<th class="n">Craniums needed</th></tr>` +
      pairs.map((x) => { const p = echoes ? x.p6 : x.p3; return `<tr><td>${short(x.a)} + ${short(x.b)}</td><td class="n">${x.left}</td><td class="n">${x.eligible}</td><td class="n">${(100 * x.p3).toFixed(0)}% (1 in ${Math.round(1 / Math.max(x.p3, 1e-9))})</td>${echoes ? `<td class="n">${(100 * x.p6).toFixed(0)}% (1 in ${Math.round(1 / Math.max(x.p6, 1e-9))})</td>` : ""}<td class="n">${plain(p)}</td></tr>`; }).join("") + `</table>`;
  }
  function renderOdds() {
    if (!$("oddsBox")) return;
    ORB_TIER = $("orbTier") ? $("orbTier").value : "";   // [lesson 22]
    // the table shows what a run will use: the "prefix must be attack or spear damage" box narrows the target prefixes
    const savedP = [...Wanted.P], narrow = $("spearOnly") && $("spearOnly").checked && !isTimeLost();
    if (narrow) { Wanted.P.clear(); Wanted.P.add("#% increased damage with spears"); Wanted.P.add("#% increased attack damage"); }
    let rows, st, pairHtml;
    try { rows = oddsRows(); st = stageRows(); pairHtml = desecrateTableHtml(); } finally { Wanted.P.clear(); savedP.forEach((x) => Wanted.P.add(x)); }
    const cell = (v) => (v == null ? "never" : String(v));
    const f = (v) => (v == null ? "never" : v < 10 ? v.toFixed(1) : String(Math.round(v)));
    const chance = (r) => (r.p == null ? "simulated" : r.p <= 0 ? "none" : (100 * r.p).toFixed(r.p < 0.1 ? 1 : 0) + "%" + (r.p < 0.5 ? " (1 in " + Math.round(1 / r.p) + ")" : ""));
    const chip = (label, v, strong) => `<span class="chip2${strong ? " strong" : ""}"><i>${label}</i> ${v}</span>`;
    const body = st.map((r) => `<div class="stage" title="${esc(r.stage)}"><div class="stageHead"><span><b>${esc(r.short || r.stage)}</b> <span class="dim">${esc(r.unit)}</span></span><span class="chance">${chance(r)}</span></div>` +
      `<div class="chips">${r.avg == null && r.hint ? `<b>${esc(r.hint)}</b>` : chip("Expect", f(r.avg), true) + chip("Typical", cell(r.n50)) + chip("Unlucky", cell(r.n90)) + chip("Very unlucky", cell(r.n99))}</div></div>`).join("");
    const singles = rows.slice(0, 3).map(([s, p]) => `<tr><td>${esc(s)}</td><td class="n">${(100 * p).toFixed(p < 0.1 ? 1 : 0)}%</td><td class="n">${p > 0 ? (1 / p).toFixed(p > 0.5 ? 1 : 0) : "never"}</td><td class="n">${cell(rollsFor(p, 0.5))}</td><td class="n">${cell(rollsFor(p, 0.9))}</td><td class="n">${cell(rollsFor(p, 0.99))}</td></tr>`).join("");
    $("oddsBox").innerHTML = `<h3 class="oddsTitle">Your route, stage by stage</h3>` +
      `<div class="stageList">${body}</div>` +
      `<div class="dim oddsLegend">The chance shown on the right is the chance each time. <b>Expect</b> is the number to plan for. <b>Typical</b>: half of crafts need more than this. <b>Unlucky</b>: 1 in 10 need more. <b>Very unlucky</b>: 1 in 100 need more. Hover a stage for its full description.</div>` +
      `<details><summary>Third-suffix odds for each starting pair</summary>${pairHtml}</details>` +
      `<details><summary>Single rolls (Exalt and Chaos on a fresh rare jewel)</summary><table><tr><th>One orb</th><th class="n">Chance</th><th class="n">Expect</th><th class="n">Typical</th><th class="n">Unlucky</th><th class="n">Very unlucky</th></tr>${singles}</table></details>` +
      `<div class="dim oddsLegend">Every mod is assumed to weigh the same (poe2db and Craft of Exile list weight 1 for jewel mods). Stage 1 is measured by simulation, the others are exact. The run below measures the whole craft including scrapped jewels.</div>`;
    return rows;
  }
  function usageTableHtml(r, N) {
    const names = Object.keys(r.curStats).sort((a, b) => (PRICES[b] || 0) * r.curStats[b].mean - (PRICES[a] || 0) * r.curStats[a].mean);
    const rows = names.map((k) => { const s = r.curStats[k]; const d = ((PRICES[k] || 0) * s.mean) / DIV; return `<tr><td>${esc(k)}</td><td class="n">${s.mean.toFixed(s.mean < 10 ? 2 : 0)}</td><td class="n">${s.p50}</td><td class="n">${s.p90}</td><td class="n">${s.p99}</td><td class="n">${d.toFixed(2)}</td></tr>`; }).join("");
    const cdf = [50, 100, 150, 200, 300, 500, 1000].map((x) => `${Math.round(100 * r.costs.filter((c) => c <= x).length / r.costs.length)} cost ${x} div or less`).join(" &middot; ");
    const finish = (1 / (1 + r.scrapsPer) * 100).toFixed(0);
    return `<table><tr><th>Orbs and materials per finished jewel</th><th class="n">Expect about</th><th class="n">Typical (half need more)</th><th class="n">Unlucky (1 in 10 need more)</th><th class="n">Very unlucky (1 in 100 need more)</th><th class="n">Cost of the average (div)</th></tr>${rows}</table>` +
      `<div class="dim">Chance one attempt finishes without being scrapped: <b>${finish}%</b> (${r.scrapsPer.toFixed(2)} scrapped per finished jewel). Out of 100 finished jewels: ${cdf}.</div>`;
  }

  // ---------------------------------------------------------------- UI: item
  let S = { mods: [], rare: false }, T = newT(), history = [], lesson = { start: Date.now(), events: [] };
  const clone = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === "draw" ? undefined : v)));
  function snapshotText() { return S.mods.map((m) => (m.side === "P" ? "P " : "S ") + m.text + (m.locked ? " [fractured]" : "") + (m.kind === "desecrated" ? " [desecrated]" : "") + (m.kind === "crafted" ? " [crafted]" : "") + (m.kind === "unrevealed" ? " [unrevealed]" : "")).join(" | "); }
  function record(type, text) {
    lesson.events.push({ t: Date.now() - lesson.start, type, text, state: snapshotText(), cost: +costOf(T).toFixed(3) });
    renderLog();
  }
  function modLi(m) {
    const tags = [m.locked ? "<b class='tag fr'>fractured</b>" : "", m.kind === "desecrated" ? "<b class='tag de'>desecrated</b>" : "", m.kind === "crafted" ? "<b class='tag cr'>crafted</b>" : "", m.kind === "unrevealed" ? "<b class='tag un'>unrevealed</b>" : "", isWanted(m) ? "<b class='tag wt'>wanted</b>" : ""].join(" ");
    return `<li class="${m.kind}">${esc(m.text)} ${tags}</li>`;
  }
  const enchantHtml = () => (S.destroyed ? '<div class="bad"><b>Destroyed</b></div>' : S.corrupted
    ? `<div class="enchants"><div class="dim"><b>Corrupted</b>${(S.enchants || []).length ? "" : " (no corruption enchantment)"}</div>${(S.enchants || []).map((e) => `<div class="ench">${esc(e.text)} <span class="tag cr">enchant</span></div>`).join("")}</div>` : "");
  // ---------------------------------------------------------------- the jewel as the game shows it (SVG tooltip card, updated on every change)
  const GEM = { Ruby: ["#5a0a14", "#d4283c", "#ff8a96"], Emerald: ["#0a3d1c", "#1fa650", "#8cf5b0"], Sapphire: ["#0c2a66", "#2b63d6", "#9cc0ff"], Diamond: ["#7d8794", "#d9e1ec", "#ffffff"] };
  const NAME_A = ["Doom", "Dread", "Grim", "Soul", "Gale", "Storm", "Ash", "Blight", "Rune", "Hate", "Mind", "Ghoul", "Havoc", "Spirit", "Beast", "Lust", "Dusk", "Wrath"];
  const NAME_B = ["Eye", "Star", "Heart", "Glance", "Gaze", "Spark", "Shard", "Tear", "Fang", "Bane", "Core", "Thorn", "Vision", "Brand", "Mark", "Pulse"];
  const wrapText = (t, n) => { const w = t.split(" "), out = []; let cur = ""; for (const x of w) { if ((cur + " " + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) out.push(cur); return out; };
  // quality scales the numbers of the mods that carry the catalyst's tag (the game shows the scaled value)
  function qualityText(m) {
    const cat = S.catName || ($("catalystName") ? $("catalystName").value : "");
    if (!S.quality || !cat || m.kind === "unrevealed" || m.kind === "crafted" || !catalystHits(cat, m)) return { text: m.text, scaled: false };
    return { scaled: true, text: m.text.replace(/\d+(?:\.\d+)?/g, (n) => { const v = +n * (1 + S.quality / 100); return Number.isInteger(+n) ? String(Math.round(v)) : v.toFixed(1); }) };
  }
  function gemSvg(x, y, sz) {
    const base = colour.replace("Time-Lost ", ""), c = GEM[base] || GEM.Emerald, tl = isTimeLost(), id = "g" + Math.floor(Math.random() * 1e6), h = sz / 2;
    const pt = (a, b) => (x + a * sz).toFixed(1) + "," + (y + b * sz).toFixed(1);
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[2]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient></defs>` +
      (tl ? `<circle cx="${x + h}" cy="${y + h}" r="${h * 1.08}" fill="none" stroke="#c9a14a" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${x + h}" cy="${y + h}" r="${h * 0.98}" fill="#1b1308" stroke="#c9a14a" stroke-width="1"/>` : "") +
      `<polygon points="${pt(.5, .04)} ${pt(.9, .3)} ${pt(.9, .7)} ${pt(.5, .96)} ${pt(.1, .7)} ${pt(.1, .3)}" fill="url(#${id})" stroke="#0b0b0b" stroke-width="1.5"/>` +
      `<polygon points="${pt(.5, .04)} ${pt(.9, .3)} ${pt(.5, .5)} ${pt(.1, .3)}" fill="#fff" fill-opacity=".28"/>` +
      `<polyline points="${pt(.1, .3)} ${pt(.5, .5)} ${pt(.9, .3)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/><line x1="${x + .5 * sz}" y1="${y + .5 * sz}" x2="${x + .5 * sz}" y2="${y + .96 * sz}" stroke="#fff" stroke-opacity=".35"/>`;
  }
  function jewelCardSvg() {
    const W = 380, wrapAt = 50, rows = [];
    const sep = () => rows.push({ sep: true });
    const base = colour, rare = S.rare, magic = S.magic;
    if (rare && !S.name) S.name = NAME_A[Math.floor(Math.random() * NAME_A.length)] + " " + NAME_B[Math.floor(Math.random() * NAME_B.length)];
    const nameCol = rare ? "#ffff77" : magic ? "#8888ff" : "#c8c8c8";
    if (S.quality) { sep(); rows.push({ prop: { label: "Quality: ", value: "+" + S.quality + "%", ev: "#8888ff" } }); }
    const ench = S.corrupted ? (S.enchants || []).map((e) => e.text) : [];
    if (ench.length) { sep(); ench.forEach((e) => wrapText(e, wrapAt).forEach((l) => rows.push({ t: l, fill: "#b4b4ff" }))); }
    const mods = S.mods.filter((m) => m.side === "P").concat(S.mods.filter((m) => m.side === "S"));
    sep();
    if (!mods.length) rows.push({ t: S.destroyed ? "Destroyed" : "No modifiers", fill: "#777", italic: true });
    for (const m of mods) {
      const q = qualityText(m);
      let fill = "#8888ff", tag = "";
      if (m.locked) { fill = "#a29162"; tag = " (fractured)"; } else if (m.kind === "desecrated") { fill = "#5fcf8f"; tag = " (desecrated)"; } else if (m.kind === "crafted") { fill = "#b4b4ff"; tag = " (crafted)"; } else if (m.kind === "unrevealed") { fill = "#5fcf8f"; }
      const text = m.kind === "unrevealed" ? "Unrevealed Desecrated " + (m.side === "P" ? "Prefix" : "Suffix") : q.text;
      const ls = wrapText(text, wrapAt); ls.forEach((l, i) => rows.push({ t: l, fill, tag: i === ls.length - 1 ? tag : "", bold: q.scaled, italic: m.kind === "unrevealed" }));
    }
    if (S.corrupted || S.destroyed) { sep(); rows.push({ t: S.destroyed ? "Destroyed" : "Corrupted", fill: "#d20000" }); }
    const HEAD = 78, LH = 21, SEP = 14;
    let H = HEAD + 10, body = "";
    for (const r of rows) {
      if (r.sep) { body += `<g transform="translate(0,${H})"><line x1="26" x2="${W - 26}" y1="4" y2="4" stroke="#6b5a3a" stroke-opacity=".8"/><circle cx="${W / 2}" cy="4" r="2.2" fill="#6b5a3a"/></g>`; H += SEP; continue; }
      H += LH;
      if (r.prop) { body += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="14" fill="#7f7f7f">${esc(r.prop.label)}<tspan fill="${r.prop.ev}">${esc(r.prop.value)}</tspan></text>`; continue; }
      body += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="14" fill="${r.fill}"${r.italic ? ' font-style="italic"' : ""}${r.bold ? ' font-weight="bold"' : ""}>${esc(r.t)}${r.tag ? `<tspan fill="#777" font-size="11">${esc(r.tag)}</tspan>` : ""}</text>`;
    }
    H += 14;
    const headFill = rare ? ["#4a3a14", "#241b08"] : magic ? ["#1d1d4a", "#0e0e25"] : ["#3a3a3a", "#1a1a1a"], border = rare ? "#b8a24a" : magic ? "#5a5ab8" : "#777";
    const title = rare ? S.name : base, sub = rare ? base : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" id="jewelCardSvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Fontin SmallCaps','Palatino Linotype',Georgia,serif">` +
      `<defs><linearGradient id="hd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${headFill[0]}"/><stop offset="1" stop-color="${headFill[1]}"/></linearGradient></defs>` +
      `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="3" fill="#0c0b0a" stroke="${border}" stroke-width="2"/>` +
      `<rect x="3" y="3" width="${W - 6}" height="${HEAD - 4}" fill="url(#hd)"/><line x1="3" x2="${W - 3}" y1="${HEAD - 1}" y2="${HEAD - 1}" stroke="${border}"/>` +
      gemSvg(14, 17, 44) + gemSvg(W - 58, 17, 44) +
      `<text x="${W / 2}" y="${sub ? 36 : 48}" text-anchor="middle" font-size="21" fill="${nameCol}">${esc(title)}</text>` + (sub ? `<text x="${W / 2}" y="62" text-anchor="middle" font-size="17" fill="${nameCol}">${esc(sub)}</text>` : "") + body + `</svg>`;
  }
  function renderCard() {
    const box = $("jewelCard"); if (!box) return;
    box.innerHTML = jewelCardSvg() + `<div class="row"><button id="saveCard">Save picture (PNG)</button></div>`;
    $("saveCard").onclick = () => {
      const svg = $("jewelCardSvg"), xml = new XMLSerializer().serializeToString(svg), img = new Image();
      img.onload = () => { const c = document.createElement("canvas"), k = 2; c.width = svg.viewBox.baseVal.width * k; c.height = svg.viewBox.baseVal.height * k; const g = c.getContext("2d"); g.scale(k, k); g.drawImage(img, 0, 0); const a = document.createElement("a"); a.download = "jewel.png"; a.href = c.toDataURL("image/png"); a.click(); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    };
  }
  // [lesson 24] every corruption enchantment the base can get (poe2db), with the chance of each and the upgraded version Yugul's Orb of Sacrifice gives
  function renderCorruptList() {
    const box = $("corruptList"); if (!box) return;
    const P = POOLS[colour], c = P.corrupted || [], u = P.corruption_upgrade || [], n = Math.max(1, c.length);
    const upOf = (m) => u.find((x) => x.family.join(",") === m.family.join(","));
    box.innerHTML = `<table><tr><th>${esc(colour)} corruption enchantment (a Vaal Orb or Architect's Orb picks one of ${c.length} with equal odds, 1 in ${n})</th><th>Upgraded by Yugul's Orb of Sacrifice</th></tr>` +
      c.map((m) => { const up = upOf(m); return `<tr><td>${esc(m.text)}</td><td>${up ? esc(up.text) : '<span class="dim">cannot be upgraded</span>'}</td></tr>`; }).join("") + `</table>`;
  }
  function renderItem() {
    const side = (x, name) => `<div class="side"><h3>${name} <span class="dim">${count(S, x)} / ${limit(S, x)}${limit(S, x) > 2 ? " (+" + (limit(S, x) - 2) + " allowed)" : ""}${count(S, x) > limit(S, x) ? " over the limit" : ""}</span></h3><ul>${S.mods.filter((m) => m.side === x).map(modLi).join("") || "<li class='dim'>empty</li>"}</ul></div>`;
    $("item").innerHTML = `<div class="cardhead">${esc(colour)} jewel${S.rare ? " (rare)" : S.magic ? " (magic)" : " (normal)"} <span class="dim">${S.mods.length} mods${S.quality ? ", quality " + S.quality + "%" : ""}</span></div><div class="sides">${side("P", "Prefixes")}${side("S", "Suffixes")}</div>${enchantHtml()}`;
    renderCard();
    if (repColour !== colour) fillRepTargets();
    const pend = S.pending;
    $("pending").innerHTML = pend ? `<div class="pend"><b>Well of Souls:</b> pick one ${pend.rerolled ? "(rerolled)" : ""}<br>${pend.options.map((o, i) => `<button data-choose="${i}">${esc(o.text)}</button>`).join(" ") || "<span class='dim'>no options</span>"}</div>` : "";
    document.querySelectorAll("[data-choose]").forEach((b) => (b.onclick = () => act("choose", +b.dataset.choose)));
    let tl = "", total = 0;
    for (const k of Object.keys(T.cur).sort((a, b) => (PRICES[b] || 0) * T.cur[b] - (PRICES[a] || 0) * T.cur[a])) { const d = (PRICES[k] || 0) * T.cur[k] / DIV; total += d; tl += `<tr><td>${esc(k)}</td><td class="n">${T.cur[k]}</td><td class="n">${d.toFixed(2)}</td></tr>`; }
    $("cost").innerHTML = `<table><tr><th>Used</th><th class="n">Count</th><th class="n">Divine</th></tr>${tl}<tr><td><b>Total</b></td><td></td><td class="n"><b>${(total + (T.extra || 0)).toFixed(2)}</b></td></tr></table>${T.extra ? `<div class="dim">includes ${T.extra.toFixed(2)} div for the base</div>` : ""}`;
    const g = goal(S);
    if (isTimeLost()) {
      const vl = S.mods.some((m) => /Upgrades Radius to Very Large/i.test(m.text));
      $("goal").innerHTML = `Target notable suffixes: <b>${wantedCount(S, "S")}</b>/3 &nbsp; target small-passive prefixes: <b>${wantedCount(S, "P")}</b> &nbsp; Very Large radius: <b>${vl ? "yes" : "no"}</b> &nbsp; Quality: <b>${S.quality || 0}%</b><br>${tlPriceText(S, vl)}`;
      return;
    }
    $("goal").innerHTML = `Target suffixes: <b>${wantedCount(S, "S")}</b>/3 &nbsp; target prefixes: <b>${wantedCount(S, "P")}</b>/1 &nbsp; Effect of Suffixes line: <b>${hasLine(S, "effect", "S") ? "yes" : "no"}</b> &nbsp; ${g ? "<b class='good'>goal reached</b>" : ""}${["Diamond", "Sapphire", "Ruby"].indexOf(colour) >= 0 ? "<br>" + basePriceText(S) : ""}`;
  }
  function act(name, arg) {
    if (!consented) return { msg: "Agree to the data storage notice first", fail: true };   // [lesson 19]
    ORB_TIER = $("orbTier").value;   // [lesson 22]
    const refuse = (msg) => { record("action", name + ": " + msg); renderItem(); return { msg, fail: true }; };   // say why nothing happened
    if (S.destroyed) return refuse("The jewel is destroyed: start a new one");
    if (S.corrupted && name !== "architect" && name !== "sacrifice" && name !== "catalyst") return refuse("A corrupted jewel cannot be changed (only an Architect's Orb, Yugul's Orb of Sacrifice and quality still work)");
    history.push({ S: clone(S), T: clone(T), poolFn: !!S.pending }); if (history.length > 200) history.shift();
    const before = S.pending;
    const res = A[name](S, T, arg) || {};
    record("action", (name === "exalt" || name === "annul" || name === "desecrate") && arg ? name + " (" + arg + " omen): " + res.msg : name + ": " + res.msg);
    renderItem();
    stepN++;
    logUsage("action", { item: itemId, n: stepN, action: name, arg: arg == null ? null : arg, msg: res.msg, fail: !!res.fail, costDiv: +costOf(T).toFixed(3), quality: S.quality || 0,
                         mods: S.mods.map((m) => ({ side: m.side, text: m.text, kind: m.kind, locked: !!m.locked })) });
    return res;
  }
  function fixPending() {   // after undo the draw function is gone; rebuild it
    if (S.pending && !S.pending.draw) { const side = S.pending.mod.side; S.pending.draw = () => shuffled(eligible(S, side, true)).slice(0, 3); }
  }
  function undo() { const h = history.pop(); if (!h) return; S = h.S; T = h.T; fixPending(); record("note", "(undo)"); renderItem(); }

  // ---------------------------------------------------------------- repeat one orb until a chosen mod is hit (user, 2026-10-21): speeds up hand crafts
  let repColour = null;
  function fillRepTargets() {
    const sel = $("repTarget"); if (!sel) return;
    const keep = sel.value, seen = new Set();
    const opts = NAT.filter((m) => !seen.has(m.norm) && seen.add(m.norm)).sort((a, b) => a.side.localeCompare(b.side) || a.text.localeCompare(b.text));
    sel.innerHTML = '<option value="__goal">any of my target mods</option>' + opts.map((m) => `<option value="${esc(m.norm)}">${m.side === "P" ? "prefix" : "suffix"}: ${esc(m.text)}</option>`).join("");
    if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
    repColour = colour;
  }
  function repeatUntil() {
    if (!consented) return;
    ORB_TIER = $("orbTier").value;
    const msg = (t) => { $("repMsg").textContent = t; const am = $("actMsg"); if (am) { am.textContent = t; am.className = "hint"; } };   // also in the pinned box, so the result shows beside the jewel
    if (S.destroyed || S.corrupted) { msg("A corrupted or destroyed jewel cannot be changed."); return; }
    const [name, side] = $("repAction").value.split("|"), target = $("repTarget").value;
    const minQ = Math.max(0, Math.min(100, +$("repMinRoll").value || 0)) / 100, max = Math.max(1, Math.min(100000, +$("repMax").value || 2000));
    const isHit = () => target === "__goal"
      ? S.mods.some((m) => isWanted(m) && m.q >= minQ - 1e-9)
      : S.mods.some((m) => m.norm === target && m.kind !== "unrevealed" && m.q >= minQ - 1e-9);
    if (isHit()) { msg("The jewel already has that mod at that roll."); return; }
    history.push({ S: clone(S), T: clone(T), poolFn: !!S.pending }); if (history.length > 200) history.shift();
    const cost0 = costOf(T), basePrice = +$("basePrice").value || 0;
    let tries = 0, hit = false, why = "";
    while (tries < max) {
      if (name === "alchemy") { S = { mods: [], rare: false }; T.extra = (T.extra || 0) + basePrice; }
      const res = A[name](S, T, side || null) || {};
      if (res.fail) { why = res.msg; break; }
      tries++;
      if (isHit()) { hit = true; break; }
      if (/nothing to remove|no room/i.test(res.msg || "")) { why = res.msg; break; }   // these answers are not marked as failures, so a loop would spend orbs for nothing
    }
    const spent = costOf(T) - cost0;
    const text = (hit ? "Hit after " : "Not hit after ") + tries + " tries" + (why ? " (stopped: " + why + ")" : "") + ", spent " + spent.toFixed(2) + " div.";
    msg(text); record("action", "repeat " + name + (side ? " (" + side + ")" : "") + " until " + target + " >= " + Math.round(minQ * 100) + "%: " + text); renderItem(); stepN++;
    logUsage("repeat_until", { item: itemId, n: stepN, action: name, arg: side || null, target, minRoll: minQ, tries, hit, costDiv: +spent.toFixed(3), mods: S.mods.map((m) => ({ side: m.side, text: m.text, kind: m.kind, locked: !!m.locked })) });
  }

  function startItem(kind) {
    itemId++; stepN = 0; logUsage("new_item", { kind });
    history = []; S = { mods: [], rare: false }; T = newT(); uid = 1;
    if (kind === "two") { T.extra = +$("basePrice").value || 0; const o = { basePrice: 0 }; const b = newBase(o, newT()); S = b; }
    else if (kind === "twoP") { T.extra = +$("basePrice").value || 0; S = newBase({ basePrice: 0, focus: "P" }, newT()); }   // [lesson 13] prefix-focused start
    else if (kind === "magic") {   // [lesson 13] a bought magic jewel with one target mod (about 1 exalt on the market)
      const pool = NAT.filter((m) => Wanted[m.side].has(m.norm)); T.extra = 0.002;
      S = { mods: [], rare: false, magic: true }; if (pool.length) S.mods.push(newMod(pick(pool)));
    }
    else if (kind === "rare") { A.alchemy(S, T); }
    record("note", "new " + colour + " jewel (" + kind + ")");
    renderItem();
  }

  // ---------------------------------------------------------------- paste an item copied in game (Ctrl+C, or Ctrl+Alt+C for the advanced text)
  // [lesson 23] the plain copy has no prefix/suffix headers, so each line is matched to the base's mod lists by its wording; unmatched lines are reported, never guessed
  function parseJewel(raw) {
    const lines = String(raw).replace(/\r/g, "").replace(/[   ]/g, " ").split("\n").map((l) => l.trim()).filter((l) => l && !/^-{3,}$/.test(l));
    const out = { colour: null, rarity: null, quality: 0, corrupted: false, mods: [], enchants: [], unmatched: [] };
    const head = lines.filter((l) => !/^(item class|rarity|item level|requires|quality|radius)\b/i.test(l)).slice(0, 4).join(" ");
    const tl = /time-lost\s+(ruby|emerald|sapphire|diamond)/i.exec(head), pl = /\b(ruby|emerald|sapphire|diamond)\b/i.exec(head), cap = (w) => w[0].toUpperCase() + w.slice(1).toLowerCase();
    out.colour = tl ? "Time-Lost " + cap(tl[1]) : pl ? cap(pl[1]) : null;
    let hint = null;   // side from an advanced-copy header such as { Prefix Modifier "Fatal" (Tier: 1) }
    const ri = lines.findIndex((l) => /^rarity:/i.test(l)); if (out.rarity === null && ri >= 0 && lines[ri + 2] && lines[ri + 1] && /rare/i.test(lines[ri])) out.name = lines[ri + 1];
    for (const l of lines) {
      let m;
      if ((m = /^rarity:\s*(\w+)/i.exec(l))) { out.rarity = m[1].toLowerCase(); continue; }
      if ((m = /^quality:\s*\+?(\d+)%/i.exec(l))) { out.quality = +m[1]; continue; }
      if (/^corrupted$/i.test(l)) { out.corrupted = true; continue; }
      if (/^(item class|item level|requires|radius|limited to|note|unidentified|mirrored|sanctified|place into|right click|can be used|use )/i.test(l)) continue;
      if (/^\{.*\}$/.test(l)) { hint = /prefix/i.test(l) ? "P" : /suffix/i.test(l) ? "S" : null; continue; }
      const tags = (l.match(/\((fractured|desecrated|crafted|enchant|implicit|rune)\)/gi) || []).join(" ").toLowerCase();
      const body = l.replace(/\s*\((fractured|desecrated|crafted|enchant|implicit|rune)\)/gi, "").replace(/(\d)\((?:\d+(?:\.\d+)?)-(?:\d+(?:\.\d+)?)\)/g, "$1").trim();
      if (!/\d|#|unrevealed|allowed|radius/i.test(body)) { if (lines.indexOf(l) > 3) out.unmatched.push(l); hint = null; continue; }   // flavour text, names and similar
      if (tags.indexOf("enchant") >= 0) { out.enchants.push(body); hint = null; continue; }
      const h = hint; hint = null;
      if (/^unrevealed/i.test(body)) { out.mods.push({ kind: "unrevealed", side: /prefix/i.test(body) ? "P" : /suffix/i.test(body) ? "S" : h, text: body, fractured: false }); continue; }
      out.mods.push({ body, tags, hint: h, fractured: tags.indexOf("fractured") >= 0 });
    }
    return out;
  }
  function applyJewel(p) {
    const msgs = [];
    if (!p.colour || !POOLS[p.colour]) return { ok: false, msg: "This does not look like a jewel I know (Ruby, Emerald, Sapphire, Diamond, or the Time-Lost versions). Copy the item in game with Ctrl+C while hovering it." };
    if (p.rarity === "unique") return { ok: false, msg: "Unique jewels have fixed mods, there is nothing to craft." };
    if (colour !== p.colour) { $("colour").value = p.colour; setColour(p.colour); }
    itemId++; stepN = 0; logUsage("new_item", { kind: "pasted" });
    history = []; T = newT(); T.extra = Math.max(0, +($("pastePrice") || {}).value || 0); uid = 1;
    S = { mods: [], rare: p.rarity === "rare", magic: p.rarity === "magic" }; if (p.name) S.name = p.name;
    if (p.quality) S.quality = p.quality;
    for (const x of p.mods) {
      if (x.kind === "unrevealed") { if (!x.side) { msgs.push("Could not tell which side the unrevealed modifier is on: " + x.text); continue; } S.mods.push({ id: uid++, side: x.side, text: "(unrevealed desecrated modifier)", kind: "unrevealed", locked: false, group: "unrevealed", norm: "unrevealed" }); continue; }
      const n = norm(x.body), num = (/-?\d+(?:\.\d+)?/.exec(x.body) || [])[0];
      let m;
      if ((m = /([+-]?\d+)\s+(prefix|suffix)(?:es)?\s+modifiers?\s+allowed/i.exec(x.body))) {   // Liquid Contempt: sits on the other side from the slot it grants
        const grants = /prefix/i.test(m[2]) ? "P" : "S";
        S.mods.push({ id: uid++, side: x.hint || (grants === "P" ? "S" : "P"), kind: "crafted", locked: false, group: "line-" + uid, norm: "line", line: { grants }, text: x.body }); continue;
      }
      if ((m = /(\d+(?:\.\d+)?)\s*%[^%]*?\beffect\b[^%]*?\b(prefix|suffix)/i.exec(x.body)) || (m = /\b(prefix|suffix)(?:es)?(?:\s+modifiers?)?\s+(?:have|has)\s+(\d+(?:\.\d+)?)\s*%\s+increased\s+effect/i.exec(x.body)) && (m = [m[0], m[2], m[1]])) {   // Liquid Ferocity
        const effect = /prefix/i.test(m[2]) ? "P" : "S";
        S.mods.push({ id: uid++, side: x.hint || (effect === "P" ? "S" : "P"), kind: "crafted", locked: false, group: "eff-" + uid, norm: "effect", line: { effect }, text: (+m[1]) + "% increased Effect of " + (effect === "S" ? "Suffixes" : "Prefixes") }); continue;
      }
      const want = x.tags.indexOf("desecrated") >= 0 ? [DES, NAT] : [NAT, DES];
      let src = null;
      for (const list of want) { const hits = list.filter((s) => s.norm.replace(/\+#/g, "#") === n.replace(/\+#/g, "#") && (!x.hint || s.side === x.hint)); if (hits.length) { src = hits[0]; break; } }
      if (src) {
        const r = /\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/.exec(src.text), v = num === undefined ? NaN : +num;
        const q = r && isFinite(v) && +r[2] > +r[1] ? Math.max(0, Math.min(1, (v - +r[1]) / (+r[2] - +r[1]))) : 0.5;
        if (r && isFinite(v) && (v < +r[1] - 1e-9 || v > +r[2] + 1e-9)) msgs.push("Roll outside the known range, kept as copied: " + x.body);
        S.mods.push(Object.assign(newMod(src), { q, text: x.body, locked: x.fractured, kind: src.kind })); continue;
      }
      const L = LIQ.find((l) => l.norm === n);
      if (L) { S.mods.push({ id: uid++, side: L.side, kind: "crafted", locked: false, group: "liq-" + L.code, norm: L.norm, tpl: L.text, q: 0.5, text: x.body }); continue; }
      msgs.push("Not recognised for a " + p.colour + ", left out: " + x.body);
    }
    for (const u of p.unmatched) msgs.push("Skipped line: " + u);
    if (p.corrupted) { S.corrupted = true; S.enchants = p.enchants.map((t) => {
        const nn = (x) => norm(x).replace(/\+#/g, "#"), n = nn(t), P = POOLS[colour], v = +((/\d+(?:\.\d+)?/.exec(t) || [])[0]);
        const fits = (m) => nn(m.text) === n && (() => { const r = /\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/.exec(m.text); return !r || !isFinite(v) || (v >= +r[1] && v <= +r[2]); })();
        const base = (P.corrupted || []).find(fits), up = base ? null : (P.corruption_upgrade || []).find(fits);   // the same wording can be the normal or the upgraded enchantment: the rolled value tells which
        const f = base || up; return { text0: base ? base.text : null, fam: f ? f.family.join(",") : "", upgraded: !!up, text: t };
      }); }
    record("note", "pasted " + p.colour + " jewel: " + snapshotText());
    renderItem();
    const np = S.mods.filter((m) => m.side === "P").length, ns = S.mods.filter((m) => m.side === "S").length;
    return { ok: true, msg: "Loaded a " + (S.rare ? "rare" : S.magic ? "magic" : "normal") + " " + p.colour + " with " + np + " prefix" + (np === 1 ? "" : "es") + " and " + ns + " suffix" + (ns === 1 ? "" : "es") + (S.quality ? ", quality " + S.quality + "%" : "") + (S.corrupted ? ", corrupted (cannot be changed)" : "") + "." + (msgs.length ? " " + msgs.join(" | ") : "") };
  }
  function loadPasted(text) {
    const box = $("pasteMsg"), res = applyJewel(parseJewel(text));
    box.textContent = res.msg; box.className = "hint " + (!res.ok || /left out|Skipped|Not recognised|Could not/.test(res.msg) ? "bad" : "");
    return res;
  }

  // ---------------------------------------------------------------- UI: wanted mods
  function buildWanted() {
    const mk = (side) => NAT.filter((m) => m.side === side).sort((a, b) => a.text.localeCompare(b.text)).map((m) => `<label><input type="checkbox" data-w="${side}" value="${esc(m.norm)}" ${Wanted[side].has(m.norm) ? "checked" : ""}> ${esc(m.text)}</label>`).join("");
    $("wantedS").innerHTML = mk("S"); $("wantedP").innerHTML = mk("P");
    document.querySelectorAll("[data-w]").forEach((c) => (c.onchange = () => { c.checked ? Wanted[c.dataset.w].add(c.value) : Wanted[c.dataset.w].delete(c.value); renderItem(); renderOdds(); }));
    renderOdds();
  }
  function setColour(c) {
    loadColour(c); Wanted.S = new Set(); Wanted.P = new Set();   // user 2026-10-22: no target mods are pre-selected; DEFAULT_WANTED is kept only as a reference list
    { const st = ((lsGet(OPT_KEY) || {}).wanted || {})[c]; if (st) { Wanted.S = new Set(st.S); Wanted.P = new Set(st.P); } }   // stored wanted mods (polish)
    // the catalyst follows the base: a Sapphire's target mods are caster mods (Refined Sibilant), the others use attack mods (Refined Reaver); only the player's targets decide in the end
    if ($("diamondNote")) $("diamondNote").hidden = !isDiamond();
    if ($("catalystName")) $("catalystName").value = /Sapphire/.test(c) ? "Refined Sibilant Catalyst" : "Refined Reaver Catalyst";
    buildWanted(); renderCorruptList(); startItem("two");
    const sh = $("starterHint"), bp = (window.BASE_PRICES || {})[c];   // [lesson 26] what a starter jewel really asks on the market
    if (sh) sh.textContent = bp && bp.starter != null ? "Market check: the cheapest rare " + c + " with 4 mods and 2+ target suffixes asks about " + bp.starter + " div (2026-10-21)." : "";
    // Time-Lost: show the liquid picker (only the liquids that exist for this base) and hide the Monte Carlo section, whose routes are not modelled for radius jewels yet
    const tl = isTimeLost();
    $("liquidRow").hidden = !tl; $("simSection").hidden = false; $("tlNote").hidden = !tl;
    $("liquidSel").innerHTML = LIQ.filter((l) => l.code !== "CraftedJewelAdditionalSuffixAllowed" && l.code !== "CraftedJewelAdditionalPrefixAllowed")
      .map((l) => `<option value="${l.code}">${esc(l.name.replace("Ancient ", ""))} (${l.side === "P" ? "prefix" : "suffix"}): ${esc(l.text.replace(/^Notable Passive Skills in Radius also grant /, "notable: ").replace(/^Small Passive Skills in Radius also grant /, "small: "))}</option>`).join("");
  }

  // ---------------------------------------------------------------- UI: teaching log, speech, notes, save
  function fmtT(ms) { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function renderLog() {   // user 2026-10-22: one numbered row per craft step: step number, orb, result, cost so far; notes and speech sit between the steps
    const all = lesson.events, shown = all.slice(-80);
    let n = all.slice(0, all.length - shown.length).filter((e) => e.type === "action" && e.text !== "(undo)").length;   // keep the step numbers when the oldest rows scroll off
    $("log").innerHTML = shown.map((e) => {
      const t = esc(fmtT(e.t));
      if (e.text === "(undo)") return `<div class="ev undo" title="${t}"><span class="stp"></span><span class="act">undo</span><span class="res">last step taken back</span><span class="cst"></span></div>`;
      if (e.type === "action") {
        const k = e.text.indexOf(": "), act = k > 0 ? e.text.slice(0, k) : "", res = k > 0 ? e.text.slice(k + 2) : e.text;
        n++;
        return `<div class="ev step" title="${t}"><span class="stp">${n}</span><span class="act">${esc(act)}</span><span class="res">${esc(res)}</span><span class="cst">${(+e.cost || 0).toFixed(2)} div</span></div>`;
      }
      const lab = e.type === "speech" ? "you said" : e.type === "flag" ? "FLAG" : "note";
      return `<div class="ev ${e.type}" title="${t}"><span class="stp"></span><span class="act">${lab}</span><span class="res">${esc(e.text)}</span><span class="cst"></span></div>`;
    }).join("");
    $("log").scrollTop = $("log").scrollHeight;
  }
  let recog = null, listening = false;
  function setupSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $("micStatus").textContent = "This browser has no speech recognition. Use Chrome or Edge, or dictate into the notes box with Windows dictation (Win+H)."; $("mic").disabled = true; return; }
    recog = new SR(); recog.continuous = true; recog.interimResults = true; recog.lang = "en-US";
    recog.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { const t = r[0].transcript.trim(); if (t) record("speech", t); } else interim += r[0].transcript;
      }
      $("interim").textContent = interim;
    };
    recog.onerror = (e) => { $("micStatus").textContent = "Speech error: " + e.error + (e.error === "not-allowed" ? " (allow the microphone for this page)" : ""); };
    recog.onend = () => { if (listening) { try { recog.start(); } catch (x) { /* already running */ } } else { $("mic").textContent = "Start listening"; $("micStatus").textContent = "Not listening"; } };
  }
  function toggleMic() {
    if (!recog) return;
    if (listening) { listening = false; recog.stop(); return; }
    listening = true; try { recog.start(); $("mic").textContent = "Stop listening"; $("micStatus").textContent = "Listening: talk while you click"; } catch (x) { $("micStatus").textContent = "Could not start: " + x.message; listening = false; }
  }
  // ---- craft log: remember this finished jewel so the market for it can be tracked (see craftlog.py)
  function craftBody() {
    const num = (txt) => { const m = /(\d+(?:\.\d+)?)/.exec(txt); return m ? +m[1] : null; };
    const mods = S.mods.filter((m) => m.kind !== "unrevealed").map((m) => {
      const isEffect = m.norm === "effect";
      const tpl = isEffect ? "#% increased Effect of " + (/Prefixes/.test(m.text) ? "Prefixes" : "Suffixes") : m.tpl || m.text;
      const r = isEffect ? [40, 60] : (rangeOf(m) || [num(m.text), num(m.text)]);
      return { side: m.side, text: m.text, tpl, value: isEffect ? num(m.text) : (rolledValue(m) ?? num(m.text)), lo: r[0], hi: r[1], kind: isEffect || m.kind === "crafted" ? "crafted" : (m.locked ? "fractured" : (m.kind === "desecrated" ? "desecrated" : "explicit")) };
    });
    return { league: ($("logLeague").value || "Standard").trim(), base: colour, source: "jewel_sim", mods, quality: S.quality || 0, quality_type: S.quality ? "Refined catalyst" : null,
             cost_div: costOf(T), spent: T.cur, notes: $("logNote").value, corrupted: !!S.corrupted, enchants: (S.enchants || []).map((e) => e.text) };
  }
  async function logCraft() {
    if (!consented) return;   // [lesson 19]
    $("logMsg").textContent = "Saving...";
    try {
      const body = craftBody();
      const r = await (await fetch("/api/craft/record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      if (r.error) { $("logMsg").textContent = "Not saved: " + r.error; return; }
      lastCraftId = r.id;
      const sold = +$("logSold").value;
      if (sold > 0) await fetch("/api/craft/sold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ craft: r.id, price_div: sold }) });
      $("logMsg").textContent = "Logged as " + r.id + (sold > 0 ? " with your sale of " + sold + " div" : "") + ". Click Check the market to look up this exact item.";
    } catch (e) { $("logMsg").textContent = "Could not reach the local server (start jewel/start.bat)."; }
  }
  let lastCraftId = null;
  async function checkMarket() {
    if (!consented) return;   // [lesson 19]
    if (!lastCraftId) { $("logMsg").textContent = "Log the craft first."; return; }
    $("logMsg").textContent = "Searching the trade site (a few seconds)...";
    try {
      const r = await (await fetch("/api/craft/snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ craft: lastCraftId, force: true }) })).json();
      if (r.error) { $("logMsg").textContent = "Search failed: " + r.error; return; }
      const f = (x) => x.total ? x.total + " listed, cheapest " + x.cheapest.slice(0, 5).join(", ") + " div (median of the cheapest " + x.median_cheapest + ")" : "none listed";
      $("logMsg").innerHTML = "Exact-roll match: " + f(r.match) + "<br>Same mods, any roll: " + f(r.shape);
    } catch (e) { $("logMsg").textContent = "Could not reach the local server."; }
  }
  async function saveLesson() {
    const name = ($("lessonName").value || "lesson").replace(/[^\w\- ]/g, "").trim() || "lesson";
    const body = { name, colour, wanted: { S: [...Wanted.S], P: [...Wanted.P] }, rules, events: lesson.events };
    $("saveMsg").textContent = "Saving...";
    try {
      const r = await fetch("/api/lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      $("saveMsg").textContent = d.error ? "Save failed: " + d.error : "Saved to " + d.path + ". Tell Claude to read it.";
    } catch (e) { $("saveMsg").textContent = "Could not reach the local server (start jewel/start.bat). Download instead."; }
  }
  function downloadLesson() {
    const blob = new Blob([JSON.stringify({ colour, wanted: { S: [...Wanted.S], P: [...Wanted.P] }, rules, events: lesson.events }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "jewel_lesson_" + Date.now() + ".json"; a.click();
  }

  // ---------------------------------------------------------------- UI: Monte Carlo
  function runSim() {
    if (!consented) return;   // [lesson 19]
    const kind = $("strategy").value;
    // the route needs 2 target mods on the focus side (the starting pair) and 1 on the other side; without them a run can never finish
    const fsd = $("focus").value === "P" ? "P" : "S", osd = fsd === "S" ? "P" : "S";
    if (Wanted[fsd].size < 2 || Wanted[osd].size < 1) {
      $("simOut").textContent = "Pick at least 2 target mods on the " + (fsd === "S" ? "suffix" : "prefix") + " side (the three-mod side) and at least 1 on the other side, then Run. " + colour + " has no preset for that: target mods belong to your build.";
      return;
    }
    const opts = { orbTier: $("orbTier").value, useEchoes: $("useEchoes").checked, bothPrefixes: $("bothPrefixes").checked, focus: $("focus").value, effectMin: +$("effectMin").value || 0, qualityPct: +$("qualityPct").value || 0, qualityGain: Math.max(0.1, +$("qualityGain").value || 1), catalystName: $("catalystName").value, salvage: +$("salvage").value || 0, within: $("within").value === "" ? null : +$("within").value, finalDivineMin: (+$("finalDivine").value || 0) / 100, preDivineMin: (+$("preDivine").value || 0) / 100, premiumPair: $("premiumPair").checked, fractureFirst: kind === "fractureFirst", firstBase: 0.1, basePrice: +$("basePrice").value || 0, build: $("startMode").value === "build" || $("startMode").value === "magic", magicStart: $("startMode").value === "magic", rawBase: 0.2, magicBase: 0.002, eraseS: $("eraseS").checked, maxBuild: 400, continueOnMiss: $("continueMiss").checked, maxContempt: 12, maxDesecrate: 80, maxChaos: 600, fractured: kind !== "free", recover: $("recover").checked, omenLine: $("omenLine").checked };
    const N = Math.max(50, Math.min(5000, +$("simN").value || 500));
    $("simOut").textContent = "Running " + N + " crafts...";
    setTimeout(() => {
      const t0 = performance.now();
      // [lesson 12, user] the craft accepts only the two attack-tagged damage prefixes the user sells with (spear damage or attack damage); both are scaled by Refined Reaver quality and sell about equally
      const savedP = [...Wanted.P];
      if ($("spearOnly").checked && !isTimeLost()) { Wanted.P.clear(); Wanted.P.add("#% increased damage with spears"); Wanted.P.add("#% increased attack damage"); }
      let r; try { r = simulate(opts, N); } finally { FOCUS = "S"; Wanted.P.clear(); savedP.forEach((x) => Wanted.P.add(x)); }
      const c = C;
      const pct = (a, b) => (b ? (100 * (c[a] || 0) / b).toFixed(0) + "%" : "n/a");
      $("simOut").innerHTML = `<b>${N} finished jewels</b> (${((performance.now() - t0) / 1000).toFixed(1)} s). Cost per finished jewel, in divine: mean <b>${r.mean.toFixed(0)}</b>, typical (P50) <b>${r.p50.toFixed(0)}</b>, P90 ${r.p90.toFixed(0)}, P99 ${r.p99.toFixed(0)}. Scrapped jewels per finished jewel: <b>${r.scrapsPer.toFixed(2)}</b>. Chaos Orbs clicked per finished jewel (effort): <b>${r.chaosPer.toFixed(0)}</b>.
        <table><tr><th>Measured from the simulation</th><th class="n">Result</th></tr>
        ${opts.fractured ? `<tr><td>Fracturing Orb lands on a target suffix</td><td class="n">${pct("fractureHit", c.fracture)} of ${c.fracture || 0}</td></tr>` : ""}
        <tr><td>Contempt hits a prefix (what you need)</td><td class="n">${pct("contemptGood", c.contempt)} of ${c.contempt || 0}</td></tr>
        ${c.builds ? `<tr><td>Starting jewels built from scratch / Chaos Orbs spent building</td><td class="n">${c.builds} / ${c.buildChaos || 0}</td></tr>` : ""}
        ${c.fractureMiss ? `<tr><td>Fracture locked a prefix (carried on ${c.fractureMissContinued || 0} times)</td><td class="n">${c.fractureMiss}</td></tr>` : ""}
        ${c.finalDivine ? `<tr><td>Divine Orbs spent at the end (per finished jewel)</td><td class="n">${(c.finalDivine / N).toFixed(1)}</td></tr>` : ""}
        ${c.salvaged ? `<tr><td>Fracture misses sold (credited)</td><td class="n">${(c.salvaged / N).toFixed(2)} per finished jewel</td></tr>` : ""}
        ${c.saleN ? `<tr><td>Typical asking price of the finished jewel (${colour === "Emerald" || colour === "Time-Lost Emerald" ? "attack-crit Emerald prices" : colour + " asking prices"}) (Effect of Suffixes strength, quality)</td><td class="n">${(c.sale / c.saleN).toFixed(0)} div; ${(100 * (c.effect60 || 0) / c.saleN).toFixed(0)}% reach 60%, ${(100 * (c.spearPrefix || 0) / c.saleN).toFixed(0)}% carry the spear damage prefix</td></tr><tr><td><b>Profit per finished jewel (asking price minus mean cost)</b></td><td class="n"><b>${(c.sale / c.saleN - r.mean).toFixed(0)} div</b></td></tr>` : `<tr><td>Asking price and profit</td><td class="n">no price data for your target mods (prices exist only for the attack-crit Emerald and the Time-Lost crit shapes)</td></tr>`}
        ${c.catalysts ? `<tr><td>Jewels given quality at the end (finished jewels only)</td><td class="n">${(c.catalysts / N).toFixed(2)} per finished jewel</td></tr>` : ""}
        ${c.qWanted ? `<tr><td>Target suffixes the catalyst actually scales</td><td class="n">${(c.qHit / N).toFixed(2)} of ${(c.qWanted / N).toFixed(2)}</td></tr>` : ""}
        ${c.preDivine ? `<tr><td>Divine Orbs spent before fracturing (per finished jewel)</td><td class="n">${(c.preDivine / N).toFixed(1)}</td></tr>` : ""}
        ${c.qN ? `<tr><td>Average roll of the 3 target suffixes at the end (0% bottom, 100% top)</td><td class="n">${(100 * c.qSum / c.qN).toFixed(0)}%</td></tr>` : ""}
        <tr><td>Bad Contempt hits recovered or scrapped</td><td class="n">${c.recoverTries || 0} recovery attempts, ${c.scrapBadContempt || 0} scrapped</td></tr>
        <tr><td>Desecrate shows a target third suffix (3 or 6 options)</td><td class="n">${pct("desecrateHit", c.desecrate)} of ${c.desecrate || 0}</td></tr>
        <tr><td>Line removal destroyed a target suffix</td><td class="n">${c.lineRemovalDamage || 0} times</td></tr>
        <tr><td>Final liquid (Ferocity, or Melancholy on Time-Lost) hit a target suffix (jewel scrapped)</td><td class="n">${pct("ferocityBad", c.ferocity)} of ${c.ferocity || 0}</td></tr></table>`;
      $("simOut").insertAdjacentHTML("beforeend", usageTableHtml(r, N));
      logUsage("sim_run", { strategy: kind, focus: $("focus").value, startMode: $("startMode").value, N,
        settings: { within: $("within").value, preDivine: $("preDivine").value, finalDivine: $("finalDivine").value, qualityPct: $("qualityPct").value, qualityGain: $("qualityGain").value, catalyst: $("catalystName").value,
                    salvage: $("salvage").value, effectMin: $("effectMin").value, omenLine: $("omenLine").checked, eraseS: $("eraseS").checked, spearOnly: $("spearOnly").checked && !isTimeLost(),
                    premiumPair: $("premiumPair").checked, useEchoes: $("useEchoes").checked, orbTier: $("orbTier").value, basePrice: $("basePrice").value, recover: $("recover").checked, continueMiss: $("continueMiss").checked },
        targets: { S: [...Wanted.S], P: [...Wanted.P] }, result: { mean: r.mean, p50: r.p50, p90: r.p90, p99: r.p99, scrapsPer: r.scrapsPer, chaosPer: r.chaosPer },
        usagePerJewel: r.curStats, extraPerJewel: r.extraPer, counters: Object.assign({}, c), sale: c.saleN ? { avg: c.sale / c.saleN, n: c.saleN } : null,
        profit: c.saleN ? c.sale / c.saleN - r.mean : null, odds: oddsRows().map(([s, p]) => ({ step: s, p })), stages: stageRows(), desecrateByPair: desecratePairs($("focus").value === "P" ? "P" : "S") });
    }, 30);
  }

  // ---------------------------------------------------------------- init

  // [polish 2026-10-22] remember the player's settings and target mods (per base) in this browser; nothing leaves it
  const OPT_KEY = "ehpic_jewel_opts_v3", OPT_SKIP = /^(pasteText|pastePrice|noteBox|flagWhy|consent|simN$|log|lesson)/;   // free text and the craft-log sale price are never carried over
  function saveOpts() {
    const prev = lsGet(OPT_KEY) || {}, o = { colour, controls: {}, wanted: prev.wanted || {} };
    document.querySelectorAll("main input[id], main select[id]").forEach((el) => { if (!OPT_SKIP.test(el.id)) o.controls[el.id] = el.type === "checkbox" ? el.checked : el.value; });
    o.wanted[colour] = { S: [...Wanted.S], P: [...Wanted.P] };
    lsSet(OPT_KEY, o);
  }
  function restoreOpts() {
    const o = lsGet(OPT_KEY); if (!o) return;
    if (o.colour && o.colour !== colour && POOLS[o.colour]) { $("colour").value = o.colour; setColour(o.colour); }
    const w = o.wanted && o.wanted[colour]; if (w) { Wanted.S = new Set(w.S); Wanted.P = new Set(w.P); buildWanted(); }
    for (const id in o.controls || {}) {
      const el = $(id); if (!el || id === "colour") continue;
      if (el.type === "checkbox") el.checked = !!o.controls[id];
      else if (el.tagName === "SELECT") { if ([...el.options].some((op) => op.value === o.controls[id])) el.value = o.controls[id]; }
      else el.value = o.controls[id];
    }
    renderItem(); renderOdds();
  }
  function installPersist() { let t = null; document.addEventListener("change", () => { clearTimeout(t); t = setTimeout(saveOpts, 300); }); }

  // keyboard shortcuts for hand mode: the cheap orbs only (never Fracturing, Vaal, Architect's or the omens that cost whole divines); ignored while typing in a field
  function installShortcuts() {
    const map = { c: "chaos", e: "exalt", a: "annul", d: "divine" };
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target; if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); $("undo").click(); return; }
      if (!map[k]) return;
      const b = document.querySelector('[data-act="' + map[k] + '"]'); if (b && !b.disabled) { e.preventDefault(); b.click(); }
    });
  }

  async function init() {
    initConsent();   // first, so the agreement button works even when the data below cannot be loaded (e.g. the page was opened without the crafter server)
    try { MODTAGS = await (await fetch("jewel_mod_tags.json?v=20261021")).json(); } catch (e) { MODTAGS = {}; }
    try { POOLS = (await (await fetch("jewel_pools.json?v=20261023")).json()).pools; } catch (e) {
      $("item").textContent = "Could not load jewel_pools.json: open this page from the jewel server (start.bat).";
      const le = $("loadError"); if (le) { le.hidden = false; le.textContent = "The simulator's data could not be loaded, so it cannot start. If you are running it yourself: start jewel/start.bat and open http://127.0.0.1:8765/jewel_sim.html (opening the file directly does not work)."; }
      return;
    }
    document.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => { const a = b.dataset.act; let arg = a === "catalyst" ? { name: $("catalystName").value, gain: Math.max(0.1, +$("qualityGain").value || 1) } : null; if (a !== "catalyst") arg = b.dataset.arg === undefined ? null : (b.dataset.arg || null); if (a === "exalt" || a === "exaltTwo") arg = $("exaltSide").value || null; if (a === "chaos") arg = $("chaosSide").value || null; if (a === "desecrate") arg = $("necroSide").value || null; if (a === "liquid") arg = $("liquidSel").value; const r = act(a, arg) || {}; const am = $("actMsg"); if (am) { am.textContent = r.msg || ""; am.className = "hint " + (r.fail ? "bad" : "good"); } }));
    $("colour").onchange = () => setColour($("colour").value);
    $("newTwo").onclick = () => startItem("two"); $("newTwoP").onclick = () => startItem("twoP"); $("newMagic").onclick = () => startItem("magic"); $("newRare").onclick = () => startItem("rare"); $("newBlank").onclick = () => startItem("blank");
    $("undo").onclick = undo;
    $("pasteLoad").onclick = () => { if ($("pasteText").value.trim()) loadPasted($("pasteText").value); };
    $("pasteClip").onclick = async () => { try { const t = await navigator.clipboard.readText(); $("pasteText").value = t; loadPasted(t); } catch (e) { $("pasteMsg").textContent = "The browser did not allow reading the clipboard. Click in the box above, press Ctrl+V, then Load."; } };
    document.addEventListener("paste", (e) => {   // Ctrl+V anywhere outside a text field
      const el = e.target; if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
      const t = (e.clipboardData && e.clipboardData.getData("text")) || ""; if (!/rarity:|item class:/i.test(t)) return;
      $("pasteText").value = t; $("pasteBox").open = true; loadPasted(t); e.preventDefault();
    });
    $("chaosRule").onchange = () => { rules.chaosTwoModSide = $("chaosRule").checked; record("note", "rule: chaos only hits the 2-mod side = " + rules.chaosTwoModSide); };
    $("mic").onclick = toggleMic;
    $("addNote").onclick = () => { const t = $("noteBox").value.trim(); if (t) { record("speech", t); $("noteBox").value = ""; } };
    $("flag").onclick = () => { const why = $("flagWhy").value.trim(); record("flag", "That does not match the game" + (why ? ": " + why : "") + " (last action above)"); $("flagWhy").value = ""; };
    $("focus").onchange = renderOdds; $("useEchoes").onchange = renderOdds; $("spearOnly").onchange = renderOdds; $("bothPrefixes").onchange = renderOdds; $("premiumPair").onchange = renderOdds; if ($("usageDl")) $("usageDl").onclick = downloadUsage;
    $("logCraft").onclick = logCraft; $("logCheck").onclick = checkMarket;
    $("save").onclick = saveLesson; $("download").onclick = downloadLesson;
    $("run").onclick = runSim; $("repGo").onclick = repeatUntil;
    // shared copy (no local server behind it): hide what needs the server
    fetch("/api/ping").then((r) => { if (!r.ok) throw 0; return r.json(); }).catch(() => { document.body.classList.add("static"); $("sharedNote").hidden = false; });
    setupSpeech(); setColour("Emerald"); restoreOpts(); installPersist(); installShortcuts();
    window.JewelSim = { parseJewel, applyJewel, A, simulate, craft, Wanted, newT, costOf, get S() { return S; }, C };
  }
  init();
})();
