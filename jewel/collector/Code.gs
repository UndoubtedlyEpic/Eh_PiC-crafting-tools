/**
 * eH_PiC simulator: collection point (Google Apps Script web app, bound to a Google Sheet).
 *
 * What it receives: usage events from the simulator pages, sent ONLY after the player ticked the agreement box
 * ("I agree to have this information stored for probability and other uses in the future"). The page never sends
 * anything before that. Events hold simulator settings, target mods, results and orbs used: no names, accounts or emails.
 * A random code (made by the page, not an identity) tells one browser from another, so a withdrawal ("consent_withdrawn")
 * or a deletion request can be honoured by deleting that code's rows.
 *
 * POST  (Content-Type text/plain, JSON body)  {id, consent:true, events:[...]}   -> appends rows to the "events" sheet
 * GET   ?token=SECRET&from=ROW                                                     -> {events:[{received,id,type,data}], next:ROW}
 *
 * Setup: see jewel/collector/README.md.  Change TOKEN below to a long random string only you know.
 */
var TOKEN = "CHANGE-ME-TO-A-LONG-RANDOM-STRING";
var SHEET_NAME = "events";
var MAX_EVENTS_PER_POST = 500;
var MAX_BODY_CHARS = 400000;
var MAX_CELL_CHARS = 45000;                 // a sheet cell holds 50,000 characters
var MAX_POSTS_PER_ID_PER_HOUR = 120;        // stops one browser flooding the sheet
var PAGE_SIZE = 2000;
var ALLOWED_TYPES = ["consent", "consent_withdrawn", "action", "new_item", "sim_run", "craft_logged", "market_check"];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["received", "id", "type", "event"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  var ok = ContentService.createTextOutput("ok");
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > MAX_BODY_CHARS) return ok;
    var body = JSON.parse(e.postData.contents);
    if (!body || body.consent !== true || !body.events || !body.events.length) return ok;   // no agreement, no storage
    var id = String(body.id || "").slice(0, 40);
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return ok;

    var cache = CacheService.getScriptCache(), key = "rl:" + id, n = Number(cache.get(key) || 0);
    if (n >= MAX_POSTS_PER_ID_PER_HOUR) return ok;
    cache.put(key, String(n + 1), 3600);

    var now = new Date().toISOString(), rows = [];
    var events = body.events.slice(0, MAX_EVENTS_PER_POST);
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev || ALLOWED_TYPES.indexOf(ev.type) < 0) continue;
      var s = JSON.stringify(ev);
      if (s.length > MAX_CELL_CHARS) s = JSON.stringify({ type: ev.type, ts: ev.ts, truncated: true, base: ev.base });
      rows.push([now, id, ev.type, s]);
    }
    if (!rows.length) return ok;

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var sh = sheet_();
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
    } finally {
      lock.releaseLock();
    }
  } catch (err) { /* never reveal anything to the caller */ }
  return ok;
}

function doGet(e) {
  var out = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  var p = (e && e.parameter) || {};
  if (!p.token || p.token !== TOKEN || TOKEN.indexOf("CHANGE-ME") === 0) return out.setContent(JSON.stringify({ error: "forbidden" }));
  var sh = sheet_(), last = sh.getLastRow(), from = Math.max(2, parseInt(p.from, 10) || 2);
  if (last < from) return out.setContent(JSON.stringify({ events: [], next: from }));
  var n = Math.min(PAGE_SIZE, last - from + 1);
  var vals = sh.getRange(from, 1, n, 4).getValues(), events = [];
  for (var i = 0; i < vals.length; i++) events.push({ received: vals[i][0], id: vals[i][1], type: vals[i][2], data: vals[i][3] });
  return out.setContent(JSON.stringify({ events: events, next: from + n }));
}
