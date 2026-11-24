(async () => {
  'use strict';

  // Each donation link shows in the popup's footer only once its URL is set,
  // and the "Support development" line only with at least one.
  const DONATE_URLS = {
    kofi: '', // https://ko-fi.com/<name>
    monobank: 'https://send.monobank.ua/jar/AQ7QMzsSpt',
  };

  const {
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    clampFontSize,
    MIN_COLUMN_WIDTH,
    MAX_COLUMN_WIDTH,
    COLUMN_WIDTH_STEP,
    clampColumnWidth,
  } = jcfSettings;

  for (const [key, url] of Object.entries(DONATE_URLS)) {
    if (!url) continue;
    const link = document.getElementById(`donate-${key}`);
    link.href = url;
    link.hidden = false;
    document.getElementById('donate').hidden = false;
  }

  const expandedInput = document.getElementById('expanded');
  const compactToolbarInput = document.getElementById('compact-toolbar');
  const singleRowInput = document.getElementById('single-row');
  const compactSearchInput = document.getElementById('compact-search');
  const compactCardsInput = document.getElementById('compact-cards');
  const sizeInput = document.getElementById('size');
  const sizeDown = document.getElementById('size-down');
  const sizeUp = document.getElementById('size-up');
  const columnInput = document.getElementById('column');
  const columnDown = document.getElementById('column-down');
  const columnUp = document.getElementById('column-up');
  const columnHint = document.getElementById('column-hint');
  const columnUnit = document.getElementById('column-unit');
  const columnReset = document.getElementById('column-reset');
  const preview = document.querySelector('.preview');

  let settings = await jcfSettings.load();

  sizeInput.min = String(MIN_FONT_SIZE);
  sizeInput.max = String(MAX_FONT_SIZE);

  function render() {
    expandedInput.checked = settings.expanded;
    compactToolbarInput.checked = settings.compactToolbar;
    singleRowInput.checked = settings.singleRow;
    compactSearchInput.checked = settings.compactSearch;
    compactCardsInput.checked = settings.compactCards;
    sizeInput.value = String(settings.fontSize);
    sizeDown.disabled = settings.fontSize <= MIN_FONT_SIZE;
    sizeUp.disabled = settings.fontSize >= MAX_FONT_SIZE;
    preview.style.setProperty('--jcf-font-size', `${settings.fontSize}px`);
    const auto = settings.columnWidth === 0;
    columnInput.value = auto ? 'Auto' : String(settings.columnWidth);
    columnUnit.hidden = auto;
    columnDown.disabled = !auto && settings.columnWidth <= MIN_COLUMN_WIDTH;
    columnUp.disabled = !auto && settings.columnWidth >= MAX_COLUMN_WIDTH;
    columnHint.textContent = auto ? 'Auto: Jira fits them to the screen' : 'Fixed width';
    columnReset.hidden = auto;
  }

  function update(changes) {
    settings = { ...settings, ...changes };
    render();
    jcfSettings.save(changes);
  }

  const setFontSize = (size) => update({ fontSize: clampFontSize(size) });
  const setColumnWidth = (width) => update({ columnWidth: clampColumnWidth(width) });

  // The width Jira gives the columns in the open tab right now, if it's a board.
  async function currentColumnWidth() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const reply = await chrome.tabs.sendMessage(tab.id, { type: 'jcf-get-column-width' });
      return reply?.width || null;
    } catch {
      return null;
    }
  }

  // Steps land on multiples of the step (a typed 205 goes to 200 or 210).
  // Leaving Auto starts from the width the columns have now, so the first
  // step is a small change rather than a jump.
  async function stepColumnWidth(direction) {
    const step = COLUMN_WIDTH_STEP;
    const current = settings.columnWidth || (await currentColumnWidth()) || 200;
    const next = direction > 0 ? Math.floor(current / step) * step + step : Math.ceil(current / step) * step - step;
    setColumnWidth(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, next)));
  }

  expandedInput.addEventListener('change', () => update({ expanded: expandedInput.checked }));
  singleRowInput.addEventListener('change', () => update({ singleRow: singleRowInput.checked }));
  compactSearchInput.addEventListener('change', () =>
    update({ compactSearch: compactSearchInput.checked })
  );
  compactCardsInput.addEventListener('change', () =>
    update({ compactCards: compactCardsInput.checked })
  );
  compactToolbarInput.addEventListener('change', () =>
    update({ compactToolbar: compactToolbarInput.checked })
  );
  sizeDown.addEventListener('click', () => setFontSize(settings.fontSize - 1));
  sizeUp.addEventListener('click', () => setFontSize(settings.fontSize + 1));
  columnDown.addEventListener('click', () => stepColumnWidth(-1));
  columnUp.addEventListener('click', () => stepColumnWidth(1));
  columnReset.addEventListener('click', () => setColumnWidth(0));
  columnInput.addEventListener('change', () => {
    const text = columnInput.value.trim().toLowerCase();
    const width = Number(text);
    if (text === '' || text === 'auto') setColumnWidth(0);
    else if (Number.isFinite(width)) setColumnWidth(width);
    else render();
  });
  sizeInput.addEventListener('change', () => {
    const size = Number(sizeInput.value);
    if (sizeInput.value.trim() === '' || !Number.isFinite(size)) render();
    else setFontSize(size);
  });

  render();
  showBoardUi();

  // Jira is bringing back its own line of filter buttons, board by board.
  // Where the open board already has it, there is no dropdown to turn into
  // buttons, so that switch is greyed out. Any other page (or no answer,
  // e.g. a tab opened before the extension was loaded) leaves it as is.
  async function showBoardUi() {
    let ui = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) ({ ui } = (await chrome.tabs.sendMessage(tab.id, { type: 'jcf-get-ui' })) ?? {});
    } catch {
      return; // no content script in this tab
    }
    if (ui !== 'line') return;
    expandedInput.disabled = true;
    expandedInput.closest('.row').classList.add('unavailable');
    document.getElementById('expanded-hint').textContent =
      'Jira shows its own filter buttons on this board';
  }
})();
