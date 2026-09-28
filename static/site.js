// Mobile menu
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('.menu-toggle');
toggle?.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
  document.body.style.overflow = open ? 'hidden' : '';
});

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
function layoutGallery(gallery) {
  const items = [...gallery.children];
  const W = gallery.clientWidth;
  const gap = parseFloat(getComputedStyle(gallery).columnGap) || 0;
  const ratios = items.map((a) => a.dataset.pswpWidth / a.dataset.pswpHeight);
  const rowHeight = Number(gallery.dataset.rowHeight) || 137;
  // Scale with the column width, but not below 120px (what Adobe uses on phones).
  const target = Math.max(rowHeight * W / 704, 120);
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
  // Don't leave a single photo alone on the last row; fold it into the row before.
  if (row.length === 1 && rows.length) rows[rows.length - 1].push(...row);
  else rows.push(row);

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
  let lastWidth = gallery.clientWidth;
  new ResizeObserver(() => {
    if (gallery.clientWidth !== lastWidth) { lastWidth = gallery.clientWidth; layoutGallery(gallery); }
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
    tapAction: 'next',
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
    el.classList.add('pswp--idle');
    el.addEventListener('pointermove', wake);
  });
  lightbox.init();
}

// Contact form: posts to Formspree if configured in site.json, otherwise opens the visitor's email app.
const form = document.querySelector('.contact-form');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = form.querySelector('.form-status');
  const data = new FormData(form);
  if (form.getAttribute('action')) {
    status.textContent = 'Sending…';
    try {
      const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error();
      form.reset();
      status.textContent = 'Thanks! Your message has been sent.';
    } catch {
      status.textContent = 'Sorry, something went wrong. Please try again later.';
    }
    return;
  }
  const subject = `Message from ${data.get('name')}`;
  const body = `${data.get('message')}\n\n${data.get('name')} <${data.get('email')}>`;
  window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  status.textContent = 'Opening your email app…';
});
