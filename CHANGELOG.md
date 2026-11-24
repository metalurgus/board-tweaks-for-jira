# Changelog

## 1.4.0

### New

- **Saved filter sets.** A bookmark button next to the filters saves the
  filters you have on as a named set and turns them all back on in one click.
  Sets are kept per board, synced through your Chrome profile. The same menu
  clears all filters.
- **Number keys** (off by default). <kbd>1</kbd>–<kbd>9</kbd> toggle the
  board's first nine filters and <kbd>0</kbd> clears them all. Ignored while
  you type in a field or have a dialog open.
- **Compact cards** (off by default). Less padding, titles up to two lines and
  smaller avatars: cards get 25–30% shorter, so more fit on screen.
- **Column width.** Give every column an exact width: narrower so more columns
  fit without scrolling sideways (Jira never goes below 200px), or wider for
  long titles. *Auto* keeps Jira's own sizing.
- **Card colours** (off by default). Tints the whole card with its card colour,
  not just the thin stripe on the left.
- **Works with Jira's own filter buttons.** Jira can show a board's filters as
  a line of its own buttons instead of the *Custom filters* dropdown (*View
  settings → Show custom filters individually*). The extension now keeps that
  line on one row that scrolls sideways, draws `|` filters as dividers and
  applies the text size to it.

### Fixed

- On boards showing Jira's line of filter buttons, the *Group* button was
  mistaken for the *Custom filters* dropdown: with *Show filters as buttons*
  on, it was hidden and a second row of filters appeared.
- *Move toolbar icons into ••• menu* didn't work on boards showing Jira's line
  of filter buttons.
- With the filters on one line, Jira's filter controls no longer take space
  the filters need.

### Changed

- *Show filters as buttons* is greyed out on boards where Jira already shows
  its own buttons.

## 1.3.0 (October 15, 2026)

First public release on the Chrome Web Store.

- The board's *Custom filters* dropdown shown as one-click toggle buttons,
  in sync with Jira.
- Filters on one line with sideways scrolling, `|` filters as dividers,
  adjustable text size.
- Compact search: *Search board* shrinks to an icon until clicked.
- Compact toolbar: the board's icon buttons move into the ••• menu.
- Works with any Jira language.
