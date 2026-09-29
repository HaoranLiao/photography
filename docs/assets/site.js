// Always show the latest version of the site. Browsers may keep pages for a while (GitHub
// Pages allows 10 minutes), so each page asks the server for the current version, bypassing the
// browser's saved copy. If this page is older, it's loaded again from an address that can't
// have been saved (…?v=<version>), at most once per page and version, so it can never loop.
const pageVersion = document.querySelector('meta[name="site-version"]')?.content;
if (new URLSearchParams(location.search).has('v')) {
  history.replaceState(null, '', location.pathname + location.hash);  // tidy the address bar
}
async function showLatestVersion() {
  try {
    const res = await fetch(new URL('../version.txt', import.meta.url), { cache: 'no-store' });
    const latest = res.ok ? (await res.text()).trim() : '';
    if (!pageVersion || !latest || latest === pageVersion) return;
    const key = `reloaded:${location.pathname}:${latest}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    location.replace(`${location.pathname}?v=${latest}${location.hash}`);
  } catch {
    // Offline, or storage blocked: just keep showing this page.
  }
}
showLatestVersion();
window.addEventListener('pageshow', (e) => { if (e.persisted) showLatestVersion(); });

// Mobile menu
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('.menu-toggle');
toggle?.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
  document.body.style.overflow = open ? 'hidden' : '';
});

// Fade the page out when following a link to another page of the site (as on Adobe).
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (link.target || link.hasAttribute('download') || link.origin !== location.origin) return;
  if (link.pathname === location.pathname) return;  // same page, or a #hash link
  document.body.classList.add('page-leaving');
});
// Coming back with the browser's Back button can restore the faded-out page; show it again.
window.addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('page-leaving'); });

// Back-to-top button
document.querySelector('.back-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Discourage right-click saving (as on the old site). Determined visitors can still save images.
if (document.body.hasAttribute('data-no-download')) {
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('img, .lb')) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); });
}

// Justified gallery, same method as Adobe Portfolio's photo grid: photos are added to a row
// until one more would make the row (stretched to the full width) shorter than a minimum
// height; that photo starts the next row. Photos are never cropped. The minimum depends on
// the width of the photo area, fitted to Adobe's layout on phones, tablets and computers,
// times the album's "row_scale" in site.json (bigger = fewer, larger photos per row).
// Phones (photo area under 540px): the minimum is a share of the photo-area width, and the
// share steps with the window width. Measured on Adobe at iPhone widths 360-440px.
const PHONE_BANDS = [  // [window width up to, minimum row height as a share of the photo width]
  [382, 0.242], [405, 0.228], [420, 0.2174], [475, 0.2128], [Infinity, 0.165],
];
// Tablets (menu-button header, window up to 932px) and computers (sidebar) go by the width of
// the photo area, with different bands for the two layouts.
const TABLET_BANDS = [  // [photo-area width up to, width ÷ this = minimum row height]
  [600, 4.45], [645, 4.63], [780, 5.9], [840, 4.5905], [862, 4.52], [Infinity, 5.9],
];
const DESKTOP_BANDS = [
  [648, 4.63], [656, 5.362], [665, 4.625], [780, 5.9], [783, 4.6], [850, 4.52],
  [1016, 5.9], [1106, 4.52], [Infinity, 5.9],
];
function minRowHeight(W, scale) {
  const vw = window.innerWidth;
  if (W < 540) {
    // On phones Adobe shows Landscape like Travel, so only enlarging scales (Night) apply here.
    return W * PHONE_BANDS.find(([upTo]) => vw <= upTo)[1] * Math.max(scale, 1);
  }
  const bands = vw <= 932 ? TABLET_BANDS : DESKTOP_BANDS;
  return (W / bands.find(([upTo]) => W < upTo)[1]) * scale;
}

function layoutGallery(gallery) {
  const items = [...gallery.children];
  const W = gallery.getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(gallery).columnGap) || 0;
  const ratios = items.map((a) => a.dataset.pswpWidth / a.dataset.pswpHeight);
  const minH = minRowHeight(W, Number(gallery.dataset.rowScale) || 1);
  const heightOf = (row) => (W - gap * (row.length - 1)) / row.reduce((sum, x) => sum + ratios[x], 0);

  const rows = [];
  let row = [];
  ratios.forEach((_, x) => {
    if (row.length && heightOf([...row, x]) < minH) {
      rows.push(row);
      row = [];
    }
    row.push(x);
  });
  rows.push(row);

  gallery.classList.add('justified');
  rows.forEach((r, i) => {
    const total = r.reduce((sum, x) => sum + ratios[x], 0);
    const gaps = gap * (r.length - 1);
    // A short last row would blow up to a huge height; keep it modest instead of full width.
    const capped = i === rows.length - 1 && rows.length > 1 && heightOf(r) > minH * 3;
    for (const x of r) {
      // Widths are shares of the row (not fixed pixels), so a row always fits, even if the
      // page width changes a little (e.g. a scrollbar appears) before the next layout pass.
      // The 0.5px keeps sub-pixel rounding from ever pushing the last photo to the next line.
      items[x].style.width = capped
        ? `${ratios[x] * minH * 1.5}px`
        : `calc((100% - ${gaps + 0.5}px) * ${ratios[x] / total})`;
      items[x].style.height = '';
      items[x].style.aspectRatio = `${ratios[x]}`;
      items[x].querySelector('img').sizes = `${Math.ceil((W - gaps) * ratios[x] / total)}px`;
    }
  });
}

for (const gallery of document.querySelectorAll('.gallery')) {
  layoutGallery(gallery);
  let lastWidth = gallery.getBoundingClientRect().width;
  new ResizeObserver(() => {
    const width = gallery.getBoundingClientRect().width;
    if (width !== lastWidth) { lastWidth = width; layoutGallery(gallery); }
  }).observe(gallery);
}

// Full-screen viewer, modelled on Adobe Portfolio's: near-white backdrop, the photo as large
// as fits, photos crossfade (0.4s), round arrows appear while the mouse is over the left or
// right 30% of the screen, and the arrows wrap around from the last photo to the first.
// Keyboard: left/right arrows and Esc. Phones: tap the sides or swipe; swipe down to close.
const ARROW_PREV = 'M36.8,36.4L30.3,30l6.5-6.4l-3.5-3.4l-10,9.8l10,9.8L36.8,36.4z';
const ARROW_NEXT = 'M24.2,23.5l6.6,6.5l-6.6,6.5l3.6,3.5L37.8,30l-10.1-9.9L24.2,23.5z';
const arrow = (d) => `<svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true"><circle class="lb-icon-bg" cx="30" cy="30" r="30"/><path class="lb-icon" d="${d}"/></svg>`;

function setupViewer(gallery) {
  const links = [...gallery.querySelectorAll('a')];
  const box = document.createElement('div');
  box.className = matchMedia('(hover: hover)').matches ? 'lb lb-idle' : 'lb';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = `<div class="lb-stage"></div>
    <button class="lb-prev" aria-label="Previous photo">${arrow(ARROW_PREV)}</button>
    <button class="lb-next" aria-label="Next photo">${arrow(ARROW_NEXT)}</button>
    <button class="lb-close" aria-label="Close"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="lb-icon-bg" cx="50" cy="50" r="47.5"/><polygon points="64.5,39.8 60.2,35.5 50,45.7 39.8,35.5 35.5,39.8 45.7,50 35.5,60.2 39.8,64.5 50,54.3 60.2,64.5 64.5,60.2 54.3,50"/></svg></button>`;
  document.body.append(box);
  const stage = box.querySelector('.lb-stage');
  let index = -1;
  let current = null;
  let idleTimer;
  let returnFocus = null;

  const wrap = (i) => (i + links.length) % links.length;
  const preload = (i) => { new Image().src = links[wrap(i)].href; };

  function show(i) {
    i = wrap(i);
    if (i === index) return;
    index = i;
    const img = new Image();
    img.className = 'lb-img';
    img.alt = links[i].querySelector('img')?.alt || '';
    img.draggable = false;
    img.src = links[i].href;
    stage.append(img);
    const previous = current;
    current = img;
    // Crossfade: once the new photo is ready, fade it in while the previous one fades out.
    const reveal = () => {
      if (current !== img) { img.remove(); return; }  // already moved on to another photo
      void img.offsetWidth;  // make the browser register opacity 0 first, so the fade runs
      img.classList.add('lb-visible');
      previous?.classList.remove('lb-visible');
      if (previous) setTimeout(() => previous.remove(), 450);
    };
    if (img.complete) {
      reveal();
    } else {
      img.addEventListener('load', reveal, { once: true });
      img.addEventListener('error', reveal, { once: true });
    }
    preload(i + 1);
    preload(i - 1);
  }

  // As on Adobe: controls are hidden until the mouse moves, and fade out 5s after it stops.
  // (Touch screens have no mouse, so there the close button stays visible.)
  const hasMouse = () => matchMedia('(hover: hover)').matches;
  const wake = () => {
    box.classList.remove('lb-idle');
    clearTimeout(idleTimer);
    if (hasMouse()) idleTimer = setTimeout(() => box.classList.add('lb-idle'), 5000);
  };

  function open(i) {
    returnFocus = document.activeElement;
    stage.replaceChildren();
    current = null;
    index = -1;
    show(i);
    document.documentElement.classList.add('lb-lock');
    box.classList.add('lb-open');
    box.querySelector('.lb-close').focus({ preventScroll: true });
  }

  function close() {
    box.classList.remove('lb-open');
    document.documentElement.classList.remove('lb-lock');
    clearTimeout(idleTimer);
    box.classList.toggle('lb-idle', hasMouse());  // hidden again (without a fade) for the next opening
    stage.replaceChildren();
    returnFocus?.focus({ preventScroll: true });
  }

  // Start loading a photo's full-size version as soon as the mouse is over its thumbnail,
  // so it's usually ready by the time it's clicked.
  const warmed = new Set();
  gallery.addEventListener('pointerover', (e) => {
    const link = e.target.closest('a');
    if (link && !warmed.has(link)) { warmed.add(link); new Image().src = link.href; }
  });

  gallery.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(links.indexOf(link));
  });
  box.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
  box.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
  box.querySelector('.lb-close').addEventListener('click', close);
  box.addEventListener('mousemove', wake);
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('lb-open')) return;
    if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
  });

  // Swipe on touch screens.
  let startX = null;
  let startY = null;
  box.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { startX = null; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    else if (dy > 80 && dy > Math.abs(dx)) close();
  });
}

document.querySelectorAll('.gallery').forEach(setupViewer);
