// Mobile menu
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('.menu-toggle');
toggle?.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});

// Back-to-top button
const backToTop = document.querySelector('.back-to-top');
const onScroll = () => backToTop.classList.toggle('visible', window.scrollY > 300);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Discourage right-click saving (as on the old site). Determined visitors can still save images.
if (document.body.hasAttribute('data-no-download')) {
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('img, .pswp')) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); });
}

// Justified gallery: split photos into rows (as many as a simple left-to-right fill
// would need), balance them so every row is close to the target height, then scale
// each row to exactly fill the width. Photos are never cropped.
function layoutGallery(gallery) {
  const items = [...gallery.children];
  const W = gallery.clientWidth;
  const gap = parseFloat(getComputedStyle(gallery).columnGap) || 0;
  const ratios = items.map((a) => a.dataset.pswpWidth / a.dataset.pswpHeight);
  const target = Math.max(W * 0.185, 100);
  const maxHeight = Math.min(W * 0.8, window.innerHeight * 0.85);

  let rowCount = 1;
  for (let i = 0, w = 0; i < ratios.length; i++) {
    const iw = ratios[i] * target;
    if (w > 0 && w + gap + iw > W) { rowCount++; w = iw; } else { w += (w ? gap : 0) + iw; }
  }
  rowCount = Math.min(rowCount, ratios.length);

  // cost[i][j]: squared miss of a row made of photos i..j-1; dp over exactly rowCount rows.
  const n = ratios.length;
  const prefix = [0];
  ratios.forEach((r, i) => prefix.push(prefix[i] + r));
  const rowCost = (i, j) => ((prefix[j] - prefix[i]) * target + gap * (j - i - 1) - W) ** 2;
  const best = Array.from({ length: rowCount + 1 }, () => new Array(n + 1).fill(Infinity));
  const cut = Array.from({ length: rowCount + 1 }, () => new Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let k = 1; k <= rowCount; k++) {
    for (let j = k; j <= n; j++) {
      for (let i = k - 1; i < j; i++) {
        const c = best[k - 1][i] + rowCost(i, j);
        if (c < best[k][j]) { best[k][j] = c; cut[k][j] = i; }
      }
    }
  }
  const rows = [];
  for (let k = rowCount, j = n; k > 0; k--) { const i = cut[k][j]; rows.unshift([i, j]); j = i; }

  gallery.classList.add('justified');
  for (const [i, j] of rows) {
    const h = Math.min((W - gap * (j - i - 1)) / (prefix[j] - prefix[i]), maxHeight);
    for (let x = i; x < j; x++) {
      const w = Math.floor(ratios[x] * h * 100) / 100;
      items[x].style.width = `${w}px`;
      items[x].style.height = `${h}px`;
      items[x].querySelector('img').sizes = `${Math.ceil(w)}px`;
    }
  }
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
    bgOpacity: 1,
    showHideAnimationType: 'fade',
    padding: { top: 40, bottom: 40, left: 20, right: 20 },
    zoom: false,
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
