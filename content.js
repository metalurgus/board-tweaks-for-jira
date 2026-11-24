// Renders a board's quick filters (Jira's "Custom filters" dropdown) as a row
// of toggle chips.
//
// Jira is rolling back to a line of its own filter buttons, and not everyone
// has it yet, so each page is checked for which one it shows. On the line we
// don't add chips: we restyle Jira's buttons (text size, "|" separators) and,
// in single-row mode, fit the line into the toolbar row with sideways
// scrolling.
//
// The filters come from Jira's REST API and their on/off state from the URL,
// which carries the selected filters' JQL. Jira keeps the filter state inside
// its own React components though, so the chips don't apply filters
// themselves: each click opens the original dropdown (hidden via CSS while we
// work), clicks the matching option and closes the dropdown again.
//
// Nothing is matched by its label, which Jira translates: the dropdown's
// button is found by its position after the "Filter" button.
(() => {
  'use strict';

  const FILTER_BUTTON_SELECTOR = '[data-testid="filter-refinement.ui.filter-popup.button"]';
  const SEARCH_FIELD_SELECTOR = '[data-testid="filter-refinement.ui.search-field-container"]';
  // The dropdown is a menu holding a multi-select list of the filters.
  const MENU_SELECTOR = '[role="menu"]:has([role="listbox"][aria-multiselectable="true"])';
  const BUSY_CLASS = 'jcf-busy';
  const LOG_PREFIX = '[jira-custom-filters]';
  const FILL_CLASS = 'jcf-fill-toolbar'; // on Jira's filter area in single-row mode
  // Jira's own filter line is tagged with data attributes rather than classes:
  // React rewrites className whenever it re-renders an element.
  const LINE_ATTR = 'data-jcf-line'; // the line of filter buttons
  const ROW_ATTR = 'data-jcf-row'; // the toolbar row holding it
  const HEAD_ATTR = 'data-jcf-head'; // the filter controls ahead of the line
  const TAIL_ATTR = 'data-jcf-tail'; // toolbar items that go after the line
  const SEP_ATTR = 'data-jcf-sep'; // a "|" filter's item in the line
  const SINGLE_ATTR = 'data-jcf-single'; // on line and row in single-row mode
  const MAX_LINE_DEPTH = 3; // levels from a filter button up to the line
  // Jira lazy-loads the dropdown's code on first open, which can take a few
  // seconds while the rest of the board is still booting.
  const MENU_OPEN_TIMEOUT = 8000;
  const CLICK_RETRY_MS = 400;

  let filters = []; // [{ name, jql, selected }] in dropdown order
  let filtersBoard = null; // id of the board the filters above belong to
  let settings = null; // from the popup, see settings.js
  let anchor = null; // Jira's wrapper around the "Custom filters" button
  let bar = null;
  let line = null; // Jira's own line of filter buttons, when the board has one
  let queue = Promise.resolve();
  let lastSeenUrl = location.href;

  // --- DOM lookups ---------------------------------------------------------

  // Jira's filter line: toggle buttons named after the board's quick filters
  // (names the board's admins chose, so this doesn't depend on Jira's
  // language). Each button sits in an item of its own inside the line.
  function findLine() {
    const names = new Set(filters.map((f) => f.name));
    if (!names.size) return null;
    const button = [...document.querySelectorAll('button[aria-pressed]')].find(
      (b) => !b.closest('.jcf-bar') && names.has(b.textContent.trim())
    );
    if (!button) return null;
    let el = button.parentElement;
    for (let depth = 0; el && depth < MAX_LINE_DEPTH; depth++, el = el.parentElement) {
      const items = [...el.children].filter((c) => c.querySelector('button[aria-pressed]'));
      if (items.length > 1) return el;
    }
    // A board with a single filter: assume Jira's usual line > item > button.
    return button.parentElement?.parentElement ?? null;
  }

  // Which UI this page shows: 'line', 'dropdown', or null (not known, or a
  // board without quick filters).
  const detectUi = () => (findLine() ? 'line' : findTrigger() ? 'dropdown' : null);

  // The dropdown's button is the first popup button after Jira's "Filter"
  // button (the assignee avatars before it are a fieldset). That only holds on
  // a board with quick filters: without them the next one is "Group".
  const findTrigger = () => {
    // On the filter line's UI the next popup button is "Group".
    if (!filters.length || line?.isConnected || findLine()) return null;
    const start =
      document.querySelector(FILTER_BUTTON_SELECTOR) || document.querySelector(SEARCH_FIELD_SELECTOR);
    if (!start) return null;
    return (
      [...document.querySelectorAll('button[aria-haspopup="true"]')].find(
        (b) =>
          start.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING &&
          !b.closest('fieldset, [data-testid^="filter-refinement."]')
      ) || null
    );
  };

  const findMenu = () => {
    const id = findTrigger()?.getAttribute('aria-controls');
    return (id && document.getElementById(id)) || document.querySelector(MENU_SELECTOR);
  };

  const optionsOf = (menu) => [...menu.querySelectorAll('[role="option"]')];

  const optionName = (option) => option.textContent.trim();

  // Prefer the option at the same position (names like "|" repeat), but fall
  // back to a name match in case the list changed under us.
  const findOption = (menu, index, name) => {
    const options = optionsOf(menu);
    if (options[index] && optionName(options[index]) === name) return options[index];
    return options.find((o) => optionName(o) === name) || null;
  };

  const isSeparator = (name) => /^[|\-–—\s]*$/.test(name);

  // --- helpers -------------------------------------------------------------

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(fn, timeout = 3000) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const result = fn();
      if (result) return result;
      if (Date.now() > deadline) return null;
      await delay(30);
    }
  }

  function enqueue(task) {
    queue = queue.then(task).catch((err) => console.warn(LOG_PREFIX, err));
    return queue;
  }

  // --- the board's quick filters ---------------------------------------------

  const boardId = () => location.pathname.match(/\/boards\/(\d+)/)?.[1] ?? null;

  async function fetchQuickFilters(board) {
    const found = [];
    for (let startAt = 0; ; ) {
      const res = await fetch(`/rest/agile/1.0/board/${board}/quickfilter?startAt=${startAt}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Quick filters request failed (${res.status})`);
      const page = await res.json();
      found.push(...page.values);
      if (page.isLast || !page.values.length) break;
      startAt += page.values.length;
    }
    return found
      .sort((a, b) => a.position - b.position)
      .map(({ name, jql }) => ({ name, jql, selected: false }));
  }

  // Jira puts the selected filters' JQL in the URL, each in parentheses and
  // joined with AND: ?filter=(type = Bug) AND (type = Story)
  function readSelection() {
    const query = new URLSearchParams(location.search).get('filter') || '';
    for (const filter of filters) filter.selected = hasClause(query, `(${filter.jql})`);
  }

  function hasClause(query, clause) {
    for (let i = query.indexOf(clause); i !== -1; i = query.indexOf(clause, i + 1)) {
      const end = i + clause.length;
      const startsClause = i === 0 || query.startsWith(' AND ', i - 5);
      const endsClause = end === query.length || query.startsWith(' AND ', end);
      if (startsClause && endsClause) return true;
    }
    return false;
  }

  // Loads a new board's filters, then reads which are on from the URL.
  function sync() {
    return enqueue(async () => {
      const board = boardId();
      if (board !== filtersBoard) {
        filters = [];
        filtersBoard = null;
        mount();
        if (board) {
          filters = await fetchQuickFilters(board);
          filtersBoard = board;
        }
      }
      readSelection();
      mount();
      render();
    });
  }

  // --- talking to the real dropdown ---------------------------------------

  async function closeMenu() {
    const trigger = findTrigger();
    if (findMenu() && trigger?.getAttribute('aria-expanded') === 'true') trigger.click();
    const closed = await waitFor(() => !findMenu(), 500);
    if (!closed) {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })
      );
      await waitFor(() => !findMenu(), 500);
    }
  }

  // Clicks the trigger until the dropdown is open with its options. While the
  // board is still starting up, Jira can drop a click on the button (it's in
  // the page before it's interactive), so re-click every CLICK_RETRY_MS rather
  // than waiting out the whole timeout on a click that never registered.
  async function openMenu() {
    const deadline = Date.now() + MENU_OPEN_TIMEOUT;
    let lastClick = 0;
    let clicks = 0;
    for (;;) {
      const menu = findMenu();
      if (menu?.querySelector('[role="option"]')) return { menu, clicks };
      if (Date.now() > deadline) return { menu: null, clicks };
      const trigger = findTrigger();
      if (trigger?.getAttribute('aria-expanded') !== 'true' && Date.now() - lastClick > CLICK_RETRY_MS) {
        trigger?.click();
        lastClick = Date.now();
        clicks += 1;
      }
      await delay(30);
    }
  }

  // Opens the dropdown invisibly, runs fn(menu), then closes it again.
  async function withMenu(fn) {
    if (!findTrigger()) throw new Error('Custom filters button not found');

    const prevFocus = document.activeElement;
    const started = performance.now();
    document.documentElement.classList.add(BUSY_CLASS);
    try {
      const { menu, clicks } = await openMenu();
      if (!menu) throw new Error(`Custom filters menu did not open (${clicks} clicks)`);
      console.debug(LOG_PREFIX, `menu open after ${Math.round(performance.now() - started)} ms, ${clicks} click(s)`);
      return await fn(menu);
    } finally {
      await closeMenu();
      if (prevFocus && prevFocus !== document.body && prevFocus.isConnected) {
        prevFocus.focus({ preventScroll: true });
      } else {
        document.activeElement?.blur();
      }
      document.documentElement.classList.remove(BUSY_CLASS);
    }
  }

  function toggle(index) {
    const { name } = filters[index];
    bar?.children[index]?.classList.add('jcf-pending');

    return enqueue(async () => {
      const before = location.href;
      try {
        await withMenu(async (menu) => {
          const option = findOption(menu, index, name);
          if (!option) {
            // The board's filters changed since we loaded them.
            filtersBoard = null;
            sync();
            throw new Error(`Filter "${name}" not found in menu`);
          }
          option.click();
          // The chips read their state back from the URL.
          await waitFor(() => location.href !== before, 2000);
        });
      } finally {
        readSelection();
        render();
      }
    });
  }

  // --- our chip bar ----------------------------------------------------------

  function render() {
    if (!bar) return;
    bar.replaceChildren(
      ...filters.map((filter, index) => {
        if (isSeparator(filter.name)) {
          const sep = document.createElement('span');
          sep.className = 'jcf-sep';
          sep.setAttribute('aria-hidden', 'true');
          return sep;
        }
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'jcf-chip';
        chip.textContent = filter.name;
        chip.setAttribute('aria-pressed', String(filter.selected));
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Defer so this click finishes bubbling before the dropdown opens;
          // otherwise its outside-click handler can close it straight away.
          setTimeout(() => toggle(index));
        });
        return chip;
      })
    );
    updateScrollFades(bar);
  }

  // --- single-row mode: horizontal scrolling ----------------------------------

  // Fades the edges that have more chips beyond them (CSS keys off data-jcf-fade).
  function updateScrollFades(el) {
    if (!el) return;
    const single = settings?.singleRow;
    const max = el.scrollWidth - el.clientWidth;
    const fades = [];
    if (single && el.scrollLeft > 1) fades.push('left');
    if (single && el.scrollLeft < max - 1) fades.push('right');
    if (fades.length) el.setAttribute('data-jcf-fade', fades.join(' '));
    else el.removeAttribute('data-jcf-fade');
  }

  // Lets a plain mouse wheel scroll the row sideways.
  function onRowWheel(e) {
    const el = e.currentTarget;
    if (!settings.singleRow || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  const onRowScroll = (e) => updateScrollFades(e.currentTarget);
  const fadeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) updateScrollFades(entry.target);
  });

  // --- Jira's own filter line -----------------------------------------------------

  // Tags the line, its row and its "|" items for content.css, and follows the
  // settings. Called again on every DOM change, so it re-tags whatever React
  // re-rendered.
  function applyLine(next) {
    if (line !== next) {
      releaseLine();
      line = next;
      line.setAttribute(LINE_ATTR, '');
      line.addEventListener('wheel', onRowWheel, { passive: false });
      line.addEventListener('scroll', onRowScroll, { passive: true });
      fadeObserver.observe(line);
    }
    const row = line.parentElement;
    const single = settings.singleRow;
    line.toggleAttribute(SINGLE_ATTR, single);
    line.style.setProperty('--jcf-font-size', `${settings.fontSize}px`);
    if (row) {
      row.setAttribute(ROW_ATTR, '');
      row.toggleAttribute(SINGLE_ATTR, single);
      // The filter controls (search first) stay ahead of the line; the rest
      // (sprint picker, icons, •••) go after it.
      for (const child of row.children) {
        const head = !!child.querySelector(SEARCH_FIELD_SELECTOR);
        child.toggleAttribute(HEAD_ATTR, head);
        child.toggleAttribute(TAIL_ATTR, child !== line && !head);
      }
    }
    for (const item of line.children) {
      const button = item.querySelector('button');
      const sep = !!button && isSeparator(button.textContent.trim());
      if (item.hasAttribute(SEP_ATTR) === sep) continue;
      item.toggleAttribute(SEP_ATTR, sep);
      // A separator is only a divider: no focus, nothing for screen readers.
      if (sep) {
        item.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
      } else {
        item.removeAttribute('aria-hidden');
        button?.removeAttribute('tabindex');
      }
    }
    updateScrollFades(line);
  }

  function releaseLine() {
    if (!line) return;
    line.removeEventListener('wheel', onRowWheel);
    line.removeEventListener('scroll', onRowScroll);
    fadeObserver.unobserve(line);
    const row = line.parentElement;
    for (const el of [line, row, ...(row?.children ?? []), ...line.children]) {
      if (!el) continue;
      for (const attr of [LINE_ATTR, ROW_ATTR, HEAD_ATTR, TAIL_ATTR, SINGLE_ATTR, 'data-jcf-fade']) el.removeAttribute(attr);
      if (el.hasAttribute(SEP_ATTR)) {
        el.removeAttribute(SEP_ATTR);
        el.removeAttribute('aria-hidden');
        el.querySelector('button')?.removeAttribute('tabindex');
      }
    }
    line.style.removeProperty('--jcf-font-size');
    line = null;
  }

  // --- settings from the popup ------------------------------------------------

  function applySettings() {
    if (line?.isConnected) applyLine(line);
    if (!anchor || !bar) return;
    anchor.classList.toggle('jcf-hidden-trigger', settings.expanded);
    bar.hidden = !settings.expanded;
    bar.style.setProperty('--jcf-font-size', `${settings.fontSize}px`);
    bar.classList.toggle('jcf-single-row', settings.singleRow);
    bar.parentElement?.classList.toggle(FILL_CLASS, settings.singleRow && settings.expanded);
    updateScrollFades(bar);
  }

  // On Jira's filter line, restyles that. Otherwise puts the bar next to the
  // dropdown's button, or takes it out of the page (giving Jira its button
  // back) on a board without quick filters.
  function mount() {
    const nextLine = findLine();
    if (nextLine) {
      unmount();
      applyLine(nextLine);
      return;
    }
    releaseLine();
    const trigger = findTrigger();
    if (!trigger) {
      unmount();
      return;
    }
    const wrapper = trigger.parentElement;
    if (bar?.isConnected && bar.previousElementSibling === wrapper) return;

    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'jcf-bar';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Custom filters');
      bar.addEventListener('wheel', onRowWheel, { passive: false });
      bar.addEventListener('scroll', onRowScroll, { passive: true });
      fadeObserver.observe(bar);
    }
    if (anchor && anchor !== wrapper) anchor.classList.remove('jcf-hidden-trigger');
    if (bar.parentElement && bar.parentElement !== wrapper.parentElement) {
      bar.parentElement.classList.remove(FILL_CLASS);
    }
    anchor = wrapper;
    anchor.after(bar);
    applySettings();
    render();
  }

  function unmount() {
    anchor?.classList.remove('jcf-hidden-trigger');
    anchor = null;
    bar?.parentElement?.classList.remove(FILL_CLASS);
    bar?.remove();
  }

  // --- wiring ------------------------------------------------------------------

  async function start() {
    settings = await jcfSettings.load();
    jcfSettings.onChange((next) => {
      settings = next;
      applySettings();
    });

    let mountScheduled = false;
    new MutationObserver(() => {
      if (mountScheduled) return;
      mountScheduled = true;
      setTimeout(() => {
        mountScheduled = false;
        mount();
      }, 100);
    }).observe(document.body, { childList: true, subtree: true });

    // The popup asks which UI the page shows, to grey out what doesn't apply.
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'jcf-get-ui') sendResponse({ ui: detectUi() });
    });

    // Jira is a SPA: switching boards or filters changes the URL without
    // reloading, so re-read it whenever that happens.
    setInterval(() => {
      if (location.href === lastSeenUrl) return;
      lastSeenUrl = location.href;
      sync();
    }, 500);

    sync();
  }

  start();
})();
