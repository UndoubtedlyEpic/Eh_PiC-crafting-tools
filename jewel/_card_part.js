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
