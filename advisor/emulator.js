// Click-to-craft emulator: a concrete item with real random rolls (weighted mod pool, rolled values), undo, and costs logged to the cost tracker.
// Loads after app.js, which hands over its helpers as window.CrafterApp. Rules follow engine.js (see references/crafting-rules.md): one fractured mod,
// one desecrated mod at a time, Annulment can remove a desecrated mod, Fracturing needs 4 mods, Greater/Perfect orbs raise the minimum mod level.
(function () {
  "use strict";
  const App = window.CrafterApp, C = window.Crafter, D = window.CRAFT_DATA, CORR = window.CRAFT_CORRUPT;
  const $ = (id) => document.getElementById(id);
  if (!App || !C || !$("emuStart")) return;
  const esc = App.esc, bare = (x) => String(x).replace(/^[DEA]:/, "");
  const TIER = ["", "Greater ", "Perfect "], TIERN = ["Regular", "Greater", "Perfect"];
  const rnd = (n) => Math.floor(Math.random() * n);
  let E = null, pending = null; const hist = [];
  // catalysts (rings, amulets, belts): +5% quality each (max 20%), enhancing the values of mods with their tag; a different catalyst replaces the quality
  const CATS = { Flesh: ["life"], Neural: ["mana"], Carapace: ["defences"], "Uul-Netol's": ["physical"], "Xoph's": ["fire"], "Tul's": ["cold"], "Esh's": ["lightning"], "Chayula's": ["chaos"], Reaver: ["attack"], Sibilant: ["caster"], Skittering: ["speed"], Adaptive: ["attribute"], Necrotic: ["minion"] };
  const QPER = { Normal: 5, Magic: 2, Rare: 1 };      // Armourer's Scrap, Whetstone, Etcher: gain by item rarity (poe2db: 5% normal, 2% magic, 1% rare; rates for the Whetstone and Etcher assumed equal)
  // Vaal Infusers (poe2wiki 'Infuser', based on a test of 1,734 infusers on 314 items): only on items at or above maximum quality; every use adds +1% (+2% with a chance of about 1 in 6 at item level 82),
  // up to +10% beyond the maximum; then the item may corrupt (Corrupted tag only, nothing else changes) with a chance of 5% per point of starting quality above the maximum: 0% at the maximum, 5% one point above, 45% nine above.
  const INFUSER_MAX_BONUS = 10, INFUSER_CORRUPT_PER_POINT = 0.05, INFUSER_P2_AT_82 = 1 / 6;
  function infuseOutcome(start, maxq, ilvl, rand) { const r = rand || Math.random, p2 = INFUSER_P2_AT_82 * Math.min(1, (ilvl || 82) / 82); const add = Math.min(r() < p2 ? 2 : 1, maxq + INFUSER_MAX_BONUS - start); return { add, corrupt: r() < INFUSER_CORRUPT_PER_POINT * Math.max(0, start - maxq) }; }
  window.__infuseOutcome = infuseOutcome;
  const SOCKET_CAP = 3;                               // most Augment Sockets Artificer's Orbs add here: the real limit per base is not in the data
  const LICH = { Sovereign: "ulaman_mod", Liege: "amanamu_mod", Blackblooded: "kurgal_mod" };
  const OTHERWORLDLY_CHANCE = 1 / 3;                  // chance an Altered Collarbone offer is an otherworldly mod: unpublished, assumed

  // ---------- helpers ----------
  const side2 = (s) => (s === "P" ? "Prefix" : "Suffix");
  function rollText(text) {
    return String(text).replace(/\((-?[\d.]+)-(-?[\d.]+)\)/g, (m, a, b) => {
      const lo = parseFloat(a), hi = parseFloat(b), dec = /\./.test(a + b);
      if (!dec) return String(lo + rnd(hi - lo + 1));
      const v = lo + Math.random() * (hi - lo); return String(+v.toFixed(2));
    });
  }
  const groupsNow = () => C.groupsFor(E.base, E.ilvl, E.aug);
  const limits = () => (E.rarity === "Magic" ? { P: 1, S: 1 } : C.slotLimits(E.base));
  const countSide = (s) => E.mods.filter((m) => m.side === s).length;
  const room = (s) => limits()[s] - countSide(s);
  const hasGroup = (k) => E.mods.some((m) => bare(m.group) === bare(k));
  const modLine = (m) => `${side2(m.side)}: ${m.text}${m.tier ? ` (T${m.tier})` : m.otherworldly ? " (otherworldly)" : ""}`;
  const price = (n) => App.rate(n) || 0;
  const costOf = (comps) => comps.reduce((a, n) => a + price(n), 0);
  const boneClass = () => { const b = D.bases[E.base] || { ty: "", tg: [] }; if (/Ring|Amulet|Belt/.test(b.ty)) return "Collarbone"; if (b.tg.includes("weapon") || b.ty === "Quiver") return "Jawbone"; return "Rib"; };

  function makeMod(k, gr, t, kind) {
    return { group: k, id: t.id, side: gr.side, lv: t.lv, text: rollText(t.text), range: t.text, tier: gr.tiers.indexOf(t) + 1, kind, locked: false, tags: t.tg || [] };
  }
  // a random natural mod: weighted over every (group, tier) allowed by the minimum level, side and free slots
  function addRandom(opts) {
    const g = groupsNow(), entries = []; let tot = 0;
    for (const k in g) {
      const gr = g[k]; if (gr.d || gr.c || hasGroup(k)) continue;
      if (room(gr.side) <= 0 || (opts.side && gr.side !== opts.side)) continue;
      for (const t of gr.tiers) if (t.lv >= (opts.aMin || 1) && t.w > 0) { const w = t.w * (opts.boost && (t.tg || []).some((x) => opts.boost.tags.includes(x)) ? opts.boost.mult : 1); entries.push({ k, gr, t, w }); tot += w; }
    }
    if (!entries.length) return null;
    let x = Math.random() * tot, pick = entries[entries.length - 1];
    for (const e of entries) { x -= e.w; if (x < 0) { pick = e; break; } }
    const m = makeMod(pick.k, pick.gr, pick.t, opts.kind || "natural"); E.mods.push(m); return m;
  }
  const unlocked = (side) => E.mods.filter((m) => !m.locked && (!side || m.side === side));
  const removeMod = (m) => { E.mods.splice(E.mods.indexOf(m), 1); };

  // ---------- quality ----------
  const maxQ = () => 20 + E.mods.reduce((a, m) => { const x = /\+(\d+)% to Maximum Quality/i.exec(m.text); return a + (x ? +x[1] : 0); }, 0);
  const catTags = () => (E.qCat ? CATS[E.qCat] || [] : []);
  const qHits = (m) => E.quality > 0 && catTags().length && (m.tags || []).some((x) => catTags().includes(x));
  const disp = (m) => (qHits(m) ? m.text.replace(/\d+(?:\.\d+)?/g, (n) => { const v = +n * (1 + E.quality / 100); return Number.isInteger(+n) ? String(Math.round(v)) : v.toFixed(1); }) : m.text);
  const itemTy = () => (D.bases[E.base] || {}).ty || "";
  const isJewellery = () => /Ring|Amulet|Belt/.test(itemTy());
  const isRingAmulet = () => /Ring|Amulet/.test(itemTy());   // catalysts and the Catalysing Infuser: "a ring or amulet" (poe2db), belts are not included
  const isArmour = () => /Body Armour|Helmet|Gloves|Boots|Shield/.test(itemTy());
  const isCaster = () => /Wand|Staff|Sceptre/.test(itemTy());
  const isMartial = () => (D.bases[E.base] || { tg: [] }).tg.includes("weapon") && !isCaster();
  const qualityItem = () => (isArmour() ? ["Armourer's Scrap", "Vaal Armourer's Infuser"] : isCaster() ? ["Arcanist's Etcher", "Vaal Arcanist's Infuser"] : isMartial() ? ["Blacksmith's Whetstone", "Vaal Blacksmith's Infuser"] : isRingAmulet() ? [null, "Vaal Catalysing Infuser"] : [null, null]);
  const modLineD = (m) => `${side2(m.side)}: ${disp(m)}${m.tier ? ` (T${m.tier})` : ""}`;

  // ---------- actions: each returns {ok, name, comps, msg} ----------
  const fail = (msg) => ({ ok: false, msg });
  const ACT = {
    transmute(t) { if (E.rarity !== "Normal") return fail("Needs a normal item."); E.rarity = "Magic"; const m = addRandom({ aMin: C.MIN_LV.transmute[t] }); return m ? { ok: true, name: TIER[t] + "Orb of Transmutation", comps: [TIER[t] + "Orb of Transmutation"], msg: "Now magic: " + modLine(m) } : (E.rarity = "Normal", fail("No mod could be added.")); },
    augment(t) { if (E.rarity !== "Magic") return fail("Needs a magic item."); if (room("P") + room("S") <= 0) return fail("No free slot."); const m = addRandom({ aMin: C.MIN_LV.augment[t] }); return m ? { ok: true, name: TIER[t] + "Orb of Augmentation", comps: [TIER[t] + "Orb of Augmentation"], msg: "Added " + modLine(m) } : fail("No mod could be added."); },
    regal(t) { if (E.rarity !== "Magic") return fail("Needs a magic item."); E.rarity = "Rare"; const m = addRandom({ aMin: C.MIN_LV.regal[t] }); return m ? { ok: true, name: TIER[t] + "Regal Orb", comps: [TIER[t] + "Regal Orb"], msg: "Now rare: added " + modLine(m) } : (E.rarity = "Magic", fail("No mod could be added.")); },
    alchemy() { if (E.rarity === "Rare") return fail("Needs a normal or magic item."); E.rarity = "Rare"; E.mods = E.mods.filter((m) => m.locked); const got = []; for (let i = 0; i < 4; i++) { const m = addRandom({}); if (m) got.push(modLine(m)); } return { ok: true, name: "Orb of Alchemy", comps: ["Orb of Alchemy"], msg: "Now rare: " + got.join("; ") }; },
    exalt(t, sd, two, cat) {
      if (E.rarity !== "Rare") return fail("Needs a rare item.");
      if (cat && !(E.quality > 0 && E.qCat)) return fail("Omen of Catalysing Exaltation needs catalyst quality on the item.");
      const boost = cat ? { tags: catTags(), mult: E.quality <= 20 ? 1 + (E.quality / 20) * 4 : 5 + ((E.quality - 20) / 20) * 2.5 } : null; // poe2wiki: weight x5 at 20% quality, x7.5 at 40% (unconfirmed)
      const got = []; for (let i = 0; i < (two ? 2 : 1); i++) { if (sd ? room(sd) <= 0 : room("P") + room("S") <= 0) break; const m = addRandom({ aMin: C.MIN_LV.exalt[t], side: sd, boost }); if (m) got.push(modLine(m)); }
      if (cat && got.length) E.quality = 0;
      if (!got.length) return fail("No free slot" + (sd ? " on that side" : "") + ".");
      const comps = [TIER[t] + "Exalted Orb"].concat(sd ? ["Omen of " + (sd === "P" ? "Sinistral" : "Dextral") + " Exaltation"] : []).concat(two ? ["Omen of Greater Exaltation"] : []).concat(cat ? ["Omen of Catalysing Exaltation"] : []);
      return { ok: true, name: comps.join(" + "), comps, msg: "Added " + got.join("; ") + (cat ? " (the catalyst quality was used up)" : "") };
    },
    chaos(t, mode) {
      if (E.rarity !== "Rare") return fail("Needs a rare item.");
      const sd = mode === "SinistralErasure" ? "P" : mode === "DextralErasure" ? "S" : null, cands = unlocked(sd);
      if (!cands.length) return fail("No mod that can be removed" + (sd ? " on that side" : "") + ".");
      let victim;
      if (mode === "Whittling") { const low = Math.min(...cands.map((m) => (m.kind === "unrevealed" ? 65 : m.lv))); const ties = cands.filter((m) => (m.kind === "unrevealed" ? 65 : m.lv) === low); victim = ties[rnd(ties.length)]; } else victim = cands[rnd(cands.length)];
      removeMod(victim);
      const added = addRandom({ aMin: C.MIN_LV.chaos[t] });
      const comps = [TIER[t] + "Chaos Orb"].concat(mode === "Whittling" ? ["Omen of Whittling"] : sd ? ["Omen of " + (sd === "P" ? "Sinistral" : "Dextral") + " Erasure"] : []);
      return { ok: true, name: comps.join(" + "), comps, msg: `Removed ${modLine(victim)}${added ? "; added " + modLine(added) : "; nothing could be added"}` };
    },
    annul(mode) {
      if (E.rarity === "Normal") return fail("Needs a magic or rare item.");
      const sd = mode === "SinistralAnnulment" ? "P" : mode === "DextralAnnulment" ? "S" : null;
      let cands = unlocked(sd); if (mode === "Light") cands = cands.filter((m) => m.kind === "desecrated" || m.kind === "unrevealed");
      if (!cands.length) return fail(mode === "Light" ? "No desecrated mod to remove." : "No mod that can be removed.");
      const v = cands[rnd(cands.length)]; removeMod(v);
      const comps = ["Orb of Annulment"].concat(mode === "Light" ? ["Omen of Light"] : sd ? ["Omen of " + (sd === "P" ? "Sinistral" : "Dextral") + " Annulment"] : []);
      return { ok: true, name: comps.join(" + "), comps, msg: "Removed " + modLine(v) };
    },
    essence(name, crystal) {
      const e = D.essences[name], etype = (D.bases[E.base] || {}).ty, mid = e && e.m && e.m[etype], gm = mid && D.mods[mid];
      if (!gm) return fail("That essence has no mod for this item type.");
      const perfect = /^Perfect /.test(name) || /Corrupted/.test(e.ty || "") || e.tl === 1;
      const comps = [name];
      if (!perfect) {
        if (E.rarity !== "Magic") return fail("Lesser, normal and Greater essences work on a magic item.");
        E.rarity = "Rare";
      } else {
        if (E.rarity !== "Rare") return fail("Perfect essences work on a rare item.");
        const sd = crystal === "P" ? "P" : crystal === "S" ? "S" : null, c = unlocked(sd);
        if (!c.length) return fail("No mod that can be removed.");
        const v = c[rnd(c.length)]; removeMod(v); if (sd) comps.push("Omen of " + (sd === "P" ? "Sinistral" : "Dextral") + " Crystallisation");
      }
      if (hasGroup(gm.g)) return fail("The item already has that mod.");
      if (room(gm.t) <= 0) return fail("No free " + side2(gm.t).toLowerCase() + " slot.");
      const m = { group: gm.g, id: mid, side: gm.t, lv: gm.lv, text: rollText(gm.l.join(" / ")), range: gm.l.join(" / "), tier: 0, kind: "crafted", locked: false, tags: gm.tg || [] };
      E.mods.push(m); return { ok: true, name: comps.join(" + "), comps, msg: "Added " + modLine(m) };
    },
    fracture() {
      if (E.rarity !== "Rare") return fail("Needs a rare item.");
      if (E.mods.some((m) => m.locked)) return fail("Only one mod on an item can be fractured.");
      if (E.mods.length < 4) return fail("Needs 4 or more mods.");
      const c = E.mods.filter((m) => m.kind !== "desecrated" && m.kind !== "unrevealed"); if (!c.length) return fail("No mod can be fractured.");
      const v = c[rnd(c.length)]; v.locked = true; return { ok: true, name: "Fracturing Orb", comps: ["Fracturing Orb"], msg: "Fractured " + modLine(v) };
    },
    desecrate(boneKind, sd0, echoes, lich, altered) {
      if (E.rarity !== "Rare") return fail("Needs a rare item.");
      if (E.mods.some((m) => m.kind === "desecrated" || m.kind === "unrevealed")) return fail("The item already has a desecrated mod. Remove it first (Annulment with Omen of Light).");
      const bc = boneClass(); if (boneKind === "Gnawed" && E.ilvl > 64) return fail("Gnawed bones only work up to item level 64.");
      if (lich && !(isJewellery() || isMartial() || isCaster())) return fail("The lich omens work on weapons and jewellery only.");
      if (altered && !isJewellery()) return fail("Altered Collarbone works on a rare amulet, ring or belt.");
      const sd = sd0 || (Math.random() < 0.5 ? "P" : "S");
      let removed = null;
      if (room(sd) <= 0) { const c = unlocked(sd).filter((m) => m.kind !== "desecrated"); if (!c.length) return fail("That side is full of locked mods."); removed = c[rnd(c.length)]; removeMod(removed); }
      E.mods.push({ group: "unrevealed", id: null, side: sd, lv: 0, text: "Unrevealed Desecrated " + side2(sd), range: "", tier: 0, kind: "unrevealed", locked: false, bone: boneKind, echoes: !!echoes, lich: lich || null, altered: !!altered });
      const comps = [altered ? "Altered Collarbone" : boneKind + " " + bc].concat(lich ? ["Omen of the " + lich] : []).concat(sd0 ? ["Omen of " + (sd0 === "P" ? "Sinistral" : "Dextral") + " Necromancy"] : []).concat(echoes ? [] : []);
      return { ok: true, name: "Desecrate with " + comps.join(" + "), comps, msg: `Added an unrevealed desecrated ${side2(sd).toLowerCase()}${removed ? " (removed " + modLine(removed) + " first)" : ""}. Reveal it at the Well of Souls.` };
    },
    quality() {
      const [item] = qualityItem(); if (!item) return fail("No quality currency for this item type (rings, amulets and belts use catalysts).");
      if (E.qCat) return fail("This item has catalyst quality; use a catalyst.");
      const cap = maxQ(); if ((E.quality || 0) >= cap) return fail("Already at the maximum quality (" + cap + "%). A Vaal Infuser can go beyond it.");
      const add = Math.min(QPER[E.rarity] || 1, cap - (E.quality || 0)); E.quality = (E.quality || 0) + add;
      return { ok: true, name: item, comps: [item], msg: `Quality +${add}% (now ${E.quality}%)` };
    },
    infuser() {
      const [, item] = qualityItem(); if (!item) return fail("No Vaal Infuser for this item type.");
      const cap = maxQ(); if ((E.quality || 0) < cap) return fail("A Vaal Infuser can only be used on an item at or above its maximum quality (" + cap + "%).");
      if ((E.quality || 0) >= cap + INFUSER_MAX_BONUS) return fail("Already " + INFUSER_MAX_BONUS + "% beyond the maximum.");
      const start = E.quality, o = infuseOutcome(start, cap, E.ilvl); E.quality += o.add; if (o.corrupt) E.corrupted = true;
      const pc = Math.round(INFUSER_CORRUPT_PER_POINT * (start - cap) * 100);
      return { ok: true, name: item, comps: [item], msg: `Quality +${o.add}% (now ${E.quality}%, ${E.quality - cap}% beyond the maximum). ${o.corrupt ? "The item was corrupted (a " + pc + "% chance at that starting quality)." : "Not corrupted (the chance was " + pc + "%)."}` };
    },
    catalyst(name) {
      if (!isRingAmulet()) return fail("Catalysts work on rings and amulets."); if (E.rarity === "Normal") return fail("Needs a magic or rare item.");
      const cap = maxQ(); let q = E.qCat === name ? (E.quality || 0) : 0; if (q >= cap) return fail("Already at the maximum quality (" + cap + "%).");
      const replaced = E.qCat && E.qCat !== name && E.quality > 0; E.qCat = name; E.quality = Math.min(cap, q + 5);
      return { ok: true, name: name + " Catalyst", comps: [name + " Catalyst"], msg: `Quality ${E.quality}% enhancing ${CATS[name].join(", ")} mods${replaced ? " (replaced the earlier catalyst quality)" : ""}` };
    },
    artificer() {
      if (!(isArmour() || isMartial() || isCaster())) return fail("Artificer's Orb works on a martial weapon, wand, staff or armour.");
      if ((E.sockets || 0) >= SOCKET_CAP) return fail("No room for another Augment Socket (capped at " + SOCKET_CAP + " here; the real limit is not in the data).");
      E.sockets = (E.sockets || 0) + 1; return { ok: true, name: "Artificer's Orb", comps: ["Artificer's Orb"], msg: "Added an Augment Socket (" + E.sockets + " added)." };
    },
    flux(el) {
      const g = groupsNow(), key = {}, pat = /^\+?\(?[\d.\-()]+\)?% to (Fire|Cold|Lightning|Chaos) Resistance$/;
      for (const k in g) { if (g[k].d || g[k].c) continue; const x = pat.exec(g[k].tiers[0].text); if (x) key[x[1]] = k; }
      const target = key[el]; if (!target) return fail(el + " Resistance cannot roll on this item.");
      const from = { Fire: ["Cold", "Lightning"], Cold: ["Fire", "Lightning"], Lightning: ["Fire", "Cold"], Chaos: ["Fire", "Cold", "Lightning"] }[el], hit = [];
      for (const m of E.mods) {
        const x = pat.exec(m.range || ""); if (!x || !from.includes(x[1]) || bare(m.group) !== bare(key[x[1]])) continue;
        const gr = g[target], t = gr.tiers.reduce((b, y) => (Math.abs(y.lv - m.lv) < Math.abs(b.lv - m.lv) ? y : b), gr.tiers[0]);
        m.group = target; m.id = t.id; m.lv = t.lv; m.range = t.text; m.text = rollText(t.text); m.tier = gr.tiers.indexOf(t) + 1; m.tags = t.tg || []; hit.push(m);
      }
      if (!hit.length) return fail("No " + from.join(" or ") + " Resistance modifier on the item.");
      const nm = { Fire: "Blazing Flux", Cold: "Chilling Flux", Lightning: "Crackling Flux", Chaos: "Void Flux" }[el];
      return { ok: true, name: nm, comps: [nm], msg: "Converted " + hit.length + " resistance mod" + (hit.length === 1 ? "" : "s") + " to " + el + ": " + hit.map(modLine).join("; ") };
    },
    alloy(name, crystal) {
      if (E.rarity !== "Rare") return fail("Alloys work on a rare item.");
      const g = groupsNow(), key = Object.keys(g).find((k) => g[k].alloys && g[k].alloys.includes(name)); if (!key) return fail("That alloy has no mod for this item type.");
      const sd = crystal === "P" ? "P" : crystal === "S" ? "S" : null, c = unlocked(sd); if (!c.length) return fail("No mod that can be removed.");
      const v = c[rnd(c.length)]; removeMod(v);
      const gr = g[key], t = gr.tiers[0];
      if (hasGroup(key) || room(gr.side) <= 0) { E.mods.push(v); return fail("The alloy's mod cannot be added (the item already has it or that side is full). Nothing was removed."); }
      const m = makeMod(key, gr, t, "crafted"); E.mods.push(m);
      const comps = [name].concat(sd ? ["Omen of " + (sd === "P" ? "Sinistral" : "Dextral") + " Crystallisation"] : []);
      return { ok: true, name: comps.join(" + "), comps, msg: `Removed ${modLine(v)}; added ${modLine(m)}` };
    },
    divine() {
      const c = E.mods.filter((m) => m.range && m.kind !== "unrevealed"); if (!c.length) return fail("No mod to reroll.");
      c.forEach((m) => { m.text = rollText(m.range); }); return { ok: true, name: "Divine Orb", comps: ["Divine Orb"], msg: "Rerolled the values of " + c.length + " mods." };
    },
    vaal() {
      if (E.corrupted) return fail("Already corrupted.");
      E.corrupted = true; const r = rnd(4); let msg;
      if (r === 0) msg = "Nothing else happened.";
      else if (r === 1) { const c = unlocked().filter((m) => m.kind !== "unrevealed"), k = Math.min(c.length, 1 + rnd(3)), done = []; for (let i = 0; i < k; i++) { const v = c.splice(rnd(c.length), 1)[0]; const sd = v.side; removeMod(v); const m = addRandom({ side: sd }) || addRandom({}); if (m) done.push(modLine(m)); } msg = "Randomised " + k + " mod" + (k === 1 ? "" : "s") + ": " + (done.join("; ") || "nothing added"); }
      else if (r === 2) { const en = enchantList(); if (en.length) { const t = en[rnd(en.length)]; E.enchant = rollText(t); msg = "Gained the enchantment: " + E.enchant; } else msg = "No enchantment available for this item type."; }
      else { const ok = ["Helmet", "Gloves", "Boots", "Body Armour", "Shield", "Focus"].includes((D.bases[E.base] || {}).ty) || (D.bases[E.base] || { tg: [] }).tg.includes("weapon"); if (ok) { E.sockets = (E.sockets || 0) + 1; msg = "Gained an extra Augment Socket, ignoring the normal limit."; } else msg = "A socket is impossible on this item, so nothing happened."; }
      return { ok: true, name: "Vaal Orb", comps: ["Vaal Orb"], msg: "Corrupted. " + msg };
    },
  };
  function enchantList() {
    const ty = (D.bases[E.base] || {}).ty, tg = (D.bases[E.base] || { tg: [] }).tg;
    const attr = tg.map((t) => (/^(str|dex|int)(_(str|dex|int))*_armour$/.test(t) ? t.replace(/_armour$/, "") : null)).find(Boolean) || "str";
    const pd = CORR && CORR.classes && (CORR.classes[ty] || CORR.classes[ty + "|" + attr]);
    return pd ? pd.corrupted.map((r) => r.text) : [];
  }
  // reveal at the Well of Souls: three options from the normal pool plus the desecrated pool, side fixed by the unrevealed mod
  function offers() {
    const u = E.mods.find((m) => m.kind === "unrevealed"), g = groupsNow(), min = u.bone === "Ancient" ? 40 : 1, entries = [];
    for (const k in g) {
      const gr = g[k]; if (gr.c || gr.side !== u.side || hasGroup(k)) continue;
      const tiers = gr.tiers.filter((t) => t.lv >= min && t.w > 0); const w = tiers.reduce((a, t) => a + t.w, 0); if (w > 0) entries.push({ k, gr, tiers, w });
    }
    const out = [];
    let exclusiveDone = false;
    const rolled = (e) => { let y = Math.random() * e.w, t = e.tiers[e.tiers.length - 1]; for (const tt of e.tiers) { y -= tt.w; if (y < 0) { t = tt; break; } } return makeMod(e.k, e.gr, t, "desecrated"); };
    if (u.lich && LICH[u.lich]) { // the lich omens guarantee one mod of that family among the options
      const fam = entries.filter((e) => e.tiers.some((t) => (t.tg || []).includes(LICH[u.lich])));
      if (fam.length) { const tot0 = fam.reduce((a, e) => a + e.w, 0); let x0 = Math.random() * tot0, e0 = fam[fam.length - 1]; for (const e of fam) { x0 -= e.w; if (x0 < 0) { e0 = e; break; } } entries.splice(entries.indexOf(e0), 1); const tt = e0.tiers.filter((t) => (t.tg || []).includes(LICH[u.lich])); out.push(rolled(Object.assign({}, e0, { tiers: tt, w: tt.reduce((a, t) => a + t.w, 0) }))); }
    }
    if (!u.lich && E.ilvl >= 65) { // at least one option is an exclusive (desecrated-only) mod when the item type has one for that side
      const ex = entries.filter((e) => e.gr.d && e.w > 0);
      if (ex.length) { const tot0 = ex.reduce((a, e) => a + e.w, 0); let x0 = Math.random() * tot0, e0 = ex[ex.length - 1]; for (const e of ex) { x0 -= e.w; if (x0 < 0) { e0 = e; break; } } entries.splice(entries.indexOf(e0), 1); out.push(rolled(e0)); exclusiveDone = true; }
    }
    const ow = (u.altered && CORR && CORR.classes && CORR.classes[itemTy()] && CORR.classes[itemTy()].breach && CORR.classes[itemTy()].breach.breach_otherworldly || []).filter((r) => r.side === u.side && !hasGroup("O:" + r.family.join(",")));
    for (let i = out.length; i < 3 && (entries.length || ow.length); i++) {
      if (ow.length && Math.random() < OTHERWORLDLY_CHANCE) { const r = ow.splice(rnd(ow.length), 1)[0]; out.push({ group: "O:" + r.family.join(","), id: null, side: r.side, lv: r.level || 1, text: rollText(r.text), range: r.text, tier: 0, kind: "desecrated", locked: false, tags: [], otherworldly: true }); continue; }
      if (!entries.length) break;
      const tot = entries.reduce((a, e) => a + e.w, 0); let x = Math.random() * tot, j = 0; for (; j < entries.length - 1; j++) { x -= entries[j].w; if (x < 0) break; }
      const e = entries.splice(j, 1)[0]; out.push(rolled(e));
    }
    return out;
  }

  // ---------- running an action ----------
  function run(fn) {
    if (!E) return;
    if (E.corrupted) { flash("The item is corrupted: it cannot be crafted any more."); return; }
    if (pending) { flash("Choose one of the revealed mods first."); return; }
    const snap = JSON.stringify(E), r = fn();
    if (!r.ok) { flash(r.msg); return; }
    commit(snap, r.name, r.comps, r.msg);
  }
  function commit(snap, name, comps, msg) {
    const cost = costOf(comps); let logged = null;
    E.spent += cost; E.uses = (E.uses || 0) + 1;
    if ($("emuLog").checked && comps.length) { App.trkLog(name, cost, 1); logged = { name, cost }; }
    E.events.unshift(`${name}: ${msg}`);
    hist.push({ snap, logged, spent: cost });
    checkGoal(); render();
  }
  function goalMet() {
    const t = App.st.targets; if (!t.length) return false; const need = Math.min(+($("need").value || t.length), t.length);
    return t.filter((x) => E.mods.some((m) => m.kind !== "unrevealed" && bare(m.group) === bare(x.group) && m.lv >= x.minLevel)).length >= need;
  }
  function checkGoal() { const met = goalMet(); if (met && !E.goal) E.events.unshift(`Goal reached after ${E.uses} uses, ${App.fx(E.spent)} ${App.ul()} spent.`); E.goal = met; }
  function flash(msg) { $("emuMsg").textContent = msg; }

  function reveal() {
    if (!E || E.corrupted) return;
    const u = E.mods.find((m) => m.kind === "unrevealed"); if (!u) { flash("No unrevealed desecrated mod on the item."); return; }
    if (pending) return;
    const o = offers(); if (!o.length) { flash("The Well of Souls found nothing to offer."); return; }
    pending = { options: o, rerolled: false }; render();
  }
  function takeOffer(i) {
    const snap = JSON.stringify(E), u = E.mods.find((m) => m.kind === "unrevealed"), m = pending.options[i];
    removeMod(u); E.mods.push(m); pending = null;
    commit(snap, "Reveal at the Well of Souls", [], "Took " + modLine(m));
  }
  function rerollOffers() {
    if (!pending || pending.rerolled) return;
    const snap = JSON.stringify(E), cost = price("Omen of Abyssal Echoes");
    pending = { options: offers(), rerolled: true };
    E.spent += cost; if ($("emuLog").checked) App.trkLog("Omen of Abyssal Echoes", cost, 1);
    hist.push({ snap, logged: $("emuLog").checked ? { name: "Omen of Abyssal Echoes", cost } : null, spent: cost, keepPending: false });
    E.events.unshift("Omen of Abyssal Echoes: rerolled the three options."); render();
  }
  function undo() {
    const h = hist.pop(); if (!h) { flash("Nothing to undo."); return; }
    E = JSON.parse(h.snap); pending = null; if (h.logged) App.trkRemove(h.logged.name, h.logged.cost);
    (h.logs || []).forEach((l) => { for (let i = 0; i < l.qty; i++) App.trkRemove(l.name, l.cost); }); render();
  }
  async function start() {
    $("emuMsg").textContent = "Checking current prices..."; await App.ensureFresh();
    const st = App.st, base = $("base").value; if (!D.bases[base]) { flash("Pick a base first."); return; }
    E = { base, ilvl: +$("ilvl").value || 80, rarity: $("rarity").value, aug: App.augTags(), mods: [], corrupted: false, spent: 0, uses: 0, events: [], goal: false, quality: 0, qCat: null, sockets: 0 };
    for (const h of st.held) {
      const rt = h.id && D.mods[h.id] ? D.mods[h.id].l.join(" / ") : "";
      E.mods.push({ group: h.group, id: h.id, side: h.side, lv: h.lv || 0, text: h.text, range: rt, tier: 0, kind: h.desecrated ? "desecrated" : h.crafted ? "crafted" : "natural", locked: !!(h.fractured || h.locked), tags: (h.id && D.mods[h.id] && D.mods[h.id].tg) || [] });
    }
    hist.length = 0; pending = null; $("emuMsg").textContent = "Started. Click an orb to use it. " + App.priceNote(); checkGoal(); render();
  }

  // ---------- rendering ----------
  const OPT = (id, label, opts) => `<label class="dim">${label} <select id="${id}">${opts.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select></label>`;
  const costTxt = (comps) => { const c = costOf(comps), miss = comps.filter((n) => !App.rate(n)); return `${App.fx(c)} ${App.ul()}${miss.length ? " (unpriced: " + esc(miss.join(", ")) + ")" : ""}`; };
  function alloyList() {
    const g = groupsNow(), out = new Set(); for (const k in g) if (g[k].alloys) g[k].alloys.forEach((n) => { if (!/^\(/.test(n)) out.add(n); }); return [...out].sort();
  }
  function panelHtml() {
    const t = (id) => +$(id).value, tierOpts = TIERN.map((n, i) => [i, n]);
    const bc = boneClass(), etype = (D.bases[E.base] || {}).ty;
    const ess = Object.keys(D.essences).filter((n) => D.essences[n].m && D.essences[n].m[etype]).sort();
    const g = (title, body) => `<div class="agroup"><h3>${title}</h3>${body}</div>`;
    const row = (inner, btnId, label) => `<div class="arow">${inner}<button type="button" id="${btnId}">${label}</button></div>`;
    return `<div class="agroups">` +
      g("Start", row(OPT("emuTrT", "Transmutation", tierOpts), "emuTr", "Use") + row("Alchemy", "emuAl", "Use")) +
      g("Add mods", row(OPT("emuAgT", "Augmentation", tierOpts), "emuAg", "Use") + row(OPT("emuRgT", "Regal", tierOpts), "emuRg", "Use") +
        row(OPT("emuExT", "Exalted", tierOpts) + OPT("emuExS", "Omen", [["", "none"], ["P", "Sinistral"], ["S", "Dextral"]]) + `<label class="dim"><input type="checkbox" id="emuExG"> Greater Exaltation</label>` + (isRingAmulet() ? `<label class="dim"><input type="checkbox" id="emuExC"> Catalysing Exaltation</label>` : ""), "emuEx", "Use")) +
      g("Remove or reroll", row(OPT("emuChT", "Chaos", tierOpts) + OPT("emuChM", "Omen", [["", "none"], ["SinistralErasure", "Sinistral Erasure"], ["DextralErasure", "Dextral Erasure"], ["Whittling", "Whittling"]]), "emuCh", "Use") +
        row(OPT("emuAnM", "Annulment", [["", "no omen"], ["SinistralAnnulment", "Sinistral"], ["DextralAnnulment", "Dextral"], ["Light", "Light (desecrated only)"]]), "emuAn", "Use") + row("Divine Orb (rerolls the values)", "emuDv", "Use")) +
      g("Essence", row(OPT("emuEs", "", ess.map((n) => [n, n])) + OPT("emuEsC", "Omen", [["", "none"], ["P", "Sinistral Crystallisation"], ["S", "Dextral Crystallisation"]]), "emuEsB", "Use")) +
      g("Lock and desecrate", row("Fracturing Orb", "emuFr", "Use") +
        row(OPT("emuBn", "Bone", [["Preserved", "Preserved " + bc], ["Ancient", "Ancient " + bc + " (mods level 40+)"], ["Gnawed", "Gnawed " + bc + " (item level 64 or less)"]]) + OPT("emuBs", "Omen", [["", "none"], ["P", "Sinistral Necromancy"], ["S", "Dextral Necromancy"]]) + ((isJewellery() || isMartial() || isCaster()) ? OPT("emuLi", "Lich omen", [["", "none"], ["Sovereign", "of the Sovereign (Ulaman)"], ["Liege", "of the Liege (Amanamu)"], ["Blackblooded", "of the Blackblooded (Kurgal)"]]) : ""), "emuDe", "Desecrate") + (isJewellery() ? row(OPT("emuBs2", "Omen", [["", "none"], ["P", "Sinistral Necromancy"], ["S", "Dextral Necromancy"]]) + OPT("emuLi2", "Lich omen", [["", "none"], ["Sovereign", "Sovereign"], ["Liege", "Liege"], ["Blackblooded", "Blackblooded"]]), "emuAc", "Altered Collarbone") : "") +
        row("Reveal at the Well of Souls (free)", "emuRv", "Reveal")) +
      g("Quality and sockets", (qualityItem()[0] ? row(qualityItem()[0] + " (+5% normal, 2% magic, 1% rare)", "emuQl", "Use") : "") + (isRingAmulet() ? row(OPT("emuCt", "Catalyst", Object.keys(CATS).map((k) => [k, k + " (" + CATS[k][0] + ")"])), "emuCa", "Use") : "") + (qualityItem()[1] ? row(qualityItem()[1] + " (beyond max quality, may corrupt)", "emuIn", "Use") : "") + ((isArmour() || isMartial() || isCaster()) ? row("Artificer's Orb (adds an Augment Socket)", "emuAr", "Use") : "")) +
      g("Fluxes (swap resistances)", row(OPT("emuFx", "Flux", [["Fire", "Blazing: all become Fire"], ["Cold", "Chilling: all become Cold"], ["Lightning", "Crackling: all become Lightning"], ["Chaos", "Void: all become Chaos"]]), "emuFl", "Use")) +
      g("Alloy", row(OPT("emuAy", "", alloyList().map((n) => [n, n])) + OPT("emuAyC", "Omen", [["", "none"], ["P", "Sinistral Crystallisation"], ["S", "Dextral Crystallisation"]]), "emuAyB", "Use")) +
      g("Repeat until a mod is hit (speed simulate)", repeatHtml()) +
      g("Finish", row("Vaal Orb (corrupts the item for good)", "emuVa", "Use")) + `</div>`;
  }
  // ---------- repeat one orb until a chosen mod (at a chosen tier or better) is on the item ----------
  function repeatHtml() {
    const gr = groupsNow(), opts = Object.keys(gr).filter((k) => !gr[k].c && !gr[k].d).sort((a, b) => gr[a].side.localeCompare(gr[b].side) || gr[a].tiers[0].text.localeCompare(gr[b].tiers[0].text))
      .map((k) => [k, side2(gr[k].side).toLowerCase() + ": " + gr[k].tiers[0].text + " (" + gr[k].tiers.length + " tiers)"]);
    const act = [["chaos", "Chaos Orb (tier and omen as set above)"], ["exalt", "Exalted Orb (tier and omens as set above)"], ["annul", "Orb of Annulment (omen as set above)"], ["divine", "Divine Orb (rerolls values only)"], ["alchemy", "Alchemy on a new normal item each try"]];
    return `<div class="arow">${OPT("emuRpA", "Orb", act)}</div>` +
      `<div class="arow">${OPT("emuRpT", "until", [["__goal", "the goal targets are met"]].concat(opts))}<label class="dim">tier at least T <input id="emuRpTier" type="number" min="1" max="20" value="1" style="width:50px"> (1 = best)</label><label class="dim">give up after <input id="emuRpMax" type="number" min="1" max="100000" value="2000" style="width:70px"> tries</label><button type="button" id="emuRpGo" class="primary">Repeat until hit</button></div>` +
      `<div class="dim">Repeats the orb with the settings chosen in the groups above and stops when the mod is on the item at that tier or better. One Undo takes back the whole run.</div><div id="emuRpMsg" class="dim" role="status"></div>`;
  }
  function repeatUntil() {
    if (!E) return;
    if (E.corrupted) { flash("The item is corrupted: it cannot be crafted any more."); return; }
    const t = (id) => +$(id).value, v = (id) => $(id).value, name = v("emuRpA"), target = v("emuRpT");
    const tier = Math.max(1, t("emuRpTier") || 1), max = Math.max(1, Math.min(100000, t("emuRpMax") || 2000));
    const isHit = () => target === "__goal" ? goalMet() : E.mods.some((m) => m.kind !== "unrevealed" && bare(m.group) === bare(target) && (m.tier === 0 || m.tier <= tier));
    const say = (m) => { if ($("emuRpMsg")) $("emuRpMsg").textContent = m; flash(m); };
    if (isHit()) { say("The item already has that mod at that tier."); return; }
    const snap = JSON.stringify(E), fresh = JSON.parse(snap), spent0 = E.spent, counts = {};
    const call = { chaos: () => ACT.chaos(t("emuChT"), v("emuChM")), exalt: () => ACT.exalt(t("emuExT"), v("emuExS") || null, $("emuExG").checked, $("emuExC") ? $("emuExC").checked : false), annul: () => ACT.annul(v("emuAnM")), divine: () => ACT.divine(), alchemy: () => ACT.alchemy() }[name];
    let tries = 0, hit = false, why = "", cost = 0;
    while (tries < max) {
      if (name === "alchemy") { const keep = E.spent; E = JSON.parse(JSON.stringify(fresh)); E.spent = keep; E.rarity = "Normal"; E.mods = E.mods.filter((m) => m.locked); }
      const r = call();
      if (!r.ok) { why = r.msg; break; }
      tries++; const c = costOf(r.comps); cost += c; E.spent += c;
      const k = r.comps.join(" + "); (counts[k] = counts[k] || { cost: c, comps: r.comps, qty: 0 }).qty++;
      if (isHit()) { hit = true; break; }
    }
    if (!tries) { E = JSON.parse(snap); say(why || "Nothing could be done."); return; }
    E.uses = (E.uses || 0) + tries;
    const logs = []; if ($("emuLog").checked) for (const k in counts) { App.trkLog(k, counts[k].cost, counts[k].qty); logs.push({ name: k, cost: counts[k].cost, qty: counts[k].qty }); }
    const text = (hit ? "Hit after " : "Not hit after ") + tries + " tries" + (why ? " (stopped: " + why + ")" : "") + ", spent " + App.fx(E.spent - spent0) + " " + App.ul() + ".";
    E.events.unshift("Repeat " + name + ": " + text);
    hist.push({ snap, logged: null, logs, spent: cost }); checkGoal(); render(); say(text);
  }
  function bind() {
    const t = (id) => +$(id).value, v = (id) => $(id).value, on = (id, f) => { if ($(id)) $(id).onclick = f; };
    on("emuTr", () => run(() => ACT.transmute(t("emuTrT")))); on("emuAl", () => run(() => ACT.alchemy()));
    on("emuAg", () => run(() => ACT.augment(t("emuAgT")))); on("emuRg", () => run(() => ACT.regal(t("emuRgT"))));
    on("emuEx", () => run(() => ACT.exalt(t("emuExT"), v("emuExS") || null, $("emuExG").checked, $("emuExC") ? $("emuExC").checked : false)));
    on("emuCh", () => run(() => ACT.chaos(t("emuChT"), v("emuChM")))); on("emuAn", () => run(() => ACT.annul(v("emuAnM"))));
    on("emuDv", () => run(() => ACT.divine())); on("emuEsB", () => run(() => ACT.essence(v("emuEs"), v("emuEsC"))));
    on("emuFr", () => run(() => ACT.fracture())); on("emuDe", () => run(() => ACT.desecrate(v("emuBn"), v("emuBs") || null, false, $("emuLi") ? v("emuLi") || null : null, false)));
    on("emuRv", () => reveal()); on("emuVa", () => run(() => ACT.vaal()));
    on("emuQl", () => run(() => ACT.quality())); on("emuIn", () => run(() => ACT.infuser())); on("emuCa", () => run(() => ACT.catalyst(v("emuCt")))); on("emuAr", () => run(() => ACT.artificer()));
    on("emuRpGo", repeatUntil);
    on("emuFl", () => run(() => ACT.flux(v("emuFx")))); on("emuAyB", () => run(() => ACT.alloy(v("emuAy"), v("emuAyC"))));
    on("emuAc", () => run(() => ACT.desecrate("Preserved", v("emuBs2") || null, false, v("emuLi2") || null, true)));
  }
  function render() {
    if (!E) return;
    $("emuUndo").disabled = !hist.length;
    const mods = E.mods.map((m) => ({ text: disp(m), side: m.side, fractured: m.locked, desecrated: m.kind === "desecrated", crafted: m.kind === "crafted", unrevealed: m.kind === "unrevealed", group: m.group, lv: m.lv }));
    $("emuCard").innerHTML = App.itemCardSvg({ rarity: E.rarity, base: E.base, ilvl: E.ilvl, held: mods, quality: E.quality, qLabel: E.qCat ? E.qCat + " catalyst" : "", sockets: E.sockets }, "emuCardSvg") +
      (E.corrupted ? `<div class="bad"><b>Corrupted</b>${E.enchant ? ": " + esc(E.enchant) : ""}</div>` : "") + (E.goal ? '<div class="good"><b>Goal reached: the item has what you asked for.</b></div>' : "");
    const sel = {}; $("emuPanel").querySelectorAll("select, input[type=number]").forEach((s) => (sel[s.id] = s.value)); const chk = $("emuExG") ? $("emuExG").checked : false;
    let html = pending
      ? `<div class="pend"><b>The Well of Souls offers three mods. Take one:</b>${pending.options.map((m, i) => `<div class="arow"><button type="button" data-offer="${i}">Take</button> ${esc(modLine(m))}</div>`).join("")}${pending.rerolled ? '<div class="dim">The options were already rerolled once.</div>' : `<div class="arow"><button type="button" id="emuReroll">Reroll the options (Omen of Abyssal Echoes, ${App.fx(price("Omen of Abyssal Echoes"))} ${App.ul()})</button></div>`}</div>`
      : panelHtml();
    $("emuPanel").innerHTML = html + `<div class="dim" style="margin-top:6px">Spent in this emulator: <b>${App.fx(E.spent)} ${App.ul()}</b> over ${E.uses || 0} uses${$("emuLog").checked ? " (also in the cost tracker)" : ""}. Costs use the prices above; Greater and Perfect orbs raise the minimum mod level.</div>`;
    if (!pending) { bind(); for (const id in sel) if ($(id)) $(id).value = sel[id]; if ($("emuExG")) $("emuExG").checked = chk; annotate(); }
    else { $("emuPanel").querySelectorAll("[data-offer]").forEach((b) => (b.onclick = () => takeOffer(+b.dataset.offer))); if ($("emuReroll")) $("emuReroll").onclick = rerollOffers; }
    $("emuEvents").innerHTML = E.events.slice(0, 40).map((e, i) => `<div class="ev${/^Goal/.test(e) ? " speech" : ""}">${esc(e)}</div>`).join("") || '<span class="dim">Nothing done yet.</span>';
  }
  // show what each button costs and grey out the ones that cannot be used right now
  function annotate() {
    const c = (id, comps) => { const b = $(id); if (b) b.title = "Cost: " + costTxt(comps); };
    const tv = (id) => +($(id) ? $(id).value : 0);
    c("emuTr", [TIER[tv("emuTrT")] + "Orb of Transmutation"]); c("emuAl", ["Orb of Alchemy"]); c("emuAg", [TIER[tv("emuAgT")] + "Orb of Augmentation"]); c("emuRg", [TIER[tv("emuRgT")] + "Regal Orb"]);
    c("emuEx", [TIER[tv("emuExT")] + "Exalted Orb"]); c("emuCh", [TIER[tv("emuChT")] + "Chaos Orb"]); c("emuAn", ["Orb of Annulment"]); c("emuDv", ["Divine Orb"]); c("emuFr", ["Fracturing Orb"]); c("emuVa", ["Vaal Orb"]);
    c("emuQl", [qualityItem()[0] || ""]); c("emuIn", [qualityItem()[1] || ""]); c("emuAr", ["Artificer's Orb"]); c("emuCa", [($("emuCt") ? $("emuCt").value : "Reaver") + " Catalyst"]);
    c("emuFl", [{ Fire: "Blazing Flux", Cold: "Chilling Flux", Lightning: "Crackling Flux", Chaos: "Void Flux" }[$("emuFx") ? $("emuFx").value : "Fire"]]); c("emuAyB", [$("emuAy") ? $("emuAy").value : ""]); c("emuAc", ["Altered Collarbone"]);
    const dis = (id, bad) => { const b = $(id); if (b) b.disabled = !!bad; };
    const R = E.rarity;
    dis("emuTr", R !== "Normal"); dis("emuAl", R === "Rare"); dis("emuAg", R !== "Magic" || room("P") + room("S") <= 0); dis("emuRg", R !== "Magic");
    dis("emuEx", R !== "Rare"); dis("emuCh", R !== "Rare"); dis("emuAn", R === "Normal"); dis("emuFr", R !== "Rare" || E.mods.length < 4 || E.mods.some((m) => m.locked));
    dis("emuDe", R !== "Rare"); dis("emuRv", !E.mods.some((m) => m.kind === "unrevealed")); dis("emuAc", R !== "Rare"); dis("emuAyB", R !== "Rare" || !$("emuAy") || !$("emuAy").value); dis("emuEsB", false); dis("emuVa", E.corrupted);
    if (E.corrupted) document.querySelectorAll("#emuPanel .agroups button").forEach((b) => (b.disabled = true));
  }

  $("emuStart").onclick = start; $("emuUndo").onclick = undo;
  document.addEventListener("pricesupdated", () => { if (E && !pending) render(); }); // button costs follow the latest prices
  $("emuLog").onchange = () => { if (E) render(); };
  $("emuUndo").disabled = true;
})();
