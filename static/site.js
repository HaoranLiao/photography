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
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('img, .pswp')) e.preventDefault(); });
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

// Lightbox
if (document.querySelector('.gallery')) {
  const base = 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist';
  const { default: PhotoSwipeLightbox } = await import(`${base}/photoswipe-lightbox.esm.min.js`);
  const lightbox = new PhotoSwipeLightbox({
    gallery: '.gallery',
    children: 'a',
    pswpModule: () => import(`${base}/photoswipe.esm.min.js`),
    // Like Adobe Portfolio: near-opaque white backdrop, photo edge to edge, no counter or zoom.
    bgOpacity: 0.94,
    showHideAnimationType: 'fade',
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    counter: false,
    zoom: false,
    imageClickAction: 'next',
    tapAction: 'toggle-controls',  // phones: tap shows/hides the close button; swipe to move, swipe down to close
  });
  // Arrows and close button appear while the mouse moves, then fade out.
  lightbox.on('afterInit', () => {
    const el = lightbox.pswp.element;
    let timer;
    const wake = () => {
      el.classList.remove('pswp--idle');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.add('pswp--idle'), 2000);
    };
    if (!matchMedia('(hover: hover)').matches) return;  // touch screens use tap-to-toggle instead
    el.classList.add('pswp--idle');
    el.addEventListener('pointermove', wake);
  });
  lightbox.init();
}
