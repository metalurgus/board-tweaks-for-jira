// Renders Jira's "Custom filters" dropdown options as a row of toggle chips.
//
// Jira keeps the filter state inside its own React components, so the chips
// don't apply filters themselves: each click opens the original dropdown
// (hidden via CSS while we work), clicks the matching option, reads back the
// checkbox states and closes the dropdown again.
(() => {
  'use strict';

  const TRIGGER_TEXT = 'Custom filters';
  const MENU_SELECTOR = '[role="menu"][aria-label="Custom filters menu"]';
  const BUSY_CLASS = 'jcf-busy';
  const LOG_PREFIX = '[jira-custom-filters]';
  const MAX_SYNC_RETRIES = 5;
  const FILL_CLASS = 'jcf-fill-toolbar'; // on Jira's filter area in single-row mode
  // Jira lazy-loads the dropdown's code on first open, which can take a few
  // seconds while the rest of the board is still booting.
  const MENU_OPEN_TIMEOUT = 8000;
  const CLICK_RETRY_MS = 400;
  const CACHE_PREFIX = 'filters:';
  const SKELETON_WIDTHS = [88, 104, 64, 96, 72];

  let filters = []; // [{ name, selected }] in dropdown order
  // Board (path) the filters above belong to. Until they've been read from
  // Jira's dropdown they come from the cache, or are empty, and `loading` is set.
  let filtersBoard = null;
  let loading = true;
  let lastCachedNames = null;
  let settings = null; // from the popup, see settings.js
  let anchor = null; // Jira's wrapper around the "Custom filters" button
  let bar = null;
  let queue = Promise.resolve();
  let lastSeenUrl = location.href;
  let lastSyncedUrl = null;
  let syncRetries = 0;

  // --- DOM lookups ---------------------------------------------------------

  const findTrigger = () =>
    [...document.querySelectorAll('button[aria-haspopup="true"]')].find((b) =>
      b.textContent.trim().startsWith(TRIGGER_TEXT)
    );

  const findMenu = () => {
    const id = findTrigger()?.getAttribute('aria-controls');
    return (id && document.getElementById(id)) || document.querySelector(MENU_SELECTOR);
  };

  const optionsOf = (menu) => [...menu.querySelectorAll('[role="option"]')];

  const optionName = (option) => option.textContent.trim();

  // aria-selected is the reliable signal, but react-select omits it on Apple
  // devices, so fall back to the checkbox icon being filled in.
  const isSelected = (option) => {
    if (option.getAttribute('aria-selected') === 'true') return true;
    const fill = option.querySelector('svg')?.style.fill;
    return !!fill && fill !== 'transparent';
  };

  const readOptions = (menu) =>
    optionsOf(menu).map((o) => ({ name: optionName(o), selected: isSelected(o) }));

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

  function sync() {
    return enqueue(async () => {
      // A new board (or first load): show its cached chips straight away,
      // even in a background tab, while the real read below catches up.
      if (filtersBoard !== location.pathname) await showCachedFilters();
      // While collapsed the dropdown is the user's to drive; reading it could
      // close it under them. Expanding again forces a fresh read.
      if (!settings.expanded || !findTrigger() || location.href === lastSyncedUrl) return;
      // Jira's dropdown doesn't open in a background tab (no animation frames);
      // the visibilitychange listener in start() syncs once the tab is shown.
      if (document.hidden) return;
      try {
        await withMenu(async (menu) => {
          setFiltersFromMenu(menu);
        });
      } catch (err) {
        scheduleSyncRetry();
        throw err;
      }
      syncRetries = 0;
      lastSyncedUrl = location.href;
      render();
    });
  }

  function setFiltersFromMenu(menu) {
    filters = readOptions(menu);
    loading = false;
    saveCachedFilters();
  }

  // --- per-board cache of filter names ------------------------------------------

  const cacheKey = () => CACHE_PREFIX + location.host + location.pathname;

  // The URL carries the board's active filters as JQL; when it's empty no
  // custom filter can be on, so cached chips are shown as all-off with confidence.
  const urlHasFilters = () => !!new URLSearchParams(location.search).get('filter');

  async function showCachedFilters() {
    filtersBoard = location.pathname;
    filters = [];
    loading = true;
    lastCachedNames = null;
    try {
      const key = cacheKey();
      const names = (await chrome.storage.local.get(key))[key];
      if (Array.isArray(names) && filtersBoard === location.pathname) {
        filters = names.map((name) => ({ name, selected: false }));
        lastCachedNames = JSON.stringify(names);
      }
    } catch {
      // No cache (or the extension was reloaded under this page): skeleton it is.
    }
    render();
  }

  function saveCachedFilters() {
    const names = JSON.stringify(filters.map((f) => f.name));
    if (names === lastCachedNames) return;
    lastCachedNames = names;
    try {
      chrome.storage.local.set({ [cacheKey()]: JSON.parse(names) }).catch(() => {});
    } catch {
      // Extension reloaded under this page; the next page load will cache.
    }
  }

  function scheduleSyncRetry() {
    if (syncRetries >= MAX_SYNC_RETRIES) return;
    syncRetries += 1;
    setTimeout(sync, 1000 * syncRetries);
  }

  function toggle(index) {
    const { name } = filters[index];
    bar?.children[index]?.classList.add('jcf-pending');

    return enqueue(async () => {
      try {
        await withMenu(async (menu) => {
          const option = findOption(menu, index, name);
          if (!option) throw new Error(`Filter "${name}" not found in menu`);
          const before = isSelected(option);
          option.click();

          const updated = await waitFor(() => {
            const m = findMenu();
            if (!m) return 'closed';
            const o = findOption(m, index, name);
            return o && isSelected(o) !== before ? m : null;
          }, 2000);

          if (updated && updated !== 'closed') {
            setFiltersFromMenu(updated);
          } else if (!findMenu()) {
            // Menu closed itself after selecting; assume the toggle went through.
            filters[index] = { name, selected: !before };
          }
        });
        // Let Jira push the new ?filter= into the URL before we record it.
        await waitFor(() => location.href !== lastSyncedUrl, 1500);
        lastSyncedUrl = location.href;
      } finally {
        render();
      }
    });
  }

  // --- our chip bar ----------------------------------------------------------

  function render() {
    if (!bar) return;
    bar.setAttribute('aria-busy', String(loading));
    // Cached chips may be showing the wrong on/off state until Jira confirms.
    bar.classList.toggle('jcf-unconfirmed', loading && urlHasFilters());
    if (loading && !filters.length) {
      bar.replaceChildren(
        ...SKELETON_WIDTHS.map((width) => {
          const skeleton = document.createElement('span');
          skeleton.className = 'jcf-skeleton';
          skeleton.style.width = `${width}px`;
          return skeleton;
        })
      );
      updateScrollFades();
      return;
    }
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
    updateScrollFades();
  }

  // --- single-row mode: horizontal scrolling ----------------------------------

  // Fades the edges that have more chips beyond them.
  function updateScrollFades() {
    if (!bar) return;
    const single = settings?.singleRow;
    const max = bar.scrollWidth - bar.clientWidth;
    bar.classList.toggle('jcf-fade-left', !!single && bar.scrollLeft > 1);
    bar.classList.toggle('jcf-fade-right', !!single && bar.scrollLeft < max - 1);
  }

  // Lets a plain mouse wheel scroll the row sideways.
  function onBarWheel(e) {
    if (!settings.singleRow || bar.scrollWidth <= bar.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    bar.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  // --- settings from the popup ------------------------------------------------

  function applySettings() {
    if (!anchor || !bar) return;
    anchor.classList.toggle('jcf-hidden-trigger', settings.expanded);
    bar.hidden = !settings.expanded;
    bar.style.setProperty('--jcf-font-size', `${settings.fontSize}px`);
    bar.classList.toggle('jcf-single-row', settings.singleRow);
    bar.parentElement?.classList.toggle(FILL_CLASS, settings.singleRow && settings.expanded);
    updateScrollFades();
  }

  function updateSettings(next) {
    const wasExpanded = settings.expanded;
    settings = next;
    applySettings();
    if (settings.expanded && !wasExpanded) {
      // Filters may have changed through the dropdown while collapsed.
      lastSyncedUrl = null;
      sync();
    }
  }

  function mount() {
    const trigger = findTrigger();
    if (!trigger) return;
    const wrapper = trigger.parentElement;
    if (bar?.isConnected && bar.previousElementSibling === wrapper) return;

    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'jcf-bar';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Custom filters');
      bar.addEventListener('wheel', onBarWheel, { passive: false });
      bar.addEventListener('scroll', updateScrollFades, { passive: true });
      new ResizeObserver(updateScrollFades).observe(bar);
    }
    if (anchor && anchor !== wrapper) anchor.classList.remove('jcf-hidden-trigger');
    if (bar.parentElement && bar.parentElement !== wrapper.parentElement) {
      bar.parentElement.classList.remove(FILL_CLASS);
    }
    anchor = wrapper;
    anchor.after(bar);
    applySettings();
    render();
    if (!filters.length || location.href !== lastSyncedUrl) sync();
  }

  // --- wiring ------------------------------------------------------------------

  async function start() {
    settings = await jcfSettings.load();
    jcfSettings.onChange(updateSettings);

    let mountScheduled = false;
    new MutationObserver(() => {
      if (mountScheduled) return;
      mountScheduled = true;
      setTimeout(() => {
        mountScheduled = false;
        mount();
      }, 100);
    }).observe(document.body, { childList: true, subtree: true });

    // Jira is a SPA: switching boards or clearing filters changes the URL
    // without reloading, so re-read the dropdown whenever that happens.
    setInterval(() => {
      if (location.href === lastSeenUrl) return;
      lastSeenUrl = location.href;
      sync();
    }, 500);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sync();
    });

    mount();
  }

  start();
})();
