// Crafting engine: item parsing + optimal-next-step solver (stochastic shortest path over an abstract item state).
// Works in the browser (window.CRAFT_DATA / CRAFT_PRICES) and in node.
(function (root) {
  "use strict";
  const D = root.CRAFT_DATA;

  // ---- currency rules. Min mod levels verified against Craft of Exile data (v4.5.5.3, 2026-10-14).
  // Verified against poe2db and Craft of Exile (see AUDIT.md): magic items hold 1 prefix and 1 suffix, Whittling removes the lowest level mod, one exclusive offer per reveal at item level 65+. ----
  const MIN_LV = { transmute: [1, 44, 70], augment: [1, 44, 70], regal: [1, 35, 50], exalt: [1, 35, 50], chaos: [1, 35, 50] };
  const TIER_NAMES = ["", "Greater ", "Perfect "];
  const MAGIC_LIMIT = 1;
  const RARE_LIMIT = 3;
  const FAMILY_OMEN = { ulaman_mod: "Omen of the Sovereign", amanamu_mod: "Omen of the Liege", kurgal_mod: "Omen of the Blackblooded" };
  
  // ---------- pool helpers ----------
  // Socket-bound augments (ModRunes: "Can roll X modifiers"). With one socketed, mods tagged X join the normal pool for that item.
  const AUGMENTS = [
    { name: "Thrud's Might", tag: "destruction", slot: (b) => b.tg.includes("weapon") || /^(Wand|Staff|Focus|Sceptre)$/.test(b.ty) },
    { name: "Uhtred's Sidereus", tag: "chronomancy", slot: (b) => b.ty === "Boots" },
    { name: "Kolr's Hunt", tag: "marksman", slot: (b) => b.ty === "Gloves" },
    { name: "Katla's Gloom", tag: "decay", slot: (b) => b.ty === "Gloves" },
    { name: "Vorana's Carnage", tag: "berserking", slot: (b) => b.ty === "Helmet" },
    { name: "Medved's Tending", tag: "soul", slot: (b) => b.ty === "Body Armour" },
  ];
  function augmentsFor(baseName) { const b = D.bases[baseName]; return b ? AUGMENTS.filter((a) => a.slot(b)).map((a) => ({ name: a.name, tag: a.tag })) : []; }
  function tagSet(baseName, extra) { const b = D.bases[baseName]; const t = b ? new Set(b.tg) : new Set(); (extra || []).forEach((x) => t.add(x)); return t; }
  function weightFor(m, tags) {
    for (let i = 0; i < m.wk.length; i++) if (tags.has(m.wk[i])) return m.wv[i];
    return 0;
  }
  function slotLimits(baseName) {
    const b = D.bases[baseName]; let p = RARE_LIMIT, s = RARE_LIMIT;
    if (b && b.ty === "Jewel") { p = 2; s = 2; } // [jewel limit] rare jewels: 2 prefixes + 2 suffixes (PoB2 Item.lua)
    const im = (b && b.im) || ""; let m;
    const rp = /([+-]\d+) Prefix Modifiers? allowed/g, rs = /([+-]\d+) Suffix Modifiers? allowed/g;
    while ((m = rp.exec(im))) p += parseInt(m[1], 10);
    while ((m = rs.exec(im))) s += parseInt(m[1], 10);
    return { P: Math.max(0, p), S: Math.max(0, s) };
  }
  const modText = (m) => m.l.join(" / ");

  // Real per-class weights (Craft of Exile) replace PoB's flat 1s when the base and mod are known; weight 1 there means "not natural".
  function classWeights(baseName) {
    const W = root.CRAFT_WEIGHTS; if (!W) return null;
    const c = W.bases[baseName]; return c != null ? W.w[c] : null;
  }
  let anyW = null;
  function anyClassWeight(id) {
    const W = root.CRAFT_WEIGHTS; if (!W) return 0;
    if (!anyW) { anyW = {}; for (const c in W.w) for (const k in W.w[c]) if (W.w[c][k] > 1 && anyW[k] === undefined) anyW[k] = W.w[c][k]; }
    return anyW[id] || 0;
  }
  function basePool(baseName, ilvl, extra) {
    const tags = tagSet(baseName, extra), out = [], cw = classWeights(baseName);
    for (const id in D.mods) {
      const m = D.mods[id];
      if (m.lv > ilvl) continue;
      let w = weightFor(m, tags);
      if (w > 0 && cw && !m.d && cw[id] !== undefined) w = cw[id] > 1 ? cw[id] : 0;
      else if (w > 0 && !m.d && extra && extra.length && m.wk.some((k) => extra.includes(k)) && !(cw && cw[id] !== undefined)) w = anyClassWeight(id) || w; // augment pools: Craft of Exile lacks some classes, borrow the weight it shows elsewhere
      if (w > 0) out.push({ id, m, w });
    }
    return out;
  }
  // group -> { group, side, d, tiers:[{id,lv,w,text,name,tg}] high level first }. Desecrated groups are keyed "D:<group>".
  function groupsFor(baseName, ilvl, aug) {
    const g = {};
    for (const e of basePool(baseName, ilvl, aug)) {
      const k = e.m.g;
      (g[k] = g[k] || { group: k, side: e.m.t, d: !!e.m.d, tiers: [] }).tiers.push({ id: e.id, lv: e.m.lv, w: e.w, text: modText(e.m), name: e.m.n, tg: e.m.tg || [] });
    }
    // Crafted mods: essence-only mods that cannot roll naturally on this base. Keyed "E:<group>".
    const ety = (D.bases[baseName] || {}).ty;
    const natural = new Set(Object.keys(g));
    for (const en in D.essences) {
      const e = D.essences[en], mid = e.m && e.m[ety], m = mid && D.mods[mid];
      if (!m || natural.has(m.g)) continue;
      const k = "E:" + m.g, grp = (g[k] = g[k] || { group: k, side: m.t, c: true, tiers: [], essences: [] });
      if (!grp.tiers.some((t) => t.id === mid)) grp.tiers.push({ id: mid, lv: m.lv, w: 0, text: modText(m), name: m.n, tg: m.tg || [], essence: en });
      grp.essences.push(en);
    }
    // Alloy mods (rare items, patch 0.5): fixed mods with zero weight, so they never roll naturally. Keyed "A:<group>". Without this they were counted as junk.
    const AL = root.CRAFT_ALLOYS;
    const listed = new Set(); // alloy mods that poe2db lists for some item class (by text)
    if (AL && ety) {
      const fix = (s) => norm(String(s).replace(/â€”|—|–/g, "-"));
      const byText = {};
      for (const id in D.mods) if (/^Alloy/.test(id)) byText[fix(D.mods[id].l.join(" / "))] = id;
      const sg = (w) => { w = w.toLowerCase().trim(); const sp = { staves: "staff", quarterstaves: "staff", foci: "focus", bucklers: "shield" }; const last = w.split(" ").pop(); return sp[last] ? w.replace(/\S+$/, sp[last]) : w.replace(/s$/, ""); };
      for (const al of AL) for (const r of al.rows) {
        listed.add(fix(r.mod));
        if (!r.classes.some((c) => sg(c) === sg(ety))) continue;
        const mid = byText[fix(r.mod)], m = mid && D.mods[mid];
        if (!m || m.lv > ilvl) continue;
        const k = "A:" + m.g, grp = (g[k] = g[k] || { group: k, side: m.t, c: true, tiers: [], alloys: [] });
        if (!grp.tiers.some((t) => t.id === mid)) grp.tiers.push({ id: mid, lv: m.lv, w: 0, text: modText(m), name: m.n, tg: m.tg || [], alloy: al.name });
        if (!grp.alloys.includes(al.name)) grp.alloys.push(al.name);
      }
    }
    // Special mods that need something we cannot add: a socket-bound augment that is not on the item (hold-only, tell the user which one), and
    // alloy mods that poe2db does not list under any alloy (source unknown).
    {
      const bObj = D.bases[baseName], need = {};
      if (bObj) for (const a of AUGMENTS) if (a.slot(bObj) && !(aug || []).includes(a.tag)) need[a.tag] = a.name;
      for (const id in D.mods) {
        const m = D.mods[id]; if (m.lv > ilvl) continue;
        const tag = (m.wk || []).find((x) => need[x]);
        const isAlloy = /^Alloy/.test(id) && !listed.has(norm(m.l.join(" / ")));
        if (!tag && !isAlloy) continue;
        if (Object.values(g).some((x) => x.tiers && x.tiers.some((t) => t.id === id))) continue;
        const k = "A:" + m.g; if (g[k]) continue;
        const src = tag ? "(needs " + need[tag] + " socketed)" : "(source not confirmed)";
        g[k] = { group: k, side: m.t, c: true, tiers: [{ id, lv: m.lv, w: 0, text: modText(m), name: m.n, tg: m.tg || [], alloy: src }], alloys: [src] };
      }
    }
    for (const k in g) g[k].tiers.sort((a, b) => b.lv - a.lv);
    return g;
  }
  const gkey = (x) => String(x).replace(/^[EA]:/, "");
  function boneClass(baseName) {
    const b = D.bases[baseName]; if (!b) return "Rib";
    if (/Ring|Amulet|Belt/.test(b.ty)) return "Collarbone";
    if (b.tg.includes("weapon") || b.ty === "Quiver") return "Jawbone";
    return "Rib";
  }

  // ---------- item text parsing ----------
  const norm = (s) => s.replace(/[\d.]+\([\d.]+-[\d.]+\)/g, "#").replace(/\([\d.]+-[\d.]+\)/g, "#").replace(/\d+(\.\d+)?/g, "#").replace(/#+/g, "#").replace(/\s+/g, " ").trim();
  let tmplIndex = null;
  function templates() {
    if (tmplIndex) return tmplIndex;
    tmplIndex = {};
    for (const id in D.mods) {
      const key = norm(D.mods[id].l.join(" | "));
      (tmplIndex[key] = tmplIndex[key] || []).push(id);
    }
    return tmplIndex;
  }
  const firstRange = (m) => { const r = /\(([\d.]+)-([\d.]+)\)/.exec(m.l.join(" ")); return r ? [parseFloat(r[1]), parseFloat(r[2])] : null; };

  function parseItem(text) {
    const res = { base: null, ilvl: 80, rarity: "Rare", mods: [], warnings: [], augments: [] };
    { const re = /Can roll (\w+) modifiers/gi; let am; while ((am = re.exec(text))) { const t = am[1].toLowerCase(); if (!res.augments.includes(t)) res.augments.push(t); } }
    const lines = text.replace(/\r/g, "").split("\n");
    const rm = /^Rarity:\s*(\w+)/m.exec(text); if (rm) res.rarity = rm[1];
    const il = /Item Level:\s*(\d+)/.exec(text); if (il) res.ilvl = parseInt(il[1], 10);
    const names = Object.keys(D.bases).sort((a, b) => b.length - a.length);
    const head = text.split(/-{4,}/)[0];
    for (const n of names) if (head.includes(n)) { res.base = n; break; }
    // Implicit modifiers, the item class and the level requirement confirm the base, or find it when the name is unknown.
    const implicits = [];
    const lines0 = text.replace(/\r/g, "").split("\n");
    for (let q = 0; q < lines0.length; q++) {
      const t = lines0[q].trim();
      if (/\(implicit\)\s*$/i.test(t)) implicits.push(t.replace(/\s*\(implicit\)\s*$/i, ""));
      else if (/^\{[^}]*Implicit[^}]*\}$/i.test(t)) { for (q++; q < lines0.length && lines0[q].trim() && !/^\{/.test(lines0[q].trim()) && !/^-{4,}/.test(lines0[q].trim()); q++) implicits.push(lines0[q].trim().replace(/\s*\((implicit|rune|enchant)\)\s*$/i, "")); q--; }
    }
    const cm = /^Item Class:\s*(.+)$/m.exec(text);
    const sing = (w) => { w = w.toLowerCase().trim(); const sp = { staves: "staff", quarterstaves: "staff", quarterstaff: "staff", foci: "focus", bucklers: "shield", buckler: "shield" }; const last = w.split(" ").pop(); if (sp[last]) return w.replace(/\S+$/, sp[last]); return w.replace(/s$/, ""); };
    const itemType = cm ? [...new Set(Object.values(D.bases).map((b) => b.ty))].find((t) => sing(t) === sing(cm[1])) || null : null;
    const rq = /(?:Requires?:?[^\n]*|Requirements:[\s\S]{0,80}?)\bLevel:?\s*(\d+)/i.exec(text.replace(/Item Level:?\s*\d+/gi, ""));
    const reqLv = rq ? parseInt(rq[1], 10) : null;
    const baseLines = (n) => (D.bases[n].im || "").split("\n").map((x) => norm(x.replace(/\{[^}]*\}/g, ""))).filter(Boolean);
    const itemImp = implicits.map((x) => norm(x));
    const consistent = (n) => itemImp.every((x) => baseLines(n).includes(x));
    function inferBase() {
      let c = Object.keys(D.bases).filter((n) => (!itemType || D.bases[n].ty === itemType) && !D.bases[n].tg.includes("not_for_sale") && consistent(n));
      if (itemImp.length) { const exact = c.filter((n) => baseLines(n).length === itemImp.length); if (exact.length) c = exact; }
      const fit = c.filter((n) => D.bases[n].rl <= (reqLv != null ? Math.max(reqLv, 0) : res.ilvl) && D.bases[n].rl <= res.ilvl);
      if (fit.length) c = fit;
      c.sort((x, y) => (reqLv != null ? Math.abs(D.bases[x].rl - reqLv) - Math.abs(D.bases[y].rl - reqLv) : D.bases[y].rl - D.bases[x].rl) || D.bases[y].rl - D.bases[x].rl);
      return c;
    }
    const mismatch = res.base && itemImp.length && !consistent(res.base);
    if (!res.base || mismatch) {
      const c = inferBase();
      if (c.length) {
        res.baseCandidates = c.slice(0, 6);
        if (!res.base || !c.includes(res.base)) {
          res.base = c[0];
          res.warnings.push("Base type taken from the implicit modifiers" + (reqLv != null ? " and level requirement " + reqLv : "") + ": " + c[0] + (c.length > 1 ? ". Other bases that fit: " + c.slice(1, 6).join(", ") + ". Change it in the list if that is wrong." : "."));
        }
      }
    }
    if (!res.base) res.warnings.push("Base type not recognised; pick it manually.");

    const T = templates();
    function matchLine(textLines, header, desecrated) {
      const ids = T[norm(textLines.join(" | "))];
      if (!ids) return null;
      const nums = (textLines.join(" ").replace(/\([\d.]+-[\d.]+\)/g, "").match(/-?\d+(\.\d+)?/g) || []).map(parseFloat);
      let cand = ids.map((id) => ({ id, m: D.mods[id] }));
      const pref = (f) => { const v = cand.filter(f); if (v.length) cand = v; };
      pref((c) => (desecrated ? !!c.m.d : !c.m.d));
      if (header && header.side) pref((c) => c.m.t === header.side);
      if (header && header.name) pref((c) => c.m.n === header.name);
      pref((c) => { const r = firstRange(c.m); return r && nums.length && nums[0] >= r[0] && nums[0] <= r[1]; });
      const tags = res.base ? tagSet(res.base, res.augments) : null;
      if (tags) pref((c) => weightFor(c.m, tags) > 0 && c.m.lv <= res.ilvl);
      cand.sort((a, b) => b.m.lv - a.m.lv);
      return cand[0].id;
    }
    const addMod = (id, side, clean, flags) => res.mods.push({ id, side: id ? D.mods[id].t : side, group: id ? D.mods[id].g : "?" + clean.join("|"),
      text: clean.join(" / "), fractured: /fractured/i.test(flags), crafted: /crafted/i.test(flags), desecrated: /desecrated/i.test(flags) || !!(id && D.mods[id].d) });
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i].trim();
      const h = /^\{\s*(.*?)\s*\}$/.exec(ln);
      if (h && /(Prefix|Suffix|Implicit|Unique|Enchant)/i.test(h[1])) {
        const info = h[1];
        const side = /Prefix/i.test(info) ? "P" : /Suffix/i.test(info) ? "S" : null;
        const nm = /"([^"]+)"/.exec(info);
        const body = [];
        i++;
        while (i < lines.length && lines[i].trim() && !/^\{/.test(lines[i].trim()) && !/^-{4,}/.test(lines[i].trim())) body.push(lines[i].trim()), i++;
        if (!side) continue;
        const UNS = /\s*[—–-]+\s*Unscalable Value\s*$/i; // alloy-added mods: the game marks their values as not scalable by magnitude mods
        const flags = body.join(" ") + " " + info + (body.some((b) => UNS.test(b)) ? " crafted" : "");
        const clean = body.map((b) => b.replace(UNS, "").replace(/\s*\((fractured|desecrated|crafted|rune)\)/gi, ""));
        addMod(matchLine(clean, { side, name: nm && nm[1] }, /desecrated/i.test(flags)), side, clean, flags);
        continue;
      }
      i++;
    }
    if (!res.mods.length) {
      for (const raw of lines) {
        const ln = raw.trim(); if (!ln || /\((implicit|rune|enchant)\)/i.test(ln) || (/^[A-Za-z ]+:/.test(ln) && !/\d/.test(ln))) continue;
        const clean = ln.replace(/\s*[—–-]+\s*Unscalable Value\s*$/i, "").replace(/\s*\((fractured|desecrated|crafted)\)/gi, "");
        const id = matchLine([clean], null, /desecrated/i.test(ln));
        if (id) addMod(id, D.mods[id].t, [clean], ln);
      }
    }
    res.mods.forEach((m) => { if (!m.id) res.warnings.push("Mod not found in the pool (counts as junk): " + m.text); });
    return res;
  }

  // ---------- the solver ----------
  // cfg: { base, ilvl, rarity, held:[{group,id,side,lv,locked,fractured,desecrated}], targets:[{group,minLevel}], need, prices, disabled:Set }
  function solve(cfg) {
    const groups = groupsFor(cfg.base, cfg.ilvl, cfg.augments);
    const lim = slotLimits(cfg.base);
    const T = cfg.targets.filter((t) => groups[t.group]).slice(0, 6);
    const nT = T.length, M = 1 << nT, K = nT + 5;
    const need = Math.min(cfg.need || nT, nT);
    const live = (root.CRAFT_PRICES && root.CRAFT_PRICES.prices) || {};
    const prices = Object.assign({}, live, cfg.prices || {});
    const missing = new Set();
    const tside = T.map((t) => groups[t.group].side);
    const issues = [];
    cfg.targets.forEach((t) => { if (!groups[t.group]) issues.push("Target '" + t.group + "' cannot roll on this base at item level " + cfg.ilvl + "."); });
    T.forEach((t) => { if (!groups[t.group].tiers.some((x) => x.lv >= t.minLevel)) issues.push("No tier of '" + t.group + "' reaches level " + t.minLevel + "."); });

    // initial state from held mods
    let mask0 = 0, lockedMask0 = 0, jp0 = 0, js0 = 0, ljp0 = 0, ljs0 = 0, fx0 = 0, dx0 = 0, bp0 = 0, bs0 = 0, needDx = false; // bp/bs: held mods the user wants replaced (must be gone at the end)
    for (const h of cfg.held) {
      const ti = T.findIndex((t) => gkey(t.group) === gkey(h.group) && (h.lv || 0) >= t.minLevel);
      const code = ti >= 0 ? ti + 1 : h.side === "P" ? nT + 1 : nT + 2;
      if (h.replace && ti < 0 && (h.fractured || h.locked)) issues.push("'" + h.text + "' is marked to be replaced but it is locked, so it cannot be removed. Replacing it needs a new base.");
      if (h.fractured && fx0 === 0) { fx0 = code; if (ti >= 0) mask0 |= 1 << ti; continue; }
      if (h.desecrated && dx0 === 0) { dx0 = code; if (ti >= 0) mask0 |= 1 << ti; if (h.replace && ti < 0) needDx = true; continue; }
      const lockedH = h.locked || h.fractured;
      if (ti >= 0) { mask0 |= 1 << ti; if (lockedH) lockedMask0 |= 1 << ti; }
      else if (h.side === "P") { if (lockedH) ljp0++; else if (h.replace) bp0++; else jp0++; }
      else { if (lockedH) ljs0++; else if (h.replace) bs0++; else js0++; }
    }
    const pc = (x) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
    const rar = { Normal: 0, Magic: 1, Rare: 2 }[cfg.rarity] ?? 2;

    // weight tables by (min action level, tag filter); regular pool only (desecrated groups never roll normally)
    const wcache = new Map();
    function weights(aMin) {
      const ck = String(aMin);
      if (wcache.has(ck)) return wcache.get(ck);
      const side = { P: 0, S: 0 }, qual = T.map(() => 0), gtot = T.map(() => 0);
      for (const g in groups) {
        if (groups[g].d || groups[g].c) continue;
        for (const t of groups[g].tiers) {
          if (t.lv < aMin) continue;
          side[groups[g].side] += t.w;
          T.forEach((tt, i) => { if (tt.group === g) { gtot[i] += t.w; if (t.lv >= tt.minLevel) qual[i] += t.w; } });
        }
      }
      const o = { side, qual, gtot }; wcache.set(ck, o); return o;
    }
    const magicLim = cfg.magicLimit != null ? cfg.magicLimit : MAGIC_LIMIT;
    const limFor = (r) => (r === 0 ? { P: 0, S: 0 } : r === 1 ? { P: Math.min(magicLim, lim.P), S: Math.min(magicLim, lim.S) } : lim);
    // state = {r, mask, jp, js, fx, dx}; fx/dx: 0 none, 1..nT target locked, nT+1 junk prefix locked, nT+2 junk suffix locked
    const enc = (s) => ((((((((s.r * M + s.mask) * 4 + s.jp) * 4 + s.js) * K + s.fx) * K + s.dx) * 4 + (s.bp | 0)) * 4 + (s.bs | 0)) * 2 + (s.bl | 0));
    const lockBit = (v) => (v >= 1 && v <= nT ? 1 << (v - 1) : 0);
    const lockedMaskOf = (s) => lockedMask0 | lockBit(s.fx);
    const ljpOf = (s) => ljp0 + (s.fx === nT + 1) + (s.dx === nT + 1) + (s.dx === nT + 3);
    const ljsOf = (s) => ljs0 + (s.fx === nT + 2) + (s.dx === nT + 2) + (s.dx === nT + 4);
    const heldCount = (s, side) => { let c = side === "P" ? s.jp + (s.bp | 0) + ljpOf(s) : s.js + (s.bs | 0) + ljsOf(s); for (let i = 0; i < nT; i++) if (s.mask >> i & 1 && tside[i] === side) c++; return c; };
    const total = (s) => pc(s.mask) + s.jp + s.js + (s.bp | 0) + (s.bs | 0) + ljpOf(s) + ljsOf(s);
    const fracIdx = T.findIndex((t) => t.fractured);
    if (T.filter((t) => t.fractured).length > 1) issues.push("Only one mod can be fractured; only the first fractured target is used.");
    if (fracIdx >= 0 && fx0 !== 0 && fx0 !== fracIdx + 1) issues.push("This item already has a different fractured mod, so '" + T[fracIdx].group.replace(/^[DE]:/, "") + "' cannot be fractured.");
    const goal = (s) => pc(s.mask) >= need && ((s.bp | 0) + (s.bs | 0) + (s.bl | 0) === 0) && (!needDx || s.dx === 0 || s.dx <= nT) && (fracIdx < 0 || ((s.mask >> fracIdx & 1) && s.fx === fracIdx + 1));
    const mk = (s, o) => Object.assign({}, s, o);

    // add one random mod; opts {side, aMin}; rOut: rarity whose limits apply
    function addOne(s, opts, rOut) {
      const L = limFor(rOut !== undefined ? rOut : s.r);
      const w = weights(opts.aMin || 1);
      const room = { P: L.P - heldCount(s, "P"), S: L.S - heldCount(s, "S") };
      const entries = [];
      for (let i = 0; i < nT; i++) {
        if (s.mask >> i & 1 || groups[T[i].group].d || groups[T[i].group].c) continue;
        if (room[tside[i]] <= 0 || (opts.side && tside[i] !== opts.side) || w.qual[i] <= 0) continue;
        entries.push({ wt: w.qual[i], mask: s.mask | 1 << i });
      }
      for (const sd of ["P", "S"]) {
        if (room[sd] <= 0 || (opts.side && sd !== opts.side)) continue;
        let j = w.side[sd];
        for (let i = 0; i < nT; i++) if (tside[i] === sd && !groups[T[i].group].d && !groups[T[i].group].c) j -= (s.mask >> i & 1) ? w.gtot[i] : w.qual[i];
        if (j > 1e-9) entries.push({ wt: j, junk: sd });
      }
      const tot = entries.reduce((a, e) => a + e.wt, 0);
      if (tot <= 0) return null;
      return entries.map((e) => ({ p: e.wt / tot, s: mk(s, { mask: e.mask !== undefined ? e.mask : s.mask, jp: s.jp + (e.junk === "P" ? 1 : 0), js: s.js + (e.junk === "S" ? 1 : 0) }) }));
    }
    // removal candidates: [{kind:'t',i}|{kind:'p'}|{kind:'s'}]
    function removables(s, side) {
      const c = [], lm = lockedMaskOf(s);
      for (let i = 0; i < nT; i++) if ((s.mask >> i & 1) && !(lm >> i & 1) && (!side || tside[i] === side)) c.push({ k: "t", i });
      if (!side || side === "P") for (let k = 0; k < s.jp; k++) c.push({ k: "p" });
      if (!side || side === "S") for (let k = 0; k < s.js; k++) c.push({ k: "s" });
      if (!side || side === "P") for (let k = 0; k < (s.bp | 0); k++) c.push({ k: "bp" });
      if (!side || side === "S") for (let k = 0; k < (s.bs | 0); k++) c.push({ k: "bs" });
      if (s.dx) { // the desecrated mod (unrevealed, revealed wanted or revealed unwanted) can be removed too
        const dside = s.dx <= nT ? tside[s.dx - 1] : (s.dx === nT + 1 || s.dx === nT + 3) ? "P" : "S";
        if (!side || side === dside) c.push({ k: "d", target: s.dx <= nT });
      }
      return c;
    }
    const applyRemove = (s, c) => c.k === "bp" ? mk(s, { bp: s.bp - 1 }) : c.k === "bs" ? mk(s, { bs: s.bs - 1 }) : c.k === "t" ? mk(s, { mask: s.mask & ~(1 << c.i) }) : c.k === "p" ? mk(s, { jp: s.jp - 1 }) : c.k === "d" ? mk(s, { dx: 0, mask: s.dx <= nT ? s.mask & ~(1 << (s.dx - 1)) : s.mask }) : mk(s, { js: s.js - 1 });
    // Omen of Whittling (poe2db): "your next Chaos Orb will remove the lowest level modifier", i.e. the mod with the lowest level at which it becomes available; ties are random.
    // The state only knows wanted mods and "unwanted" counts, so levels are modelled: a wanted mod has the average level of the tiers you accept (weighted), and every
    // unwanted mod has a level drawn from the pool's own level distribution. The removal probabilities are then exact for that model (no "unwanted first" assumption).
    let _lvPmf = null;
    function levelPmf() {
      if (_lvPmf) return _lvPmf;
      const m = new Map(); let tot = 0;
      for (const g in groups) { const gr = groups[g]; if (gr.d || gr.c) continue; for (const t of gr.tiers) if (t.w > 0) { m.set(t.lv, (m.get(t.lv) || 0) + t.w); tot += t.w; } }
      const lv = [...m.keys()].sort((a, b) => a - b); let acc = 0;
      return (_lvPmf = { lv, f: lv.map((l) => m.get(l) / tot), le: lv.map((l) => (acc += m.get(l) / tot)) });
    }
    const targetLevel = (i) => {
      const gr = groups[T[i].group]; const ts = gr.tiers.filter((t) => t.lv >= T[i].minLevel && (t.w > 0 || gr.d || gr.c)); if (!ts.length) return T[i].minLevel;
      const w = ts.reduce((a, t) => a + (t.w || 1), 0); return ts.reduce((a, t) => a + t.lv * (t.w || 1), 0) / w;
    };
    const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
    function whittleChances(tl, n) { // tl: levels of the wanted candidates; n: number of unwanted candidates. Returns {pt: [chance each wanted is removed], pj: chance an unwanted one is removed}
      const pm = levelPmf(), pt = tl.map(() => 0); let pj = 0;
      const tlr = tl.map((x) => { let b = pm.lv[0], d = Infinity; for (const l of pm.lv) if (Math.abs(l - x) < d) { d = Math.abs(l - x); b = l; } return b; }); // snap to a real level
      const levels = [...new Set(pm.lv.concat(tlr))].sort((a, b) => a - b);
      for (const L of levels) {
        if (tlr.some((x) => x < L)) continue;
        const at = tlr.map((x, j) => (x === L ? j : -1)).filter((j) => j >= 0), ix = pm.lv.indexOf(L), f = ix >= 0 ? pm.f[ix] : 0, above = 1 - (ix >= 0 ? pm.le[ix] : pm.le[Math.max(0, pm.lv.findIndex((l) => l > L) - 1)] || 0);
        for (let k = 0; k <= n; k++) {
          const wgt = n === 0 ? (k === 0 ? 1 : 0) : binom(n, k) * Math.pow(f, k) * Math.pow(above, n - k); if (wgt <= 0) continue;
          const tie = k + at.length; if (tie === 0) continue;
          at.forEach((j) => { pt[j] += wgt / tie; }); pj += wgt * k / tie;
        }
      }
      const tot = pt.reduce((a, x) => a + x, 0) + pj; return { pt: pt.map((x) => x / tot), pj: pj / tot };
    }
    root.Crafter.__whittle = { whittleChances, levelPmf }; // test hook: the audit checks these chances against a direct simulation
    const wcache2 = new Map();
    function removeOne(s, side, lowest) {
      const c = removables(s, side);
      if (!c.length) return null;
      if (!lowest) return c.map((x) => ({ p: 1 / c.length, s: applyRemove(s, x) }));
      const tc = c.filter((x) => x.k === "t" || (x.k === "d" && x.target)), jc = c.filter((x) => !(x.k === "t" || (x.k === "d" && x.target)));
      const tl = tc.map((x) => targetLevel(x.k === "t" ? x.i : s.dx - 1));
      const key = tl.map((x) => x.toFixed(1)).join(",") + "|" + jc.length; let ch = wcache2.get(key); if (!ch) { ch = whittleChances(tl, jc.length); wcache2.set(key, ch); }
      const out = []; tc.forEach((x, j) => { if (ch.pt[j] > 1e-12) out.push({ p: ch.pt[j], s: applyRemove(s, x) }); });
      jc.forEach((x) => { if (ch.pj > 1e-12) out.push({ p: ch.pj / jc.length, s: applyRemove(s, x) }); });
      return out;
    }
    const chain = (dist, f) => {
      const acc = new Map();
      for (const d of dist) {
        const nx = f(d.s); if (!nx) return null;
        for (const e of nx) { const k = enc(e.s); const o = acc.get(k); if (o) o.p += d.p * e.p; else acc.set(k, { p: d.p * e.p, s: e.s }); }
      }
      return [...acc.values()];
    };

    // ---- action catalogue ----
    const A = [];
    const sideSets = [["", null], ["Sinistral ", "P"], ["Dextral ", "S"]];
    const omenName = (kind, on) => "Omen of " + on.trim() + " " + kind;
    for (let v = 0; v < 3; v++) {
      const pre = TIER_NAMES[v];
      A.push({ name: pre + "Orb of Transmutation", cost: [pre + "Orb of Transmutation"], when: (s) => s.r === 0, run: (s) => addOne(mk(s, { r: 1 }), { aMin: MIN_LV.transmute[v] }) });
      A.push({ name: pre + "Orb of Augmentation", cost: [pre + "Orb of Augmentation"], when: (s) => s.r === 1, run: (s) => addOne(s, { aMin: MIN_LV.augment[v] }) });
      A.push({ name: pre + "Regal Orb", cost: [pre + "Regal Orb"], when: (s) => s.r === 1, run: (s) => addOne(mk(s, { r: 2 }), { aMin: MIN_LV.regal[v] }, 2) });
      for (const [on, sd] of sideSets) {
        for (const two of [false, true]) {
          const oc = (sd ? [omenName("Exaltation", on)] : []).concat(two ? ["Omen of Greater Exaltation"] : []);
          A.push({ name: pre + "Exalted Orb" + (oc.length ? " + " + oc.join(" + ") : ""), cost: [pre + "Exalted Orb"].concat(oc), when: (s) => s.r === 2,
            run: (s) => { const o = { aMin: MIN_LV.exalt[v], side: sd }; const d1 = addOne(s, o); return d1 && (two ? chain(d1, (x) => addOne(x, o)) : d1); } });
        }
        const ec = sd ? [omenName("Erasure", on)] : [];
        A.push({ name: pre + "Chaos Orb" + (ec.length ? " + " + ec[0] : ""), cost: [pre + "Chaos Orb"].concat(ec), when: (s) => s.r === 2,
          run: (s) => { const rm = removeOne(s, sd); return rm && chain(rm, (x) => addOne(x, { aMin: MIN_LV.chaos[v] })); } });
      }
      A.push({ name: pre + "Chaos Orb + Omen of Whittling", cost: [pre + "Chaos Orb", "Omen of Whittling"], when: (s) => s.r === 2,
        run: (s) => { const rm = removeOne(s, null, true); return rm && chain(rm, (x) => addOne(x, { aMin: MIN_LV.chaos[v] })); } });
    }
    const alch = (s) => { let d = [{ p: 1, s: mk(s, { r: 2 }) }]; for (let k = 0; k < 4 && d; k++) d = chain(d, (x) => addOne(x, { aMin: 1 }, 2)); return d; };
    A.push({ name: "Orb of Alchemy", cost: ["Orb of Alchemy"], when: (s) => s.r <= 1, run: (s) => alch(s.r === 1 ? mk(s, { mask: 0, jp: 0, js: 0 }) : s) });
    for (const [on, sd] of sideSets) {
      const oc = sd ? [omenName("Annulment", on)] : [];
      A.push({ name: "Orb of Annulment" + (oc.length ? " + " + oc[0] : ""), cost: ["Orb of Annulment"].concat(oc), when: (s) => s.r >= 1, run: (s) => removeOne(s, sd) });
    }

    // essences
    const etype = (D.bases[cfg.base] || {}).ty;
    for (const en in D.essences) {
      const e = D.essences[en]; const mid = e.m && e.m[etype]; if (!mid || !D.mods[mid]) continue;
      const m = D.mods[mid]; const ti = T.findIndex((t) => gkey(t.group) === m.g);
      if (!(ti >= 0 && m.lv >= T[ti].minLevel)) continue; // only essences that give a wanted mod
      const perfect = /^Perfect /.test(en) || /Corrupted/.test(e.ty || "") || e.tl === 1;
      const gen = (s) => (s.mask >> ti & 1 ? null : [{ p: 1, s: mk(s, { r: 2, mask: s.mask | 1 << ti }) }]);
      const label = en + " (" + modText(m) + ")";
      if (!perfect) A.push({ name: label, cost: [en], when: (s) => s.r === 1, run: gen });
      else for (const [on, sd] of sideSets) {
        const oc = sd ? [omenName("Crystallisation", on)] : [];
        A.push({ name: label + (oc.length ? " + " + oc[0] : ""), cost: [en].concat(oc), when: (s) => s.r === 2, run: (s) => { const rm = removeOne(s, sd); return rm && chain(rm, gen); } });
      }
    }

    // alloys: rare only, remove a random mod and add a fixed one (like a Perfect Essence). Only offered when the alloy has a price.
    T.forEach((t, ti) => {
      const gr = groups[t.group]; if (!gr || !gr.alloys) return;
      for (const an of gr.alloys) {
        if (/^\(needs/.test(an)) { issues.push("'" + modText(D.mods[gr.tiers[0].id]) + "' only rolls on an item with " + an.slice(7, -10) + " socketed. Tick it under 'Socket-bound augment' in the item section to include these mods in the crafting steps."); continue; }
        if (/^\(/.test(an)) { issues.push("'" + modText(D.mods[gr.tiers[0].id]) + "' can be held or marked as wanted, but the material that adds it is not confirmed, so no crafting step is calculated for it."); continue; }
        if (prices[an] == null) { issues.push(an + " has no price, so it is not offered for '" + modText(D.mods[gr.tiers[0].id]) + "'. Set a price for it to include it."); continue; }
        for (const [on, sd] of sideSets) { // Crystallisation with an alloy: used by two crafters (BigDaddy Gaming guide, Belton video 0.5.5); the omen's own text names only Perfect and Corrupted Essences
          const oc = sd ? [omenName("Crystallisation", on)] : [];
          A.push({ name: an + " (" + gr.tiers[0].text + ")" + (oc.length ? " + " + oc[0] : ""), cost: [an].concat(oc), when: (s) => s.r === 2 && !(s.mask >> ti & 1),
            run: (s) => { const rm = removeOne(s, sd); return rm && chain(rm, (x) => (x.mask >> ti & 1 ? null : [{ p: 1, s: mk(x, { mask: x.mask | 1 << ti }) }])); } });
        }
      }
    });

    // Fracturing Orb: rare, 4+ explicit mods, locks one random unlocked mod (once per item)
    if (fracIdx >= 0 || cfg.considerFracture) A.push({ name: "Fracturing Orb (locks a random mod)", cost: ["Fracturing Orb"], when: (s) => s.r === 2 && s.fx === 0 && total(s) >= 4,
      run: (s) => { const c = removables(s, null).filter((x) => x.k !== "d"); if (!c.length) return null;
        return c.map((x) => ({ p: 1 / c.length, s: x.k === "t" ? mk(s, { fx: x.i + 1 }) : x.k === "p" ? mk(s, { jp: s.jp - 1, fx: nT + 1 }) : x.k === "bp" ? mk(s, { bp: s.bp - 1, fx: nT + 1, bl: 1 }) : x.k === "bs" ? mk(s, { bs: s.bs - 1, fx: nT + 2, bl: 1 }) : mk(s, { js: s.js - 1, fx: nT + 2 }) })); } });

    // Desecration (Abyssal bones). Source: Mobalytics abyss guide (Jul 2026). A bone adds an unrevealed desecrated mod; if the item is full a
    // random mod is removed first and the new mod is on the same side. At the Well of Souls you pick 1 of 3 options drawn from the normal mod
    // pool (plus Kurgal/Ulaman/Amanamu mods); Omen of Abyssal Echoes rerolls the options once. Sinistral/Dextral Necromancy forces the side. The lich omens
    // (Sovereign, Liege, Blackblooded) guarantee one family mod, for weapons and jewellery only. Ancient bones: option mods are level 40 or higher.
    // Gnawed bones only work up to item level 64. Omen of Light on an Annulment removes only the desecrated mod.
    {
      const bc = boneClass(cfg.base), famOK = bc === "Jawbone" || bc === "Collarbone";
      const bones = [["Preserved " + bc, 1], ["Ancient " + bc, 40]]; if (cfg.ilvl <= 64) bones.push(["Gnawed " + bc, 1]);
      const famUseful = (f) => T.some((t) => groups[t.group].d && groups[t.group].tiers.some((x) => (x.tg || []).includes(f)));
      const fams = famOK ? [[null, null], ...Object.keys(FAMILY_OMEN).filter(famUseful).map((f) => [f, FAMILY_OMEN[f]])] : [[null, null]];
      const dsides = [[null, null], ["P", "Sinistral Necromancy"], ["S", "Dextral Necromancy"]];
      const dcache = new Map(), ddCache = new Map();
      // per side: wanted targets (weight), everything else lumped as junk (weight and number of groups)
      function optionPool(side, aMin, mask) {
        const ck = side + "|" + aMin + "|" + mask; if (dcache.has(ck)) return dcache.get(ck);
        const w = [], wi = []; let jw = 0, jn = 0;
        for (const g in groups) {
          const gr = groups[g]; if (gr.c || gr.side !== side) continue;
          const tiers = gr.tiers.filter((t) => t.lv >= aMin), gsum = tiers.reduce((a, t) => a + t.w, 0); if (gsum <= 0) continue;
          const ti = T.findIndex((t) => t.group === g);
          if (ti >= 0 && (mask >> ti & 1)) continue; // this group is already on the item
          if (ti >= 0) {
            const q = tiers.filter((t) => t.lv >= T[ti].minLevel).reduce((a, t) => a + t.w, 0);
            if (q > 0) { w.push(q); wi.push(ti); }
            if (gsum - q > 0) { jw += gsum - q; jn++; }
          } else { jw += gsum; jn++; }
        }
        const o = { w, wi, jw, jn }; dcache.set(ck, o); return o;
      }
      // probability of each set of wanted mods appearing among k drawn options (without replacement over mod groups)
      function drawDist(pool, k, fam) {
        const out = new Map(); const add = (m, p) => out.set(m, (out.get(m) || 0) + p);
        function rec(left, used, p, avail, jw, jn) {
          if (left === 0) return add(used, p);
          const tot = avail.reduce((a, i) => a + pool.w[i], 0) + jw;
          if (tot <= 0) return add(used, p);
          for (const i of avail) rec(left - 1, used | 1 << pool.wi[i], p * pool.w[i] / tot, avail.filter((x) => x !== i), jw, jn);
          if (jn > 0 && jw > 0) rec(left - 1, used, p * jw / tot, avail, jw - jw / jn, jn - 1);
        }
        const all = pool.w.map((_, i) => i);
        if (fam) { // one option is a random mod of the omen's family
          const famN = fam.n; if (famN <= 0) return null;
          let pt = 0;
          for (const [ti, cnt] of fam.targets) { pt += cnt / famN; rec(k - 1, 1 << ti, cnt / famN, all, pool.jw, pool.jn); }
          if (pt < 1) rec(k - 1, 0, 1 - pt, all, pool.jw, pool.jn);
        } else rec(k, 0, 1, all, pool.jw, pool.jn);
        return out;
      }
      const unionDist = (a, b) => { const o = new Map(); for (const [m1, p1] of a) for (const [m2, p2] of b) o.set(m1 | m2, (o.get(m1 | m2) || 0) + p1 * p2); return o; };
      // the 3 options shown when a desecrated mod is revealed (a second set with Omen of Abyssal Echoes); you take the best one
      function optionOutcomes(st, side, aMin, famTag, echo) {
        const pool = optionPool(side, aMin, st.mask);
        // poe2wiki: when a desecrated mod is revealed at least one of the three options is an exclusive desecrated mod (one that cannot roll normally) as long as the item level is
        // 65 or higher and the item type has an exclusive mod for that side; a lich omen makes that exclusive option a mod of the chosen family. Weights between exclusives are not published (equal here).
        const dk = side + "|" + aMin + "|" + st.mask + "|" + (famTag || "");
        let d1 = ddCache.get(dk);
        if (d1 === undefined) {
          let fam = { n: 0, targets: [] };
          for (const g in groups) {
            const gr = groups[g]; if (!gr.d || gr.side !== side) continue;
            if (famTag ? !gr.tiers.some((t) => (t.tg || []).includes(famTag) && t.lv >= aMin) : !(cfg.ilvl >= 65 && gr.tiers.some((t) => t.lv >= aMin))) continue;
            fam.n++; const ti = T.findIndex((t) => t.group === g); if (ti >= 0 && !(st.mask >> ti & 1) && gr.tiers.some((t) => t.lv >= T[ti].minLevel)) fam.targets.push([ti, 1]);
          }
          if (fam.n === 0 && !famTag) fam = null;
          d1 = drawDist(pool, Math.min(3, Math.max(1, pool.w.length + pool.jn)), famTag || fam ? fam : null); ddCache.set(dk, d1);
        }
        if (!d1) return null;
        let d = d1;
        if (echo) { const ek = dk + "|e"; d = ddCache.get(ek); if (!d) { d = unionDist(d1, d1); ddCache.set(ek, d); } }
        const out = [];
        for (const [m, p] of d) {
          const idx = []; for (let i = 0; i < nT; i++) if (m >> i & 1) idx.push(i);
          if (idx.length) out.push({ p, alts: idx.map((i) => mk(st, { mask: st.mask | 1 << i, dx: i + 1 })), key: "t" + idx.join(",") });
          else out.push({ p, alts: [mk(st, { dx: side === "P" ? nT + 1 : nT + 2 })], key: "j" + side });
        }
        return out;
      }
      const dRun = (aMin, famTag, sideOmen, echo) => (s) => {
        if (s.r !== 2 || s.dx !== 0) return null;
        const L = limFor(2), room = { P: L.P - heldCount(s, "P"), S: L.S - heldCount(s, "S") };
        // (state after the possible removal, side of the new mod, probability)
        let starts = [];
        if (room.P <= 0 && room.S <= 0) {
          const c = removables(s, sideOmen);
          if (!c.length) return null;
          for (const x of c) starts.push({ st: applyRemove(s, x), side: x.k === "t" ? tside[x.i] : x.k === "p" ? "P" : "S", p: 1 / c.length });
        } else {
          const sides = ["P", "S"].filter((x) => room[x] > 0 && (!sideOmen || sideOmen === x));
          if (!sides.length) return null;
          for (const x of sides) starts.push({ st: s, side: x, p: 1 / sides.length });
        }
        const acc = new Map(); const put = (alts, p, key) => { const k = key; const o = acc.get(k); if (o) o.p += p; else acc.set(k, { p, alts }); };
        for (const x of starts) {
          const outs = optionOutcomes(x.st, x.side, aMin, famTag, echo); if (!outs) return null;
          for (const o of outs) put(o.alts, x.p * o.p, o.key + "|" + enc(x.st));
        }
        return [...acc.values()].map((o) => ({ p: o.p, alts: o.alts }));
      };
      for (const [bn, aMin] of bones) for (const [fam, fo] of fams) for (const [sd, so] of dsides) for (const echo of [false, true]) {
        const oc = [fo, so && "Omen of " + so, echo && "Omen of Abyssal Echoes"].filter(Boolean);
        A.push({ name: "Desecrate with " + bn + (oc.length ? " + " + oc.join(" + ") : ""), cost: [bn].concat(oc), when: (s) => s.r === 2 && s.dx === 0, run: dRun(aMin, fam, sd, echo) });
      }
      // Lolcohol, Attack Breach Ring guide: on a 3-mod item a bone adds a 4th (unrevealed) mod; do not reveal it, and a Fracturing Orb then has a 1 in 3 chance to lock your mod.
      for (const [bn] of bones.filter((x) => !/^Ancient/.test(x[0]))) for (const [sd, so] of dsides) {
        A.push({ name: "Add an unrevealed desecrated mod with " + bn + (so ? " + Omen of " + so : "") + " (do not reveal it, so a Fracturing Orb can be used)", cost: [bn].concat(so ? ["Omen of " + so] : []),
          when: (s) => s.r === 2 && s.dx === 0 && (limFor(2).P - heldCount(s, "P") > 0 || limFor(2).S - heldCount(s, "S") > 0),
          run: (s) => { const L = limFor(2), sides = ["P", "S"].filter((x) => L[x] - heldCount(s, x) > 0 && (!sd || sd === x)); if (!sides.length) return null;
            return sides.map((x) => ({ p: 1 / sides.length, s: mk(s, { dx: x === "P" ? nT + 3 : nT + 4 }) })); } });
      }
      for (const echo of [false, true]) {
        A.push({ name: "Reveal the desecrated mod at the Well of Souls (pick 1 of 3)" + (echo ? " + Omen of Abyssal Echoes" : ""), cost: echo ? ["Omen of Abyssal Echoes"] : [],
          when: (s) => s.r === 2 && (s.dx === nT + 3 || s.dx === nT + 4),
          run: (s) => { const side = s.dx === nT + 3 ? "P" : "S", base = mk(s, { dx: 0 }); const outs = optionOutcomes(base, side, 1, null, echo); if (!outs) return null;
            return outs.map((o) => ({ p: o.p, alts: o.alts })); } });
      }
      // Lolcohol, Blood Mage Cast Speed Ring guide: swap a bad revealed desecrated mod out without an Omen of Light. Omen of Sinistral/Dextral Crystallisation + any
      // Perfect Essence replaces it with the essence mod, then Crystallisation + Essence of the Abyss replaces that with a Mark of the Abyss, which the next bone replaces.
      // Only safe when that side holds no other unlocked mod, because the essences remove a random mod on the side.
      {
        const cheapest = Object.keys(D.essences).filter((n) => /^Perfect /.test(n) && D.essences[n].m && D.essences[n].m[etype] && prices[n] != null).sort((x, y) => prices[x] - prices[y])[0];
        if (cheapest) for (const [sd, so] of [["P", "Sinistral"], ["S", "Dextral"]]) {
          A.push({ name: "Swap out a bad desecrated " + (sd === "P" ? "prefix" : "suffix") + " with " + cheapest + " and Essence of the Abyss (Omen of " + so + " Crystallisation twice)",
            cost: ["Omen of " + so + " Crystallisation", cheapest, "Omen of " + so + " Crystallisation", "Essence of the Abyss"],
            when: (s) => { if (s.r !== 2 || s.dx <= nT) return false; const ds = (s.dx === nT + 1 || s.dx === nT + 3) ? "P" : "S"; if (ds !== sd) return false; const c = removables(s, sd); return c.length === 1 && c[0].k === "d"; },
            run: (s) => [{ p: 1, s: mk(s, { dx: 0 }) }] });
        }
      }
      A.push({ name: "Orb of Annulment + Omen of Light (removes only the desecrated mod)", cost: ["Orb of Annulment", "Omen of Light"], when: (s) => s.r === 2 && s.dx > nT,
        run: (s) => [{ p: 1, s: mk(s, { dx: 0, mask: s.dx >= 1 && s.dx <= nT ? s.mask & ~(1 << (s.dx - 1)) : s.mask }) }] });
    }

    const acts = A.filter((a) => {
      if (cfg.disabled && cfg.disabled.has(a.name)) return false;
      const bad = a.cost.filter((c) => prices[c] == null);
      bad.forEach((c) => missing.add(c));
      return !bad.length;
    });
    const priceOf = (a) => a.cost.reduce((t, c) => t + prices[c], 0);

    // ---- value iteration over reachable states ----
    const failCost = cfg.failCost != null ? cfg.failCost : 10; // price of a new base when the item is ruined
    const fresh = { r: 0, mask: 0, jp: 0, js: 0, fx: 0, dx: 0, bp: 0, bs: 0, bl: 0 };
    const start = { r: rar, mask: mask0, jp: Math.min(jp0, 3), js: Math.min(js0, 3), fx: fx0, dx: dx0, bp: Math.min(bp0, 3), bs: Math.min(bs0, 3), bl: 0 };
    // ---- crafting sequence: push the exact outcome distribution through a list of steps ----
    const actions = acts.map((a) => ({ name: a.name, cost: priceOf(a) }));
    function runSequence(steps) {
      const addTo = (m, st, p) => { const k = enc(st); const o = m.get(k); if (o) o.p += p; else m.set(k, { p, s: st }); };
      let dist = new Map(); addTo(dist, start, 1);
      const out = [], pEach = (d) => T.map((_, i) => { let x = 0; for (const e of d.values()) if (e.s.mask >> i & 1) x += e.p; return x; });
      const pGoal = (d) => { let x = 0; for (const e of d.values()) if (goal(e.s)) x += e.p; return x; };
      let spend = 0;
      const freeBoth = (st) => { const L = limFor(2); return L.P - heldCount(st, "P") <= 0 && L.S - heldCount(st, "S") <= 0; };
      const condOf = (u) => {
        if (!u || u === "times") return null;
        if (u === "goal") return goal;
        if (u === "nojunk") return (st) => st.jp + st.js === 0;
        if (u === "full") return freeBoth;
        if (u.indexOf("mods:") === 0) { const n = +u.slice(5); return (st) => total(st) <= n; }
        if (u.indexOf("atleast:") === 0) { const n = +u.slice(8); return (st) => total(st) >= n; }
        if (u.indexOf("has:") === 0) { const i = +u.slice(4); return (st) => !!(st.mask >> i & 1); }
        return null;
      };
      const untilWords = (u) => (u === "goal" ? "all wanted mods are on the item" : u === "nojunk" ? "no unwanted mods are left" : u === "full" ? "the item has no free slots" : u && u.indexOf("mods:") === 0 ? "the item has at most " + u.slice(5) + " mods" : u && u.indexOf("atleast:") === 0 ? "the item has at least " + u.slice(8) + " mods" : u && u.indexOf("has:") === 0 ? (T[+u.slice(4)] ? modText(D.mods[groups[T[+u.slice(4)].group].tiers[0].id]).replace(/\([\d.]+-[\d.]+\)/g, "#") + " is on the item" : "that mod is on the item") : "");
      for (const stp of steps) {
        const a = acts.find((x) => x.name === stp.name);
        if (!a) { out.push({ name: stp.name, times: stp.times, error: "Not available for this item or your targets." }); continue; }
        const unit = priceOf(a), cond = condOf(stp.until);
        const times = Math.max(1, Math.min(cond ? 2000 : 500, Math.round(cond ? (stp.max || 100) : stp.times) || 1));
        let used = 0, applicable = 0;
        for (let k = 0; k < times; k++) {
          const nd = new Map(); let usedNow = 0, tot = 0;
          for (const e of dist.values()) {
            tot += e.p;
            if (goal(e.s) || (cond && cond(e.s)) || !a.when(e.s)) { addTo(nd, e.s, e.p); continue; }
            const res = a.run(e.s);
            if (!res || !res.length) { addTo(nd, e.s, e.p); continue; }
            usedNow += e.p;
            for (const o of res) addTo(nd, o.s || o.alts[0], e.p * o.p);
          }
          used += usedNow; if (k === 0) applicable = usedNow / (tot || 1); dist = nd;
          if (cond && usedNow < 1e-9) break;
        }
        const cost = used * unit; spend += cost;
        out.push({ name: a.name, times, until: cond ? untilWords(stp.until) : "", uses: used, unitCost: unit, cost, cumCost: spend, pGoal: pGoal(dist), pEach: pEach(dist), appliesFirst: applicable });
      }
      const g = pGoal(dist);
      return { steps: out, spend, pGoal: g, costPerSuccess: g > 1e-12 ? spend / g : null, targets: T.map((t) => t.group), pEach: pEach(dist) };
    }
    const sequence = runSequence(cfg.sequence || []);
    if (cfg.sequenceOnly) return { actions, sequence, issues, skipped: [], targets: T, start: { prefixRoom: limFor(rar).P - heldCount(start, "P"), suffixRoom: limFor(rar).S - heldCount(start, "S") } };

    const _t0 = Date.now(), _tm = {};
    const nodes = new Map();
    const queue = [start, fresh]; nodes.set(enc(start), { s: start, edges: null, V: 1e12 });
    if (!nodes.has(enc(fresh))) nodes.set(enc(fresh), { s: fresh, edges: null, V: 1e12 });
    while (queue.length) {
      const s = queue.pop(); const node = nodes.get(enc(s));
      node.edges = [];
      if (goal(s)) { node.V = 0; continue; }
      for (const a of acts) {
        if (!a.when(s)) continue;
        const d = a.run(s); if (!d || !d.length) continue;
        if (d.length === 1 && d[0].s && enc(d[0].s) === enc(s)) continue;
        const reg = (st) => { const k = enc(st); if (!nodes.has(k)) { nodes.set(k, { s: st, edges: null, V: 1e12 }); queue.push(st); } return k; };
        const dist = d.map((e) => ({ p: e.p, ks: (e.alts || [e.s]).map(reg) }));
        node.edges.push({ a, cost: priceOf(a), dist });
      }
    }
    _tm.bfs = Date.now() - _t0;
    // Items that can no longer reach the goal are ruined: they cost a new base. Scrapping an item that could still be finished
    // is offered only when asked for (cfg.allowScrap).
    {
      const reach = new Set(); for (const [k, n] of nodes) if (goal(n.s)) reach.add(k);
      for (let ch = true; ch;) { ch = false; for (const [k, n] of nodes) { if (reach.has(k) || !n.edges) continue; if (n.edges.some((ed) => ed.dist.some((d) => d.ks.some((x) => reach.has(x))))) { reach.add(k); ch = true; } } }
      for (const [k, n] of nodes) {
        if (!n.edges || goal(n.s) || k === enc(fresh)) continue;
        if (!reach.has(k)) n.edges.push({ a: { name: "Item is ruined (no way to finish): start over on a new base" }, cost: failCost, dist: [{ ks: [enc(fresh)], p: 1 }] });
        else if (cfg.allowScrap) n.edges.push({ a: { name: "Scrap this item and start over on a new base" }, cost: failCost, dist: [{ ks: [enc(fresh)], p: 1 }] });
      }
    }
    // value iteration warm start, then policy iteration (exact evaluation of each policy), on flat arrays for speed
    const all = [...nodes.values()]; all.forEach((n, i) => { n.i = i; });
    const arr = all.filter((n) => n.edges && n.edges.length);
    const Vf = new Float64Array(all.length); all.forEach((n) => { Vf[n.i] = goal(n.s) ? 0 : 1e12; });
    for (const n of arr) for (const ed of n.edges) { ed.ps = Float64Array.from(ed.dist.map((d) => d.p)); ed.al = ed.dist.map((d) => Int32Array.from(d.ks.map((k) => nodes.get(k).i))); }
    const qE = (ed) => { let q = ed.cost; for (let j = 0; j < ed.ps.length; j++) { const al = ed.al[j]; let v = Vf[al[0]]; for (let t = 1; t < al.length; t++) { const w = Vf[al[t]]; if (w < v) v = w; } q += ed.ps[j] * v; } return q; };
    const order = arr.slice().sort((x, y) => (pc(y.s.mask) - pc(x.s.mask)) || (y.s.r - x.s.r) || ((x.s.jp + x.s.js) - (y.s.jp + y.s.js)));
    for (let it = 0; it < 10; it++) for (const n of order) { let best = Vf[n.i]; for (const ed of n.edges) { const q = qE(ed); if (q < best) best = q; } Vf[n.i] = best; }
    _tm.warm = Date.now() - _t0;
    const pol = new Map();
    for (let round = 0; round < 60; round++) {
      let changed = false;
      for (const n of order) {
        let best = Infinity, bi = null; const cur = pol.get(n);
        for (const ed of n.edges) { const q = qE(ed); if (q < best - 1e-9 * Math.abs(best) || bi === null) { best = q; bi = ed; } }
        if (cur && qE(cur) <= best + 1e-6 * Math.abs(best)) bi = cur;
        if (bi !== cur) { pol.set(n, bi); changed = true; }
      }
      if (!changed) break;
      _tm.rounds = round + 1;
      for (let it = 0; it < 80; it++) {
        let delta = 0;
        for (const n of order) { const q = Math.min(1e12, qE(pol.get(n))); delta = Math.max(delta, Math.abs(q - Vf[n.i]) / Math.max(1, q)); Vf[n.i] = q; }
        if (delta < 1e-9) break;
      }
    }
    for (let it = 0; it < 8000; it++) { // exact evaluation of the final policy
      let delta = 0;
      for (const n of order) { const ed = pol.get(n); if (!ed) continue; const q = Math.min(1e12, qE(ed)); delta = Math.max(delta, Math.abs(q - Vf[n.i]) / Math.max(1, q)); Vf[n.i] = q; }
      if (delta < 1e-10) break;
    }
    all.forEach((n) => { n.V = Vf[n.i]; });
    const bestK = (d) => { let b = d.ks[0], bv = nodes.get(b).V; for (let i = 1; i < d.ks.length; i++) { const v = nodes.get(d.ks[i]).V; if (v < bv) { bv = v; b = d.ks[i]; } } return b; };
    const qOf = (ed) => { let q = ed.cost; for (const d of ed.dist) q += d.p * nodes.get(bestK(d)).V; return q; };
    _tm.pi = Date.now() - _t0;
    const sNode = nodes.get(enc(start));
    const lab = (i) => modText(D.mods[groups[T[i].group].tiers[0].id]).replace(/\([\d.]+-[\d.]+\)/g, "#");
    const diffText = (a, s) => {
      const parts = [];
      T.forEach((t, i) => { if ((s.mask >> i & 1) && !(a.mask >> i & 1)) parts.push("+ " + lab(i)); if (!(s.mask >> i & 1) && (a.mask >> i & 1)) parts.push("lost " + lab(i)); });
      if (s.jp > a.jp) parts.push((s.jp - a.jp) + " unwanted prefix added"); if (s.js > a.js) parts.push((s.js - a.js) + " unwanted suffix added");
      if (s.jp < a.jp) parts.push((a.jp - s.jp) + " unwanted prefix removed"); if (s.js < a.js) parts.push((a.js - s.js) + " unwanted suffix removed");
      if ((s.bp | 0) + (s.bs | 0) < (a.bp | 0) + (a.bs | 0)) parts.push(((a.bp | 0) + (a.bs | 0) - (s.bp | 0) - (s.bs | 0)) + " mod to replace removed");
      if (s.fx !== a.fx) parts.push(s.fx >= 1 && s.fx <= nT ? "fractured: " + lab(s.fx - 1) : "fractured an unwanted mod");
      if (s.dx !== a.dx) parts.push(s.dx === 0 ? "desecrated mod removed" : s.dx <= nT ? "desecrated: " + lab(s.dx - 1) : s.dx >= nT + 3 ? "unrevealed desecrated mod added" : "unwanted desecrated mod (locked)");
      if (s.r !== a.r) parts.push(["normal", "magic", "rare"][s.r]);
      return parts.join(", ") || "no change";
    };
    const describe = (s) => diffText(start, s);
    const stateText = (s) => {
      const have = []; for (let i = 0; i < nT; i++) if (s.mask >> i & 1) have.push(lab(i));
      const parts = [["Normal", "Magic", "Rare"][s.r] + " item"];
      parts.push(have.length ? "has " + have.join("; ") : "none of your wanted mods yet");
      if (s.jp + s.js > 0) parts.push(s.jp + " unwanted prefix" + (s.jp === 1 ? "" : "es") + ", " + s.js + " unwanted suffix" + (s.js === 1 ? "" : "es"));
      if ((s.bp | 0) + (s.bs | 0) > 0) parts.push(((s.bp | 0) + (s.bs | 0)) + " mod" + ((s.bp | 0) + (s.bs | 0) === 1 ? "" : "s") + " still to replace");
      if (s.fx) parts.push("fractured: " + (s.fx <= nT ? lab(s.fx - 1) : "an unwanted mod"));
      if (s.dx) parts.push("desecrated: " + (s.dx <= nT ? lab(s.dx - 1) : s.dx >= nT + 3 ? "an unrevealed mod" : "an unwanted mod"));
      return parts.join(" | ");
    };
    const options = (sNode.edges || []).map((ed) => {
      const q = qOf(ed);
      let pHit = 0; // chance that one use gains a target mod
      for (const d of ed.dist) { const st = nodes.get(bestK(d)).s; if (pc(st.mask) > pc(start.mask)) pHit += d.p; }
      return { name: ed.a.name, cost: ed.cost, expected: q, pHit, avgToHit: pHit > 1e-12 ? 1 / pHit : null, outcomes: ed.dist.map((d) => ({ p: d.p, what: describe(nodes.get(bestK(d)).s), done: goal(nodes.get(bestK(d)).s) })).sort((a, b) => b.p - a.p) };
    }).sort((a, b) => a.expected - b.expected);
    const skipped = [...missing].sort();
    // Expected number of times each action is used over the whole craft, following the best policy from the start.
    const plan = [], route = [];
    let pSuccess = null, spendIfAttempt = null;
    if (sNode.V < 1e10 && !goal(start)) {
      // expected number of visits to each state under the best policy (flat arrays)
      let vArr = new Float64Array(all.length), nvArr = new Float64Array(all.length);
      const sIdx = nodes.get(enc(start)).i; vArr[sIdx] = 1;
      const tgt = new Map();
      for (const node of arr) { const ed = pol.get(node); if (!ed) continue; const idx = new Int32Array(ed.dist.length); ed.dist.forEach((d, j) => { idx[j] = nodes.get(bestK(d)).i; }); tgt.set(node, idx); }
      for (let it = 0; it < 20000; it++) {
        nvArr.fill(0); nvArr[sIdx] = 1;
        for (const node of arr) { const w = vArr[node.i]; if (!w) continue; const ed = pol.get(node); if (!ed) continue; const idx = tgt.get(node); for (let j = 0; j < idx.length; j++) nvArr[idx[j]] += w * ed.ps[j]; }
        let delta = 0; for (let k = 0; k < nvArr.length; k++) { const d = Math.abs(nvArr[k] - vArr[k]); if (d > delta) delta = d; }
        const tmp = vArr; vArr = nvArr; nvArr = tmp;
        if (delta < 1e-8) break;
      }
      const uses = new Map();
      for (const node of arr) { const w = vArr[node.i]; const ed = pol.get(node); if (w && ed) { const u = uses.get(ed.a.name) || { uses: 0, cost: ed.cost }; u.uses += w; uses.set(ed.a.name, u); } }
      for (const [name, u] of uses) if (u.uses > 1e-4) plan.push({ name, uses: u.uses, cost: u.cost, subtotal: u.uses * u.cost });
      plan.sort((a, b) => b.subtotal - a.subtotal);
      // Recipe: what to do for each state of the item the best policy visits, in the order the states usually occur.
      const rows = [];
      for (const node of arr) {
        const w = vArr[node.i], ed = pol.get(node);
        if (!w || w < 0.02 || !ed || goal(node.s)) continue;
        rows.push({ s: node.s, state: stateText(node.s), action: ed.a.name, visits: w, cost: ed.cost, outcomes: ed.dist.map((d) => { const t = nodes.get(bestK(d)).s; return { p: d.p, what: diffText(node.s, t), done: goal(t) }; }).sort((a, b) => b.p - a.p).slice(0, 4), isStart: enc(node.s) === enc(start) });
      }
      rows.sort((a, b) => b.visits - a.visits); rows.length = Math.min(rows.length, 20);
      // order: how many crafts it usually takes to get to that state from the item as it is now (breadth first over likely outcomes)
      const depth = new Map(); depth.set(enc(start), 0);
      for (let frontier = [start], d = 0; frontier.length && d < 60; d++) {
        const nextF = [];
        for (const st of frontier) { const ed = pol.get(nodes.get(enc(st))); if (!ed) continue;
          for (const o of ed.dist) { if (o.p < 0.02) continue; const k = bestK(o); if (!depth.has(k)) { depth.set(k, d + 1); nextF.push(nodes.get(k).s); } } }
        frontier = nextF;
      }
      rows.sort((a, b) => ((depth.get(enc(a.s)) ?? 99) - (depth.get(enc(b.s)) ?? 99)) || (b.visits - a.visits));
      rows.forEach((r) => { delete r.s; route.push(r); });
      // chance the item gets finished (rather than ruined) and the currency spent on it, following this policy
      let pEnd = 0, pRuin = 0;
      for (const node of arr) { const w = vArr[node.i], ed = pol.get(node); if (w && ed && /ruined|Scrap/.test(ed.a.name)) pRuin += w; }
      for (const n of all) if (goal(n.s)) pEnd += vArr[n.i];
      pSuccess = pEnd > 0 ? Math.min(1, pEnd / (pEnd + pRuin)) : 0;
      spendIfAttempt = plan.filter((x) => !/ruined|Scrap/.test(x.name)).reduce((a, x) => a + x.subtotal, 0);
    }
    // Monte Carlo of the item's crafting: from the item as it is now, draw each outcome at random and follow a route until the goal.
    // mode "cost" (default): the solver's cheapest-on-average policy; ruined items are replaced by a new base (failCost) and the craft restarts.
    // mode "chance": at every state take the action that gives the highest chance of finishing without ruining the item (no restarts, no scrapping);
    // actions within 0.2 percentage points of the best chance count as equal and the cheapest of them is taken (otherwise a 0.03% edge could cost thousands of exalted). A run that reaches a state with no way to finish is "ruined" and stops there.
    // Returns one record per run: {done, ruined, spend, steps, counts:[{name, uses, cost}]}; the array has .successChance for the chosen mode.
    const isRestart = (ed) => /^(Item is ruined|Scrap)/.test(ed.a.name);
    let _P = null;
    const successP = () => {
      if (_P) return _P;
      const P = new Float64Array(all.length);
      all.forEach((n) => { if (goal(n.s)) P[n.i] = 1; });
      const t0 = Date.now();
      for (let it = 0; it < 6000 && Date.now() - t0 < 3000; it++) {
        let delta = 0;
        for (const n of order) {
          if (P[n.i] === 1 && goal(n.s)) continue;
          let best = 0;
          for (const ed of n.edges) { if (isRestart(ed)) continue; let p = 0; for (let j = 0; j < ed.ps.length; j++) { const al = ed.al[j]; let v = P[al[0]]; for (let t = 1; t < al.length; t++) if (P[al[t]] > v) v = P[al[t]]; p += ed.ps[j] * v; } if (p > best) best = p; }
          if (best - P[n.i] > delta) delta = best - P[n.i];
          P[n.i] = best;
        }
        if (delta < 1e-12) break;
      }
      return (_P = P);
    };
    const chanceEdge = new Map();
    const pickEdge = (node, P) => {
      if (chanceEdge.has(node)) return chanceEdge.get(node);
      let best = -1; const scored = [];
      for (const ed of node.edges) { if (isRestart(ed)) continue; let p = 0; for (let j = 0; j < ed.ps.length; j++) { const al = ed.al[j]; let v = P[al[0]]; for (let t = 1; t < al.length; t++) if (P[al[t]] > v) v = P[al[t]]; p += ed.ps[j] * v; } scored.push([ed, p]); if (p > best) best = p; }
      let pick = null, pq = Infinity;
      for (const [ed, p] of scored) if (p >= best - 2e-3) { const q = qOf(ed); if (q < pq) { pq = q; pick = ed; } }
      chanceEdge.set(node, pick); return pick;
    };
    const simulate = (runs, rng, mode) => {
      rng = rng || Math.random; const out = []; const chance = mode === "chance"; const P = chance ? successP() : null;
      for (let r = 0; r < runs; r++) {
        let node = sNode, spend = 0, steps = 0, done = false, ruined = false; const counts = new Map();
        while (steps < 20000) {
          if (goal(node.s)) { done = true; break; }
          const ed = chance ? (P[node.i] > 1e-12 ? pickEdge(node, P) : null) : pol.get(node);
          if (!ed) { ruined = chance; break; }
          spend += ed.cost; steps++;
          const c = counts.get(ed.a.name) || { uses: 0, cost: ed.cost }; c.uses++; counts.set(ed.a.name, c);
          let x = rng(), acc = 0, pick = ed.dist[ed.dist.length - 1];
          for (const d of ed.dist) { acc += d.p; if (x < acc) { pick = d; break; } }
          if (chance) { let bk = pick.ks[0], bv = P[nodes.get(bk).i]; for (const k of pick.ks) { const v = P[nodes.get(k).i]; if (v > bv + 1e-12) { bv = v; bk = k; } } node = nodes.get(bk); }
          else node = nodes.get(bestK(pick));
        }
        out.push({ done, ruined, spend, steps, counts: [...counts].map(([name, u]) => ({ name, uses: u.uses, cost: u.cost })) });
      }
      out.successChance = chance ? P[sNode.i] : null;
      return out;
    };
    return { timing: _tm, actions, sequence, plan, route, pSuccess, simulate, spendIfAttempt, done: goal(start), expectedCost: sNode.V, reachable: sNode.V < 1e10, options, issues, skipped, targets: T, states: nodes.size,
      start: { prefixRoom: limFor(rar).P - heldCount(start, "P"), suffixRoom: limFor(rar).S - heldCount(start, "S") } };
  }

  root.Crafter = { parseItem, solve, groupsFor, basePool, slotLimits, modText, MIN_LV, augmentsFor };
  if (typeof module !== "undefined") module.exports = root.Crafter;
})(typeof window !== "undefined" ? window : globalThis);
