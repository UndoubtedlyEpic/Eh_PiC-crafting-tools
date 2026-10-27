// Precursor Tablet pricing guide: which affixes and combinations to look for (and keep or sell) on each tablet type, from trade-site listings (tablet_market.js,
// built by tablet_analyze.py from tablet_scan_<type>.json). Not a crafting tool: it only reads the market and checks a tablet you paste from the game.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MARKET = window.TABLET_MARKET || {};
  const TABLETS = ["Breach Tablet", "Expedition Tablet", "Delirium Tablet", "Ritual Tablet", "Irradiated Tablet", "Overseer Tablet", "Abyss Tablet", "Temple Tablet"];
  const short = (t) => t.replace(" Tablet", "");
  const fmt = (v) => (v == null || !isFinite(v) ? "n/a" : v < 10 ? (Math.round(v * 100) / 100).toString() : v < 100 ? (Math.round(v * 10) / 10).toString() : String(Math.round(v)));
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const OPT_KEY = "ehpic_tablet_guide_v1";

  // ---------------------------------------------------------------- matching a wording to a pool mod
  let POOLS = null, tablet = "Breach Tablet", POOL = [];
  const norm = (t) => String(t).replace(/\([\d.]+-[\d.]+\)/g, "#").replace(/[+-]?\d+(\.\d+)?/g, "#").replace(/#+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  // letters only, singular, "an additional" = "1 additional" ("X%" marks a number poe2db does not list): the same affix reads alike from the pool, the trade site and a pasted item
  const letters = (t) => String(t).replace(/\bX(?=%)/g, "").toLowerCase().replace(/\([\d.]+-[\d.]+\)/g, "").replace(/\ban(?= additional)/g, "").replace(/\ba\b/g, "").replace(/ies\b/g, "y").replace(/(x|ss)es\b/g, "$1").replace(/([a-z])s\b/g, "$1").replace(/[^a-z]+/g, "");
  function loadPool(t) {
    POOL = POOLS[t].normal.map((m) => ({ side: m.side, text: m.text, norm: norm(m.text), key: letters(m.text), parts: m.text.split(" / ").map(letters) }));
  }
  function findPool(marketText) {
    const n = norm(marketText), k = letters(marketText);
    return POOL.find((m) => m.norm === n) || POOL.find((m) => m.key === k) || POOL.find((m) => m.parts.length > 1 && m.parts.indexOf(k) >= 0) || null;
  }

  // ---------------------------------------------------------------- price bands
  const goodAt = () => Math.max(0.1, +$("goodAt").value || 2);       // "worth keeping" line, in divine
  const minN = () => Math.max(1, +$("minN").value || 5);              // listings needed before an affix is trusted
  const band = (d) => (d >= 10 ? ["high", "High"] : d >= goodAt() ? ["good", "Good"] : ["low", "Low"]);
  const badge = (d) => { const [c, t] = band(d); return `<span class="vb ${c}">${t}</span>`; };

  // ---------------------------------------------------------------- the guide for one tablet type
  function modsTable(m) {
    if (!m || !m.mods.length) return "<div class='dim'>No market data for this tablet type yet.</div>";
    let rows = m.mods.filter((x) => x.n >= minN()).sort((a, b) => b.median - a.median || b.lift - a.lift);
    if (!$("showLow").checked) rows = rows.filter((x) => x.median >= goodAt());
    const hasFloor = m.mods.some((x) => x.listed != null);
    if (!rows.length) return "<div class='dim'>Nothing on this tablet type reaches that price with that many listings. Lower the price line or the listings needed.</div>";
    return `<table><tr><th>Affix</th><th></th><th class="n">Sells around (div)</th><th></th><th class="n">Price effect</th><th class="n">Asking 10+ div</th><th class="n">Listings seen</th>${hasFloor ? '<th class="n">Competing now</th>' : ""}</tr>` +
      rows.map((x) => `<tr><td>${esc(x.sample)}</td><td class="dim">${x.side === "P" ? "prefix" : "suffix"}</td><td class="n"><b>${fmt(x.median)}</b></td><td>${badge(x.median)}</td><td class="n">x${Math.pow(10, x.lift).toFixed(1)}</td><td class="n">${Math.round(100 * x.share10)}%</td><td class="n">${x.n}</td>${hasFloor ? `<td class="n">${x.listed != null ? x.listed : ""}</td>` : ""}</tr>`).join("") + "</table>" +
      `<div class="hint">"Sells around" is the median asking price of scanned tablets that carry the affix. "Price effect" says how many times dearer a tablet gets when it has the affix (x2 = twice the price of one without it). "Asking 10+ div" is the share of those tablets listed at 10 divine or more.${hasFloor ? ' "Competing now" is how many tablets of this type with it were listed asking the median or more when the market was checked: many means a crowded market.' : ""}</div>`;
  }
  function combosTable(m) {
    if (!m || !m.combos.length) return "<div class='dim'>No market data for this tablet type yet.</div>";
    let rows = m.combos.filter((c) => c.n >= 3).slice();
    if (!$("showLow").checked) rows = rows.filter((c) => c.median >= goodAt());
    rows.sort((a, b) => (Number(b.consistent) - Number(a.consistent)) || b.median - a.median);
    rows = rows.slice(0, 20);
    if (!rows.length) return "<div class='dim'>No combination on this tablet type reaches that price with enough listings.</div>";
    return `<table><tr><th>Look for all of these together</th><th class="n">Sells around (div)</th><th></th><th class="n">Middle half</th><th class="n">Listings seen</th><th>Price</th></tr>` +
      rows.map((c) => `<tr><td>${c.sample.map(esc).join("<br>")}</td><td class="n"><b>${fmt(c.median)}</b></td><td>${badge(c.median)}</td><td class="n">${fmt(c.q1)} to ${fmt(c.q3)}</td><td class="n">${c.n}</td><td>${c.consistent ? "<span class='good'>steady</span>" : "<span class='dim'>varies a lot</span>"}</td></tr>`).join("") + "</table>" +
      `<div class="hint">A steady price means the listings agree with each other, so the number is a safer guide. "Varies a lot" combinations have a few very different asks: price those one by one on the trade site before listing.</div>`;
  }
  function renderGuide() {
    const m = MARKET[tablet];
    $("typeName").textContent = short(tablet);
    $("mktMods").innerHTML = modsTable(m);
    $("mktCombos").innerHTML = combosTable(m);
    $("mktCount").textContent = m ? m.listings + " listings scanned" : "no data";
    document.querySelectorAll("#typeTabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === tablet));
  }

  // ---------------------------------------------------------------- across every tablet type
  function renderAcross() {
    const rows = [];
    for (const t of TABLETS) { const m = MARKET[t]; if (!m) continue; for (const x of m.mods) if (x.n >= minN()) rows.push({ t, x }); }
    rows.sort((a, b) => b.x.median - a.x.median);
    const top = rows.slice(0, 15);
    $("mktAcross").innerHTML = top.length ? `<table><tr><th>Tablet</th><th>Affix</th><th class="n">Sells around (div)</th><th class="n">Price effect</th><th class="n">Listings</th></tr>` +
      top.map(({ t, x }) => `<tr><td><a href="#" data-go="${esc(t)}">${esc(short(t))}</a></td><td>${esc(x.sample)}</td><td class="n"><b>${fmt(x.median)}</b></td><td class="n">x${Math.pow(10, x.lift).toFixed(1)}</td><td class="n">${x.n}</td></tr>`).join("") + "</table>" : "<div class='dim'>No data yet.</div>";
    const cr = [];
    for (const t of TABLETS) { const m = MARKET[t]; if (!m) continue; for (const c of m.combos) if (c.consistent && c.n >= 3) cr.push({ t, c }); }
    cr.sort((a, b) => b.c.median - a.c.median);
    $("mktAcrossCombos").innerHTML = cr.length ? `<table><tr><th>Tablet</th><th>Combination</th><th class="n">Sells around (div)</th><th class="n">Middle half</th><th class="n">Listings</th></tr>` +
      cr.slice(0, 12).map(({ t, c }) => `<tr><td><a href="#" data-go="${esc(t)}">${esc(short(t))}</a></td><td>${c.sample.map(esc).join("<br>")}</td><td class="n"><b>${fmt(c.median)}</b></td><td class="n">${fmt(c.q1)} to ${fmt(c.q3)}</td><td class="n">${c.n}</td></tr>`).join("") + "</table>" : "<div class='dim'>No steady combinations yet.</div>";
    document.querySelectorAll("[data-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); setTablet(a.dataset.go); document.getElementById("guide").scrollIntoView({ behavior: "smooth" }); }));
  }

  // ---------------------------------------------------------------- check a tablet pasted from the game
  function parsePaste(raw) {
    const lines = String(raw).replace(/\r/g, "").replace(/[   ]/g, " ").split("\n").map((l) => l.trim()).filter((l) => l && !/^-{3,}$/.test(l));
    const out = { tablet: null, rarity: null, lines: [] };
    const head = lines.filter((l) => !/^(item class|rarity)/i.test(l)).slice(0, 3).join(" ");
    const t = /(Breach|Expedition|Delirium|Ritual|Irradiated|Overseer|Abyss|Temple)/i.exec(head); if (t) out.tablet = t[1][0].toUpperCase() + t[1].slice(1).toLowerCase() + " Tablet";
    for (const l of lines) {
      let m;
      if ((m = /^rarity:\s*(\w+)/i.exec(l))) { out.rarity = m[1].toLowerCase(); continue; }
      if (/uses? remaining/i.test(l)) continue;
      if (/^(item class|item level|requires|limited to|note|place|right click|can be used|use |adds |empowers)/i.test(l) || /^\{.*\}$/.test(l)) continue;
      if (/^[A-Z][\w' ]*(Tablet|Tablets)$/.test(l) || l.length < 12) continue;   // item names, not affixes
      out.lines.push(l.replace(/\s*\((fractured|crafted|desecrated)\)/gi, "").replace(/(\d)\((?:\d+(?:\.\d+)?)-(?:\d+(?:\.\d+)?)\)/g, "$1").trim());
    }
    return out;
  }
  function checkTablet(raw) {
    const p = parsePaste(raw), out = $("checkOut");
    if (!p.tablet || !POOLS[p.tablet]) { out.innerHTML = `<p class="bad">This does not look like a tablet I know (Breach, Expedition, Delirium, Ritual, Irradiated, Overseer, Abyss, Temple). Copy it in game with Ctrl+C while hovering it.</p>`; return; }
    if (p.rarity === "unique") { out.innerHTML = `<p class="dim">Unique tablets have fixed mods; price them on the trade site.</p>`; return; }
    if (tablet !== p.tablet) setTablet(p.tablet);
    const m = MARKET[tablet] || { mods: [], combos: [] };
    // a hybrid mod prints one line per stat: lines that together make a hybrid belong to it
    const keys = p.lines.map((l) => letters(l)), claimed = new Set(), held = [], unknown = [];
    for (const hm of POOL.filter((x) => x.parts.length > 1)) {
      const idx = hm.parts.map((k) => keys.findIndex((x, i) => x === k && !claimed.has(i)));
      if (idx.every((i) => i >= 0)) { idx.forEach((i) => claimed.add(i)); held.push({ pool: hm, line: idx.map((i) => p.lines[i]).join(" / ") }); }
    }
    p.lines.forEach((l, i) => { if (claimed.has(i)) return; const pm = findPool(l); if (pm) held.push({ pool: pm, line: l }); else if (/\d/.test(l) || /map|monster|tablet|additional/i.test(l)) unknown.push(l); });
    const have = new Set(held.map((h) => h.pool.norm));
    const marketOf = (pm) => m.mods.find((x) => { const q = findPool(x.text); return q && q.norm === pm.norm; });
    const rows = held.map((h) => { const x = marketOf(h.pool); return { h, x }; });
    const comboNorms = (c) => c.mods.map((k) => (findPool(k) || {}).norm);
    const full = m.combos.filter((c) => { const ns = comboNorms(c); return ns.every(Boolean) && ns.every((n) => have.has(n)); }).sort((a, b) => b.mods.length - a.mods.length || b.median - a.median);
    const best = full[0];
    const near = m.combos.filter((c) => { const ns = comboNorms(c); const miss = ns.filter((n) => !have.has(n)); return ns.every(Boolean) && miss.length === 1 && ns.length - 1 >= 1 && c.n >= 3 && c.median >= goodAt() && c.consistent; })
      .sort((a, b) => b.median - a.median).slice(0, 3);
    const topSingle = rows.filter((r) => r.x && r.x.n >= 3).sort((a, b) => b.x.median - a.x.median)[0];
    let verdict;
    if (!held.length) verdict = `<div class="verdict ok"><b>No affixes recognised.</b> Check that the whole item was copied (hover it in game and press Ctrl+C) and that it is a ${esc(short(tablet))} tablet.</div>`;
    else if (best && best.median >= goodAt()) verdict = `<div class="verdict good"><b>Worth listing.</b> ${best.n} scanned tablets with ${best.mods.length === held.length ? "this" : "these " + best.mods.length} affix${best.mods.length === 1 ? "" : "es"} ask about <b>${fmt(best.median)} div</b> (middle half ${fmt(best.q1)} to ${fmt(best.q3)}), ${best.consistent ? "a steady price" : "but the prices vary a lot, so check the trade site"}.</div>`;
    else if (topSingle && topSingle.x.median >= goodAt()) verdict = `<div class="verdict ok"><b>One good affix.</b> "${esc(topSingle.x.sample)}" tablets sell around <b>${fmt(topSingle.x.median)} div</b>, but no scanned listing has this exact mix, so the price of the whole tablet is unknown: search the trade site for it.</div>`;
    else verdict = `<div class="verdict low"><b>Low value.</b> No affix on it reaches ${fmt(goodAt())} div in the scan${best ? ` (the best matching combination asks about ${fmt(best.median)} div)` : ""}. Not worth the listing effort unless the trade site shows otherwise.</div>`;
    out.innerHTML = `<div class="dim">${esc(short(p.tablet))} tablet, ${esc(p.rarity || "rarity unknown")}, ${held.length} affix${held.length === 1 ? "" : "es"} recognised.</div>` + verdict +
      `<table><tr><th>Affix on the tablet</th><th></th><th class="n">Sells around (div)</th><th></th><th class="n">Price effect</th></tr>` +
      (rows.map(({ h, x }) => `<tr><td>${esc(h.line)}</td><td class="dim">${h.pool.side === "P" ? "prefix" : "suffix"}</td><td class="n">${x ? "<b>" + fmt(x.median) + "</b>" : "<span class='dim'>no data</span>"}</td><td>${x ? badge(x.median) : ""}</td><td class="n">${x ? "x" + Math.pow(10, x.lift).toFixed(1) : ""}</td></tr>`).join("") || `<tr><td colspan="5" class="dim">No affixes recognised.</td></tr>`) + "</table>" +
      (near.length ? `<h3>One affix away from a valuable combination</h3><table><tr><th>You would also need</th><th>With</th><th class="n">Sells around (div)</th></tr>` + near.map((c) => { const ns = comboNorms(c); const missI = ns.findIndex((n) => !have.has(n)); return `<tr><td>${esc(c.sample[missI])}</td><td>${c.sample.filter((_, i) => i !== missI).map(esc).join("<br>")}</td><td class="n"><b>${fmt(c.median)}</b></td></tr>`; }).join("") + "</table>" : "") +
      (unknown.length ? `<div class="hint bad">Not recognised for a ${esc(short(tablet))} tablet, ignored: ${unknown.map(esc).join(" | ")}</div>` : "");
  }

  // ---------------------------------------------------------------- start
  function saveOpts() { lsSet(OPT_KEY, { tablet, goodAt: $("goodAt").value, minN: $("minN").value, showLow: $("showLow").checked }); }
  function setTablet(t) { tablet = t; loadPool(t); renderGuide(); saveOpts(); }
  async function init() {
    try { POOLS = (await (await fetch("tablet_pools.json?v=1")).json()).pools; } catch (e) {
      const le = $("loadError"); le.hidden = false; le.textContent = "The tablet data could not be loaded. Open this page from the hub (start.bat), not from the file: http://127.0.0.1:8765/tablet_sim.html";
      return;
    }
    $("typeTabs").innerHTML = TABLETS.map((t) => `<button type="button" data-t="${esc(t)}">${esc(short(t))}</button>`).join("");
    document.querySelectorAll("#typeTabs button").forEach((b) => (b.onclick = () => setTablet(b.dataset.t)));
    const o = lsGet(OPT_KEY);
    if (o) { if (o.goodAt) $("goodAt").value = o.goodAt; if (o.minN) $("minN").value = o.minN; $("showLow").checked = !!o.showLow; if (o.tablet && POOLS[o.tablet]) tablet = o.tablet; }
    ["goodAt", "minN", "showLow"].forEach((id) => ($(id).onchange = () => { renderGuide(); renderAcross(); saveOpts(); }));
    $("pasteLoad").onclick = () => { if ($("pasteText").value.trim()) checkTablet($("pasteText").value); };
    $("pasteClear").onclick = () => { $("pasteText").value = ""; $("checkOut").innerHTML = ""; $("pasteMsg").textContent = ""; };
    $("pasteClip").onclick = async () => { try { const t = await navigator.clipboard.readText(); $("pasteText").value = t; checkTablet(t); } catch (e) { $("pasteMsg").textContent = "The browser did not allow reading the clipboard. Click in the box, press Ctrl+V, then press Check."; } };
    document.addEventListener("paste", (e) => { const el = e.target; if (el && /^(input|textarea|select)$/i.test(el.tagName)) return; const t = (e.clipboardData && e.clipboardData.getData("text")) || ""; if (!/rarity:|item class:/i.test(t)) return; $("pasteText").value = t; checkTablet(t); document.getElementById("check").scrollIntoView({ behavior: "smooth" }); e.preventDefault(); });
    loadPool(tablet); renderGuide(); renderAcross();
    window.TabletGuide = { findPool, parsePaste, checkTablet, setTablet };
  }
  init();
})();
