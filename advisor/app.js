(function () {
  "use strict";
  const C = window.Crafter, D = window.CRAFT_DATA;
  const $ = (id) => document.getElementById(id);
  const st = { held: [], targets: [] };
  let prices = {};
  var unitFactor = () => 1, unitName = () => "Exalted Orbs"; // set once the cost units exist (renderPrices can run before that)
  try { prices = JSON.parse(localStorage.getItem("craftPrices") || "{}"); } catch (e) {}

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const augTags = () => { const sel = $("augment"); return sel && sel.value ? [sel.value] : []; };
  const groups = () => { const b = $("base").value; return D.bases[b] ? C.groupsFor(b, +$("ilvl").value || 100, augTags()) : {}; };
  function fillAugments(keep) {
    const sel = $("augment"); if (!sel) return;
    const list = C.augmentsFor($("base").value);
    sel.innerHTML = '<option value="">None</option>' + list.map((a) => `<option value="${a.tag}">${esc(a.name)} (adds ${a.tag} modifiers)</option>`).join("");
    sel.disabled = !list.length;
    if (keep && list.some((a) => a.tag === keep)) sel.value = keep;
  }
  const bareG = (x) => String(x).replace(/^[EA]:/, "");
  const heldOf = (group) => st.held.find((h) => bareG(h.group) === bareG(group));
  // default "at least" tier for a target: the tier above the one already on the item, otherwise the second best tier
  function defaultMin(gr) {
    const h = heldOf(gr.group), t = gr.tiers;
    if (h) { const above = t.filter((x) => x.lv > (h.lv || 0)).pop(); return (above || t[0]).lv; }
    return t[Math.min(1, t.length - 1)].lv;
  }
  const gLabel = (g) => C.modText(D.mods[g.tiers[0].id]).replace(/\(([\d.]+)-([\d.]+)\)/g, "#");

  // ---- item type, then every base of that type ----
  const SECTIONS = [["Weapons", /Sword|Axe|Mace|Spear|Bow|Crossbow|Flail|Sceptre|Wand|Staff|Dagger|Claw|Talisman/], ["Armour", /Body Armour|Helmet|Gloves|Boots|Shield|Focus/], ["Jewellery", /Ring|Amulet|Belt/], ["Other", /./]];
  const types = [...new Set(Object.values(D.bases).map((b) => b.ty))].sort();
  $("cls").innerHTML = SECTIONS.map(([name, re], si) => {
    const list = types.filter((t) => re.test(t) && !SECTIONS.slice(0, si).some(([, r2]) => r2.test(t)));
    return list.length ? `<optgroup label="${name}">${list.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</optgroup>` : "";
  }).join("");
  const ATTR = { str_armour: "Strength", dex_armour: "Dexterity", int_armour: "Intelligence", str_dex_armour: "Str / Dex", str_int_armour: "Str / Int", dex_int_armour: "Dex / Int", str_dex_int_armour: "Str / Dex / Int" };
  function fillBases(keep) {
    const ty = $("cls").value;
    const bases = Object.keys(D.bases).filter((n) => D.bases[n].ty === ty && !D.bases[n].tg.includes("not_for_sale")).sort((x, y) => (D.bases[y].rl - D.bases[x].rl) || x.localeCompare(y));
    const attrOf = (n) => { const t = D.bases[n].tg.find((x) => ATTR[x]); return t ? ATTR[t] : ""; };
    const sec = {}; bases.forEach((n) => (sec[attrOf(n)] = sec[attrOf(n)] || []).push(n));
    $("base").innerHTML = Object.keys(sec).sort().map((k) => {
      const opts = sec[k].map((n) => `<option value="${esc(n)}">${esc(n)} (req lvl ${D.bases[n].rl})</option>`).join("");
      return k ? `<optgroup label="${k}">${opts}</optgroup>` : opts;
    }).join("");
    if (keep && D.bases[keep] && D.bases[keep].ty === ty) $("base").value = keep;
  }
  function setBase(name) { if (!D.bases[name]) return; $("cls").value = D.bases[name].ty; fillBases(name); $("base").value = name; }

  // Only one mod on an item can ever be fractured: once one held mod or one target has it, every other fracture box is disabled.
  const fracTaken = () => st.held.some((h) => h.fractured) || st.targets.some((t) => t.fractured);
  const FRAC_TIP = "Only one mod on an item can be fractured, and one already is. Untick that one first.";
  function syncFracForms() {
    const taken = fracTaken();
    ["heldFrac", "targetFrac"].forEach((id) => { const e = $(id); if (!e) return; if (taken) e.checked = false; e.disabled = taken; e.title = taken ? FRAC_TIP : ""; });
  }
  function renderHeld() {
    $("held").innerHTML = st.held.map((h, i) => `<div class="chip${typeof avoidSet === "function" && avoidSet().has(String(h.group).replace(/^[EA]:/, "")) ? " avoidchip" : ""}"><span><span class="${h.side}">${h.side === "P" ? "Prefix" : "Suffix"}</span> ${esc(h.text)}
      ${h.desecrated ? '<span class="tag">desecrated</span>' : ""}${h.crafted ? '<span class="tag">crafted</span>' : ""}${h.fractured ? '<span class="tag">fractured</span>' : ""}${typeof avoidSet === "function" && avoidSet().has(String(h.group).replace(/^[EA]:/, "")) ? '<span class="tag" style="color:var(--bad)">on your avoid list</span>' : ""}
      <label class="dim"><input type="checkbox" data-frac="${i}" ${h.fractured ? "checked" : ""} ${fracTaken() && !h.fractured ? `disabled title="${FRAC_TIP}"` : ""}> fractured</label>
      <label class="dim" title="Remove this mod during the craft and make room for the mods you want. The plan only counts as finished once it is gone."><input type="checkbox" data-repl="${i}" ${effReplace(h) && !h.fractured && !h.locked ? "checked" : ""} ${h.fractured || h.locked ? "disabled" : ""}> replace this mod</label>
      <label class="dim"><input type="checkbox" data-lock="${i}" ${h.locked || h.fractured ? "checked" : ""} ${h.fractured ? "disabled" : ""}> locked</label></span><span class="x" data-rm="${i}">✕</span></div>`).join("") || '<span class="dim">None</span>';
    $("held").querySelectorAll("[data-rm]").forEach((e) => e.onclick = () => { st.held.splice(+e.dataset.rm, 1); renderHeld(); });
    if ($("heldMod")) fillMods();
    syncFracForms();
    if (typeof renderItemCard === "function") renderItemCard();
    $("held").querySelectorAll("[data-repl]").forEach((e) => e.onchange = () => { st.held[+e.dataset.repl].replace = e.checked; });
    $("held").querySelectorAll("[data-lock]").forEach((e) => e.onchange = () => { st.held[+e.dataset.lock].locked = e.checked; });
    $("held").querySelectorAll("[data-frac]").forEach((e) => e.onchange = () => { const h = st.held[+e.dataset.frac]; h.fractured = e.checked; if (e.checked) h.locked = true; renderHeld(); renderTargets(); });
  }
  function renderTargets() {
    const g = groups();
    $("targets").innerHTML = st.targets.map((t, i) => {
      const gr = g[t.group]; if (!gr) return `<div class="chip warn">${esc(t.group)} (not available on this base)<span class="x" data-rm="${i}">✕</span></div>`;
      const opts = gr.tiers.map((x, k) => `<option value="${x.lv}" ${x.lv === t.minLevel ? "selected" : ""}>T${k + 1} ${esc(x.text)} (lvl ${x.lv})</option>`).join("");
      return `<div class="chip" style="flex-wrap:wrap"><span><span class="${gr.side}">${gr.side === "P" ? "Prefix" : "Suffix"}</span> ${esc(gLabel(gr))}
        ${gr.d ? '<span class="tag">desecrated: Abyssal bones</span>' : ""}${gr.c ? '<span class="tag">crafted: ' + esc((gr.essences || gr.alloys || []).join(", ")) + "</span>" : ""}</span><span class="x" data-rm="${i}">✕</span>
        <div style="width:100%">at least <select data-min="${i}">${opts}</select></div>${(() => { const h = heldOf(t.group); if (!h) return ""; const k = gr.tiers.findIndex((x) => x.lv === (h.lv || 0)); const ok = (h.lv || 0) >= t.minLevel; return `<div class="${ok ? "dim" : "warn"}" style="width:100%">On the item now: ${k >= 0 ? "T" + (k + 1) + " " : ""}(level ${h.lv || "?"}). ${ok ? "That already meets this target, so nothing is left to craft for it: raise the tier above to go higher." : "Below this tier: the craft will replace it."}</div>`; })()}
        <label class="dim" style="width:100%"><input type="checkbox" data-tfrac="${i}" ${t.fractured ? "checked" : ""} ${fracTaken() && !t.fractured ? `disabled title="${FRAC_TIP}"` : ""}> fracture this mod (lock it with a Fracturing Orb)</label></div>`;
    }).join("") || '<span class="dim">None</span>';
    $("targets").querySelectorAll("[data-rm]").forEach((e) => e.onclick = () => { st.targets.splice(+e.dataset.rm, 1); renderTargets(); });
    $("targets").querySelectorAll("[data-tfrac]").forEach((e) => e.onchange = () => { st.targets.forEach((t) => (t.fractured = false)); if (e.checked) st.targets[+e.dataset.tfrac].fractured = true; renderTargets(); renderHeld(); });
    $("targets").querySelectorAll("[data-min]").forEach((e) => e.onchange = () => { st.targets[+e.dataset.min].minLevel = +e.value; });
    const n = st.targets.length; const cur = +$("need").value || n;
    if ($("targetMod")) fillMods();
    if (typeof renderPicker === "function") renderPicker();
    syncFracForms();
    if (typeof renderItemCard === "function") renderItemCard();
    $("need").innerHTML = Array.from({ length: Math.max(n, 1) }, (_, k) => `<option value="${k + 1}" ${k + 1 === Math.min(cur, n) || (k + 1 === n && cur > n) ? "selected" : ""}>${k + 1}</option>`).join("");
  }
  // ---- mod dropdowns: every mod that can roll on this base, prefixes and suffixes (and desecrated ones) separated ----
  function modOptions(filter, exclude) {
    const g = groups(), f = (filter || "").toLowerCase().trim();
    const buckets = { P: [], S: [], DP: [], DS: [], CP: [], CS: [] };
    for (const k in g) {
      if (exclude.has(k)) continue;
      const lab = gLabel(g[k]); if (f && !(lab + " " + k).toLowerCase().includes(f)) continue;
      buckets[(g[k].d ? "D" : g[k].c ? "C" : "") + g[k].side].push({ k, lab });
    }
    const names = { P: "Prefixes", S: "Suffixes", DP: "Desecrated prefixes (Abyssal bones only)", DS: "Desecrated suffixes (Abyssal bones only)", CP: "Crafted prefixes (essence only)", CS: "Crafted suffixes (essence only)" };
    return Object.keys(buckets).filter((b) => buckets[b].length).map((b) =>
      `<optgroup label="${names[b]}">${buckets[b].sort((x, y) => x.lab.localeCompare(y.lab)).map((x) => `<option value="${esc(x.k)}">${esc(x.lab)}</option>`).join("")}</optgroup>`).join("") || '<option value="">(no mods match)</option>';
  }
  function fillTiers() {
    const gr = groups()[$("heldMod").value];
    $("heldTier").innerHTML = gr ? gr.tiers.map((x, k) => `<option value="${k}">T${k + 1}: ${esc(x.text)} (lvl ${x.lv})</option>`).join("") : "";
  }
  function fillMods() {
    const keepH = $("heldMod").value, keepT = $("targetMod").value;
    $("heldMod").innerHTML = modOptions($("heldFilter").value, new Set());
    if (keepH) $("heldMod").value = keepH;
    fillTiers();
    $("targetMod").innerHTML = modOptions($("targetFilter").value, new Set(st.targets.map((t) => t.group)));
    if (keepT) $("targetMod").value = keepT;
  }
  $("heldFilter").oninput = $("targetFilter").oninput = fillMods;
  $("heldMod").onchange = fillTiers;
  $("addHeld").onclick = () => {
    const gr = groups()[$("heldMod").value]; if (!gr) return;
    const t = gr.tiers[+$("heldTier").value || 0], frac = $("heldFrac").checked && !fracTaken();
    st.held.push({ id: t.id, group: gr.group, side: gr.side, lv: t.lv, text: t.text, desecrated: !!gr.d, crafted: !!gr.c, fractured: frac, locked: frac });
    $("heldFrac").checked = false; renderHeld(); renderTargets();
  };
  $("addTarget").onclick = () => {
    const gr = groups()[$("targetMod").value]; if (!gr) return;
    if (st.targets.length >= 6) { $("targetMsg").textContent = "Up to 6 targets."; return; }
    $("targetMsg").textContent = "";
    if (!st.targets.some((t) => t.group === gr.group)) {
      st.targets.push({ group: gr.group, minLevel: defaultMin(gr), fractured: $("targetFrac").checked && !fracTaken() });
    }
    $("targetFrac").checked = false; renderTargets(); renderHeld();
  };

  // ---- mod picker: every craftable mod for the base, marked Want / Either / Avoid (remembered per item type) ----
  var picks = {};
  try { picks = JSON.parse(localStorage.getItem("craftPicks") || "{}"); } catch (e) {}
  const pickKey = () => (D.bases[$("base").value] || {}).ty || "";
  const avoidSet = () => new Set(Object.keys(picks[pickKey()] || {}).filter((k) => picks[pickKey()][k] === "avoid").map((k) => k.replace(/^[EA]:/, "")));
  function savePicks() { try { localStorage.setItem("craftPicks", JSON.stringify(picks)); } catch (e) {} }
  function renderPicker() {
    if (!$("picker")) return;
    const g = groups(), key = pickKey(), mine = (picks[key] = picks[key] || {}), f = ($("pickFilter").value || "").toLowerCase().trim(), top = $("pickTop").checked;
    const wanted = new Set(st.targets.map((t) => t.group));
    const names = [["P", "Prefixes"], ["S", "Suffixes"], ["DP", "Desecrated prefixes (Abyssal bones only)"], ["DS", "Desecrated suffixes (Abyssal bones only)"], ["CP", "Crafted prefixes (essence or alloy)"], ["CS", "Crafted suffixes (essence or alloy)"]];
    const bucket = (k) => (g[k].d ? "D" : g[k].c ? "C" : "") + g[k].side;
    let html = "", nW = 0, nA = 0;
    for (const [b, title] of names) {
      const ks = Object.keys(g).filter((k) => bucket(k) === b).map((k) => ({ k, lab: gLabel(g[k]) })).filter((x) => !f || (x.lab + " " + x.k).toLowerCase().includes(f)).sort((x, y) => x.lab.localeCompare(y.lab));
      if (!ks.length) continue;
      html += `<tr class="sec"><td colspan="3">${title} (${ks.length})</td></tr>`;
      for (const { k, lab } of ks) {
        const st_ = wanted.has(k) ? "want" : mine[k] === "avoid" ? "avoid" : "either";
        if (st_ === "want") nW++; if (st_ === "avoid") nA++;
        const tiers = g[k].tiers, val = top ? tiers[0].text : tiers.length > 1 ? `${tiers.length} tiers, top: ${tiers[0].text}` : tiers[0].text;
        const src = g[k].c ? ` <span class="tag">${esc((g[k].essences || g[k].alloys || []).join(", "))}</span>` : "";
        html += `<tr class="${st_ === "either" ? "" : st_}"><td>${esc(lab)}${src}<div class="dim">${esc(val)}</div></td><td class="m">${["want", "either", "avoid"].map((v) => `<label><input type="radio" name="pk_${esc(k)}" data-pk="${esc(k)}" value="${v}" ${st_ === v ? "checked" : ""}> ${v[0].toUpperCase() + v.slice(1)}</label>`).join("")}</td></tr>`;
      }
    }
    $("picker").innerHTML = html ? "<table>" + html + "</table>" : '<p class="dim" style="padding:8px">No mods match.</p>';
    $("pickSummary").textContent = `${nW} wanted, ${nA} to avoid (counts only the mods shown by the filter).`;
    $("picker").querySelectorAll("[data-pk]").forEach((e) => e.onchange = () => {
      const k = e.dataset.pk, v = e.value, gr = g[k];
      if (v === "want") {
        if (st.targets.length >= 6 && !wanted.has(k)) { $("targetMsg").textContent = "Up to 6 targets. Remove one before wanting another."; renderPicker(); return; }
        $("targetMsg").textContent = ""; delete mine[k];
        if (!wanted.has(k)) st.targets.push({ group: k, minLevel: defaultMin(gr), fractured: false });
      } else {
        const i = st.targets.findIndex((t) => t.group === k); if (i >= 0) st.targets.splice(i, 1);
        if (v === "avoid") mine[k] = "avoid"; else delete mine[k];
      }
      savePicks(); renderTargets(); renderHeld();
    });
  }
  $("pickFilter").oninput = $("pickTop").onchange = renderPicker;
  $("cls").onchange = () => { fillBases(); fillAugments(""); st.held = []; st.targets = []; renderHeld(); renderTargets(); };
  $("base").onchange = $("ilvl").onchange = () => { fillAugments($("augment").value); renderHeld(); renderTargets(); };
  $("augment").onchange = () => { renderHeld(); renderTargets(); if (typeof refreshActions === "function") { refreshActions(); renderSeq(); } };

  $("parse").onclick = () => {
    const r = C.parseItem($("paste").value);
    if (r.base) setBase(r.base); fillAugments(r.augments && r.augments[0]); $("ilvl").value = r.ilvl; $("rarity").value = ["Normal", "Magic", "Rare"].includes(r.rarity) ? r.rarity : "Rare";
    st.held = r.mods.map((m) => ({ id: m.id, group: m.group, side: m.side, lv: m.id ? D.mods[m.id].lv : 0, text: m.text, locked: m.fractured, fractured: m.fractured, desecrated: m.desecrated, crafted: m.crafted }));
    renderHeld(); renderTargets();
    $("parseMsg").innerHTML = `${r.mods.length} mods read` + (r.warnings.length ? `<br><span class="warn">${r.warnings.map(esc).join("<br>")}</span>` : "");
  };

  // prices: live Craft of Exile snapshot (window.CRAFT_PRICES, in Exalted Orbs) with your overrides on top
  const live = (window.CRAFT_PRICES && window.CRAFT_PRICES.prices) || {};
  function renderPrices() {
    const f = ($("priceFilter").value || "").toLowerCase();
    const src = window.CRAFT_PRICES ? `${window.CRAFT_PRICES.source}, ${window.CRAFT_PRICES.date}` : "no live prices loaded";
    $("priceSrc").textContent = "Source: " + src + ". Shown in " + unitName() + " (change it with \"Show costs in\" at the top).";
    const keys = Object.keys(live).filter((k) => k.toLowerCase().includes(f)).sort().slice(0, 80);
    $("prices").innerHTML = "<table>" + keys.map((k) => `<tr><td>${esc(k)}</td><td><input type="number" step="any" min="0" data-p="${esc(k)}" value="${+((prices[k] != null ? prices[k] : live[k]) / unitFactor()).toPrecision(4)}"></td></tr>`).join("") + "</table>";
    $("prices").querySelectorAll("[data-p]").forEach((e) => e.onchange = () => { prices[e.dataset.p] = +e.value * unitFactor(); try { localStorage.setItem("craftPrices", JSON.stringify(prices)); } catch (x) {} });
  }
  // fetch current prices for a chosen league through the local server (poe.ninja exchange)
  function applyFetched(r) {
    Object.keys(r.prices).forEach((k) => { live[k] = r.prices[k]; });
    if (window.CRAFT_PRICES) { window.CRAFT_PRICES.source = "poe.ninja (" + r.league + ")"; window.CRAFT_PRICES.date = r.date; }
    renderPrices(); syncBase("baseEx"); try { renderCorruption(); renderVaal(); updateProfit(); refreshActions(); } catch (e) {}
  }

  // ---- fresh prices: every time costs are used (Advise me, comparisons, simulation, emulator) the prices are refreshed first when the local server can reach poe.ninja
  // (at most every 5 minutes; the server caches for 10). The published website cannot call other sites, so it uses the saved snapshot and says how old it is.
  const FRESH_MS = 5 * 60 * 1000;
  let lastFetch = 0, serverUp = null, freshBusy = null, priceNote = "";
  const ago = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? "just now" : m < 90 ? m + " min ago" : m < 2880 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " days ago"; };
  function setPriceStatus() {
    const el = $("priceStatus"); const src = window.CRAFT_PRICES ? window.CRAFT_PRICES.source : "no prices"; const date = window.CRAFT_PRICES ? window.CRAFT_PRICES.date : "";
    let t;
    if (lastFetch) t = `Prices: ${src}, fetched ${ago(Date.now() - lastFetch)}.`;
    else { const days = date ? (Date.now() - new Date(date + "T12:00:00").getTime()) / 86400000 : null; t = `Prices: ${src}${date ? ", " + date : ""}${days != null && days > 1.5 ? ` (${Math.round(days)} days old: live prices need the local copy)` : ""}.`; }
    priceNote = t; if (el) el.textContent = t;
  }
  async function ensureFresh(force) {
    if (freshBusy) return freshBusy;
    if (!force && lastFetch && Date.now() - lastFetch < FRESH_MS) return;
    freshBusy = (async () => {
      try {
        if (serverUp === null) { try { serverUp = (await fetch("/api/ping")).ok; } catch (e) { serverUp = false; } }
        if (!serverUp) { setPriceStatus(); return; }
        const league = ($("priceLeague") && $("priceLeague").value) || "Forbidden Rites";
        const resp = await fetch("/api/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ league }) });
        const r = await resp.json(); if (r.error || !r.prices) throw new Error(r.error || "no prices");
        applyFetched(r); lastFetch = Date.now();
        try { localStorage.setItem("craftLivePrices", JSON.stringify(r)); } catch (e) {}
      } catch (e) { /* keep the prices we have */ }
      setPriceStatus(); document.dispatchEvent(new Event("pricesupdated"));
    })();
    try { await freshBusy; } finally { freshBusy = null; }
  }
  setPriceStatus(); ensureFresh(true); setInterval(() => ensureFresh(), FRESH_MS);
  try { const saved = JSON.parse(localStorage.getItem("craftLivePrices") || "null"); if (saved && saved.prices) { applyFetched(saved); } } catch (e) {}
  (async () => {
    const sel = $("priceLeague"); if (!sel) return;
    let want = "Forbidden Rites"; try { want = localStorage.getItem("craftLeague") || want; } catch (e) {}
    let list = null;
    try { const r = await (await fetch("/api/leagues")).json(); if (r.leagues && r.leagues.length) list = r.leagues; } catch (e) {}
    if (!list && window.CRAFT_LEAGUE_PRICES) list = Object.keys(window.CRAFT_LEAGUE_PRICES.leagues);
    if (list) sel.innerHTML = list.map((l) => `<option>${esc(l)}</option>`).join("");
    if (![...sel.options].some((o) => o.value === want)) sel.insertAdjacentHTML("afterbegin", `<option>${esc(want)}</option>`);
    sel.value = want;
  })();
  if ($("priceLeague")) $("priceLeague").onchange = () => { try { localStorage.setItem("craftLeague", $("priceLeague").value); } catch (e) {} if ($("league")) $("league").value = $("priceLeague").value; };
  if ($("fetchPrices")) $("fetchPrices").onclick = async () => {
    const msg = $("fetchMsg"), league = $("priceLeague").value;
    msg.textContent = "Fetching prices for " + league + " (about 10 seconds)...";
    try {
      const resp = await fetch("/api/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ league }) });
      const r = await resp.json();
      if (r.error) { msg.innerHTML = '<span class="warn">' + esc(r.error) + "</span>"; return; }
      applyFetched(r); lastFetch = Date.now(); setPriceStatus();
      try { localStorage.setItem("craftLivePrices", JSON.stringify(r)); localStorage.setItem("craftLeague", league); } catch (e) {}
      if ($("league")) $("league").value = league;
      msg.textContent = Object.keys(r.prices).length + " prices loaded for " + league + ", " + r.date + (r.failed.length ? " (missing: " + r.failed.join(", ") + ")" : "") + ".";
    } catch (e) {
      // no local server (the published website cannot call other sites): load the saved snapshot for this league instead
      const snap = window.CRAFT_LEAGUE_PRICES && window.CRAFT_LEAGUE_PRICES.leagues[league];
      if (snap && Object.keys(snap.prices).length > 20) {
        applyFetched({ prices: snap.prices, league, date: snap.date, failed: [] });
        try { localStorage.setItem("craftLivePrices", JSON.stringify({ prices: snap.prices, league, date: snap.date, failed: [] })); localStorage.setItem("craftLeague", league); } catch (x) {}
        if ($("league")) $("league").value = league;
        msg.textContent = Object.keys(snap.prices).length + " prices loaded for " + league + " from the snapshot of " + snap.date + ". Live fetching needs the local copy (start.bat); this snapshot is refreshed when the site is republished.";
      } else msg.innerHTML = '<span class="warn">No usable price snapshot for ' + esc(league) + " (too few listings), and the live fetch needs the local copy (start.bat).</span>";
    }
  };
  $("priceFilter").oninput = renderPrices;
  $("resetPrices").onclick = () => { prices = {}; try { localStorage.removeItem("craftPrices"); } catch (x) {} renderPrices(); };

  // ---- base price in exalt / chaos / divine (kept in sync through the current exchange rates) ----
  const rate = (name) => (prices[name] != null ? prices[name] : live[name]) || 0;
  function syncBase(from) {
    const ch = rate("Chaos Orb"), dv = rate("Divine Orb");
    let ex = +$("baseEx").value;
    if (from === "baseChaos") ex = +$("baseChaos").value * ch; else if (from === "baseDiv") ex = +$("baseDiv").value * dv;
    const fmt = (x) => String(+x.toFixed(4));
    if (from !== "baseEx") $("baseEx").value = fmt(ex);
    if (from !== "baseChaos") $("baseChaos").value = ch ? fmt(ex / ch) : "";
    if (from !== "baseDiv") $("baseDiv").value = dv ? fmt(ex / dv) : "";
    try { localStorage.setItem("craftBaseEx", String(ex)); } catch (x) {}
  }
  ["baseEx", "baseChaos", "baseDiv"].forEach((id) => { $(id).oninput = () => syncBase(id); });
  try { const v = localStorage.getItem("craftBaseEx"); $("baseEx").value = v ? v : String(Math.round(rate("Divine Orb")) || 700); } catch (x) { $("baseEx").value = String(Math.round(rate("Divine Orb")) || 700); }
  syncBase("baseEx");

  // ---- sale price and profit warning ----
  function syncSell(from) {
    const ch = rate("Chaos Orb"), dv = rate("Divine Orb");
    const raw = $(from).value; if (raw === "") { ["sellEx", "sellChaos", "sellDiv"].forEach((id) => { if (id !== from) $(id).value = ""; }); }
    else {
      let ex = +$("sellEx").value;
      if (from === "sellChaos") ex = +raw * ch; else if (from === "sellDiv") ex = +raw * dv;
      const fmt = (x) => String(+x.toFixed(4));
      if (from !== "sellEx") $("sellEx").value = fmt(ex);
      if (from !== "sellChaos") $("sellChaos").value = ch ? fmt(ex / ch) : "";
      if (from !== "sellDiv") $("sellDiv").value = dv ? fmt(ex / dv) : "";
    }
    try { localStorage.setItem("craftSellEx", $("sellEx").value); } catch (x) {}
    updateProfit();
  }
  const sellPrice = () => { const v = $("sellEx").value; return v === "" || !(+v > 0) ? null : +v; };
  const baseCost = () => ($("sellBase").checked ? +$("baseEx").value || 0 : 0);
  // cost: average currency to finish; returns html (a red warning when the cost is above the sale price)
  function profitHtml(cost, what) {
    const sp = sellPrice(); if (sp == null || cost == null || !isFinite(cost)) return "";
    const total = cost + baseCost(), net = sp - total, bc = baseCost();
    const detail = `Average ${what}: <b>${fx(cost)} ${ul()}</b>${bc ? ` plus the base <b>${fx(bc)} ${ul()}</b> = <b>${fx(total)} ${ul()}</b>` : ""}. Sale price: <b>${fx(sp)} ${ul()}</b>.`;
    if (net < 0) return `<div class="lossbox warnbox" role="alert">&#9888; Warning: this craft costs more than the item sells for. Expected loss: <b>${fx(-net)} ${ul()}</b> per finished item. <div class="dim" style="font-weight:400">${detail} Lower the target, buy a better base, or only craft it if the price is higher.</div></div>`;
    const margin = total > 0 ? net / total : 0;
    return `<div class="gainbox">${net < sp * 0.15 ? '<b class="warn">Thin margin.</b> ' : ""}Expected profit: <b>${fx(net)} ${ul()}</b> per finished item (${pct(Math.max(margin, 0))} on cost). <div class="dim">${detail}</div></div>`;
  }
  // ---- real market listings through the local server (server.py -> official trade search) ----
  try { const l = localStorage.getItem("craftLeague"); if (l) $("league").value = l; } catch (x) {}
  $("marketGo").onclick = async () => {
    const out = $("marketOut"), g = groups();
    if (!st.targets.length) { out.textContent = "Add at least one target mod first."; return; }
    try { localStorage.setItem("craftLeague", $("league").value); } catch (x) {}
    const lo = (line) => { const m = /\(([\d.]+)\s*[-\u2014\u2013]\s*([\d.]+)\)/.exec(line); if (m) return parseFloat(m[1]); const n = /-?\d+(\.\d+)?/.exec(line); return n ? parseFloat(n[0]) : null; };
    const filters = st.targets.filter((t) => g[t.group]).map((t) => {
      const gr = g[t.group], tier = gr.tiers.find((x) => x.lv === t.minLevel) || gr.tiers[gr.tiers.length - 1];
      return { kind: t.fractured ? "fractured" : gr.d ? "desecrated" : "explicit", lines: D.mods[tier.id].l.map((text) => ({ text, min: lo(text) })) };
    });
    out.textContent = "Searching the trade site (about 5 seconds)...";
    try {
      const resp = await fetch("/api/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ league: $("league").value.trim(), base: $("base").value, filters, rates: { chaos: rate("Chaos Orb"), divine: rate("Divine Orb") } }) });
      const r = await resp.json();
      if (r.error) { out.innerHTML = '<span class="warn">' + esc(r.error) + "</span>"; return; }
      const priced = r.listings.filter((x) => x.ex != null).map((x) => x.ex).sort((a, b) => a - b);
      const med = priced.length ? priced.slice(0, 5)[Math.floor((Math.min(priced.length, 5) - 1) / 2)] : null;
      let h = r.missing.length ? `<div class="warn">The trade site has no stat for: ${r.missing.map(esc).join("; ")} (left out of the search).</div>` : "";
      h += `<div>${r.total} listing${r.total === 1 ? "" : "s"} found. <a href="${esc(r.url)}" target="_blank" rel="noopener">Open the search on the trade site</a></div>`;
      if (r.listings.length) h += `<div class="tablewrap"><table><tr><th>Item</th><th>Item level</th><th>Listed price</th><th>In ${ul()}</th></tr>${r.listings.map((x) => `<tr><td>${esc(x.name || "(rare)")}</td><td>${x.ilvl || "-"}</td><td>${x.amount} ${esc(x.currency)}</td><td>${x.ex != null ? fx(x.ex) : "-"}</td></tr>`).join("")}</table></div>`;
      if (med != null) { $("sellEx").value = String(+med.toFixed(2)); syncSell("sellEx"); h += `<div>Sale price set to <b>${fx(med)} ${ul()}</b> (middle of the cheapest five). The listings may carry extra mods you did not ask for, so treat it as an upper estimate for a bare item with just your wanted mods.</div>`; }
      else h += '<div class="warn">No priced listing found with all your wanted mods. A very rare item may sell for far more than anything listed, or the mods may be too strict; lower a tier or drop a target and search again.</div>';
      out.innerHTML = h;
    } catch (e) { out.innerHTML = '<span class="warn">Could not reach the local server. Close this page and start the advisor with start.bat (python server.py in advisor); the published website cannot search the trade site.</span>'; }
  };
  function updateProfit() {
    const sp = sellPrice();
    $("profitLive").textContent = sp == null ? "" : "Run Advise me or the step planner to see whether the craft is worth it.";
    if (typeof window.__reprofit === "function") window.__reprofit();
  }
  ["sellEx", "sellChaos", "sellDiv"].forEach((id) => { $(id).oninput = () => syncSell(id); });
  $("sellBase").onchange = () => updateProfit();
  try { const v = localStorage.getItem("craftSellEx"); if (v) { $("sellEx").value = v; syncSell("sellEx"); } } catch (x) {}

  const pct = (p) => (p * 100 >= 10 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)) + "%" + (p > 0 && p < 0.1 ? ` (1 in ${1 / p >= 100 ? (1 / p).toFixed(0) : (1 / p).toFixed(1)})` : ""); // small chances also in plain words, as in the jewel simulator
  const fn = (n) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)); // plain numbers (counts)
  // money: stored in exalted, shown in the unit chosen at the top (exalted, chaos or divine)
  const UNITS = { ex: ["exalted", () => 1], chaos: ["chaos", () => rate("Chaos Orb") || 1], div: ["divine", () => rate("Divine Orb") || 1] };
  let unitKey = "ex"; try { const u = localStorage.getItem("craftUnit"); if (UNITS[u]) unitKey = u; } catch (x) {}
  const ul = () => UNITS[unitKey][0];
  unitFactor = () => UNITS[unitKey][1](); unitName = () => ({ ex: "Exalted Orbs", chaos: "Chaos Orbs", div: "Divine Orbs" }[unitKey]);
  const fx = (n) => { const v = n / UNITS[unitKey][1](); return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4); };
  // a held mod is replaced when the user ticks it or, unticked by default, when its group is on the Avoid list
  const effReplace = (h) => (h.replace !== undefined ? !!h.replace : avoidSet().has(String(h.group).replace(/^[EA]:/, "")));
  const baseCfg = () => ({ base: $("base").value, ilvl: +$("ilvl").value || 80, rarity: $("rarity").value, held: st.held.map((h) => Object.assign({}, h, { replace: effReplace(h) && !h.fractured && !h.locked })), targets: st.targets, need: +$("need").value || st.targets.length, prices, augments: augTags(), failCost: +$("baseEx").value, allowScrap: $("allowScrap").checked, considerFracture: $("allowFrac").checked });

  // hints that explain how to carry out a recommended action in game
  function howTo(name) {
    const tips = [];
    if (/Whittling/.test(name)) tips.push("Right-click the Omen of Whittling first. The game highlights the mod it will remove (the one with the lowest required level, not the weakest looking one). If that is a mod you want to keep, stop.");
    if (/Erasure/.test(name)) tips.push("Erasure limits the Chaos Orb to removing a prefix (Sinistral) or a suffix (Dextral).");
    if (/^Desecrate/.test(name)) tips.push("The bone adds an unrevealed mod. Take the item to the Well of Souls and reveal it: you pick 1 of 3 mods. On a full item a random mod is removed first, on the same side as the new mod.");
    if (/Abyssal Echoes/.test(name)) tips.push("Abyssal Echoes lets you reroll the 3 options once, and you can still take one from the first set.");
    if (/Necromancy/.test(name)) tips.push("Necromancy forces the desecrated mod onto the prefix (Sinistral) or suffix (Dextral) side.");
    if (/Sovereign|Liege|Blackblooded/.test(name)) tips.push("The lich omens guarantee one Ulaman (Sovereign), Amanamu (Liege) or Kurgal (Blackblooded) mod among the options. Weapons and jewellery only.");
    if (/Omen of Light/.test(name)) tips.push("Omen of Light makes the Annulment remove only the desecrated mod, so you can desecrate again.");
    if (/Fracturing/.test(name)) tips.push("The Fracturing Orb locks one random mod for good. It needs 4 or more mods on the item, so remove the mods you do not want to risk beforehand.");
    if (/Crystallisation/.test(name)) tips.push("Crystallisation limits the removal of a Perfect or Corrupted Essence to prefixes (Sinistral) or suffixes (Dextral). Make sure that side only holds mods you can afford to lose.");
    if (/Perfect Essence/.test(name)) tips.push("A Perfect Essence removes one random mod and adds its guaranteed mod.");
    return tips;
  }

  $("go").onclick = () => {
    const base = $("base").value;
    if (!D.bases[base]) return ($("out").innerHTML = '<p class="warn">Pick a valid base type first.</p>');
    if (!st.targets.length) return ($("out").innerHTML = '<p class="warn">Add at least one target mod.</p>');
    $("out").innerHTML = '<p class="dim">Checking current prices, then working out the cheapest route. This can take a few seconds with several wanted mods...</p>';
    ensureFresh().then(() => setTimeout(runAdvice, 30));
  };
  function runAdvice() {
    const base = $("base").value;
    const r = C.solve(baseCfg());
    let h = "";
    if (r.issues.length) h += `<p class="warn">${r.issues.map(esc).join("<br>")}</p>`;
    h += `<div class="dim">Free slots now: ${r.start.prefixRoom} prefix, ${r.start.suffixRoom} suffix. ${esc(priceNote)}</div>`;
    if (r.done) h += '<p class="big">Done: the item already has what you asked for.</p><div class="dim">If you want a higher tier of a mod the item already has, raise its "at least" tier in section 3: a mod only counts when it is at or above that tier.</div>';
    else if (!r.reachable) h += '<p class="warn">No route found with the modelled currency. The target may be blocked by slots (locked mods), by item level, or by a missing tool such as Desecration.</p>';
    else {
      const o = r.options[0];
      st.lastAdvice = r.expectedCost;
      const tips = howTo(o.name);
      h += profitHtml(r.expectedCost, "cost to finish");
      h += `<div class="chip best" style="display:block"><div class="dim">Do this first</div><div class="big">${esc(o.name)}</div><button type="button" data-log="${esc(o.name)}" data-cost="${o.cost}" title="Add one use of this action to the cost tracker">Log this use</button>
        <div>Average total cost to finish from here: <b>${fx(r.expectedCost)} ${ul()}</b> (this action costs ${fx(o.cost)} ${ul()} each time).${r.pSuccess != null && r.pSuccess < 0.995 ? ` Chance the item is finished without being ruined: <b>${pct(r.pSuccess)}</b>; the cost includes buying a new base each time one is ruined.` : ""}</div>
        <table><tr><th>Chance</th><th>What happens</th></tr>${o.outcomes.map((x) => `<tr><td>${pct(x.p)}</td><td>${esc(x.what)}${x.done ? ' <b class="big" style="font-size:14px">finished</b>' : ""}</td></tr>`).join("")}</table>
        ${tips.length ? `<div class="dim"><span class="more">${tips.map(esc).join("<br>")}</span><span class="moremark">Hold Alt for how to carry this out in game.</span></div>` : ""}</div>`;
      if (r.route && r.route.length) h += `<h2 style="margin-top:12px">Recipe: what to do for each state of the item</h2>
        <div class="dim">Look at your item after each craft, find the matching row and do what it says. Rows are in the order they usually come up. "Times" is how often that row comes up on average, because some rows repeat (spamming).</div>
        <div class="tablewrap"><table><tr><th>When your item is</th><th>Do this</th><th>Times (average)</th><th>What can happen</th></tr>${r.route.map((x) => `<tr${x.isStart ? ' style="outline:1px solid var(--good)"' : ""}><td>${esc(x.state)}${x.isStart ? ' <b class="dim">(your item now)</b>' : ""}</td><td>${esc(x.action)}<div class="dim">${fx(x.cost)} ${ul()} each</div> <button type="button" data-log="${esc(x.action)}" data-cost="${x.cost}">Log</button></td><td>${fn(x.visits)}</td><td>${x.outcomes.map((y) => `${pct(y.p)} ${esc(y.what)}${y.done ? " (finished)" : ""}`).join("<br>")}</td></tr>`).join("")}</table></div>`;
      if (r.plan.length) h += `<h2 style="margin-top:12px">The whole plan: how many of each action</h2>
        <div class="dim">Average over many crafts if you always pick the best action. One craft can need more or fewer.</div>
        <div class="tablewrap"><table><tr><th>Action</th><th>Times used (average)</th><th>Cost each</th><th>Cost in total</th></tr>${r.plan.map((x) => `<tr><td>${esc(x.name)}</td><td>${fn(x.uses)}</td><td>${fx(x.cost)}</td><td>${fx(x.subtotal)}</td></tr>`).join("")}
        <tr><td><b>Total</b></td><td></td><td></td><td><b>${fx(r.plan.reduce((a, x) => a + x.subtotal, 0))}</b></td></tr></table></div>`;
      h += `<details style="margin-top:12px"><summary>Other first actions, ranked</summary>
        <div class="dim"><b>Cost per use</b>: what one use costs. <b>Chance to hit</b>: chance one use adds a mod you want. <b>Average uses to hit</b>: how many times you would need it, on average, to get a wanted mod. <b>Average total cost to finish</b>: cost of the whole craft if you do this first and then always pick the best action.</div>
        <div class="tablewrap"><table><tr><th>Action</th><th>Cost per use</th><th>Chance to hit</th><th>Average uses to hit</th><th>Average total cost to finish</th></tr>${r.options.slice(0, 14).map((x) => `<tr><td>${esc(x.name)}</td><td>${fx(x.cost)}</td><td>${x.pHit > 0 ? pct(x.pHit) : "-"}</td><td>${x.avgToHit ? fn(x.avgToHit) : "-"}</td><td>${x.expected >= 1e8 ? "dead end" : fx(x.expected)}</td></tr>`).join("")}</table></div></details>`;
    }
    $("out").innerHTML = h;
  }

  // ---- crafting steps: chain actions, each repeated a number of times or until something is true ----
  st.seq = [];
  st.actionNames = [];
  function refreshActions() {
    if (!D.bases[$("base").value] || !st.targets.length) { $("seqAction").innerHTML = '<option value="">(add a target mod first)</option>'; st.actionNames = []; fillRepeat(); return; }
    const r = C.solve(Object.assign(baseCfg(), { considerFracture: true, sequenceOnly: true }));
    st.actionNames = r.actions.map((a) => a.name);
    const keep = $("seqAction").value;
    $("seqAction").innerHTML = r.actions.map((a) => `<option value="${esc(a.name)}">${esc(a.name)} (${fx(a.cost)} ${ul()})</option>`).join("");
    if (keep) $("seqAction").value = keep;
    fillRepeat();
  }
  function fillRepeat() {
    const keep = $("seqRepeat").value;
    $("seqRepeat").innerHTML = '<option value="times">repeat a set number of times</option><option value="goal">repeat until all wanted mods are on the item</option><option value="nojunk">repeat until no unwanted mods are left</option><option value="full">repeat until the item has no free slots</option>'
      + st.targets.map((t, i) => { const gr = groups()[t.group]; return gr ? `<option value="has:${i}">repeat until ${esc(gLabel(gr))} is on the item</option>` : ""; }).join("");
    if (keep && [...$("seqRepeat").options].some((o) => o.value === keep)) $("seqRepeat").value = keep;
    syncRepeatLabel();
  }
  function syncRepeatLabel() { $("seqTimesLabel").textContent = $("seqRepeat").value === "times" ? "Times" : "At most (times)"; if ($("seqRepeat").value !== "times" && +$("seqTimes").value < 10) $("seqTimes").value = 50; }
  $("seqRepeat").onchange = syncRepeatLabel;
  const stepText = (x) => x.until && x.until !== "times" ? `repeat until ${untilName(x.until)}, at most ${x.max} times` : `&times; ${x.times}`;
  const untilName = (u) => u === "goal" ? "all wanted mods are on the item" : u === "nojunk" ? "no unwanted mods are left" : u === "full" ? "the item has no free slots" : String(u).indexOf("mods:") === 0 ? "the item has at most " + String(u).slice(5) + " mods" : String(u).indexOf("atleast:") === 0 ? "the item has at least " + String(u).slice(8) + " mods" : (() => { const t = st.targets[+String(u).slice(4)]; const gr = t && groups()[t.group]; return gr ? gLabel(gr) + " is on the item" : "that mod is on the item"; })();
  function repeatOptions(sel) {
    const o = [["times", "a set number of times"], ["goal", "until all wanted mods are on the item"], ["nojunk", "until no unwanted mods are left"], ["full", "until the item has no free slots"], ["atleast:3", "until the item has at least 3 mods"], ["atleast:4", "until the item has at least 4 mods"], ["mods:2", "until the item has at most 2 mods"], ["mods:3", "until the item has at most 3 mods"], ["mods:4", "until the item has at most 4 mods"]];
    st.targets.forEach((t, i) => { const gr = groups()[t.group]; if (gr) o.push(["has:" + i, "until " + gLabel(gr) + " is on the item"]); });
    return o.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`).join("");
  }
  function renderSeq() {
    $("seqList").innerHTML = st.seq.map((x, i) => {
      const until = x.until && x.until !== "times";
      return `<div class="step"><div class="stephead"><span class="badge">${i + 1}</span><span class="stepname">${esc(x.name)}</span>
        <span class="stepbtns"><button data-up="${i}" ${i === 0 ? "disabled" : ""}>Move up</button><button data-down="${i}" ${i === st.seq.length - 1 ? "disabled" : ""}>Move down</button><button data-del="${i}">Remove</button></span></div>
        <div class="steprow"><span class="dim">Use it</span> <select data-seqmode="${i}" aria-label="How often">${repeatOptions(until ? x.until : "times")}</select>
        <span class="dim">${until ? "at most" : ""}</span> <input type="number" min="1" max="2000" value="${until ? x.max : x.times}" data-seqtimes="${i}" style="width:72px" aria-label="Number of times"> <span class="dim">times</span></div></div>`;
    }).join("") || '<div class="empty">No steps yet. Load a method above, or add the first step below.</div>';
    $("seqList").querySelectorAll("[data-del]").forEach((e) => e.onclick = () => { st.seq.splice(+e.dataset.del, 1); renderSeq(); });
    $("seqList").querySelectorAll("[data-up]").forEach((e) => e.onclick = () => { const i = +e.dataset.up; if (i > 0) { [st.seq[i - 1], st.seq[i]] = [st.seq[i], st.seq[i - 1]]; renderSeq(); } });
    $("seqList").querySelectorAll("[data-down]").forEach((e) => e.onclick = () => { const i = +e.dataset.down; if (i < st.seq.length - 1) { [st.seq[i + 1], st.seq[i]] = [st.seq[i], st.seq[i + 1]]; renderSeq(); } });
    $("seqList").querySelectorAll("[data-seqmode]").forEach((e) => e.onchange = () => { const x = st.seq[+e.dataset.seqmode], v = e.value, n = x.until && x.until !== "times" ? x.max : x.times;
      if (v === "times") { delete x.until; delete x.max; x.times = Math.min(500, n || 1); } else { x.until = v; x.max = Math.max(n || 1, 20); x.times = x.max; } renderSeq(); });
    $("seqList").querySelectorAll("[data-seqtimes]").forEach((e) => e.onchange = () => { const x = st.seq[+e.dataset.seqtimes], v = Math.max(1, Math.min(2000, +e.value || 1)); if (x.until && x.until !== "times") x.max = v; else x.times = Math.min(500, v); renderSeq(); });
    calcSeq();
  }
  const mkStep = (name, until, n) => (until && until !== "times" ? { name, until, max: n || 50, times: n || 50 } : { name, times: n || 1 });
  $("seqAdd").onclick = () => { const n = $("seqAction").value; if (!n) return; st.seq.push(mkStep(n, $("seqRepeat").value, Math.max(1, +$("seqTimes").value || 1))); renderSeq(); };
  $("seqBest").onclick = () => {
    if (!st.targets.length) return;
    const r = C.solve(baseCfg());
    if (r.options && r.options.length && !r.done) { st.seq.push({ name: r.options[0].name, times: 1 }); renderSeq(); }
  };
  // ready-made methods, built from the actions that exist for this item
  // Ready-made methods. Sources: Mobalytics "Crafting Guide: High Damage Attack Breach Ring" (Lolcohol), "Abyss Crafting and Desecrated Modifier" (Lolcohol, Jul 2026)
  // and "PoE2 Crafting Guide" (Perra, Jun 2026). Each has a plain description: what it does, when it suits, the steps in words and what to watch out for.
  const CH = ["Chaos Orb", "Greater Chaos Orb", "Perfect Chaos Orb"];
  const PRESETS = [
    { name: "Two good mods, fracture, annul down, chaos, desecrate, Greater Exalts", group: "Fracture and annul down",
      what: "Put the mods you want to keep on your base (hopefully two good ones), add an unrevealed desecrated mod so the item has 4 mods, and use a Fracturing Orb hoping it locks the mod you want. Annul down to just the fractured mod and one other, chaos spam that other mod until it is the one you want, desecrate for the other prefix to finish the prefixes, then hit the suffixes with Omen of Greater Exaltation and Greater Exalted Orbs.",
      when: "You start from the base you want and build it yourself. You are happy to risk the fracture to save buying a fractured base.",
      how: ["Put the mods you want to keep on the base: Perfect Orb of Transmutation, Perfect Orb of Augmentation and a Regal Orb (turns it rare and adds a mod). Hopefully two of them are good.", "Use an Exalted Orb if the item has fewer than 3 mods, then add an unrevealed desecrated mod with a bone and do not reveal it. The item now has 4 mods, which a Fracturing Orb needs.", "Use a Fracturing Orb and hope it locks the mod you want.", "Use Orbs of Annulment until only the fractured mod and one other are left. An Annulment can remove the unrevealed desecrated mod too.", "Use Chaos Orbs until the other mod is the one you want. Only that mod is rerolled.", "Desecrate with a bone (Omen of Sinistral Necromancy for a prefix, Omen of Abyssal Echoes to reroll the options once), reveal at the Well of Souls and take the other prefix you want.", "Use Omen of Greater Exaltation and Omen of Dextral Exaltation with Greater Exalted Orbs, again and again, until the suffixes you want are on the item."],
      extras: ["Alloy: use it after the chaos spam and before you desecrate for the other prefix. First add a throwaway mod on the side the alloy will remove from (Exalted Orb with Sinistral or Dextral Exaltation), then use the alloy with Omen of Sinistral or Dextral Crystallisation so only that side is hit. Two crafters use this pairing (the BigDaddy Gaming guide and Belton's wand video), although the omen's own text names only Perfect and Corrupted Essences. The fractured mod is safe.", "Quality (rings and amulets): once you have fractured, decide what type of item you are making (attack, caster, mana...). Add a junk prefix, use Essence of the Breach so it replaces the junk prefix (+20% maximum quality), add the matching catalysts until the quality is 40%, then remove the +20% maximum quality prefix with an Annulment or Chaos Orb. Do this before the chaos spam so the prefix slot is free again."],
      watch: "With 3 normal mods and one unrevealed mod, the Fracturing Orb has a 1 in 3 chance to lock the mod you want, and a miss locks an unwanted mod for good. The Annulments are random, so you may lose a mod you wanted before you reach two mods. If a step does not apply to your item it shows as skipped.",
      build: (f, c) => { const ds = c.sideSecond ? f(new RegExp("^Add an unrevealed desecrated mod with Preserved \\w+ \\+ Omen of " + (c.sidePrefix || "Sinistral") + " Necromancy")) : null;
        const dz = f(new RegExp("^Desecrate with (Preserved|Ancient) \\w+ \\+ Omen of " + (c.sidePrefix || "Sinistral") + " Necromancy \\+ Omen of Abyssal Echoes$")) || f(/^Desecrate with Preserved \w+ \+ Omen of Sinistral Necromancy$/) || f(/^Desecrate with Preserved \w+$/);
        return [f(["Perfect Orb of Transmutation", "Greater Orb of Transmutation", "Orb of Transmutation"]), f(["Perfect Orb of Augmentation", "Greater Orb of Augmentation", "Orb of Augmentation"]), f(["Perfect Regal Orb", "Greater Regal Orb", "Regal Orb"]), [f(["Exalted Orb", "Greater Exalted Orb"]), "atleast:3", 4],
          ds || f(/^Add an unrevealed desecrated mod with Preserved \w+ \(do not reveal/), f("Fracturing Orb (locks a random mod)"), [f("Orb of Annulment"), "mods:2", 10], c.second >= 0 ? [f(CH), "has:" + c.second, 400] : [f(CH), "goal", 400],
          dz, [f(["Greater Exalted Orb + Omen of Dextral Exaltation + Omen of Greater Exaltation"]), "goal", 10]]; } },
    { name: "Fracture the key mod, shrink the item, then chaos spam the next mod", group: "Fracture and chaos spam",
      what: "Start from a rare base that already has your most important mod. Lock that mod with a Fracturing Orb, remove the other mods with Orbs of Annulment until only the fractured mod and one other are left, then use Chaos Orbs. With only one unlocked mod on the item, every Chaos Orb rerolls just that mod, so you keep going until it is the mod you want.",
      when: "You can buy a rare base that already has your key mod rolled well (ideally with room for more mods). The item should not have more than 4 mods to begin with.",
      how: ["Use a Fracturing Orb. It needs 4 or more mods and locks one at random. If the base has only 3 mods, first add an unrevealed desecrated mod with a bone and do not reveal it: the Fracturing Orb then has a 1 in 3 chance to lock your mod.", "Use Orbs of Annulment until the item has at most 2 mods (the fractured one and one other).", "Use Chaos Orbs until the second mod is the one you want."],
      watch: "A Fracturing Orb picks at random, so a miss can lock an unwanted mod for good. Annulments and hundreds of Chaos Orbs add up, and bad luck can multiply the cost.",
      build: (f, c) => [f("Fracturing Orb (locks a random mod)"), [f(["Orb of Annulment"]), "mods:2", 10], c.second >= 0 ? [f(CH), "has:" + c.second, 400] : [f(CH), "goal", 400]] },
    { name: "Add a mod by desecration, retry with Omen of Light", group: "Desecration",
      what: "Use an Ancient Abyssal Bone with a Necromancy omen to choose the side and Omen of Abyssal Echoes, then reveal at the Well of Souls. You pick 1 of 3 mods, or reroll the 3 once. If none is what you want, an Orb of Annulment with Omen of Light removes only the desecrated mod, and you try again.",
      when: "The item has an open prefix or suffix and does not already carry a desecrated mod. It is a safe way to add a high tier mod, because you choose from the options.",
      how: ["Use an Ancient bone with the Necromancy omen for the side you need and Omen of Abyssal Echoes. Reveal at the Well of Souls and take a wanted mod if one is offered. Reroll once if not.", "If you still got nothing useful, use an Orb of Annulment with Omen of Light. It removes only the desecrated mod.", "Desecrate again."],
      watch: "Each try costs a bone, omens, and an Annulment when it fails. An item can only hold one desecrated mod. Do not use Omen of Light on a desecrated mod you want to keep.",
      build: (f, c) => { const side = c.sideSecond || c.sideFirst; const d = (side && f(new RegExp("^Desecrate with Ancient \\w+ \\+ Omen of " + side + " Necromancy \\+ Omen of Abyssal Echoes$"))) || f(/^Desecrate with Ancient \w+ \+ Omen of Abyssal Echoes$/); return [d, f("Orb of Annulment + Omen of Light (removes only the desecrated mod)"), d]; } },
    { name: "Add two suffixes at once with a Perfect Exalted Orb", group: "Finishing",
      what: "Use a Perfect Exalted Orb with Omen of Greater Exaltation and Omen of Dextral Exaltation. The Perfect Exalted Orb only adds mods of level 50 or higher, the Greater omen adds two mods, and the Dextral omen makes both of them suffixes.",
      when: "Your prefixes are done and you have two open suffix slots to fill with good mods (resistances, for example).",
      how: ["Use a Perfect Exalted Orb with Omen of Greater Exaltation and Omen of Dextral Exaltation."],
      watch: "It is random which two suffixes you get. The cost per try is high, and the Homogenising omen that used to narrow the choice is no longer obtainable.",
      build: (f) => [f(["Perfect Exalted Orb + Omen of Dextral Exaltation + Omen of Greater Exaltation"])] },
    { name: "Beginner numbers game: build a rare, fill it, desecrate, sell", group: "Beginner",
      what: "A budget way to make many items and sell the good ones. Make a rare from a normal base, add mods until it is full, finish with one desecration, and sell the items that turn out well. Most will not be great; the occasional very good one pays for the rest.",
      when: "You want a low-cost attempt to make currency, not one specific item. It is not how high-end gear is made.",
      how: ["Use a Perfect Orb of Transmutation to make the item magic with one mod.", "Use an Orb of Augmentation to add a second mod.", "Use a Regal Orb to make it rare and add a mod.", "Use Exalted Orbs (with an essence if you like) until the item has no free slots.", "Use one Abyssal Bone to desecrate, reveal at the Well of Souls and take the best of the 3 options."],
      watch: "The result is random. The desecrated mod stays unless you remove it with an Annulment and Omen of Light.",
      build: (f) => [f(["Perfect Orb of Transmutation", "Greater Orb of Transmutation", "Orb of Transmutation"]), f(["Perfect Orb of Augmentation", "Greater Orb of Augmentation", "Orb of Augmentation"]), f(["Perfect Regal Orb", "Greater Regal Orb", "Regal Orb"]), [f(["Exalted Orb", "Greater Exalted Orb"]), "full", 6], f(/^Desecrate with Preserved \w+$/)] },
    { name: "Fractured base: chaos the second mod, desecrate the third, finish the suffixes", group: "Fracture and chaos spam",
      what: "The method from Lolcohol's Attack Breach Ring guide. Buy a rare base that already has your best mod at the top tier and no more than 4 mods. Fracture that mod, remove everything else but one mod, chaos spam until the second key mod appears, add the third key mod by desecration, then finish the suffixes with Greater Exaltation and Perfect Exalted Orbs.",
      when: "You are making an expensive item where three mods of the same kind matter (for example three damage prefixes) and you can buy a base with the first one already rolled.",
      how: ["Fracture the key mod with a Fracturing Orb. The base should have 4 mods and an empty prefix and an empty suffix slot. With only 3 mods, add an unrevealed desecrated mod first for a 1 in 3 chance.", "Use Orbs of Annulment until only the fractured mod and one other are left.", "Use Chaos Orbs until the second key mod appears. This step is the expensive one.", "Desecrate with an Ancient bone, Omen of Sinistral Necromancy and Omen of Abyssal Echoes, and reveal the third key mod. If you miss twice, remove the desecrated mod with an Annulment and Omen of Light and desecrate again.", "Use a Perfect Exalted Orb with Omen of Greater Exaltation and Omen of Dextral Exaltation to add the two suffixes."],
      extras: ["Quality: add catalysts for the item type (see the quality notes) before the chaos spam."],
      watch: "It is expensive and bad luck can multiply the cost: the guide quotes about 1 in 204 per Chaos Orb to hit any one of three wanted mods, and about 1 in 814 for a top tier fire or lightning one. The guide also used Omen of Homogenising Exaltation to narrow the suffixes, which can no longer be obtained, so the suffixes are more random now. Do not buy fractured, corrupted or sanctified bases, or bases whose quality makes a lower tier look higher.",
      build: (f, c) => { const side = c.sideSecond || "Sinistral"; const d = f(new RegExp("^Desecrate with Ancient \\w+ \\+ Omen of " + side + " Necromancy \\+ Omen of Abyssal Echoes$")) || f(/^Desecrate with Ancient \w+ \+ Omen of Abyssal Echoes$/);
        return [f("Fracturing Orb (locks a random mod)"), [f("Orb of Annulment"), "mods:2", 10], c.second >= 0 ? [f(CH), "has:" + c.second, 600] : [f(CH), "goal", 600], d, f("Orb of Annulment + Omen of Light (removes only the desecrated mod)"), d, [f(["Perfect Exalted Orb + Omen of Dextral Exaltation + Omen of Greater Exaltation"]), "goal", 10]]; } },
    { name: "Wand or staff: fracture, chaos spam, alloy, then desecrate the prefixes", group: "Fracture and chaos spam",
      what: "From BigDaddy Gaming's +7 Wand guide (Jun 2026). Fracture the key mod, chaos spam the second mod while it is the only other mod, add a throwaway prefix and replace it with an alloy (aimed with Omen of Sinistral Crystallisation, as Belton also does), then fish for the prefixes with desecration, blocking the mod you do not want so the next rolls are better.",
      when: "You are making a caster weapon (wand or staff) where an alloy gives a key mod, and you can afford alloys and several bones.",
      how: ["Fracture the key mod. With 2 other mods on the base, add a desecrated mod with a bone and do not reveal it, so the item has 4 mods (1 in 3 chance).", "Chaos spam the second mod. Make sure it is the only unlocked mod on the item, so annul down first if needed.", "Add a throwaway prefix with Omen of Sinistral Exaltation and an Exalted Orb.", "Use the alloy with Omen of Sinistral Crystallisation: it removes only a prefix (the throwaway) and adds the alloy mod, which finishes the suffixes. (The omen's own text names essences only; the guide and Belton's wand video both use it with an alloy.)", "Desecrate with a Preserved bone and Omen of Abyssal Echoes. At the Well of Souls take the mod the guide tells you to block (for example plain mana), so later prefixes can hit something better.", "Use Omen of Greater Exaltation with a Greater or Perfect Exalted Orb.", "Remove the blocking desecrated mod with an Annulment and Omen of Light, then desecrate again and reveal the final mod."],
      extras: ["The alloy goes after the chaos spam (which can remove mods) and before the desecrations and exalts that only add mods. The throwaway prefix is what keeps the removal safe."],
      watch: "The alloy step is not part of the calculated numbers, because the alloy mods are not in the mod data. The +7 version of the guide also used a temporary rune in a socket; check the guide for that.",
      build: (f, c) => { const ds = f(/^Add an unrevealed desecrated mod with Preserved \w+ \(do not reveal/); const d = f(/^Desecrate with Preserved \w+ \+ Omen of Abyssal Echoes$/);
        return [ds, f("Fracturing Orb (locks a random mod)"), [f("Orb of Annulment"), "mods:2", 10], c.second >= 0 ? [f(CH), "has:" + c.second, 400] : [f(CH), "goal", 400], f("Exalted Orb + Omen of Sinistral Exaltation"), d, f(["Greater Exalted Orb + Omen of Greater Exaltation", "Perfect Exalted Orb + Omen of Greater Exaltation"]), f("Orb of Annulment + Omen of Light (removes only the desecrated mod)"), d]; } },
    { name: "Weapon: fracture, chaos spam, crafted mods, finish with desecration", group: "Fracture and chaos spam",
      what: "The weapon method from Perra's crafting guide. Fracture one mod, chaos spam a second, add crafted mods (runes make several of these possible on weapons), and finish with a desecration. It keeps the random part small and the cost fairly low.",
      when: "You are making a weapon and want few random steps.",
      how: ["Fracture one mod.", "Annul down to the fractured mod and one other, then chaos spam the second mod.", "Add the crafted mods (rune interactions, not calculated here).", "Finish with a desecration: reveal at the Well of Souls and take the best of the 3 options."],
      extras: ["If an alloy gives a key mod, use it after the chaos spam and before the final desecration (see the alloy notes)."],
      watch: "The crafted mods are not part of the calculated numbers. Check the current rune recipes before you spend.",
      build: (f, c) => [f("Fracturing Orb (locks a random mod)"), [f("Orb of Annulment"), "mods:2", 10], c.second >= 0 ? [f(CH), "has:" + c.second, 400] : [f(CH), "goal", 400], f(/^Desecrate with (Preserved|Ancient) \w+ \+ Omen of Abyssal Echoes$/) || f(/^Desecrate with Preserved \w+$/)] },
    { name: "Amulet: item level 82 base, 50% quality, one mod, chaos spam the +3, whittle the prefixes", group: "Amulets (Belton, 0.5.5)",
      what: "From Belton's amulet videos (SHm3jvYPjco, tJ6SVHozpQ0). Buy an item level 82 base, take its quality to 50% with a Breach essence plus the matching catalysts, cut it down to one mod and Chaos spam that one mod until it is the +3 to spell skills. Because the only other prefix at level 82 is flat mana, every later prefix can be added and whittled without a Fracturing Orb.",
      when: "You are making a caster amulet (for example Archmage with double mana). Item level 82 gives Tier 1 flat mana, and that is the only level 82 prefix, so it always outlevels the other prefix.",
      how: ["Make the base rare, add Essence of the Breach (+20% maximum quality) and the matching catalysts (caster for spell builds) until the quality is 40%. Tainted/Vaal Infusers then take it to 50%; he needed about 50 Infusers and 8 bases for one success.", "Reduce the item to one modifier, then spam normal Chaos Orbs for the +3. His odds at item level 82 were about 1 in 1,600 per Chaos Orb (he spent 5,682 Chaos Orbs, about 598 divine, in one session).", "Put on Tier 1 flat mana by adding one prefix at a time and whittling: a Perfect Chaos Orb (minimum level 50) or Greater Chaos Orb with Omen of Whittling removes the lowest level mod, so with flat mana at level 82 the other prefix is the one that leaves. Use Omen of Sinistral Erasure when a higher level prefix (flat Energy Shield) would otherwise survive.", "Add the second prefix (mana percent) the same way. Then desecrate the cast speed suffix: Omen of Light and Omen of Dextral Necromancy with a Collarbone and Omen of Abyssal Echoes (about 1 in 15 to see it).", "Optional: sanctify. With no fractured mod, all four mods can be multiplied. He rolls the sanctification only with a Hinekora's Lock hover, because a failed sanctification sells for far less than the item cost."],
      extras: ["Quality: Breach essence gives +20% maximum quality (jewellery); catalysts add 5% each; Infusers add 1-2% at item level 82 and corrupt at 5% per point above the maximum (the advisor's Infuser rules match).", "Market note from the same video: a Cast on Critical amulet with Dialla's Lantern wastes the free spirit (the amulet gives that skill without upkeep), so Archmage is the better implicit, and item level 82 Archmage amulets sold for about half the price of the Cast on Critical version."],
      watch: "Level numbers are Belton's (Tier 1 cast speed 66, +3 skills 75, flat mana 82, evasion 77, armour and energy shield percent 75) and he warns that GGG changed levels and weights between leagues and that new 0.5 mods show weight 1 (unknown). Check the mod level in the advisor's mod list before you trust it. His odds were observed, not a game text.",
      build: () => [] },
    { name: "Wand: stack socketed-effect to run three crafted mods and 8 mods (+11 spell levels)", group: "Wand tricks (Belton, 0.5.5)",
      what: "From Belton's wand videos (Tt7DBsX36dc, C1CBFLFr7I4). Alva's Legacy rune of increased effect of socketed runes (75%) plus the Sovereign Alloy suffix (20-30% increased effect of socketed augment items) make +1 suffix modifier into +2, and plus one crafted modifier into several. Items added through a crafted slot or a rune can be removed again afterwards, which leaves mods behind.",
      when: "You are building a top-end caster wand. This is an expensive, partly random craft: it needs corruption, locks, and rolls on an Architect's Orb and the new Yaal Max Orb of Sacrifice.",
      how: ["Wand with two sockets, item level 80 or 81 (+4 or +5 skills of a type), Spellslinger level 20. Rune of +1 crafted modifier and rune of +1 suffix.", "Prefixes: 119% spell damage, 119% lightning damage (or 30% as extra), and +1 spells with mana as the first crafted modifier.", "Suffixes: +5 lightning (or +4 all spell skills), natural Tier 1 cast speed, Tier 1 spell crit chance, then the alloy's 30% socketed effect as the second crafted modifier.", "Swap the +1 crafted modifier for the 75% socketed-effect rune: +1 suffix becomes +2 suffixes. Desecrate Tier 1 crit bonus as the fifth suffix.", "Remove the 75% rune, put in the Alva's Legacy rune of +2 spell skills, and use Hinekora's Locks (hover) to get the corruption that adds a socket; put +1 spell skills in it.", "Corrupt twice (Architect's Orb: 50% a second enchantment, 50% destroys the item) to get a +1 gem-type enchantment, then use a Yaal Max Orb of Sacrifice: it removes a random modifier and upgrades the enchantment to +2. You want it to remove the useless 30% socketed-effect suffix. Result: +11."],
      extras: ["Cheaper version (C1CBFLFr7I4): leave out the destruction prefix so only five mods can be removed. Hover with a Lock until the enchantment matches your gem type; fracture the +5 skills mod so it cannot be the one removed. The wand ends with +11 and no seventh mod.", "Another route: start with the 75% rune and the +1 crafted rune, make +4 spell skills and the 30% socketed effect, add the 4th crafted mod (mana), then swap +1 crafted for a suffix, so you can have five suffixes.", "The Legacy runes are wand-only. A focus can carry the other +2 and the extra suffix: +14 levels between the weapons and +20 with a +6 amulet."],
      watch: "Not in the calculated numbers: the advisor does not model rune effects, crafted-modifier limits, Lock hovering or Sacrifice. Rules to keep in mind: only one crafted modifier by default (a second with the right rune), and a desecrated mod stays when the +1 suffix source is removed. Belton says he could not test it in game; it is a plan, not a proven craft.",
      build: () => [] },
    { name: "Physical weapon, budget route: magic base, Greater essence, fracture a suffix, essences and one desecration", group: "Weapons (Belton, 0.5)",
      what: "From Belton's league-start guide (r90VcxlqWpE, written before 0.5 went live). Buy or make a magic item level 82 weapon with Tier 1 or 2 physical percent, make it rare with a Greater Essence of Abrasion (guaranteed flat physical), swap a throwaway suffix for the 20% damage as extra physical mod, then finish the suffixes with Perfect Essences and one desecration. He calls it 100% deterministic for a weapon that carries you to tier 15-16 maps.",
      when: "You want a cheap, serviceable physical martial weapon (spear, bow, mace, quarterstaff, talisman) for the first weeks of a league, or many of them to sell.",
      how: ["Start from a normal or magic item level 82 base (item level 81 is needed for the hybrid physical percent and +5/+7 skills, 77 for Tier 1 attack speed, 75 for Tier 1 flat physical, 72 for Tier 1 crit chance). Perfect Orb of Transmutation, then Perfect Orb of Augmentation and Orb of Annulment until a Tier 1 or 2 physical percent prefix sits on it. Or buy a magic item that already has it.", "Greater Essence of Abrasion makes it rare and gives a guaranteed flat physical prefix. If a wanted suffix (attack speed or crit chance) is already on it and Fracturing Orbs are cheap, add an unrevealed desecrated mod with a Preserved Jawbone and fracture for a 1 in 3 chance at that suffix.", "Third prefix: Omen of Dextral Crystallisation with Perfect Essence of Abrasion removes a suffix and adds 20% (33% on two-handed weapons except bows) of damage as extra physical damage.", "Suffixes: use a Greater Exalted Orb (minimum level 35) until you see Tier 3 or better crit or attack speed. Then Perfect Essence of Battle (+3 attack skills). He says that with the suffixes full it removes a suffix before it adds, so no Crystallisation omen is needed (his observation; the advisor assumes any unlocked mod can be removed).", "Last suffix: Dextral Necromancy and a Preserved Jawbone, or Perfect Essence of Haste (onslaught on kill). Perfect Essence of Haste or Battle also removes a bad desecrated mod without Omen of Light when a suffix is fractured; repeat until the revealed mod is the one you want."],
      extras: ["Weapon quality is the best place for quality on a physical weapon: 20% on a 1,000 PDPS weapon makes 1,200 and 30% makes 1,300. Buy 23-27% quality items cheaply.", "Desecrated attack speed (18%) is Tier 1 adjacent on a bow, Tier 4 on one-handed weapons. With Omen of the Lich (Amanamu) and Echoes, every screen shows an Amanamu suffix, and he counts three of them for weapons, so about 66% on the first try to see the 18% attack speed."],
      watch: "Belton's numbers: about 577-657 PDPS on a spear and 650 on an obliterator bow at the worst case. These are his own and the guide predates the 0.5 rule 'one crafted modifier at a time' (see the notes), which may block two crafted mods such as the Perfect Essence and the damage-as-extra mod. The advisor does not check that rule.",
      build: () => [] },
    { name: "Armour piece: fracture the key mod, then Omen of Putrefaction with a bone and Echoes", group: "Armour (Belton, 0.5)",
      what: "From the Crafting Couch episode 5 (5HKHN3L2lKY). Fracture the one mod you must keep (for example move speed on boots), then use Omen of Putrefaction with a bone: the next desecration replaces all other modifiers with unrevealed desecrated mods (up to six, the fractured one stays) and corrupts the item. On armour there are only a handful of prefixes, and the reveal lets you choose from three per screen, so the result is mostly Tier 1 mods.",
      when: "Boots, gloves, helmets and body armour at item level 82 with one fractured mod. Not for items you still want to craft afterwards, since it corrupts.",
      how: ["Fracture the mod you must have (needs 4 or more mods).", "Use Omen of Putrefaction, then a Preserved or Ancient bone with Omen of Abyssal Echoes. The omen's text (poe2db): while it is active the next desecration replaces all modifiers, creating an item with up to 6 unrevealed modifiers, and corrupts it.", "Reveal each mod at the Well of Souls. Armour has no desecrated-only prefixes, so the options are natural mods; he sees three per screen (six with Echoes) and picks the Tier 1 ones. Every tier of Energy Shield and resistance mods has the same weight, so Tier 1 is as likely as Tier 7."],
      watch: "The item ends up corrupted with 5 desecrated mods, so you cannot add anything afterwards, and the omen can't be used on an item you want to keep as it is. Observed in a pre-0.5 video that also used the removed Homogenising omen for other steps; the omen text itself is from poe2db. Omen of Putrefaction is not modelled in the advisor's numbers.",
      build: () => [] },
    { name: "Whittle bait: put a cheap low-level crafted mod on the item, then Whittle it away", group: "Weapons (Belton, 0.5)",
      what: "From Belton's Crafting Couch overview (ebRw5y7qYvw). Whittling removes the lowest level mod, so a mod of level 45 (spirit) on the item blocks it: Whittling would reroll the spirit. Put a very low level crafted mod on the free prefix first (for example the increased runic ward prefix from a Sovereign Alloy, about level 25, aimed with Omen of Sinistral Crystallisation), and the next Whittling removes that one instead of your mod.",
      when: "You roll a prefix with Perfect Exalted Orbs (minimum level 50) and the item holds a mod, like spirit, that is lower level than the new ones you will roll. Cheaper than Sinistral Erasure omens (about 6-7 div each at that time, Whittling about 4).",
      how: ["Use the +1 crafted modifier socket, or a free crafted slot, so that the extra crafted mod is allowed on the item.", "Replace the prefix you do not want with the Sovereign Alloy (increased runic ward) and Omen of Sinistral Crystallisation, or desecrate with Essence of the Abyss and a bone, to get a very low level prefix.", "Chaos Orb with Omen of Whittling: it now removes the lowest level mod, which is the bait. Repeat the exalts and Whittling until the prefix is the mod you want."],
      watch: "Needs a second crafted modifier on the item, which Belton gets from the Astrid's Creativity-style rune. The 0.5 patch notes say only one crafted modifier at a time is allowed, so check that your item can hold both. Sinistral and Dextral Crystallisation work with alloys even though the omen text names only essences (Belton, again here).",
      build: () => [] },
    { name: "Wand, budget route: magic base, Greater essence, forced Amanamu desecration, Perfect Essence of Sorcery", group: "Weapons (Belton, 0.5)",
      what: "From Belton's Crafting Couch episode 2 (rJBeawMsl50, made before 0.5 went live). A caster wand with spell damage, cast speed, spell crit, +3 spell skills, elemental damage and damage as extra, almost without variance. Start from a magic item level 80 or 81 wand with spell damage and cast speed or spell crit, use a Greater Essence for the missing suffix, desecrate the elemental damage prefix, fracture the spell damage, then Perfect Essence of Sorcery for the +3.",
      when: "You want a generic spell wand fast. Item level 80 is enough and better for later Whittling (the highest level mod on a wand is 81); 81 is needed for a skill type (lightning, cold, fire, chaos) and its percent damage.",
      how: ["Magic wand with Tier 3 or better spell damage plus cast speed (or spell crit). Greater Essence adds the other suffix and makes it rare.", "Omen of Sinistral Necromancy, Omen of the Lich (Amanamu), a Preserved Jawbone and Omen of Abyssal Echoes: the desecrated mod is a prefix from the Amanamu pool, so it shows elemental damage. Optional: fracture first for a 1 in 3 chance at the spell damage (the fracture cannot hit the unrevealed mod).", "Reveal and take elemental damage. It blocks fire, cold, lightning, chaos and spell percent damage prefixes, so only damage as extra (weight 500 each), flat mana and the spell damage + mana hybrid are left.", "Omen of Sinistral Exaltation and a Greater Exalted Orb (minimum level 35) adds a prefix; it is a feeder mod.", "Omen of Sinistral Crystallisation with Perfect Essence of Sorcery removes a prefix and adds +3 spell skills. If spell damage is fractured, only the feeder prefix or the elemental damage can go, and elemental damage can be re-added.", "Last mod: another Greater Exalted Orb. It can only be damage as extra, flat mana or the hybrid, all of which Belton counts as useful."],
      extras: ["Mutual exclusivity (his table): spell damage, life-cost and invocation damage mods exclude each other (group A); every percent damage type excludes the other types (group B); a skill-level type (+lightning skills) lets only the matching percent damage roll and the reverse is also true (group D). Damage as extra and spell crit are not in a group.", "A Greater Exalted Orb costs little more than a plain one (the redheaded stepchild of the exceptional currencies) but raises the minimum level to 35."],
      watch: "The 0.5 patch notes limit an item to one crafted modifier at a time. The Perfect Essence mod is one, but whether the Greater Essence mod counts is not clear from the notes, so check on your item. Belton's cost estimate was 5 minutes and about 5 divine, 'as of the last league'. The wand's numbers in the page's calculator are not computed for this card.",
      build: () => [] },
    { name: "Fish for a desecrated mod without Omen of Light", group: "Desecration",
      what: "From Lolcohol's Blood Mage Cast Speed Ring guide. When a revealed desecrated mod is not what you want, remove it more cheaply than with Omen of Light: Omen of Sinistral Crystallisation with any Perfect Essence replaces it, then Omen of Sinistral Crystallisation with Essence of the Abyss replaces that with a Mark of the Abyss, which the next bone replaces. Then desecrate again.",
      when: "One side (prefixes or suffixes) is finished, the other side holds only the desecrated mod and nothing you want to keep, and you are fishing for one particular mod.",
      how: ["Desecrate with a Preserved bone and Omen of Abyssal Echoes and reveal. Take the mod if it is the one you want.", "If not, use Omen of Sinistral Crystallisation (or Dextral for suffixes) with a cheap Perfect Essence that fits the item. It replaces the desecrated mod.", "Use the same omen again with Essence of the Abyss. It replaces the essence mod with a Mark of the Abyss. If it fails to add the mark because the side is full, click again until it works.", "Desecrate again. The bone replaces the Mark of the Abyss. Repeat until you reveal the mod you want."],
      watch: "Only safe when that side holds nothing else unlocked, because the essences remove a random mod on the side. Each cycle costs two Crystallisation omens and two essences. Compared with Omen of Light, which the guide notes means 6 mods seen per attempt with Echoes, it is much cheaper per try. The guide's whole craft no longer works since Omen of Homogenising Exaltation can no longer drop, but this fishing loop still applies.",
      build: (f, c) => { const side = c.sidePrefix || "Sinistral"; const d = f(/^Desecrate with Preserved \w+ \+ Omen of Abyssal Echoes$/) || f(/^Desecrate with Preserved \w+$/); const sw = f(new RegExp("^Swap out a bad desecrated (prefix|suffix) with .* \\(Omen of " + side + " Crystallisation twice\\)$"));
        return [d, sw, d, sw, d]; } },
    { name: "Add a guaranteed mod with a Perfect Essence", group: "Adding mods",
      what: "A Perfect Essence removes one random mod and adds its own guaranteed mod. With Omen of Sinistral or Dextral Crystallisation the removal is limited to prefixes or suffixes, so you can aim it at a throwaway mod.",
      when: "A mod you want is one of the essence mods (for example a resistance or life percent), and one side of the item holds a throwaway mod you can lose.",
      how: ["Check that the side you will remove from holds only the throwaway mod and mods you can afford to lose. Fractured mods are safe.", "Use the Perfect Essence with the Crystallisation omen for that side."],
      watch: "Without the omen the removal can hit any unlocked mod. Only essences that give one of your wanted mods are offered here.",
      build: (f) => [f(/^Perfect Essence of .* \+ Omen of (Sinistral|Dextral) Crystallisation$/) || f(/^Perfect Essence of [^+]*$/)] },
  ];
  function presetCard(i) {
    if (i === "" || !PRESETS[+i]) return "";
    const m = PRESETS[+i];
    return `<div class="methodcard"><div><b>What it is.</b> ${esc(m.what)}</div>
      <div><b>The steps.</b><ol>${m.how.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>
      <div class="more"><b>Use it when.</b> ${esc(m.when)}</div>${m.extras ? `<div class="more"><b>Alloys and quality.</b><ul>${m.extras.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}<div class="warn2 more"><b>Watch out.</b> ${esc(m.watch)}</div><div class="dim"><span class="moremark">Hold Alt for when to use it, alloy and quality notes and warnings.</span></div></div>`;
  }
  {
    const groups_ = [...new Set(PRESETS.map((x) => x.group || "Other"))];
    $("seqPreset").innerHTML = '<option value="">Choose a ready-made method...</option>' + groups_.map((g) => `<optgroup label="${esc(g)}">` + PRESETS.map((x, i) => (x.group || "Other") === g ? `<option value="${i}">${esc(x.name)}</option>` : "").join("") + "</optgroup>").join("");
  }
  $("seqPreset").onchange = () => { $("seqPresetInfo").innerHTML = presetCard($("seqPreset").value); };
  // builds the step list of ready-made method i for the current targets; missing lists what could not be built
  function presetSteps(i) {
    const have = st.actionNames, missing = [];
    const f = (opt) => { const list = Array.isArray(opt) ? opt : opt instanceof RegExp ? have.filter((n) => opt.test(n)) : [opt]; const hit = list.find((n) => have.includes(n)); if (!hit) missing.push(Array.isArray(opt) ? opt[0] : opt instanceof RegExp ? "an action of that kind" : String(opt)); return hit || null; };
    const keyIdx = Math.max(0, st.targets.findIndex((t) => t.fractured)), secondIdx = st.targets.findIndex((t, k) => k !== keyIdx);
    const sideName = (k) => { const t = st.targets[k], gr = t && groups()[t.group]; return gr ? (gr.side === "P" ? "Sinistral" : "Dextral") : null; };
    const prefIdx = st.targets.findIndex((t, k) => k !== keyIdx && k !== secondIdx && (groups()[t.group] || {}).side === "P");
    const ctx = { second: secondIdx, sideSecond: secondIdx >= 0 ? sideName(secondIdx) : null, sideFirst: sideName(keyIdx), sidePrefix: "Sinistral", prefIdx };
    const steps = [];
    for (const x of PRESETS[+i].build(f, ctx)) { const [name, until, n] = Array.isArray(x) ? x : [x]; if (name) steps.push(mkStep(name, until, n)); }
    return { steps, missing };
  }
  $("seqPresetBtn").onclick = () => {
    const i = $("seqPreset").value; if (i === "" || !st.targets.length) { $("seqOut").innerHTML = '<p class="warn">Add a target mod first, then choose a method.</p>'; return; }
    const built = presetSteps(i), steps = built.steps, missing = built.missing;
    st.seqNote = missing.length ? `<p class="dim">${steps.length ? "Steps left out" : "No steps could be built"} because they are not available or not priced for this item or your wanted mods: ${esc([...new Set(missing)].join(", "))}. For the Perfect Essence method, one of your wanted mods must be a mod that a Perfect Essence gives (look for "Crafted" mods in the target list).</p>` : "";
    st.seq = steps; renderSeq(); $("seqPresetInfo").innerHTML = presetCard(i);
  };
  $("seqClear").onclick = () => { st.seq = []; st.seqNote = ""; renderSeq(); };
  function calcSeq() {
    if (!st.seq.length) { $("seqOut").innerHTML = '<div class="empty">Add steps to see the chance of finishing and the cost after each one.</div>'; return; }
    if (!st.targets.length) { $("seqOut").innerHTML = '<div class="empty">Add a target mod first (section 3).</div>'; return; }
    const r = C.solve(Object.assign(baseCfg(), { considerFracture: true, sequenceOnly: true, sequence: st.seq })).sequence;
    const note = st.seqNote || "";
    const names = r.targets.map((t, i) => { const gr = groups()[t]; return gr ? gLabel(gr) : t.replace(/^[DE]:/, ""); });
    const perItem = r.costPerSuccess || (r.pGoal > 0 ? r.spend / r.pGoal : null);
    let h = note + profitHtml(perItem, "cost per finished item") + `<div class="stats">
      <div class="stat"><div class="statnum">${pct(r.pGoal)}</div><div class="dim">chance the item ends up with everything you want</div></div>
      <div class="stat"><div class="statnum">${fx(r.spend)} ${ul()}</div><div class="dim">average currency spent on one item</div></div>
      <div class="stat"><div class="statnum">${r.costPerSuccess ? fx(r.costPerSuccess) + " " + ul() : "-"}</div><div class="dim">average cost per finished item if you repeat these steps on new identical items</div></div></div>`;
    h += '<div class="timeline">' + r.steps.map((x, i) => {
      if (x.error) return `<div class="tstep"><div class="badge">${i + 1}</div><div class="tbody"><b>${esc(x.name)}</b><div class="warn">${esc(x.error)}</div></div></div>`;
      const how = x.until ? `repeated until ${esc(x.until)} (at most ${x.times} times)` : `used ${x.times} time${x.times === 1 ? "" : "s"}`;
      const skipped = !x.until && x.uses < x.times - 1e-6 ? ` <span class="dim">(on average only ${fn(x.uses)} of those are needed: the step stops for items that are already finished or where it does not apply)</span>` : "";
      const over = sellPrice() != null && x.cumCost + baseCost() > sellPrice();
      return `<div class="tstep${over ? " loss" : ""}"><div class="badge">${i + 1}</div><div class="tbody">
        ${over ? '<div class="warn">&#9888; The cost so far (including the base) is already above the sale price.</div>' : ""}<div><b>${esc(x.name)}</b> <span class="dim">${how}</span></div>
        ${x.uses < 0.005 ? '<div class="warn">Skipped: this action does not apply to the item as it is at this point (for example it is already rare, or already finished).</div>' : `<div class="dim">Average uses: <b>${fn(x.uses)}</b>${skipped} &middot; cost of this step: <b>${fx(x.cost)} ${ul()}</b> &middot; total so far: <b>${fx(x.cumCost)} ${ul()}</b></div>`}
        <div class="barrow"><span class="barlabel">Item finished after this step</span><span class="bar"><span class="barfill" style="width:${Math.max(1, Math.round(x.pGoal * 100))}%"></span></span><b>${pct(x.pGoal)}</b></div>
        <div class="chips">${x.pEach.map((q, k) => `<span class="pill">${esc(names[k])}: <b>${pct(q)}</b></span>`).join("")}</div></div></div>`;
    }).join("") + "</div>";
    h += `<div class="dim note">Each percentage is the chance across many items, not a promise for one. Omen of Whittling removes the lowest level mod: the advisor works out how likely that is to be a mod you want from the levels in the mod pool.</div>`;
    $("seqOut").innerHTML = h;
  }
  ["cls", "base", "ilvl", "rarity", "heldFilter", "need"].forEach((id) => $(id).addEventListener("change", () => { refreshActions(); setTimeout(() => { renderSeq(); }, 0); }));
  ["addHeld", "addTarget", "parse"].forEach((id) => $(id).addEventListener("click", () => setTimeout(() => { refreshActions(); renderSeq(); }, 0)));
  document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-rm]")) setTimeout(() => { refreshActions(); renderSeq(); }, 0); });

  window.__reprofit = () => { try { if (st.seq && st.seq.length && st.targets.length) calcSeq(); } catch (e) {} };

  // ---- corruption: outcomes, enchantments, Sacrifice orbs, Vaal uniques (data from corrupt.js, built by tools/fetch_corruption.py) ----
  const CORR = window.CRAFT_CORRUPT;
  // How likely each Vaal Orb outcome is. No official table exists. Guides (Switchblade Gaming, verified against 0.5.4; TimeSaver; U4N) all say the four
  // outcomes are equally likely (~25% each), and the only measured sample found (100 chest plates: 29/28/22/21%, MMOJUGG, old) fits equal odds
  // (chi-square 2.0 on 3 degrees of freedom). So the weights are equal; change them here if better data appears.
  // kind: "rare" | "unique" | "rareJewel" | "uniqueJewel"; one weight per entry of CORR.outcomes[kind], in order.
  function vaalOutcomeWeights(kind) {
    return CORR.outcomes[kind].map(() => 1);
  }
  function corrTags(ty) {
    if (ty === "Jewel") return new Set(["jewel"]);
    const b = Object.keys(D.bases).find((n) => D.bases[n].ty === ty);
    return b ? new Set(D.bases[b].tg) : new Set();
  }
  const corrWeight = (e, tags) => { for (let i = 0; i < e.wk.length; i++) if (tags.has(e.wk[i])) return e.wv[i]; return 0; };
  const corrGroup = (ty) => (ty === "Jewel" ? "jewel" : /Ring|Amulet|Belt/.test(ty) ? "jewellery" : /Wand|Staff/.test(ty) ? "caster" : /Body Armour|Helmet|Gloves|Boots|Shield|Focus/.test(ty) ? "armour" : "weapon");
  function renderCorruption() {
    if (!CORR || !$("corrOut")) return;
    const sel = $("corrType"), keep = sel.value;
    if (!sel.options.length) {
      const tys = ["Jewel"].concat(types.filter((t) => t !== "Jewel"));
      sel.innerHTML = tys.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    }
    const ty = (D.bases[$("base").value] || {}).ty;
    if (!keep && ty) sel.value = ty;
    const type = sel.value, tags = corrTags(type), jewel = type === "Jewel";
    // poe2db's class page (the same source the jewel simulator uses) lists the enchantments, what each Orb of Sacrifice upgrades them to and the Altered Collarbone pools;
    // the Path of Building list is the fallback (jewels, anything poe2db did not give)
    const attr = ((D.bases[$("base").value] || {}).tg || []).map((t) => /^(str|dex|int)(_(str|dex|int))*_armour$/.test(t) ? t.replace(/_armour$/, "") : null).find(Boolean) || "str";
    const pd = !jewel && CORR.classes ? (CORR.classes[type] || CORR.classes[type + "|" + (D.bases[$("base").value] && D.bases[$("base").value].ty === type ? attr : "str")]) : null;
    const list = pd ? pd.corrupted.map((r) => ({ l: [r.text], family: r.family })) : CORR.enchants.filter((e) => !e.special && corrWeight(e, tags) > 0);
    const wOf = (e) => (pd ? 1 : corrWeight(e, tags));
    const tot = list.reduce((a, e) => a + wOf(e), 0);
    const upOf = (e) => (pd ? pd.upgrade.find((x) => x.family.join(",") === e.family.join(",")) : null);
    const kind = jewel ? "rareJewel" : "rare";
    const names = CORR.outcomes[kind].slice(), wts = vaalOutcomeWeights(kind).slice();
    const noSocket = !jewel && !/Wand|Staff/.test(type) && !(["Helmet", "Gloves", "Boots", "Body Armour", "Shield", "Focus"].includes(type) || corrGroup(type) === "weapon");
    if (noSocket) names[3] = "Special outcome (socket) is impossible on this type, so nothing happens (simulated: see the Details view)";
    const sw = wts.reduce((a, x) => a + x, 0) || 1;
    const idx = names.findIndex((n) => /enchantment is added/i.test(n));
    const pEnch = wts[idx] / sw;
    const vaal = rate("Vaal Orb");
    const socketable = ["Helmet", "Gloves", "Boots", "Body Armour", "Shield", "Focus"].includes(type) || corrGroup(type) === "weapon";
    const sac = CORR.sacrifice.find((x) => (jewel ? /Jewel/ : corrGroup(type) === "jewellery" ? /Amulet/ : corrGroup(type) === "armour" ? /Armour/ : /Weapon/).test(x.text));
    let h = `<div class="corrgrid">${names.map((n, i) => `<div><b>${pct(wts[i] / sw)}</b><div class="dim">${esc(n)}</div></div>`).join("")}</div>
      <div class="dim">Odds: equal for each outcome, as every guide states (GGG publishes no table; the one test found, 100 items, fits equal odds). ${socketable ? "This type can also gain a socket as the special outcome. " : ""}${/Ring|Amulet|Belt/.test(type) ? "Rings, amulets and belts cannot gain a socket, so that outcome probably does nothing there (about half of corruptions change nothing, by one guide's reasoning; not confirmed). " : ""}${/Wand|Staff/.test(type) ? "Wands and staves get quality up to 23% as the special outcome. " : ""}Uniques instead get their values divined (0.78x to 1.22x) instead of randomised.</div>`;
    h += `<div class="tablewrap"><table><tr><th>Corruption enchantment (${list.length} can roll on ${esc(type)})</th><th>Chance per Vaal Orb</th><th>Items you burn on average</th><th>Cost on average (${ul()})</th>${pd ? "<th>After an Orb of Sacrifice</th>" : ""}</tr>${list.sort((a, b) => a.l.join().localeCompare(b.l.join())).map((e) => {
      const p = pEnch * wOf(e) / tot, n = p > 0 ? 1 / p : Infinity, each = (+$("baseEx").value || 0) + vaal;
      return `<tr><td>${esc(e.l.join(" / "))}</td><td>${p > 0 ? pct(p) : "-"}</td><td>${isFinite(n) ? fn(n) : "-"}</td><td>${isFinite(n) ? fx(n * each) : "-"}</td>${pd ? `<td>${upOf(e) ? esc(upOf(e).text) : '<span class="dim">cannot be upgraded</span>'}</td>` : ""}</tr>`;
    }).join("") || '<tr><td colspan="5">No corruption enchantments in the data for this type.</td></tr>'}</table></div>
      <div class="dim">A corrupted item cannot be corrupted again, so every try uses up one item: the cost counts the base price from section 4 plus a Vaal Orb at ${fx(vaal)} ${ul()}. Enchantment weights in the data are all equal. Each try can also randomise your modifiers, so only corrupt items you can afford to lose.</div>`;
    h += `<div class="chip" style="display:block"><b>Orb of Sacrifice for this item</b><div>${sac ? esc(sac.name) + ": " + esc(sac.text) + `. Price ${fx(rate(sac.name))} ${ul()}.` : "No Sacrifice orb applies to this item type."}</div>
      <div class="dim">All four types: ${CORR.sacrifice.map((x) => esc(x.name) + " (" + fx(rate(x.name)) + " " + ul() + ")").join("; ")}. They work on a corrupted Rare of the matching type: the corruption enchantment is upgraded and a random modifier is removed, so keep the item's best modifiers in mind (fractured ones cannot be removed). Where an orb comes from: Atziri, the Red Queen.</div></div>`;
    h += `<div class="dim" style="margin-top:6px"><b>Other corruption sources.</b><ul>${CORR.outcomes.other.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      Architect's Orb ${fx(rate("Architect's Orb"))} ${ul()}, Crystallised Corruption ${fx(rate("Crystallised Corruption"))} ${ul()}, Vaal Cultivation Orb ${fx(rate("Vaal Cultivation Orb"))} ${ul()}.</div>`;
    if (pd && pd.breach && pd.breach.breach_otherworldly && pd.breach.breach_otherworldly.length) {
      const ow = pd.breach.breach_otherworldly;
      h += `<details><summary>Altered Collarbone: the "otherworldly" modifiers it can add to a rare ${esc(type)} (${ow.length}; ${fx(rate("Altered Collarbone"))} ${ul()} each)</summary><div class="dim">Desecrates a Rare amulet, ring or belt with a chance for otherworldly modifiers (poe2db). The chance is not published, so no odds are calculated.</div><ul>${ow.map((m) => `<li>${esc(m.text)} <span class="tag">${m.side === "P" ? "prefix" : m.side === "S" ? "suffix" : ""}</span></li>`).join("")}</ul></details>`;
    }
    if (CORR.enchants.some((e) => e.special)) h += `<details><summary>Special corruption-only enchantments (${CORR.enchants.filter((e) => e.special).length}; no item weights in the data)</summary><ul>${CORR.enchants.filter((e) => e.special).map((e) => `<li>${esc(e.l.join(" / "))}</li>`).join("")}</ul></details>`;
    $("corrOut").innerHTML = h;
  }
  function renderVaal() {
    if (!CORR || !$("vaalOut")) return;
    const cs = $("vaalClass"); if (!cs.options.length) cs.innerHTML = '<option value="">All item classes</option>' + [...new Set(CORR.uniques.map((u) => u.cls))].sort().map((c) => `<option>${esc(c)}</option>`).join("");
    const f = ($("vaalFilter").value || "").toLowerCase().trim(), c = cs.value;
    $("vaalRule").textContent = (CORR.cultivationRule || "") + ". Price: " + fx(rate("Vaal Cultivation Orb")) + " ex. Which replacement mods it picks is random from the pool shown; no odds are published. A non-Vaal unique becomes a new corrupted unique of the same class. Source: " + (CORR.cultivationSource || "");
    const rows = CORR.uniques.filter((u) => (!c || u.cls === c) && (!f || (u.name + " " + u.base + " " + u.cls + " " + u.mods.join(" ") + " " + u.cultivated.join(" ")).toLowerCase().includes(f)));
    $("vaalOut").innerHTML = `<table><tr><th>Vaal unique</th><th>Normal modifiers</th><th>Cultivation pool (${rows.length} items shown)</th></tr>${rows.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="dim">${esc(u.cls)}, ${esc(u.base)}</div></td><td>${u.mods.map(esc).join("<br>")}</td><td>${u.cultivated.map(esc).join("<br>")}<div class="dim">${u.cultivated.length} possible; replaces up to 2</div></td></tr>`).join("") || '<tr><td colspan="3">No unique matches.</td></tr>'}</table>`;
  }
  ["corrType"].forEach((id) => { if ($(id)) $(id).onchange = renderCorruption; });
  if ($("vaalFilter")) { $("vaalFilter").oninput = renderVaal; $("vaalClass").onchange = renderVaal; }
  $("base").addEventListener("change", () => { if ($("corrType")) { $("corrType").value = (D.bases[$("base").value] || {}).ty || $("corrType").value; renderCorruption(); } });

  // ---- cumulative crafting cost tracker (kept in this browser) ----
  const TRK_KEY = "craftTracker", HIST_KEY = "craftHistory";
  let trk = { name: "", entries: [] }, hist = [];
  try { const v = JSON.parse(localStorage.getItem(TRK_KEY) || "null"); if (v && v.entries) trk = v; hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) {}
  const saveTrk = () => { try { localStorage.setItem(TRK_KEY, JSON.stringify(trk)); localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch (e) {} };
  const priceOf = (n) => { const v = prices[n] != null ? prices[n] : live[n]; return v != null ? v : null; };
  function lastAdviceCost() { return st.lastAdvice != null ? st.lastAdvice : null; }
  function trkSpent() { return trk.entries.reduce((a, e) => a + e.qty * e.each, 0) + (($("trkBase") && $("trkBase").checked) ? (+$("baseEx").value || 0) : 0); }
  function renderTracker() {
    if (!$("trkOut")) return;
    const sel = $("trkCur"), f = ($("trkFilter").value || "").toLowerCase();
    const names = Object.keys(live).concat(Object.keys(prices)).filter((n, i, a) => a.indexOf(n) === i && n.toLowerCase().includes(f)).sort();
    const keep = sel.value; sel.innerHTML = names.slice(0, 300).map((n) => `<option>${esc(n)}</option>`).join(""); if (keep && names.includes(keep)) sel.value = keep;
    $("trkName").value = trk.name || $("trkName").value;
    const base = ($("trkBase").checked ? +$("baseEx").value || 0 : 0), spent = trkSpent();
    const rows = trk.entries.map((e, i) => `<tr><td>${esc(e.name)}${e.sim ? ' <span class="tag">simulated</span>' : ""}</td><td><input type="number" min="0" step="1" value="${e.qty}" data-trkq="${i}" style="width:70px" aria-label="Quantity"></td><td>${fx(e.each)} ${ul()}</td><td>${fx(e.qty * e.each)} ${ul()}</td><td><span class="x" data-trkdel="${i}" style="cursor:pointer;color:var(--bad)">&#10005;</span></td></tr>`).join("");
    const sp = sellPrice(), adv = lastAdviceCost();
    let h = `<div class="tablewrap"><table><tr><th>What you used</th><th>Times</th><th>Each</th><th>Total</th><th></th></tr>${base ? `<tr><td>Base item</td><td>1</td><td>${fx(base)} ${ul()}</td><td>${fx(base)} ${ul()}</td><td></td></tr>` : ""}${rows || (base ? "" : '<tr><td colspan="5" class="dim">Nothing logged yet.</td></tr>')}</table></div>`;
    h += `<div class="corrgrid"><div><b>${fx(spent)} ${ul()}</b><div class="dim">spent so far</div></div>`
      + (adv != null ? `<div><b>${fx(adv + base)} ${ul()}</b><div class="dim">the advice expected in total (from the last Advise me, with base)</div></div>` : "")
      + (sp != null ? `<div><b>${fx(sp)} ${ul()}</b><div class="dim">sale price</div></div><div><b class="${spent > sp ? "warn" : ""}">${fx(sp - spent)} ${ul()}</b><div class="dim">profit if sold now</div></div>` : "") + "</div>";
    if (sp != null && spent > sp) h += `<div class="lossbox warnbox" role="alert">&#9888; You have already spent more than this item sells for (${fx(spent)} against ${fx(sp)} ${ul()}). Stop unless the sale price is higher.</div>`;
    else if (adv != null && spent > (adv + base) * 1.5) h += `<div class="warn">You have spent over 1.5x what the advice expected. Bad luck, or the advice is off for this item.</div>`;
    h += `<div class="row"><button id="trkFinish" type="button">Finish this item (sold for the sale price above)</button> <button id="trkUndo" type="button">Undo the last entry</button> <button id="trkClear" type="button">Clear the log</button></div>`;
    $("trkOut").innerHTML = h;
    $("trkOut").querySelectorAll("[data-trkq]").forEach((e) => e.onchange = () => { trk.entries[+e.dataset.trkq].qty = Math.max(0, +e.value || 0); saveTrk(); renderTracker(); });
    $("trkOut").querySelectorAll("[data-trkdel]").forEach((e) => e.onclick = () => { trk.entries.splice(+e.dataset.trkdel, 1); saveTrk(); renderTracker(); });
    $("trkUndo").onclick = () => { trk.entries.pop(); saveTrk(); renderTracker(); };
    $("trkClear").onclick = () => { trk.entries = []; saveTrk(); renderTracker(); };
    $("trkFinish").onclick = () => {
      const sale = sellPrice(); const total = trkSpent();
      hist.unshift({ name: ($("trkName").value || trk.name || "Item").trim() || "Item", date: new Date().toISOString().slice(0, 10), spent: total, sale: sale != null ? sale : null });
      trk = { name: "", entries: [] }; $("trkName").value = ""; saveTrk(); renderTracker();
    };
    const profit = hist.reduce((a, x) => a + (x.sale != null ? x.sale - x.spent : 0), 0), spentAll = hist.reduce((a, x) => a + x.spent, 0);
    $("trkHist").innerHTML = hist.length ? `<div class="tablewrap"><table><tr><th>Item</th><th>Date</th><th>Spent</th><th>Sold for</th><th>Profit</th></tr>${hist.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.date)}</td><td>${fx(x.spent)} ${ul()}</td><td>${x.sale != null ? fx(x.sale) + " " + ul() : "-"}</td><td class="${x.sale != null && x.sale < x.spent ? "warn" : ""}">${x.sale != null ? fx(x.sale - x.spent) + " " + ul() : "-"}</td></tr>`).join("")}</table></div><div><b>Total spent ${fx(spentAll)} ${ul()}, total profit ${fx(profit)} ${ul()}</b> over ${hist.length} item${hist.length === 1 ? "" : "s"}.</div><div class="row"><button id="trkHistClear" type="button">Clear the history</button></div>` : '<span class="dim">No finished items yet.</span>';
    if ($("trkHistClear")) $("trkHistClear").onclick = () => { hist = []; saveTrk(); renderTracker(); };
  }
  function trkLog(name, each, qty) {
    const last = trk.entries.find((e) => !e.sim && e.name === name && e.each === each);
    if (last) last.qty += qty || 1; else trk.entries.push({ name, qty: qty || 1, each });
    saveTrk(); renderTracker();
  }
  function trkRemove(name, each) { const i = trk.entries.findIndex((e) => !e.sim && e.name === name && e.each === each); if (i < 0) return; trk.entries[i].qty -= 1; if (trk.entries[i].qty <= 0) trk.entries.splice(i, 1); saveTrk(); renderTracker(); }
  if ($("trkAdd")) {
    $("trkFilter").oninput = renderTracker;
    $("trkName").oninput = () => { trk.name = $("trkName").value; saveTrk(); };
    $("trkBase").onchange = renderTracker;
    $("trkNew").onclick = () => { trk = { name: "", entries: [] }; $("trkName").value = ""; saveTrk(); renderTracker(); };
    $("trkAdd").onclick = () => { const n = $("trkCur").value, p = priceOf(n); if (!n) return; trkLog(n, p != null ? p : 0, Math.max(1, +$("trkQty").value || 1)); };
    // "Log" buttons inside the advice output
    document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-log]"); if (b) trkLog(b.dataset.log, +b.dataset.cost || 0, 1); });
    ["baseEx", "sellEx"].forEach((id) => $(id).addEventListener("input", renderTracker));
    if ($("unitSel")) $("unitSel").addEventListener("change", renderTracker);
    renderTracker();
  }

  // ---- simulate the rest of the craft: one random run of the advised plan is added to the tracker; 1,000 runs show the spread ----
  function runSim(many) { ensureFresh().then(() => runSim2(many)); }
  function runSim2(many) {
    const msg = $("trkSimMsg");
    if (!st.targets.length) { msg.innerHTML = '<span class="warn">Add a target mod first (sections 2 and 3).</span>'; return; }
    msg.textContent = "Working out the plan and simulating...";
    setTimeout(() => {
      const r = C.solve(baseCfg());
      if (r.done) { msg.textContent = "The item already has everything you asked for: nothing left to simulate."; return; }
      if (!r.reachable) { msg.innerHTML = '<span class="warn">No route found, so there is nothing to simulate (see the Advise me output).</span>'; return; }
      st.lastAdvice = r.expectedCost;
      if (!many) {
        const mode = $("trkRoute").value, sims = r.simulate(1, null, mode), run = sims[0];
        run.counts.forEach((c) => { const old = trk.entries.find((e) => e.sim && e.name === c.name && e.each === c.cost); if (old) old.qty += c.uses; else trk.entries.push({ name: c.name, qty: c.uses, each: c.cost, sim: true }); });
        saveTrk(); renderTracker();
        msg.innerHTML = `${mode === "chance" ? `Route: highest chance of success (${pct(sims.successChance)} of crafts finish without ruining the item; ties go to the cheaper action). ` : "Route: cheapest on average. "}One possible run: ${run.done ? "finished" : run.ruined ? "<b class=\"warn\">the item was ruined</b>" : "did not finish within 4,000 steps"} after ${run.steps} uses, ${fx(run.spend)} ${ul()} spent (the cheapest-route average is ${fx(r.expectedCost)} ${ul()}). Added to the log below as simulated entries. Run it again for a different outcome.`;
        return;
      }
      const mode = $("trkRoute").value, allRuns = r.simulate(1000, null, mode), okRate = allRuns.filter((x) => x.done).length / allRuns.length, runs = allRuns.map((x) => x.spend).sort((a, b) => a - b), q = (p) => runs[Math.min(runs.length - 1, Math.floor(p * runs.length))];
      const sp = sellPrice(), base = +$("baseEx").value || 0, mean = runs.reduce((a, x) => a + x, 0) / runs.length;
      const loss = sp != null ? runs.filter((x) => x + (trkSpent() - 0) > sp).length / runs.length : null;
      msg.innerHTML = `1,000 simulated crafts from here (${mode === "chance" ? "highest-chance route" : "cheapest route"}, ${pct(okRate)} finished${mode === "chance" ? ", the rest ruined" : ""}): cheapest tenth ${fx(q(0.1))}, typical (median) ${fx(q(0.5))}, unlucky tenth ${fx(q(0.9))}, worst 1% ${fx(q(0.99))} ${ul()}; average ${fx(mean)} ${ul()}.${loss != null ? ` ${pct(loss)} of them end up costing more (with what you already logged) than the ${fx(sp)} ${ul()} sale price.` : " Set a sale price (section 4) to see how often a craft loses money."} Nothing was added to the log.`;
    }, 30);
  }
  if ($("trkSim")) {
    $("trkSim").onclick = () => runSim(false);
    $("trkSimMany").onclick = () => runSim(true);
    $("trkRmSim").onclick = () => { trk.entries = trk.entries.filter((e) => !e.sim); saveTrk(); renderTracker(); $("trkSimMsg").textContent = "Simulated entries removed."; };
  }

  // ---- projected cost by method ----
  function compareMethods() { ensureFresh().then(compareMethods2); }
  function compareMethods2() {
    const msg = $("cmpMsg"), out = $("cmpOut");
    if (!st.targets.length) { msg.innerHTML = '<span class="warn">Add a target mod first.</span>'; return; }
    refreshActions();
    const base = +$("baseEx").value || 0, sp = sellPrice();
    const rows = [];
    const add = (name, tries, perTry, perItem, note) => rows.push({ name, tries, perTry, perItem, note });
    msg.textContent = "Solving the advisor's routes...";
    setTimeout(() => {
      const r = C.solve(baseCfg());
      if (r.done) { msg.textContent = "The item already has everything you asked for."; return; }
      if (!r.reachable) { msg.innerHTML = '<span class="warn">No route found with the modelled currency.</span>'; return; }
      add("Advisor: cheapest on average", r.pSuccess != null ? r.pSuccess : 1, r.spendIfAttempt != null ? r.spendIfAttempt : r.expectedCost, r.expectedCost, "buys a new base when an item is ruined");
      const ch = r.simulate(600, null, "chance"), P = ch.successChance || 0, avg = ch.reduce((a, x) => a + x.spend, 0) / ch.length;
      add("Advisor: highest chance of success", P, avg, P > 1e-9 ? avg / P + (1 / P - 1) * base : null, "never gambles on a cheaper step that can ruin the item; the rest of the tries start on a new base");
      const idx = PRESETS.map((x, i) => i);
      let k = 0;
      const next = () => {
        if (k >= idx.length) { finish(); return; }
        const i = idx[k++]; msg.textContent = `Working out ${PRESETS[i].name} (${k} of ${idx.length})...`;
        setTimeout(() => {
          try {
            const b = presetSteps(i);
            if (!b.steps.length) { rows.push({ name: PRESETS[i].name, skip: "cannot be built from your wanted mods" }); return next(); }
            const sq = C.solve(Object.assign(baseCfg(), { considerFracture: true, sequenceOnly: true, sequence: b.steps })).sequence;
            const g = sq.pGoal;
            add(PRESETS[i].name, g, sq.spend, g > 1e-9 ? sq.spend / g + (1 / g - 1) * base : null, b.missing.length ? "some steps left out (" + [...new Set(b.missing)].length + " not available)" : "");
          } catch (e) { rows.push({ name: PRESETS[i].name, skip: "could not be calculated" }); }
          next();
        }, 20);
      };
      const finish = () => {
        const ok = rows.filter((x) => !x.skip && x.perItem != null).sort((a, b) => a.perItem - b.perItem), bad = rows.filter((x) => x.skip || x.perItem == null);
        const cheapest = ok.length ? ok[0].perItem : null, bestP = ok.reduce((m, x) => Math.max(m, x.tries), 0);
        const money = (v) => `${fx(v)} ${ul()}`;
        out.innerHTML = `<table><tr><th>Method</th><th>Chance to finish in one try</th><th>Spend per try</th><th>Average cost per finished item</th><th>With the first base</th>${sp != null ? "<th>Profit per item</th>" : ""}</tr>${ok.map((x) => { const tot = x.perItem + base; return `<tr><td>${esc(x.name)}${x.perItem === cheapest ? ' <span class="tag">cheapest</span>' : ""}${x.tries === bestP ? ' <span class="tag">best chance</span>' : ""}${x.note ? `<div class="dim">${esc(x.note)}</div>` : ""}</td><td>${pct(x.tries)}</td><td>${money(x.perTry)}</td><td>${money(x.perItem)}${cheapest && x.perItem > cheapest ? ` <span class="dim">(${(x.perItem / cheapest).toFixed(1)}x)</span>` : ""}</td><td>${money(tot)}</td>${sp != null ? `<td class="${sp < tot ? "warn" : ""}">${money(sp - tot)}</td>` : ""}</tr>`; }).join("")}</table>${bad.length ? `<div class="dim">Not compared: ${bad.map((x) => esc(x.name) + " (" + (x.skip || "the steps as written cannot finish this item from where it is now: many methods start from a partly built item, for example one that already has the fractured mod") + ")").join("; ")}.</div>` : ""}<div class="dim">Cost per finished item counts the new bases bought after failed tries (base price from section 4). Ready-made methods are the steps as written, so they can cost more than the advisor's own route, which picks the best action for every item state.</div>`;
        msg.textContent = `Compared ${ok.length} methods.`;
      };
      next();
    }, 30);
  }
  if ($("cmpGo")) $("cmpGo").onclick = compareMethods;

  // ---- cost change by crafting material: force one tier (regular, Greater, Perfect) of a currency and re-solve ----
  function compareMaterials() { ensureFresh().then(compareMaterials2); }
  function compareMaterials2() {
    const msg = $("matMsg"), out = $("matOut");
    if (!st.targets.length) { msg.innerHTML = '<span class="warn">Add a target mod first.</span>'; return; }
    msg.textContent = "Solving the advisor's own mix...";
    setTimeout(() => {
      const r0 = C.solve(baseCfg());
      if (r0.done) { msg.textContent = "The item already has everything you asked for."; return; }
      if (!r0.reachable) { msg.innerHTML = '<span class="warn">No route found with the modelled currency.</span>'; return; }
      const FAM = ["Chaos Orb", "Exalted Orb", "Regal Orb", "Orb of Transmutation", "Orb of Augmentation"], TIERS = ["", "Greater ", "Perfect "];
      const names = r0.actions.map((a) => a.name);
      const tierOf = (n) => (/^Perfect /.test(n) ? 2 : /^Greater /.test(n) ? 1 : 0), famOf = (n) => FAM.find((f) => n.replace(/^(Greater |Perfect )/, "").startsWith(f));
      const jobs = [];
      FAM.forEach((f) => TIERS.forEach((_, t) => { const have = names.filter((n) => famOf(n) === f); if (have.some((n) => tierOf(n) === t)) jobs.push({ f, t, off: new Set(have.filter((n) => tierOf(n) !== t)) }); }));
      const res = []; let k = 0;
      const SPAM = (n) => /^(Desecrate|Add an unrevealed|Reveal|Swap out)|Essence|Alloy|Omen of Light/.test(n); // routes that avoid the material under test
      const next = () => {
        if (k >= jobs.length) return finish();
        const j = jobs[k++]; msg.textContent = `Solving ${TIERS[j.t] || "regular "}${j.f} only (${k} of ${jobs.length})...`;
        setTimeout(() => {
          let row = { f: j.f, t: j.t };
          try { const r = C.solve(Object.assign(baseCfg(), { disabled: j.off })); row.ok = r.reachable && !r.done; row.cost = r.expectedCost; row.p = r.pSuccess; row.first = r.options && r.options[0] && r.options[0].name; }
          catch (e) { row.ok = false; }
          if (j.f === "Chaos Orb" || j.f === "Exalted Orb") { // the same choice when the craft has to be done with this material (no desecration, essences or alloys)
            try { const off2 = new Set([...j.off, ...names.filter(SPAM)]); const r2 = C.solve(Object.assign(baseCfg(), { disabled: off2 })); row.ok2 = r2.reachable && !r2.done; row.cost2 = r2.expectedCost; row.p2 = r2.pSuccess; } catch (e) { row.ok2 = false; }
          }
          res.push(row); next();
        }, 15);
      };
      const finish = () => {
        const base = r0.expectedCost, money = (v) => `${fx(v)} ${ul()}`;
        const price = (f, t) => rate(TIERS[t] + f);
        const tables = FAM.map((f) => {
          const rows = res.filter((x) => x.f === f); if (!rows.length) return "";
          const forced = rows.filter((x) => x.ok2).map((x) => x.cost2), best2 = forced.length ? Math.min(...forced) : null;
          return `<tr class="sec"><td colspan="7"><b>${esc(f)}</b></td></tr>` + rows.map((x) => {
            const two = x.ok2 === undefined ? '<td class="dim" colspan="3">not tested for this currency</td>' : x.ok2 ? `<td>${money(x.cost2)}</td><td class="${x.cost2 > best2 * 1.005 ? "warn" : "dim"}">${x.cost2 > best2 * 1.005 ? "+" + ((x.cost2 / best2 - 1) * 100).toFixed(0) + "%" : "cheapest"}</td><td>${x.p2 != null ? pct(x.p2) : "-"}</td>` : '<td class="warn" colspan="3">cannot finish this way</td>';
            const label = (TIERS[x.t] || "Regular ") + f.replace(/^Orb of /, "");
            if (!x.ok) return `<tr><td>${esc(label)} only <div class="dim">${money(price(f, x.t))} each</div></td><td colspan="3" class="warn">cannot finish the craft (a wanted mod needs a higher level than this version can roll)</td>${two}</tr>`;
            const d = (x.cost / base - 1) * 100;
            return `<tr><td>${esc(label)} only <div class="dim">${money(price(f, x.t))} each</div></td><td>${money(x.cost)}</td><td class="${d > 0.5 ? "warn" : d < -0.5 ? "" : "dim"}">${Math.abs(d) < 0.5 ? "same" : (d > 0 ? "+" : "") + d.toFixed(1) + "%"}</td><td>${x.p != null ? pct(x.p) : "-"}</td>${two}</tr>`;
          }).join("");
        }).join("");
        out.innerHTML = `<table><tr><th>Material</th><th>Cost, advisor free to use anything else</th><th>Change against its own mix (${money(base)})</th><th>Chance without ruin</th><th>Cost when this material must do the work</th><th>Against the cheapest version</th><th>Chance without ruin</th></tr>${tables}</table><div class="dim">Each line allows only that version of one currency and lets the advisor use everything else as before, so the change is the effect of that choice alone. The advisor's own mix is the cheapest of all, so no line should beat it. The last three columns (Chaos and Exalted only) remove desecration, essences and alloys, so the craft has to be done with that material and the versions can be compared fairly.</div>`;
        msg.textContent = `Compared ${res.length} material choices.`;
      };
      next();
    }, 30);
  }
  if ($("matGo")) $("matGo").onclick = compareMaterials;

  // ---- game-style item card (colours and layout as in the jewel simulator): the item now, and what you want on it ----
  // src (optional): an item other than the one in sections 1 to 3, {rarity, base, ilvl, held, corrupted}; svgId: element id so two cards can sit on one page
  function itemCardSvg(src, svgId) {
    const W = 400, wrapAt = 52, rows = [], rar = src ? src.rarity : $("rarity").value, base = (src ? src.base : $("base").value) || "Item", ilvl = src ? src.ilvl : $("ilvl").value, sid = svgId || "itemCardSvg";
    const wrap = (t, n) => { const w = String(t).split(" "), out = []; let cur = ""; for (const x of w) { if ((cur + " " + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) out.push(cur); return out; };
    const sep = () => rows.push({ sep: true });
    const rare = rar === "Rare", magic = rar === "Magic", nameCol = rare ? "#ffff77" : magic ? "#8888ff" : "#c8c8c8";
    if (src && src.quality) { sep(); rows.push({ prop: { label: "Quality: ", value: "+" + src.quality + "%" + (src.qLabel ? " (" + src.qLabel + ")" : ""), ev: "#8888ff" } }); }
    if (src && src.sockets) rows.push({ prop: { label: "Augment Sockets: ", value: "+" + src.sockets, ev: "#ffffff" } });
    sep(); rows.push({ prop: { label: "Item Level: ", value: String(ilvl), ev: "#ffffff" } });
    const g = src ? C.groupsFor(src.base, +src.ilvl || 80, augTags()) : groups(), held = (src ? src.held : st.held).slice().sort((a, b) => (a.side === b.side ? 0 : a.side === "P" ? -1 : 1));
    sep();
    if (!held.length) rows.push({ t: "No modifiers", fill: "#777", italic: true });
    for (const h of held) {
      let fill = "#8888ff", tag = "";
      if (h.fractured) { fill = "#a29162"; tag = " (fractured)"; } else if (h.desecrated) { fill = "#5fcf8f"; tag = " (desecrated)"; } else if (h.crafted) { fill = "#b4b4ff"; tag = " (crafted)"; }
      const rp = !src && effReplace(h) && !h.fractured && !h.locked; if (rp) { fill = "#e06c6c"; tag = " (to replace)"; }
      if (h.unrevealed) { fill = "#5fcf8f"; tag = ""; }
      const ls = wrap(h.text, wrapAt); ls.forEach((l, i) => rows.push({ t: l, fill, strike: rp, italic: !!h.unrevealed, tag: i === ls.length - 1 ? tag : "" }));
    }
    const missing = st.targets.filter((t) => !(src ? src.held : st.held).some((h) => bareG(h.group) === bareG(t.group) && (h.lv || 0) >= t.minLevel));
    if (missing.length) {
      sep(); rows.push({ t: "Wanted", fill: "#c8a86a" });
      for (const t of missing) { const gr = g[t.group]; if (!gr) continue; const tier = gr.tiers.find((x) => x.lv === t.minLevel) || gr.tiers[gr.tiers.length - 1]; wrap(tier.text + " (tier " + (gr.tiers.indexOf(tier) + 1) + " or better)", wrapAt).forEach((l) => rows.push({ t: l, fill: "#9a9a9a", italic: true })); }
    }
    const HEAD = 70, LH = 21, SEP = 14; let H = HEAD + 10, body = "";
    for (const r of rows) {
      if (r.sep) { body += `<g transform="translate(0,${H})"><line x1="26" x2="${W - 26}" y1="4" y2="4" stroke="#6b5a3a" stroke-opacity=".8"/><circle cx="${W / 2}" cy="4" r="2.2" fill="#6b5a3a"/></g>`; H += SEP; continue; }
      H += LH;
      if (r.prop) { body += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="14" fill="#7f7f7f">${esc(r.prop.label)}<tspan fill="${r.prop.ev}">${esc(r.prop.value)}</tspan></text>`; continue; }
      body += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="14" fill="${r.fill}"${r.italic ? ' font-style="italic"' : ""}${r.strike ? ' text-decoration="line-through"' : ""}>${esc(r.t)}${r.tag ? `<tspan fill="#777" font-size="11" text-decoration="none">${esc(r.tag)}</tspan>` : ""}</text>`;
    }
    H += 14;
    const headFill = rare ? ["#4a3a14", "#241b08"] : magic ? ["#1d1d4a", "#0e0e25"] : ["#3a3a3a", "#1a1a1a"], border = rare ? "#b8a24a" : magic ? "#5a5ab8" : "#777";
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${sid}" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" font-family="'Fontin SmallCaps','Palatino Linotype',Georgia,serif">` +
      `<defs><linearGradient id="${sid}hd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${headFill[0]}"/><stop offset="1" stop-color="${headFill[1]}"/></linearGradient></defs>` +
      `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="3" fill="#0c0b0a" stroke="${border}" stroke-width="2"/>` +
      `<rect x="3" y="3" width="${W - 6}" height="${HEAD - 4}" fill="url(#${sid}hd)"/><line x1="3" x2="${W - 3}" y1="${HEAD - 1}" y2="${HEAD - 1}" stroke="${border}"/>` +
      `<text x="${W / 2}" y="${rare ? 32 : 42}" text-anchor="middle" font-size="${rare ? 19 : 21}" fill="${nameCol}">${esc(rare ? "Your " + base : base)}</text>${rare ? `<text x="${W / 2}" y="55" text-anchor="middle" font-size="16" fill="${nameCol}">${esc(base)}</text>` : ""}` + body + `</svg>`;
  }
  function renderItemCard() {
    const box = $("itemCard"); if (!box) return;
    if (!D.bases[$("base").value]) { box.innerHTML = ""; return; }
    box.innerHTML = itemCardSvg() + '<div class="row"><button id="saveItemCard" type="button">Save picture (PNG)</button></div>';
    $("saveItemCard").onclick = () => {
      const svg = $("itemCardSvg"), xml = new XMLSerializer().serializeToString(svg), img = new Image();
      img.onload = () => { const c = document.createElement("canvas"), k = 2, vb = svg.viewBox.baseVal; c.width = vb.width * k; c.height = vb.height * k; const x = c.getContext("2d"); x.scale(k, k); x.drawImage(img, 0, 0, vb.width, vb.height); const a = document.createElement("a"); a.download = "item.png"; a.href = c.toDataURL("image/png"); a.click(); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml.replace('width="100%"', `width="${svg.viewBox.baseVal.width}"`));
    };
  }

  // ---- comments: changes and things to fix (kept in this browser; on the published site the shared comment box also reaches Claude) ----
  (function feedback() {
    if (!$("fbAdd")) return;
    const KEY = "craftComments"; let list = [];
    try { list = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
    const ctx = () => {
      const g = groups(), t = st.targets.map((x) => (g[x.group] ? gLabel(g[x.group]) : x.group) + " (level " + x.minLevel + "+" + (x.fractured ? ", fractured" : "") + ")");
      return `${$("base").value}, item level ${$("ilvl").value}, ${$("rarity").value}. On the item: ${st.held.map((h) => h.text).join("; ") || "nothing"}. Wanted: ${t.join("; ") || "nothing"}.`;
    };
    function render() {
      $("fbList").innerHTML = list.length ? list.map((c, i) => `<div class="chip" style="display:block"><div class="dim">${esc(c.date)} · ${esc(c.kind)} <span class="x" data-fbdel="${i}" style="float:right;cursor:pointer;color:var(--bad)" title="Remove">&#10005;</span></div><div>${esc(c.text).replace(/\n/g, "<br>")}</div>${c.ctx ? `<div class="dim">${esc(c.ctx)}</div>` : ""}</div>`).join("") : '<span class="dim">No comments yet.</span>';
      $("fbList").querySelectorAll("[data-fbdel]").forEach((e) => (e.onclick = () => { list.splice(+e.dataset.fbdel, 1); save(); render(); }));
    }
    $("fbAdd").onclick = () => {
      const text = $("fbText").value.trim(); if (!text) { $("fbMsg").textContent = "Write something first."; return; }
      list.unshift({ date: new Date().toISOString().slice(0, 16).replace("T", " "), kind: $("fbKind").value, text, ctx: $("fbCtx").checked ? ctx() : "" });
      save(); $("fbText").value = ""; $("fbMsg").textContent = "Comment saved."; render();
    };
    $("fbCopy").onclick = async () => {
      const txt = list.map((c) => `[${c.date}] ${c.kind}: ${c.text}${c.ctx ? "\n   (" + c.ctx + ")" : ""}`).join("\n\n"); if (!txt) { $("fbMsg").textContent = "Nothing to copy."; return; }
      try { await navigator.clipboard.writeText(txt); $("fbMsg").textContent = "Copied."; } catch (e) { $("fbText").value = txt; $("fbText").select(); $("fbMsg").textContent = "Copy it from the box above."; }
    };
    // on the published page the viewer can leave a shared comment that Claude can read
    try { if (window.claude && window.claude.use) window.claude.use("comments").then((c) => { if (c && c.openComposer) { $("fbShared").hidden = false; $("fbShared").onclick = () => { try { c.openComposer({ element: $("feedback") }); } catch (e) { $("fbMsg").textContent = "The shared comment box could not open."; } }; } }).catch(() => {}); } catch (e) {}
    render();
  })();

  // ---- skill gem corruption (Belton, "I Made a MIRROR in ONE Day Crafting ONLY Gems", 0.5.5; outcome rules cross-checked with Maxroll's corruption page) ----
  // First corruption: four equal outcomes (nothing; +1 or -1 socket; quality raised or lowered; level +1 or -1). A quality raise reaches the 23% cap in about 80% of cases
  // (21 or 22% otherwise). The Crystallised Corruption then gives a second outcome that cannot repeat the first kind (here: the other of level and quality) or destroys the gem (50%).
  function renderGemCorruption() {
    const box = $("gemCorr"); if (!box) return;
    const keep = {}; box.querySelectorAll("input[data-gv]").forEach((e) => (keep[e.dataset.gv] = e.value));
    const dflt = { gem: 0.1, prep: 0.05, uncut: 6, p2123: 60 };                   // divine; example values from the video (October 2026): level 17 gems are cheap, a level 20 uncut gem was 6 divine, a 2123 gem sold for about 60
    const dv = rate("Divine Orb") || 1, toEx = (n) => n * dv, val = (k) => { const v = keep[k] !== undefined && keep[k] !== "" ? +keep[k] : dflt[k]; return isFinite(v) ? v : 0; };
    const vaal = rate("Vaal Orb"), cc = rate("Crystallised Corruption");
    const pLvl = 0.125, pQ23 = 0.125 * 0.8;                                         // per first corruption: +1 level 12.5%; quality raised 12.5% and 80% of those reach 23%
    const cost1 = toEx(val("gem") + val("prep")) + vaal, uncut = toEx(val("uncut"));
    const routes = [
      { name: "Keep both kinds (what the video does)", succ: pLvl * 0.25 * 0.8 + pQ23 * 0.25, cand: pLvl + pQ23, note: "send every +1 level gem and every 23% gem to the Crystallised Corruption" },
      { name: "Quality first, then level only", succ: pQ23 * 0.25, cand: pQ23, note: "keep only the 23% gems; the second corruption must raise the level (1 in 4)" },
      { name: "Level first, then quality only", succ: pLvl * 0.25 * 0.8, cand: pLvl, note: "keep only the +1 gems; the second corruption must raise the quality to 23% (1 in 5: it can land on 21 or 22%)" },
    ].map((r) => { const gems = 1 / r.succ, cors = gems * r.cand; return Object.assign(r, { gems, cors, cost: gems * cost1 + cors * cc + uncut }); });
    const money = (ex) => `${fx(ex)} ${ul()}`, inp = (k, label) => `<label class="dim">${label} <input type="number" step="any" min="0" data-gv="${k}" value="${keep[k] !== undefined ? keep[k] : dflt[k]}" style="width:80px"></label>`;
    box.innerHTML = `<p class="dim">Corrupt a level 17 gem that already has its sockets and 20% quality: each Vaal Orb gives one of four equal outcomes. The money is in a gem that ends up level +1 with 23% quality (a "2123" gem). Values below are in divine; the defaults are the video's example prices, so set today's.</p>
      <div class="row">${inp("gem", "Level 17 gem")}${inp("prep", "Sockets and quality per gem")}${inp("uncut", "Uncut gem to level it up")}${inp("p2123", "2123 gem sells for")}</div>
      <div class="corrgrid"><div><b>25%</b><div class="dim">nothing happens</div></div><div><b>12.5% / 12.5%</b><div class="dim">+1 / -1 socket</div></div><div><b>10% + 2.5%</b><div class="dim">quality up to 23%, or only 21 or 22%</div></div><div><b>12.5% / 12.5%</b><div class="dim">+1 / -1 level</div></div></div>
      <div class="tablewrap"><table><tr><th>Route</th><th>Gems per 2123 gem</th><th>Crystallised Corruptions</th><th>Cost per 2123 gem</th><th>Profit per 2123 gem</th></tr>${routes.map((r) => { const profit = toEx(val("p2123")) - r.cost; return `<tr><td>${esc(r.name)}<div class="dim">${esc(r.note)}</div></td><td>${fn(r.gems)}</td><td>${fn(r.cors)}</td><td>${money(r.cost)}</td><td class="${profit < 0 ? "warn" : ""}">${money(profit)}</td></tr>`; }).join("")}</table></div>
      <div class="dim">The cost of one Crystallised Corruption (${money(cc)}) is the biggest part, so using it on the 23% gems (1 in 4) rather than the +1 gems (1 in 5) saves about a fifth of them. It destroys the gem half the time. The cost per 2123 gem counts the gems, the Vaal Orbs, the Crystallised Corruptions and the uncut gem to level it up; the gems you do not send to the second corruption (for example +1 gems or 23% gems sold as they are, 21 or 22% results) are not counted as income. A corrupted gem can still be levelled to 20 afterwards and keeps the +1, so corrupt a cheap level 17 gem and level it with an uncut gem; gems that cannot be made from an uncut gem (for example Powered by Verisium) must be level 20 before they are corrupted. Sources: Belton (video, 0.5.5) for the routes and prices; Maxroll's corruption page for the outcome rules (the lower limit of the quality change differs between sources: -7% to +3% on Maxroll, up to 10% either way capped at 23% in other guides).</div>`;
    box.querySelectorAll("input[data-gv]").forEach((e) => (e.onchange = () => renderGemCorruption()));
  }
  (function gemUi() {
    const sec = $("corruption"); if (!sec || $("gemCorr")) return;
    const d = document.createElement("details"); d.className = "sect"; d.id = "gemSect";
    d.innerHTML = '<summary><h2>Skill gems: corruption and double corruption</h2></summary><div class="sectbody" id="gemCorr"></div>';
    sec.appendChild(d); d.addEventListener("toggle", () => { if (d.open) renderGemCorruption(); });
    document.addEventListener("pricesupdated", () => { if (d.open) renderGemCorruption(); });
    if ($("unitSel")) $("unitSel").addEventListener("change", () => setTimeout(() => { if (d.open) renderGemCorruption(); }, 0));
  })();
  function renderAlloys() {
    const AL = window.CRAFT_ALLOYS; if (!AL || !$("alloyTable")) return;
    const short = (c) => c.length > 4 ? c.slice(0, 3).join(", ") + " and " + (c.length - 3) + " more" : c.join(", ");
    const price = (n) => { const v = (prices[n] != null ? prices[n] : live[n]); return v != null ? fx(v) + " " + ul() : "no price listed"; };
    $("alloyTable").innerHTML = "<table><tr><th>Alloy</th><th>Item types</th><th>Adds</th><th>Slot</th><th>Level</th></tr>" + AL.map((al) => al.rows.map((r, i) =>
      `<tr><td>${i === 0 ? "<b>" + esc(al.name) + "</b><div class=\"dim\">" + esc(price(al.name)) + "</div>" : ""}</td><td>${esc(short(r.classes))}</td><td>${esc(r.mod)}</td><td>${r.side === "P" ? "Prefix" : "Suffix"}</td><td>${r.lv}</td></tr>`).join("")).join("") + "</table>";
  }
  renderAlloys();

  // ---- tidy view: long explanations show their first sentence; hold Alt (or press Details) to see all of it ----
  (function tidy() {
    const main = document.querySelector("main"); if (!main) return;
    const bar = document.createElement("div"); bar.className = "hintbar";
    bar.innerHTML = '<span>Short view. Hold <b>Alt</b> (or press Details) to show the full explanations. Hover a trailing "…" to read it too.</span><span><label for="unitSel">Show costs in</label> <select id="unitSel" aria-label="Currency for cost totals"><option value="ex">Exalted</option><option value="chaos">Chaos</option><option value="div">Divine</option></select> <button id="detailsToggle" type="button" aria-pressed="false">Details: off</button></span>';
    main.parentNode.insertBefore(bar, main);
    let pinned = false;
    const apply = (on) => document.body.classList.toggle("alt", on);
    $("unitSel").value = unitKey;
    $("unitSel").onchange = () => {
      unitKey = $("unitSel").value; try { localStorage.setItem("craftUnit", unitKey); } catch (x) {}
      renderPrices();
      try { renderCorruption(); renderVaal(); updateProfit(); if (typeof refreshActions === "function") refreshActions(); if (st.seq && st.seq.length && st.targets.length) calcSeq(); if (/Do this first|Done:/.test($("out").textContent)) runAdvice(); } catch (e) {}
    };
    $("detailsToggle").onclick = () => { pinned = !pinned; apply(pinned); $("detailsToggle").textContent = "Details: " + (pinned ? "on" : "off"); $("detailsToggle").setAttribute("aria-pressed", String(pinned)); };
    document.addEventListener("keydown", (e) => { if (e.key === "Alt") { e.preventDefault(); apply(true); } });
    document.addEventListener("keyup", (e) => { if (e.key === "Alt") { e.preventDefault(); if (!pinned) apply(false); } });
    window.addEventListener("blur", () => { if (!pinned) apply(false); });

    // 1. collapse the reference sections
    const COLLAPSE = /Alloys and quality|Assumptions|Corruption, Sacrifice|Plan your own crafting steps/;
    document.querySelectorAll("main section").forEach((sec) => {
      const h = sec.querySelector(":scope > h2"); if (!h || !COLLAPSE.test(h.textContent)) return;
      const d = document.createElement("details"); d.className = "sect"; const sm = document.createElement("summary"); const body = document.createElement("div"); body.className = "sectbody";
      sm.appendChild(h); [...sec.childNodes].forEach((n) => body.appendChild(n));
      d.append(sm, body); sec.replaceWith(d);
    });

    // 2. shorten long plain-text explanations to their first sentence
    const SEL = "section p.dim, section .dim, .note p, .note li, header small, .methodcard, .warn2";
    function firstCut(html) {
      const re = /([.!?])(\s+)(?=[A-Z])/g; let m;
      while ((m = re.exec(html))) {
        const head = html.slice(0, m.index + 1);
        if (head.length >= 45 && (head.match(/</g) || []).length === (head.match(/>/g) || []).length && !/<(?!\/?(b|i|em|code|a)\b)/i.test(head)) return m.index + 1;
      }
      return -1;
    }
    function shorten(root) {
      root.querySelectorAll(SEL).forEach((el) => {
        if (el.dataset.sh || el.closest("table, select, textarea, .methodcard") || el.querySelector("br, ul, ol, table, div, input, select, button")) return;
        el.dataset.sh = "1";
        const html = el.innerHTML; if (html.length < 150) return;
        const cut = firstCut(html); if (cut < 0 || html.length - cut < 40) return;
        el.title = el.textContent.trim().slice(0, 600);
        el.innerHTML = html.slice(0, cut) + '<span class="more">' + html.slice(cut) + '</span> <span class="moremark">&hellip;</span>';
      });
    }
    shorten(document);
    let timer = null;
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => shorten(document), 60); }).observe(main, { childList: true, subtree: true });
  })();

  $("cls").value = "Ring"; fillBases(); fillAugments(""); renderHeld(); renderTargets(); renderPrices(); renderSeq(); refreshActions(); renderCorruption(); renderVaal();

  // ---- clear buttons, and the working item survives a reload ----
  const WORK_KEY = "craftWork";
  function renderAll() { renderHeld(); renderTargets(); if (typeof refreshActions === "function") refreshActions(); renderSeq(); }
  $("clearPaste").onclick = () => { $("paste").value = ""; $("parseMsg").textContent = ""; };
  $("clearHeld").onclick = () => { st.held = []; renderHeld(); renderTargets(); };
  $("clearTargets").onclick = () => { st.targets = []; $("targetMsg").textContent = ""; renderTargets(); renderHeld(); };
  $("clearOut").onclick = () => { $("out").innerHTML = '<p class="dim">Fill in the item and targets, then press Advise me.</p>'; };
  $("clearAvoid").onclick = () => { delete picks[pickKey()]; savePicks(); renderPicker(); renderHeld(); };
  $("newItem").onclick = () => {
    if ((st.held.length || st.targets.length || $("paste").value.trim()) && !confirm("Clear the item, its mods, the targets and the advice?")) return;
    $("paste").value = ""; $("parseMsg").textContent = ""; $("targetMsg").textContent = "";
    st.held = []; st.targets = [];
    $("rarity").value = "Rare"; $("ilvl").value = 82; fillAugments("");
    ["sellEx", "sellChaos", "sellDiv"].forEach((id) => { $(id).value = ""; });
    if ($("marketOut")) $("marketOut").textContent = ""; if ($("profitLive")) $("profitLive").textContent = "";
    $("out").innerHTML = '<p class="dim">Fill in the item and targets, then press Advise me.</p>';
    renderAll(); try { localStorage.removeItem(WORK_KEY); } catch (e) {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const workState = () => JSON.stringify({ base: $("base").value, ilvl: $("ilvl").value, rarity: $("rarity").value, aug: $("augment").value, paste: $("paste").value, held: st.held, targets: st.targets, sell: $("sellEx").value });
  try {
    const w = JSON.parse(localStorage.getItem(WORK_KEY) || "null");
    if (w && w.base && D.bases[w.base]) {
      setBase(w.base); fillAugments(w.aug || ""); $("ilvl").value = w.ilvl; $("rarity").value = w.rarity; $("paste").value = w.paste || "";
      st.held = w.held || []; st.targets = (w.targets || []).filter((t) => t && t.group);
      if (w.sell) { $("sellEx").value = w.sell; syncSell("sellEx"); }
      renderAll();
      if (st.held.length || st.targets.length) $("saveNote").textContent = "Restored your last item";
    }
  } catch (e) {}
  let lastWork = workState();
  setInterval(() => {
    const now = workState(); if (now === lastWork) return; lastWork = now;
    try { localStorage.setItem(WORK_KEY, now); $("saveNote").textContent = "Saved"; } catch (e) {}
  }, 1000);
  window.__st = st;
  window.CrafterApp = { st, groups, augTags, ensureFresh, priceNote: () => priceNote, rate, fx, fn, ul, esc, pct, trkLog, trkRemove, itemCardSvg, bareG, defaultMin };
})();
