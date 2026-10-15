# Chrome Web Store listing

Text and answers to paste into the Chrome Web Store developer dashboard.

## Package

Upload a ZIP with just the extension files, built from the committed code
(run from the repository root):

```bash
git archive --format=zip -o board-tweaks-for-jira.zip HEAD manifest.json settings.js content.js toolbar.js content.css popup.html popup.css popup.js icons
```

(Don't use Windows PowerShell's `Compress-Archive`: it writes `icons\…` paths
with backslashes, which the store doesn't read as folders.)

Bump `version` in `manifest.json` before every upload; the store rejects a
version it has already seen.

## Store listing tab

**Name** (from the manifest): Board Tweaks for Jira

**Summary** (from the manifest description, max 132 characters):
Shows Jira board quick filters as one-click toggle buttons, and makes the board toolbar and search more compact.

**Description:**

```
Filter your Jira Cloud board in one click.

Board Tweaks for Jira turns the board's "Custom filters" dropdown into a row of toggle buttons right in the toolbar, so switching filters no longer takes three clicks.

FEATURES
• Quick filters as buttons – every filter from the board's Custom filters dropdown becomes a button you can toggle with one click. Selected filters are highlighted and stay in sync with Jira, whichever way you change them.
• Separators – name a quick filter "|" or "—" and it's drawn as a divider, so you can group related filters.
• One line or wrapped – keep the buttons on one line and scroll sideways (the mouse wheel works), or let them wrap.
• Compact search – "Search board" shrinks to an icon until you click it.
• Compact toolbar – the board's icon buttons (Sprint details, View settings, …) move into the ••• menu.
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

**Additional fields:**
- Homepage URL: https://github.com/metalurgus/board-tweaks-for-jira
- Support URL: https://github.com/metalurgus/board-tweaks-for-jira/issues

## Privacy practices tab

**Single purpose:**
Improves the Jira Cloud board page: shows the board's quick filters as toggle buttons and makes the board toolbar and search more compact.

**Permission justification – `storage`:**
Saves the user's settings from the popup (which tweaks are on, button text size).

**Permission justification – host permission `https://*.atlassian.net/*`:**
The extension modifies Jira Cloud board pages, which are served from *.atlassian.net, and reads the board's quick filter list from Jira's own API on the same site.

**Remote code:** No, I am not using remote code.

**Data usage:** tick none of the data types (the extension collects no user data), then certify the three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/metalurgus/board-tweaks-for-jira/blob/main/PRIVACY.md
