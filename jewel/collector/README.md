# Collection point for the simulator's usage data

Everything people do in the simulator is sent here **only after they tick the agreement box**. The page says so in the notice ("It is also sent to the simulator's author").
Nothing identifies a person: the events hold settings, target mods, results and orbs used, plus a random code made by the browser.

How it fits together:

```
simulator page --(after the box is ticked)--> Google Apps Script web app --> your Google Sheet ("events")
                                                                                   ^
              python craftlog.py pull  (daily, or when you like)  -----------------+   -> craftlog/collected.jsonl
```

## One-time setup (about 5 minutes, your Google account, no cost)

1. Make a new Google Sheet (name it anything, e.g. "eHPiC simulator data").
2. In the sheet: **Extensions > Apps Script**. Delete the sample code, paste the whole of `jewel/collector/Code.gs`.
3. Change `TOKEN` (top of the script) to a long random string only you know. Save.
4. **Deploy > New deployment > type: Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and approve the permissions. Copy the **Web app URL** (ends in `/exec`).
5. Put the URL in the page: edit `jewel/collect_config.js` and set `window.EHPIC_COLLECT_URL = "https://script.google.com/macros/s/.../exec";`
6. Put the URL and the token where the pull script reads them: create `jewel/craftlog/collector.json` (it is git-ignored):

   ```json
   {"url": "https://script.google.com/macros/s/.../exec", "token": "the same long random string", "cursor": 2}
   ```
7. Rebuild the shared copy (`python jewel/tools/build_share.py`) so it carries the address.

## Reading the data

```
python jewel/craftlog.py pull          # downloads everything new into craftlog/collected.jsonl and moves the cursor
python jewel/craftlog.py usage-report  # summary of your own runs plus the collected ones
```

Daily pull: a Windows scheduled task or a Claude scheduled task can run the `pull` command once a day.

## Rules this keeps

- No agreement, no data: the page sends nothing before the box is ticked, and this script ignores any post that does not say `consent: true`.
- Withdrawal: "Withdraw consent" stops the page sending and posts one `consent_withdrawn` event with the browser's random code, so you can delete that code's rows (Sheet > filter by `id`).
- The read side needs the token; the write side accepts anything well-formed, limited to 500 events per post, 120 posts per code per hour, and a fixed list of event types.
- The sheet is private to your Google account. Do not publish the sheet or the token.
