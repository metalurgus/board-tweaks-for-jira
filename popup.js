(async () => {
  'use strict';

  // TODO: fill in. Each donation link shows in the popup's footer only once
  // its URL is set, and the "Support development" line only with at least one.
  const DONATE_URLS = {
    kofi: '', // https://ko-fi.com/<name>
    monobank: '', // https://send.monobank.ua/jar/<id>
  };

  const { MIN_FONT_SIZE, MAX_FONT_SIZE, clampFontSize } = jcfSettings;

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
  const sizeInput = document.getElementById('size');
  const sizeDown = document.getElementById('size-down');
  const sizeUp = document.getElementById('size-up');
  const preview = document.querySelector('.preview');

  let settings = await jcfSettings.load();

  sizeInput.min = String(MIN_FONT_SIZE);
  sizeInput.max = String(MAX_FONT_SIZE);

  function render() {
    expandedInput.checked = settings.expanded;
    compactToolbarInput.checked = settings.compactToolbar;
    singleRowInput.checked = settings.singleRow;
    compactSearchInput.checked = settings.compactSearch;
    sizeInput.value = String(settings.fontSize);
    sizeDown.disabled = settings.fontSize <= MIN_FONT_SIZE;
    sizeUp.disabled = settings.fontSize >= MAX_FONT_SIZE;
    preview.style.setProperty('--jcf-font-size', `${settings.fontSize}px`);
  }

  function update(changes) {
    settings = { ...settings, ...changes };
    render();
    jcfSettings.save(changes);
  }

  const setFontSize = (size) => update({ fontSize: clampFontSize(size) });

  expandedInput.addEventListener('change', () => update({ expanded: expandedInput.checked }));
  singleRowInput.addEventListener('change', () => update({ singleRow: singleRowInput.checked }));
  compactSearchInput.addEventListener('change', () =>
    update({ compactSearch: compactSearchInput.checked })
  );
  compactToolbarInput.addEventListener('change', () =>
    update({ compactToolbar: compactToolbarInput.checked })
  );
  sizeDown.addEventListener('click', () => setFontSize(settings.fontSize - 1));
  sizeUp.addEventListener('click', () => setFontSize(settings.fontSize + 1));
  sizeInput.addEventListener('change', () => {
    const size = Number(sizeInput.value);
    if (sizeInput.value.trim() === '' || !Number.isFinite(size)) render();
    else setFontSize(size);
  });

  render();
})();
