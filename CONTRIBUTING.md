# Contributing

Thanks for helping. Small, focused changes are easiest to review.

## Good ways to help
- **Check a rule.** If a simulator or the advisor does something that differs from the game, open an issue with what you did, what it showed, and what the game does. A screenshot or pasted item text helps.
- **Report a bug.** Say which tool, which page section, and what you pressed.
- **Improve a page.** Layout, wording, phone-width fixes and accessibility are all welcome.
- **Add data.** New bases, mods, orbs or price sources: say where the data comes from.

## How to propose a change
1. Fork the repository (or create a branch if you have write access).
2. Change one tool at a time (`advisor/`, `jewel/` or `tablet/`); each is standalone.
3. Start the tool with its `start.bat` and try your change in a browser. There is no automated test suite yet, so please say what you tried.
4. If you edit a script file (`.js`), bump its `?v=` number in the HTML page that loads it, or browsers keep the old copy.
5. Open a pull request describing what changed and how you checked it.

## Ground rules
- Rules and numbers need a source (poe2db, the game, a video or a post). Mark anything assumed as an assumption.
- Do not add logins, session cookies, tokens or personal data. The tools only use public data.
- Keep each tool runnable on its own, with Python 3 and no other installs.
- By opening a pull request you agree that your contribution is licensed under the GNU General Public License v3.0, like the rest of the repository.
