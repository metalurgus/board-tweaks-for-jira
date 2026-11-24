# Chrome Web Store listing

Text and answers to paste into the Chrome Web Store developer dashboard.

## Package

Upload a ZIP with just the extension files, built from the committed code
(run from the repository root):

```bash
git archive --format=zip -o board-tweaks-for-jira.zip HEAD manifest.json settings.js popover.js content.js presets.js shortcuts.js toolbar.js board.js content.css popup.html popup.css popup.js icons
```

(Don't use Windows PowerShell's `Compress-Archive`: it writes `icons\…` paths
with backslashes, which the store doesn't read as folders.)

Bump `version` in `manifest.json` before every upload; the store rejects a
version it has already seen. Check the list above against `content_scripts`
in `manifest.json` whenever a script is added.

## Store listing tab

**Name** (from the manifest): Board Tweaks for Jira

**Summary** (from the manifest description, max 132 characters):
Keeps Jira board filters on one line, adds saved filter sets, and makes the toolbar, search and cards more compact.

**Description:**

```
Filter your Jira Cloud board in one click, and fit more of the board on screen.

Jira's board filters either hide in a "Custom filters" dropdown or, on boards with many filters, spill over several rows of buttons that push the board down. Board Tweaks for Jira puts them on one line in the toolbar that scrolls sideways, and gives the rest of the screen back to your cards.

FEATURES
• One line of filters – the board's filters sit in the toolbar on a single line and scroll sideways (the mouse wheel works), instead of wrapping over several rows. Or let them wrap, if you prefer.
• Quick filters as buttons – when Jira shows them in its Custom filters dropdown, every filter becomes a button you can toggle with one click. Selected filters are highlighted and stay in sync with Jira, whichever way you change them. When Jira shows its own line of filter buttons ("Show custom filters individually" in View settings), the extension works with those instead.
• Saved filter sets – save a combination of filters ("Android + QA") and apply it in one click, per board.
• Number keys – optionally, 1–9 toggle the first nine filters and 0 clears them all.
• Separators – name a quick filter "|" or "—" and it's drawn as a divider, so you can group related filters.
• Compact search – "Search board" shrinks to an icon until you click it.
• Compact toolbar – the board's icon buttons (Sprint details, View settings, …) move into the ••• menu.
• Compact cards – less padding, titles up to two lines and smaller avatars, so about a third more cards fit on screen.
• Column width – set an exact column width: narrower so more fit without scrolling sideways, or wider for long titles. "Auto" keeps Jira's own sizing.
• Card colours – tint the whole card with its card colour, not just the thin stripe.
• Adjustable button text size.

Everything can be switched on and off from the extension's popup, and it works with any Jira language.

REQUIREMENTS
Jira Cloud (*.atlassian.net). Quick filters are set up per board in Board settings → Custom filters on company-managed boards; team-managed boards don't have them, so there only the toolbar and search tweaks apply.

PRIVACY
The extension runs only on Jira Cloud pages, collects no data and sends nothing anywhere. It's open source: https://github.com/metalurgus/board-tweaks-for-jira

Not affiliated with or endorsed by Atlassian. Jira is a trademark of Atlassian.
```

**Category:** Workflow & Planning (or Productivity → Tools)

**Language:** English

**Graphic assets:**
- Store icon: `icons/icon128.png`
- Screenshots (1280×800): `store/screenshot-1.png`, `store/screenshot-2.png`
- Small promo tile (440×280): `store/promo-small-440x280.png`
- Marquee promo tile (1400×560, optional): `store/marquee-1400x560.png`

**Additional fields:**
- Homepage URL: https://github.com/metalurgus/board-tweaks-for-jira
- Support URL: https://github.com/metalurgus/board-tweaks-for-jira/issues

## Privacy practices tab

**Single purpose:**
Improves the Jira Cloud board page: makes the board's quick filters quicker to use (one line, toggle buttons, saved sets) and makes the toolbar, search and cards more compact.

**Permission justification – `storage`:**
Saves the user's settings from the popup (which tweaks are on, sizes) and the filter sets they save for each board.

**Permission justification – host permission `https://*.atlassian.net/*`:**
The extension modifies Jira Cloud board pages, which are served from *.atlassian.net, and reads the board's quick filter list from Jira's own API on the same site.

**Remote code:** No, I am not using remote code.

**Data usage:** tick none of the data types (the extension collects no user data), then certify the three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/metalurgus/board-tweaks-for-jira/blob/main/PRIVACY.md
