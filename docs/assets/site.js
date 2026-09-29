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

// Justified gallery, same method as Adobe Portfolio's photo grid: walk through the
// photos and keep adding to the current row while that brings the row's height
// (when stretched to the full width) closer to the target height. Photos are never
// cropped. The target is given in pixels for Adobe's 704px-wide column (site.json
// "row_height") and scales with the actual width.
// Target row height for each screen size, fitted to what Adobe Portfolio does.
function targetRowHeight(gallery, W) {
  const rowHeight = Number(gallery.dataset.rowHeight) || 137;  // per album, see site.json
  const vw = window.innerWidth;
  if (vw <= 540) return 114;                                // phones
  if (vw <= 768) return W * 0.278;                          // tablets, upright
  if (vw <= 932) return W * 0.196 * (rowHeight / 137);      // tablets, sideways
  return rowHeight * W / 704;                               // computers
}

function layoutGallery(gallery) {
  const items = [...gallery.children];
  // Exact (fractional) width, trimmed a hair so rounding can never push a photo onto the next row.
  const W = gallery.getBoundingClientRect().width - 0.1;
  const gap = parseFloat(getComputedStyle(gallery).columnGap) || 0;
  const ratios = items.map((a) => a.dataset.pswpWidth / a.dataset.pswpHeight);
  const target = targetRowHeight(gallery, W);
  const heightOf = (row) => (W - gap * (row.length - 1)) / row.reduce((sum, x) => sum + ratios[x], 0);

  const rows = [];
  let row = [];
  ratios.forEach((_, x) => {
    if (row.length && Math.abs(heightOf([...row, x]) - target) > Math.abs(heightOf(row) - target)) {
      rows.push(row);
      row = [];
    }
    row.push(x);
  });
  rows.push(row);
  // Don't leave a single photo alone on the last row: re-split the last two rows as evenly as possible.
  if (rows.length > 1 && row.length === 1) {
    const both = [...rows[rows.length - 2], ...row];
    let best = 1;
    const miss = (k) => Math.abs(heightOf(both.slice(0, k)) - target) + Math.abs(heightOf(both.slice(k)) - target);
    for (let k = 2; k < both.length; k++) if (miss(k) < miss(best)) best = k;
    rows.splice(-2, 2, both.slice(0, best), both.slice(best));
  }

  gallery.classList.add('justified');
  rows.forEach((r, i) => {
    let h = heightOf(r);
    // A short last row would blow up to a huge height; keep it at the target instead.
    if (i === rows.length - 1 && rows.length > 1 && h > target * 2) h = target;
    for (const x of r) {
      const w = Math.floor(ratios[x] * h * 100) / 100;
      items[x].style.width = `${w}px`;
      items[x].style.height = `${h}px`;
      items[x].querySelector('img').sizes = `${Math.ceil(w)}px`;
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
