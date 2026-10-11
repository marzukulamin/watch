import '@fontsource-variable/manrope';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import './styles.css';
import {
  api,
  post,
  session,
  setSession,
  user,
  escapeHtml as e,
  currency as money,
  localImage,
  date,
} from './api.js';
import { pageMotion, clearMotion, panelMotion, statusMotion, reduced } from './motion.js';
import { playIntro, shouldIntroduce, cancelIntro } from './intro.js';
const app = document.querySelector('#app');
let store,
  products = [],
  bag = new Map(),
  sceneCleanup = () => {},
  generation = 0,
  analytics = false,
  filter = { brand: 'all', gender: 'all', q: '', sort: 'featured' },
  checkoutKey = crypto.randomUUID();
const arrow =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const icons = {
  bag: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  menu: '<path d="M3 7h18M3 17h18"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">${icons[name]}</svg>`;
const button = (text, href, cls = '') =>
  `<a class="button ${cls}" href="${href}" data-magnetic><span>${e(text)}</span>${arrow}</a>`;
const heading = (value, cls = '') =>
  `<h1 class="display ${cls}">${e(value)
    .split('\n')
    .map((line, i) => `<span class="line" data-letter>${line}</span>`)
    .join('')}</h1>`;
const count = () => [...bag.values()].reduce((n, q) => n + q, 0);
function saveBag() {
  try {
    sessionStorage.setItem('verse_bag', JSON.stringify({ items: [...bag], checkoutKey }));
  } catch {}
}
function restoreBag() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('verse_bag') || 'null');
    if (!Array.isArray(saved?.items)) return;
    bag = new Map(
      saved.items.slice(0, 30).filter(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          Number.isSafeInteger(item[0]) &&
          products.some((p) => p.id === item[0]) &&
          Number.isSafeInteger(item[1]) &&
          item[1] >= 1 &&
          item[1] <= 10,
      ),
    );
    if (typeof saved.checkoutKey === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(saved.checkoutKey))
      checkoutKey = saved.checkoutKey;
    saveBag();
  } catch {}
}
function header() {
  return `<header class="site-header"><a class="wordmark" href="/" aria-label="VERSE home">VERSE</a><nav aria-label="Main navigation" class="desktop-nav"><a href="/collection" ${location.pathname === '/collection' ? 'aria-current="page"' : ''}>The collection</a><a href="/#perspective">Our perspective</a><a href="/stores" ${location.pathname === '/stores' ? 'aria-current="page"' : ''}>Visit us</a></nav><div class="nav-tools"><button class="icon-button" data-search aria-label="Search watches">${icon('search')}</button><a class="icon-button" href="/account" aria-label="Your account">${icon('user')}</a><a class="bag-link" href="/bag" aria-label="Shopping bag, ${count()} items">${icon('bag')}<span class="bag-count">${String(count()).padStart(2, '0')}</span></a><button class="icon-button menu-button" data-menu aria-label="Open navigation" aria-expanded="false">${icon('menu')}</button></div></header><div class="scroll-progress" aria-hidden="true"></div>`;
}
function footer() {
  return `<footer class="site-footer"><div class="footer-top"><a href="/" class="wordmark footer-logo">VERSE</a><p>A different sense of time.</p><a class="text-link" href="/collection">Discover the collection ${arrow}</a></div><div class="footer-grid"><div><p class="eyebrow">LET’S TALK</p><a href="mailto:${e(store.business.email)}">${e(store.business.email)}</a><a href="tel:${e(store.business.phone)}">${e(store.business.phone)}</a></div><div><p class="eyebrow">EXPLORE</p><a href="/collection">Watches</a><a href="/stores">Our stores</a><a href="/account">Your account</a></div><div><p class="eyebrow">CUSTOMER CARE</p><a href="/policies/delivery">Delivery information</a><a href="/policies/refund">Refund & cancellation</a><a href="tel:${e(store.business.complaint_phone)}">Speak to customer care</a></div><div><p class="eyebrow">THE DETAILS</p><a href="/policies/privacy">Privacy policy</a><a href="/policies/terms">Terms of service</a><a href="/policies/cookies">Cookie policy</a><button class="plain-link" data-cookies>Cookie settings</button></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${e(store.business.name)}</span><span>DHAKA, BANGLADESH</span><a href="/admin">${user?.role === 'admin' ? 'Admin dashboard' : 'Business access'} ${arrow}</a></div></footer>`;
}
function productCard(p, i = 0) {
  return `<article class="product-card" data-reveal><a class="product-art" href="/watches/${e(p.slug)}"><span class="card-index">${String(i + 1).padStart(2, '0')} / ${e(p.brand)}</span><img src="${localImage(p.image)}" alt="${e(p.full_name.split('|')[0])}" width="600" height="600" loading="lazy" decoding="async"><span class="card-explore">Explore ${arrow}</span></a><div class="product-caption"><div><p class="eyebrow">${e(p.brand)}</p><h3><a href="/watches/${e(p.slug)}">${e(p.name)}</a></h3><span class="model-text">${e(p.model)}</span></div><span class="price">${money(p.price_minor)}</span></div></article>`;
}
function home() {
  const content = store.content,
    heroProduct = products.find((p) => p.model === content.hero.featured_model) || products[0],
    feature = products.find((p) => /AR11746/.test(p.model)) || products[1];
  const featured = products.filter((p) => p.featured).slice(0, 4);
  return `<main id="main" tabindex="-1"><section class="hero"><div class="hero-meta"><span class="eyebrow">WATCHES. CHARACTER. YOU.</span><span class="edition">DHAKA · BD <span class="small-line"></span> VERSE</span></div><div class="hero-copy"><p class="eyebrow accent">${e(content.hero.eyebrow)}</p>${heading(content.hero.title, 'hero-title')}<p class="hero-description">${e(content.hero.description)}</p><div class="hero-actions">${button(content.hero.cta, '/collection')}<a href="#the-edit" class="quiet-link">${e(content.hero.secondary)} <span>↘</span></a></div></div><div class="hero-scene" data-scene="${localImage(heroProduct.image)}"><div class="scene-glow" aria-hidden="true"></div><img class="scene-poster" src="${localImage(heroProduct.image)}" alt="${e(heroProduct.full_name.split('|')[0])}" fetchpriority="high" width="1200" height="1200"><span class="orbit-label orbit-label-one">${e(heroProduct.brand)}</span><span class="orbit-label orbit-label-two">${e(heroProduct.model)}</span><div class="scene-controls"><button data-scene-left aria-label="Tilt watch left">←</button><span>EXPLORE IN MOTION</span><button data-scene-right aria-label="Tilt watch right">→</button><button data-scene-pause aria-pressed="${reduced.matches}">${reduced.matches ? 'Resume motion' : 'Pause motion'}</button></div></div><div class="hero-bottom"><a href="#the-edit" class="scroll-cue"><span class="scroll-line"></span>SCROLL TO DISCOVER</a><a href="/watches/${e(heroProduct.slug)}" class="hero-feature"><span class="eyebrow">IN FOCUS</span><strong>${e(heroProduct.name)}</strong><span>${e(heroProduct.brand)} · ${money(heroProduct.price_minor)} ${arrow}</span></a><span class="chapter">01 <span>/ 04</span></span></div></section><div class="brand-ribbon" aria-label="Brands in our collection"><div class="ribbon-track">${[...store.brands, ...store.brands].map((b) => `<span>${e(b.name)}</span><span class="ribbon-star" aria-hidden="true">✳</span>`).join('')}</div><button class="ribbon-pause" aria-label="Pause brand animation">Ⅱ</button></div><section class="section collection-preview" id="the-edit"><div class="section-top"><p class="eyebrow"><span class="section-number">01</span> ${e(content.collection.eyebrow)}</p><span class="section-marker">A MATTER OF PERSONALITY</span></div><div class="section-heading" data-reveal><h2 class="display medium">${e(
    content.collection.title,
  )
    .split('\n')
    .map((s) => `<span class="line" data-letter>${s}</span>`)
    .join(
      '',
    )}</h2><div><p>${e(content.collection.description)}</p><a href="/collection" class="text-link">View the collection ${arrow}</a></div></div><div class="product-grid">${featured.map(productCard).join('')}</div></section><section class="perspective" id="perspective"><div class="perspective-photo">${content.story.video ? `<video data-lazy-video="${localImage(content.story.video)}" muted playsinline loop preload="none" aria-hidden="true"></video><button class="video-control" data-video-pause aria-pressed="false">Pause film</button>` : ''}<img src="${localImage(feature.image.replace('-0.webp', '-1.webp'))}" alt="${e(feature.brand)} ${e(feature.name)} worn on the wrist" width="1000" height="1000" loading="lazy" data-parallax=".1"><div class="photo-caption"><span>A PHOTOGRAPH IN MOTION</span><span>${e(feature.model)}</span></div></div><div class="perspective-copy"><p class="eyebrow accent" data-reveal><span class="section-number">02</span> ${e(content.story.eyebrow)}</p><h2 class="display medium scroll-heading">${e(
    content.story.title,
  )
    .split('\n')
    .map((s) => `<span class="scroll-word">${s}</span>`)
    .join(
      '',
    )}</h2><p data-reveal>${e(content.story.description)}</p>${button(content.story.cta, '/collection', 'button-outline')}</div></section><section class="detail-story section"><div class="section-top"><p class="eyebrow"><span class="section-number">03</span> A CLOSER LOOK</p><span class="section-marker">DETAILS MAKE THE DIFFERENCE</span></div><div class="detail-grid"><div data-reveal><p class="eyebrow accent">${e(feature.brand)} · ${e(feature.model)}</p><h2 class="display medium">Made for<br><em>your moment.</em></h2><p>${e(feature.description)}</p><a class="text-link" href="/watches/${e(feature.slug)}">Meet ${e(feature.name)} ${arrow}</a></div><a href="/watches/${e(feature.slug)}" class="macro-image" aria-label="View ${e(feature.name)}"><img src="${localImage(feature.image)}" width="1200" height="1200" alt="Close view of ${e(feature.name)}" loading="lazy" data-parallax=".12"><span class="macro-circle" aria-hidden="true"></span><span class="macro-label">TAKE A CLOSER LOOK ${arrow}</span></a></div></section><section class="visit-section section"><div class="section-top"><p class="eyebrow"><span class="section-number">04</span> ${e(content.visit.eyebrow)}</p><span class="section-marker">LET THE WRIST DECIDE</span></div><div class="visit-grid"><div data-reveal><h2 class="display large">${e(content.visit.title).split('\n').join('<br>')}</h2></div><div class="visit-info" data-reveal><p>${e(content.visit.description)}</p>${store.locations.map((l) => `<a href="/stores" class="store-line"><span>${icon('pin')} ${e(l.name)}</span>${arrow}</a>`).join('')}${button('Find a VERSE store', '/stores', 'button-outline')}</div></div><span class="visit-watermark" aria-hidden="true">VERSE</span></section></main>`;
}
function collection() {
  return `<main id="main" tabindex="-1" class="page-main"><section class="page-intro section"><p class="eyebrow accent">YOUR NEXT CHAPTER</p>${heading('The collection.')}<p>Find the one that feels like you.</p></section><section class="section collection-page"><form class="collection-toolbar" id="filters"><div class="filter-group"><label for="brand">Brand</label><select id="brand" name="brand"><option value="all">All brands</option>${store.brands.map((b) => `<option value="${e(b.name)}" ${filter.brand === b.name ? 'selected' : ''}>${e(b.name)}</option>`).join('')}</select></div><div class="filter-group"><label for="gender">Collection</label><select id="gender" name="gender">${[
    ['all', 'All watches'],
    ['men', 'For men'],
    ['women', 'For women'],
    ['unisex', 'Unisex'],
  ]
    .map(([v, t]) => `<option value="${v}" ${filter.gender === v ? 'selected' : ''}>${t}</option>`)
    .join(
      '',
    )}</select></div><div class="filter-group search-field"><label for="watch-search">Search watches</label><input id="watch-search" type="search" name="q" placeholder="Brand, model or style" value="${e(filter.q)}"></div><div class="filter-group"><label for="sort">Sort by</label><select id="sort" name="sort">${[
    ['featured', 'Featured'],
    ['price-low', 'Price: low to high'],
    ['price-high', 'Price: high to low'],
    ['name', 'Brand & model'],
  ]
    .map(([v, t]) => `<option value="${v}" ${filter.sort === v ? 'selected' : ''}>${t}</option>`)
    .join(
      '',
    )}</select></div><button class="plain-link filter-reset" type="button" data-reset-filters>Reset</button></form><p id="result-count" class="result-count" role="status" aria-live="polite"></p><div class="product-grid" id="collection-results"></div></section></main>`;
}
function updateResults() {
  let result = products.filter(
    (p) =>
      (filter.brand === 'all' || p.brand === filter.brand) &&
      (filter.gender === 'all' || p.gender === filter.gender) &&
      `${p.full_name} ${p.model} ${p.category}`.toLowerCase().includes(filter.q.toLowerCase()),
  );
  if (filter.sort === 'price-low') result.sort((a, b) => a.price_minor - b.price_minor);
  else if (filter.sort === 'price-high') result.sort((a, b) => b.price_minor - a.price_minor);
  else if (filter.sort === 'name')
    result.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  document.querySelector('#collection-results').innerHTML = result.length
    ? result.map(productCard).join('')
    : '<div class="empty-state"><h2>No watches found.</h2><p>Try another brand, model or style.</p><button class="button" data-reset-filters>Clear filters</button></div>';
  document.querySelector('#result-count').textContent =
    `${result.length} ${result.length === 1 ? 'watch' : 'watches'}`;
}
async function product(slug) {
  const p = await api(`/products/${encodeURIComponent(slug)}`),
    specs = p.specs.filter((s) => !['Brand', 'Model', 'Collection', 'Gender'].includes(s.label));
  return `<main id="main" tabindex="-1" class="page-main"><div class="section breadcrumb"><a href="/collection">The collection</a><span>/</span><span>${e(p.model)}</span></div><section class="product-detail section"><div class="gallery" data-reveal><div class="gallery-main"><img id="gallery-image" src="${localImage(p.images[0]?.path)}" alt="${e(p.images[0]?.alt)}" width="1200" height="1200" fetchpriority="high"><button class="gallery-zoom" data-zoom aria-label="Expand product photograph">↗</button></div><div class="gallery-thumbs">${p.images.map((im, i) => `<button data-gallery="${localImage(im.path)}" aria-label="View photograph ${i + 1}" aria-pressed="${i === 0}"><img src="${localImage(im.path)}" alt="" width="100" height="100" loading="lazy"></button>`).join('')}</div><p class="caption">Product photography from VERSE’s catalogue.</p></div><div class="product-information" data-reveal><p class="eyebrow accent">${e(p.brand)}</p><h1 class="display medium">${e(p.name)}</h1><p class="model-text">${e(p.model)}</p><p class="product-price">${money(p.price_minor)} <span>BDT</span></p><p class="product-description">${e(p.description)}</p><p class="availability"><span class="status-dot"></span>${p.stock_verified ? (p.stock > 0 ? 'Available to order' : 'Currently unavailable') : 'Availability on request'}</p><div class="purchase-actions"><button class="button" data-add="${p.id}" ${p.stock_verified && p.stock === 0 ? 'disabled' : ''}>Add to bag ${arrow}</button><a class="button button-outline" href="tel:${e(store.business.phone)}">Ask about this watch ${arrow}</a></div><div class="product-facts">${[
    ['Case Diameter', 'Case size'],
    ['Movement', 'Movement'],
    ['Water Resistance', 'Water resistance'],
  ]
    .map(([k, t]) => {
      const spec = specs.find((s) => s.label === k);
      return spec ? `<div><span>${t}</span><strong>${e(spec.value)}</strong></div>` : '';
    })
    .join(
      '',
    )}</div><div class="detail-accordions"><details open><summary>The details <span>+</span></summary><dl class="spec-list">${specs.map((s) => `<div><dt>${e(s.label)}</dt><dd>${e(s.value)}</dd></div>`).join('')}</dl></details><details><summary>Delivery & returns <span>+</span></summary><p>Delivery charges and estimated timings are shown before placing an order. Read the policies and ask our team if you have a question.</p><a class="text-link" href="/policies/delivery">Delivery information ${arrow}</a><a class="text-link" href="/policies/refund">Refund policy ${arrow}</a></details></div><p class="caption">Catalogue checked ${date(p.source_checked_at)}. Stock is confirmed separately.</p></div></section><section class="section related-section"><div class="section-heading"><h2 class="display small" data-reveal>Another expression.</h2><a class="text-link" href="/collection">Explore all ${arrow}</a></div><div class="product-grid">${products
    .filter((x) => x.id !== p.id && x.brand === p.brand)
    .slice(0, 4)
    .map(productCard)
    .join('')}</div></section></main>`;
}
function stores() {
  return `<main id="main" tabindex="-1" class="page-main"><section class="page-intro section"><p class="eyebrow accent">DHAKA, BANGLADESH</p>${heading('Make time.\nMeet VERSE.')}<p>Some decisions feel better in person.</p></section><section class="section stores-grid">${store.locations.map((l, i) => `<article class="location-card" data-reveal><div class="location-visual"><span class="location-number">0${i + 1}</span>${icon('pin')}<span>DHAKA / ${e(l.name.toUpperCase())}</span></div><div class="location-body"><p class="eyebrow accent">VERSE STORE</p><h2>${e(l.name)}</h2><p>${e(l.address)}</p><a class="text-link" href="tel:${e(l.phone)}">${e(l.phone)} ${arrow}</a><p class="caption">Please call to confirm opening hours before visiting.</p></div></article>`).join('')}</section><section class="section contact-panel" data-reveal><div><p class="eyebrow">PREFER TO TALK?</p><h2 class="display small">We’re here.</h2></div><div><a class="text-link" href="mailto:${e(store.business.email)}">${e(store.business.email)} ${arrow}</a><a class="text-link" href="tel:${e(store.business.phone)}">Online enquiries · ${e(store.business.phone)} ${arrow}</a><a class="text-link" href="tel:${e(store.business.complaint_phone)}">Customer care · ${e(store.business.complaint_phone)} ${arrow}</a></div></section>${store.business.legal_name ? `<section class="section legal-business"><h2>Business details</h2><p>${e(store.business.legal_name)} · ${e(store.business.registration_number)}</p><p>${e(store.business.registered_address)}</p></section>` : ''}</main>`;
}
async function policy(slug) {
  const p = await api(`/policies/${encodeURIComponent(slug)}`);
  return `<main id="main" tabindex="-1" class="page-main"><section class="section page-intro policy-intro"><p class="eyebrow accent">CLEAR, BY DESIGN</p>${heading(p.title)}<p>Updated ${date(p.updated_at)} · Version ${e(p.version)}</p>${p.status === 'draft' ? '<p class="notice">This policy is awaiting business confirmation. Checkout will open once the final policy is published.</p>' : ''}</section><section class="section policy-layout"><nav class="policy-nav" aria-label="Customer policies">${store.policies.map((item) => `<a href="/policies/${e(item.slug)}" ${item.slug === slug ? 'aria-current="page"' : ''}>${e(item.title)}</a>`).join('')}</nav><article class="policy-content">${p.sections.map((s, i) => `<section data-reveal><span class="section-number">${String(i + 1).padStart(2, '0')}</span><h2>${e(s.heading)}</h2><p>${e(s.body)}</p></section>`).join('')}${p.source_url ? `<a class="text-link" href="${e(p.source_url)}" target="_blank" rel="noopener noreferrer">View existing VERSE source ${arrow}</a>` : ''}<p>Questions? <a href="mailto:${e(store.business.email)}">${e(store.business.email)}</a></p></article></section></main>`;
}
function bagPage() {
  const entries = [...bag]
    .map(([id, q]) => ({ p: products.find((p) => p.id === id), q }))
    .filter((x) => x.p);
  const subtotal = entries.reduce((v, x) => v + x.p.price_minor * x.q, 0);
  return `<main id="main" tabindex="-1" class="page-main"><section class="section page-intro"><p class="eyebrow accent">YOUR PERSONAL EDIT</p>${heading('The bag.')}<p>${count()} ${count() === 1 ? 'timepiece' : 'timepieces'}, chosen by you.</p></section><section class="section bag-layout">${entries.length ? `<div class="bag-items">${entries.map(({ p, q }) => `<article class="bag-item" data-reveal><a href="/watches/${e(p.slug)}"><img src="${localImage(p.image)}" alt="${e(p.full_name)}" width="180" height="180"></a><div><p class="eyebrow">${e(p.brand)}</p><h2><a href="/watches/${e(p.slug)}">${e(p.name)}</a></h2><p class="model-text">${e(p.model)}</p><div class="quantity-control"><button data-quantity="${p.id}" data-change="-1" aria-label="Reduce ${e(p.name)} quantity">−</button><output>${q}</output><button data-quantity="${p.id}" data-change="1" aria-label="Increase ${e(p.name)} quantity" ${q >= 10 ? 'disabled' : ''}>+</button></div><button class="plain-link remove-item" data-remove="${p.id}">Remove</button></div><p class="price">${money(p.price_minor * q)}</p></article>`).join('')}</div><aside class="bag-summary" data-reveal><p class="eyebrow accent">THE SUMMARY</p><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="summary-line"><span>Delivery</span><span>Calculated at checkout</span></div><p>Availability is confirmed from our inventory before an order can be placed.</p>${button('Continue to checkout', '/checkout')}<a class="text-link" href="/collection">Keep exploring ${arrow}</a><a class="plain-link" href="/policies/refund">Read our refund policy</a></aside>` : `<div class="empty-state"><span class="empty-dial" aria-hidden="true"></span><h2>Your next watch is waiting.</h2><p>Your bag is empty. Take your time with the collection.</p>${button('Explore watches', '/collection')}</div>`}</section></main>`;
}
const field = (name, label, type = 'text', value = '', extra = '') =>
  `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${e(value)}" ${extra}></div>`;
const formError = '<p class="form-error" role="alert" tabindex="-1" hidden></p>';
function checkout() {
  if (!bag.size) return bagPage();
  if (!user)
    return `<main id="main" tabindex="-1" class="page-main section"><div class="empty-state"><p class="eyebrow accent">YOUR ACCOUNT</p><h1 class="display medium">One step closer.</h1><p>Sign in to keep your delivery details and order history together.</p>${button('Sign in', '/account?next=/checkout')}</div></main>`;
  const subtotal = [...bag].reduce(
    (v, [id, q]) => v + products.find((p) => p.id === id).price_minor * q,
    0,
  );
  const missing = [...bag.keys()].filter((id) => {
    const p = products.find((p) => p.id === id);
    return !p.stock_verified || p.stock < bag.get(id);
  });
  return `<main id="main" tabindex="-1" class="page-main"><section class="section page-intro"><p class="eyebrow accent">THE FINAL DETAILS</p>${heading('To your door.')}</section><section class="section checkout-layout"><form id="checkout-form" class="form-panel">${!store.checkout_ready ? '<p class="notice">Online ordering is awaiting final business and policy confirmation. You can explore the collection and contact our team.</p>' : ''}${missing.length ? '<p class="notice">Stock for your selection needs confirmation. Please ask our team before ordering.</p>' : ''}<h2>Delivery details</h2>${field('recipient_name', 'Recipient name', 'text', user.name, 'required autocomplete="name" maxlength="120"')}${field('phone', 'Phone number', 'tel', '', 'required autocomplete="tel" maxlength="30"')}${field('address', 'Street address', 'text', '', 'required autocomplete="street-address" maxlength="600"')}${field('city', 'City', 'text', '', 'required autocomplete="address-level2" maxlength="120"')}${field('postal_code', 'Postal code (optional)', 'text', '', 'autocomplete="postal-code" maxlength="20"')}<div class="field"><label for="shipping_zone_id">Delivery zone</label><select id="shipping_zone_id" name="shipping_zone_id" required>${store.zones.map((z) => `<option value="${z.id}">${e(z.name)} · ${e(z.delivery_note)}</option>`).join('')}</select></div><h2>Payment</h2><div class="field"><label for="payment_method">Payment method</label><select id="payment_method" name="payment_method"><option value="cod">Cash on delivery</option><option value="manual_transfer">Manual transfer, confirmed by staff</option></select></div><p class="form-hint" id="payment-note">No card or banking credentials are collected. Manual transfers are confirmed by VERSE before dispatch.</p><label class="checkbox-row"><input type="checkbox" name="terms_consent" required><span>I have read and accept the <a href="/policies/terms" target="_blank">terms of service</a> and <a href="/policies/refund" target="_blank">refund policy</a>.</span></label><p class="form-hint">We use these details to fulfil your order. Read our <a href="/policies/privacy">privacy policy</a>.</p>${formError}<button class="button" type="submit" ${!store.checkout_ready || missing.length ? 'disabled' : ''}>Place order ${arrow}</button></form><aside class="bag-summary"><p class="eyebrow accent">YOUR ORDER</p>${[
    ...bag,
  ]
    .map(([id, q]) => {
      const p = products.find((p) => p.id === id);
      return `<div class="summary-line"><span>${e(p.brand)} ${e(p.name)} × ${q}</span><strong>${money(p.price_minor * q)}</strong></div>`;
    })
    .join(
      '',
    )}<div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="summary-line"><span>Delivery</span><strong id="delivery-total"></strong></div><div class="summary-line"><span id="tax-label">Tax</span><strong id="tax-total"></strong></div><div class="summary-line grand-total"><span>Total</span><strong id="order-total"></strong></div><p id="delivery-note"></p><a class="text-link" href="/bag">Edit bag ${arrow}</a><a class="text-link" href="tel:${e(store.business.phone)}">Speak to VERSE ${arrow}</a></aside></section></main>`;
}
function updateCheckout() {
  const form = document.querySelector('#checkout-form');
  if (!form) return;
  const zone = store.zones.find((z) => z.id === Number(form.shipping_zone_id.value));
  const subtotal = [...bag].reduce(
    (v, [id, q]) => v + products.find((p) => p.id === id).price_minor * q,
    0,
  );
  const rate = store.business.tax_rate_bps || 0;
  const tax = store.business.tax_mode === 'exclusive' ? Math.round((subtotal * rate) / 10000) : 0;
  const included =
    store.business.tax_mode === 'inclusive' ? Math.round((subtotal * rate) / (10000 + rate)) : 0;
  const netSubtotal = subtotal - included;
  const fee =
    zone.free_over_minor !== null && netSubtotal > zone.free_over_minor ? 0 : zone.fee_minor;
  document.querySelector('#delivery-total').textContent = money(fee);
  document.querySelector('#order-total').textContent = money(fee + subtotal + tax);
  document.querySelector('#tax-label').textContent =
    store.business.tax_mode === 'inclusive'
      ? 'Tax included'
      : store.business.tax_mode === 'exempt'
        ? 'Tax (confirmed exemption)'
        : 'Tax';
  document.querySelector('#tax-total').textContent = store.business.tax_mode
    ? money(tax || included)
    : 'Awaiting confirmation';
  document.querySelector('#delivery-note').textContent = zone.delivery_note;
  const cod = form.payment_method.querySelector('[value="cod"]');
  cod.disabled = netSubtotal > zone.cod_limit_minor || (zone.advance_required && fee > 0);
  if (cod.disabled) form.payment_method.value = 'manual_transfer';
  document.querySelector('#payment-note').textContent = cod.disabled
    ? 'This order requires a manually confirmed transfer before dispatch. VERSE will provide instructions after reviewing the order.'
    : 'No card or banking credentials are collected. Manual transfers are confirmed by VERSE before dispatch.';
}

function authForms() {
  const next = new URLSearchParams(location.search).get('next') || '/account';
  return `<main id="main" tabindex="-1" class="page-main"><section class="section page-intro"><p class="eyebrow accent">YOUR VERSE</p>${heading('Good to\nsee you.')}</section><section class="section auth-layout"><div class="auth-note"><h2 class="display small">A place for<br><em>your timepieces.</em></h2><p>Track your orders, follow deliveries, and keep the essentials in one place.</p></div><div class="auth-panel"><div class="auth-tabs" role="tablist" aria-label="Account access"><button id="tab-signin" role="tab" aria-selected="true" aria-controls="signin-panel" data-auth-tab="signin">Sign in</button><button id="tab-register" role="tab" aria-selected="false" aria-controls="register-panel" data-auth-tab="register" tabindex="-1">Create account</button></div><div id="signin-panel" role="tabpanel" aria-labelledby="tab-signin"><form id="signin" data-next="${e(next)}">${field('login-email', 'Email', 'email', '', 'required autocomplete="username"')}${field('login-password', 'Password', 'password', '', 'required autocomplete="current-password" maxlength="256"')}${formError}<button class="button" type="submit">Sign in ${arrow}</button><p class="form-hint">Need help signing in? <a href="mailto:${e(store.business.email)}">Contact VERSE</a>.</p></form></div><div id="register-panel" role="tabpanel" aria-labelledby="tab-register" hidden><form id="register" data-next="${e(next)}">${field('register-name', 'Your name', 'text', '', 'required autocomplete="name" maxlength="120"')}${field('register-email', 'Email', 'email', '', 'required autocomplete="username"')}${field('register-password', 'Password', 'password', '', 'required autocomplete="new-password" minlength="12" maxlength="256" aria-describedby="password-hint"')}<p class="form-hint" id="password-hint">At least 12 characters. Password managers and paste are welcome.</p><p class="form-hint">We use your details to manage your account. Read the <a href="/policies/privacy">privacy policy</a>. No marketing subscription is added.</p>${formError}<button class="button" type="submit">Create account ${arrow}</button></form></div></div></section></main>`;
}
async function account() {
  if (!user) return authForms();
  const orders = await api('/orders');
  return `<main id="main" tabindex="-1" class="page-main"><section class="section page-intro"><p class="eyebrow accent">YOUR VERSE</p>${heading(`Hello, ${user.name.split(' ')[0]}.`)}<div class="account-tools"><p>${e(user.email)}</p><button class="plain-link" data-logout>Sign out</button>${user.role === 'admin' ? '<a class="text-link" href="/admin">Admin dashboard ' + arrow + '</a>' : ''}</div></section><section class="section"><h2 class="display small" data-reveal>Your orders.</h2>${orders.length ? orders.map(orderCard).join('') : `<div class="empty-state"><h3>Your story starts here.</h3><p>You haven’t placed an order yet.</p>${button('Discover watches', '/collection')}</div>`}</section></main>`;
}
function orderCard(o) {
  return `<article class="order-card" data-reveal><div class="order-heading"><div><p class="eyebrow">ORDER ${e(o.reference)}</p><span>${date(o.created_at)}</span></div><span class="status-pill">${e(o.status)}</span><strong>${money(o.total_minor)}</strong></div><div class="order-track" aria-label="Order progress">${['placed', 'confirmed', 'packed', 'shipped', 'delivered'].map((s) => `<span class="${['placed', 'confirmed', 'packed', 'shipped', 'delivered'].indexOf(s) <= ['placed', 'confirmed', 'packed', 'shipped', 'delivered'].indexOf(o.status) ? 'completed' : ''}">${s}</span>`).join('')}</div>${o.items.map((i) => `<div class="summary-line"><span>${e(i.product_name)} · ${e(i.model)} × ${i.quantity}</span><strong>${money(i.unit_price_minor * i.quantity)}</strong></div>`).join('')}<p>Payment recorded: ${money(o.paid_minor)}${o.refunded_minor ? ` · Refunded: ${money(o.refunded_minor)}` : ''}</p>${o.shipment ? `<p>Carrier: ${e(o.shipment.carrier)} · Tracking: ${e(o.shipment.tracking_number)}</p>` : ''}<div class="order-actions">${['placed', 'confirmed', 'packed'].includes(o.status) ? `<button class="button button-outline" data-cancel-order="${o.id}">Cancel before shipment</button>` : ''}<button class="plain-link" data-request-refund="${o.id}">Request a refund</button></div>${o.refund_requests.map((r) => `<p class="notice">Refund request: ${e(r.status)}${r.decision_note ? ` · ${e(r.decision_note)}` : ''}</p>`).join('')}</article>`;
}
function showDialog(html, cls = '') {
  document.querySelector('#site-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'site-dialog';
  dialog.className = cls;
  dialog.innerHTML = `<button class="dialog-close icon-button" data-close-dialog aria-label="Close">${icon('close')}</button>${html}`;
  document.body.append(dialog);
  dialog.showModal();
  panelMotion(dialog);
  dialog.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-close-dialog]') || ev.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}
function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${e(message)}</span><button class="plain-link" data-dismiss-toast aria-label="Dismiss notification">×</button>`;
  document.body.append(el);
  panelMotion(el);
  const timer = setTimeout(() => el.remove(), 5000);
  el.querySelector('button').onclick = () => {
    clearTimeout(timer);
    el.remove();
  };
}
function consentBanner(settings = false) {
  document.querySelector('#cookie-banner')?.remove();
  const banner = document.createElement('aside');
  banner.id = 'cookie-banner';
  banner.className = 'cookie-banner';
  banner.setAttribute('aria-labelledby', 'cookie-title');
  banner.innerHTML = `<div><p class="eyebrow accent">YOUR PRIVACY, YOUR CHOICE</p><h2 id="cookie-title">A little clarity on cookies.</h2><p>Essential cookies keep your account working. Optional, first-party analytics help us understand page visits. No advertising trackers.</p><a href="/policies/cookies">Read the cookie policy</a></div><div class="cookie-actions"><button class="button button-outline" data-consent="false">Reject optional</button><button class="button button-outline" data-consent="true">Accept analytics</button>${settings ? '<button class="plain-link" data-close-cookies>Close without changing</button>' : ''}</div>`;
  document.body.append(banner);
  panelMotion(banner);
}
async function saveConsent(value) {
  await post('/consent', { analytics: value });
  analytics = value;
  try {
    localStorage.setItem(
      'verse_preferences',
      JSON.stringify({ analytics: value, expires: Date.now() + 180 * 86400000 }),
    );
  } catch {}
  document.querySelector('#cookie-banner')?.remove();
  announce('Cookie preference saved.');
}
function announce(text) {
  document.querySelector('#announcer').textContent = text;
}
async function route(path, options = {}) {
  if (!options.initial) cancelIntro();
  const thisGeneration = ++generation;
  sceneCleanup();
  sceneCleanup = () => {};
  clearMotion();
  document.querySelector('#site-dialog')?.close();
  if (options.push !== false) history.pushState({ scroll: 0 }, '', path);
  const pathname = location.pathname;
  let html,
    title = 'VERSE — A different sense of time';
  try {
    if (pathname === '/') {
      html = home();
    } else if (pathname === '/collection') {
      html = collection();
      title = 'The collection · VERSE';
    } else if (pathname.startsWith('/watches/')) {
      html = await product(pathname.slice(9));
      title = 'Explore a timepiece · VERSE';
    } else if (pathname === '/stores') {
      html = stores();
      title = 'Visit VERSE · Dhaka';
    } else if (pathname.startsWith('/policies/')) {
      html = await policy(pathname.slice(10));
      title = 'Customer policies · VERSE';
    } else if (pathname === '/bag') {
      html = bagPage();
      title = 'Your bag · VERSE';
    } else if (pathname === '/checkout') {
      html = checkout();
      title = 'Checkout · VERSE';
    } else if (pathname === '/account') {
      html = await account();
      title = 'Your account · VERSE';
    } else if (pathname === '/admin') {
      const { renderAdmin } = await import('./admin.js');
      html = await renderAdmin(store, products, user);
      title = 'Business dashboard · VERSE';
    } else
      html = `<main id="main" tabindex="-1" class="page-main section"><div class="empty-state"><p class="eyebrow accent">404</p><h1 class="display medium">A moment lost.</h1><p>This page isn’t here.</p>${button('Back to VERSE', '/')}</div></main>`;
  } catch (err) {
    html = `<main id="main" tabindex="-1" class="page-main section"><div class="empty-state"><h1 class="display small">Let’s try that again.</h1><p>${e(err.message)}</p><button class="button" data-retry>Retry ${arrow}</button>${button('Back to the collection', '/collection', 'button-outline')}</div></main>`;
  }
  if (thisGeneration !== generation) return;
  app.innerHTML = header() + html + footer();
  const replay = document.createElement('button');
  replay.className = 'plain-link intro-replay';
  replay.innerHTML = '<span aria-hidden="true">↻</span> Replay intro';
  replay.disabled = reduced.matches || !!navigator.connection?.saveData;
  if (replay.disabled)
    replay.title = 'Intro motion is disabled by your motion or data-saving preference.';
  replay.addEventListener('click', () =>
    playIntro({ replay: true, poster: products[0] && localImage(products[0].image) }),
  );
  document.querySelector('.footer-grid > div:nth-child(2)')?.append(replay);
  const introPoster = document.querySelector('.intro-poster');
  if (introPoster && products[0]) introPoster.src = localImage(products[0].image);
  document.title = title;
  if (!options.keepScroll) scrollTo({ top: options.scroll || 0, behavior: 'instant' });
  if (pathname === '/collection') updateResults();
  if (pathname === '/checkout') updateCheckout();
  if (pathname === '/admin') {
    const { bindAdmin } = await import('./admin.js');
    bindAdmin(
      () => refreshStore().then(() => route('/admin', { push: false, keepScroll: true })),
      toast,
    );
  }
  if (options.entrance) await options.entrance;
  if (thisGeneration !== generation) return;
  pageMotion();
  if (!options.initial) document.querySelector('#main')?.focus({ preventScroll: true });
  const hash = location.hash;
  if (hash) {
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  const scene = document.querySelector('[data-scene]');
  if (scene) {
    import('./scene.js')
      .then(async ({ mountScene }) => {
        if (thisGeneration !== generation) return;
        const cleanup = await mountScene(scene, scene.dataset.scene);
        if (thisGeneration !== generation) cleanup();
        else sceneCleanup = cleanup;
      })
      .catch(() => scene.classList.add('scene-fallback'));
  }
  const routeCategory =
    pathname === '/'
      ? 'home'
      : pathname === '/collection'
        ? 'collection'
        : pathname.startsWith('/watches/')
          ? 'product'
          : pathname === '/stores'
            ? 'stores'
            : pathname.startsWith('/policies/')
              ? 'policy'
              : null;
  if (analytics && routeCategory) post('/analytics/view', { route: routeCategory }).catch(() => {});
}
async function refreshStore() {
  [store, products] = await Promise.all([api('/store'), api('/products')]);
}
function updateBagHeader() {
  const link = document.querySelector('.bag-link');
  link.querySelector('.bag-count').textContent = String(count()).padStart(2, '0');
  link.setAttribute('aria-label', `Shopping bag, ${count()} items`);
  statusMotion(link);
}
document.addEventListener('click', async (ev) => {
  const target = ev.target.closest('button,a');
  if (!target) return;
  const link = target.closest('a[href]');
  if (
    link &&
    !ev.metaKey &&
    !ev.ctrlKey &&
    !ev.shiftKey &&
    !ev.altKey &&
    !link.target &&
    link.origin === location.origin
  ) {
    ev.preventDefault();
    history.replaceState({ ...history.state, scroll: scrollY }, '', location.href);
    const url = new URL(link.href);
    if (url.pathname === location.pathname && url.hash) {
      history.pushState({}, '', url);
      document
        .getElementById(url.hash.slice(1))
        ?.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
    } else await route(url.pathname + url.search + url.hash);
    return;
  }
  try {
    if (target.hasAttribute('data-add')) {
      const id = Number(target.dataset.add),
        p = products.find((p) => p.id === id),
        q = bag.get(id) || 0;
      if (q >= 10) {
        toast('A maximum of 10 per watch can be added.');
        return;
      }
      bag.set(id, q + 1);
      checkoutKey = crypto.randomUUID();
      saveBag();
      updateBagHeader();
      toast(`${p.name} added to your bag.`);
    }
    if (target.hasAttribute('data-quantity')) {
      const id = Number(target.dataset.quantity),
        q = Math.max(0, Math.min(10, (bag.get(id) || 0) + Number(target.dataset.change)));
      if (q) bag.set(id, q);
      else bag.delete(id);
      checkoutKey = crypto.randomUUID();
      saveBag();
      await route('/bag', { push: false, keepScroll: true });
    }
    if (target.hasAttribute('data-remove')) {
      bag.delete(Number(target.dataset.remove));
      checkoutKey = crypto.randomUUID();
      saveBag();
      await route('/bag', { push: false, keepScroll: true });
      announce('Watch removed from your bag.');
    }
    if (target.hasAttribute('data-search')) {
      const d = showDialog(
        `<p class="eyebrow accent">FIND YOUR TIMEPIECE</p><h2 class="display small">What’s your style?</h2><form id="search-form"><label for="site-search">Search watches</label><div class="dialog-search"><input type="search" id="site-search" name="q" placeholder="Brand, model or style" required><button class="icon-button" aria-label="Search">${arrow}</button></div></form><p class="caption">${store.brands.map((b) => e(b.name)).join(' / ')}</p>`,
        'search-dialog',
      );
      d.querySelector('input').focus();
    }
    if (target.hasAttribute('data-menu')) {
      showDialog(
        `<nav class="mobile-navigation" aria-label="Mobile navigation"><a href="/collection">The collection ${arrow}</a><a href="/#perspective">Our perspective ${arrow}</a><a href="/stores">Visit us ${arrow}</a><a href="/account">Your account ${arrow}</a></nav>`,
        'menu-dialog',
      );
    }
    if (target.hasAttribute('data-cookies')) consentBanner(true);
    if (target.hasAttribute('data-video-pause')) {
      const film = target.parentElement.querySelector('video');
      if (film.paused) {
        film.dataset.userPaused = '';
        if (!film.src) film.src = film.dataset.lazyVideo;
        await film.play();
        film.classList.add('playing');
        target.textContent = 'Pause film';
        target.setAttribute('aria-pressed', 'false');
      } else {
        film.pause();
        film.dataset.userPaused = 'true';
        target.textContent = 'Play film';
        target.setAttribute('aria-pressed', 'true');
      }
    }
    if (target.hasAttribute('data-consent')) {
      target.disabled = true;
      try {
        await saveConsent(target.dataset.consent === 'true');
      } catch (err) {
        target.disabled = false;
        toast(err.message);
      }
    }
    if (target.hasAttribute('data-close-cookies'))
      document.querySelector('#cookie-banner')?.remove();
    if (target.hasAttribute('data-gallery')) {
      document.querySelector('#gallery-image').src = target.dataset.gallery;
      document
        .querySelectorAll('[data-gallery]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === target)));
      statusMotion(document.querySelector('#gallery-image'));
    }
    if (target.hasAttribute('data-zoom')) {
      const img = document.querySelector('#gallery-image');
      showDialog(
        `<img src="${img.src}" alt="${e(img.alt)}" width="1200" height="1200">`,
        'zoom-dialog',
      );
    }
    if (target.hasAttribute('data-reset-filters')) {
      filter = { brand: 'all', gender: 'all', q: '', sort: 'featured' };
      await route('/collection', { push: false, keepScroll: true });
    }
    if (target.hasAttribute('data-auth-tab')) {
      const mode = target.dataset.authTab;
      document.querySelectorAll('[data-auth-tab]').forEach((b) => {
        const selected = b.dataset.authTab === mode;
        b.setAttribute('aria-selected', String(selected));
        b.tabIndex = selected ? 0 : -1;
      });
      document.querySelector('#signin-panel').hidden = mode !== 'signin';
      document.querySelector('#register-panel').hidden = mode !== 'register';
      panelMotion(document.querySelector(`#${mode}-panel`));
    }
    if (target.hasAttribute('data-logout')) {
      await post('/auth/logout', {});
      await session();
      await route('/account', { push: false });
    }
    if (target.hasAttribute('data-cancel-order')) {
      const id = Number(target.dataset.cancelOrder);
      showDialog(
        `<p class="eyebrow accent">ORDER CANCELLATION</p><h2>Cancel this order?</h2><p>It has not shipped yet. Any payment already recorded requires a separate refund request.</p><div class="dialog-actions"><button class="button button-outline" data-close-dialog>Keep order</button><button class="button" data-confirm-cancel="${id}">Cancel order</button></div>`,
      );
    }
    if (target.hasAttribute('data-confirm-cancel')) {
      await post(`/orders/${Number(target.dataset.confirmCancel)}/cancel`, {});
      document.querySelector('#site-dialog')?.close();
      await route('/account', { push: false, keepScroll: true });
      toast('Order cancelled.');
    }
    if (target.hasAttribute('data-request-refund'))
      showDialog(
        `<p class="eyebrow accent">CUSTOMER CARE</p><h2>Request a refund</h2><form id="refund-form" data-order="${Number(target.dataset.requestRefund)}"><div class="field"><label for="refund-reason">Tell us what happened</label><textarea id="refund-reason" name="reason" required maxlength="1200" rows="5"></textarea></div><p class="form-hint">Include the issue and relevant delivery details. Do not include banking passwords or card numbers.</p>${formError}<button class="button">Send request ${arrow}</button></form>`,
      );
    if (target.hasAttribute('data-retry'))
      await route(location.pathname + location.search, { push: false });
    if (target.classList.contains('ribbon-pause')) {
      const track = document.querySelector('.ribbon-track'),
        paused = track.style.animationPlayState === 'paused';
      track.style.animationPlayState = paused ? 'running' : 'paused';
      target.setAttribute(
        'aria-label',
        paused ? 'Pause brand animation' : 'Resume brand animation',
      );
      target.textContent = paused ? 'Ⅱ' : '▶';
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener('keydown', (ev) => {
  if (
    ev.target.matches('[data-auth-tab]') &&
    ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(ev.key)
  ) {
    ev.preventDefault();
    const tabs = [...document.querySelectorAll('[data-auth-tab]')];
    const next = ev.target === tabs[0] ? tabs[1] : tabs[0];
    next.click();
    next.focus();
  }
});
document.addEventListener('focusin', (ev) => {
  const banner = document.querySelector('#cookie-banner');
  if (!banner || banner.contains(ev.target)) return;
  const r = ev.target.getBoundingClientRect(),
    top = banner.getBoundingClientRect().top;
  if (r.bottom > top && r.top < innerHeight)
    scrollBy({ top: r.bottom - top + 24, behavior: 'instant' });
});
document.addEventListener('input', (ev) => {
  if (ev.target.closest('#filters')) {
    const fd = new FormData(document.querySelector('#filters'));
    filter = Object.fromEntries(fd);
    updateResults();
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.closest('#checkout-form')) updateCheckout();
  if (ev.target.closest('#filters')) {
    filter = Object.fromEntries(new FormData(document.querySelector('#filters')));
    updateResults();
  }
});
document.addEventListener('submit', async (ev) => {
  const form = ev.target;
  if (
    !['signin', 'register', 'checkout-form', 'search-form', 'refund-form', 'filters'].includes(
      form.id,
    )
  )
    return;
  ev.preventDefault();
  if (form.id === 'filters') return;
  const fd = new FormData(form),
    b = Object.fromEntries(fd);
  if (form.id === 'search-form') {
    filter.q = b.q;
    document.querySelector('#site-dialog')?.close();
    await route('/collection');
    return;
  }
  const submit = form.querySelector('[type="submit"]') || form.querySelector('button'),
    error = form.querySelector('.form-error');
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  if (error) error.hidden = true;
  try {
    if (form.id === 'signin' || form.id === 'register') {
      const body =
        form.id === 'signin'
          ? { email: b['login-email'], password: b['login-password'] }
          : {
              name: b['register-name'],
              email: b['register-email'],
              password: b['register-password'],
            };
      const s = await post(`/auth/${form.id === 'signin' ? 'login' : 'register'}`, body);
      setSession(s);
      const next = form.dataset.next;
      await route(next.startsWith('/') && !next.startsWith('//') ? next : '/account');
    }
    if (form.id === 'checkout-form') {
      const order = await post('/orders', {
        ...b,
        shipping_zone_id: Number(b.shipping_zone_id),
        terms_consent: b.terms_consent === 'on',
        idempotency_key: checkoutKey,
        items: [...bag].map(([product_id, quantity]) => ({ product_id, quantity })),
      });
      bag.clear();
      checkoutKey = crypto.randomUUID();
      saveBag();
      await refreshStore();
      await route('/account');
      toast(`Order ${order.reference} received for confirmation.`);
    }
    if (form.id === 'refund-form') {
      await post(`/orders/${Number(form.dataset.order)}/refund`, { reason: b.reason });
      document.querySelector('#site-dialog')?.close();
      await route('/account', { push: false, keepScroll: true });
      toast('Your refund request is ready for review.');
    }
  } catch (err) {
    if (error) {
      error.textContent = err.message;
      error.hidden = false;
      error.focus();
    } else toast(err.message);
  } finally {
    submit.disabled = false;
    form.removeAttribute('aria-busy');
  }
});
addEventListener('popstate', () =>
  route(location.pathname + location.search + location.hash, {
    push: false,
    scroll: history.state?.scroll || 0,
  }),
);
async function init() {
  const entrance = shouldIntroduce() ? playIntro() : Promise.resolve();
  try {
    const s = await session();
    await refreshStore();
    restoreBag();
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem('verse_preferences') || 'null');
    } catch {}
    if (saved && saved.expires > Date.now()) {
      analytics = !!saved.analytics;
      if (analytics !== s.analytics_consent) await post('/consent', { analytics });
    } else {
      analytics = false;
      if (s.analytics_consent) await post('/consent', { analytics: false });
    }
    await route(location.pathname + location.search + location.hash, {
      push: false,
      initial: true,
      entrance,
    });
    if (!saved || saved.expires <= Date.now()) consentBanner();
  } catch (err) {
    cancelIntro();
    app.innerHTML = `<main id="main" class="connection-error"><span class="wordmark">VERSE</span><h1>We couldn’t load the collection.</h1><p>${e(err.message)}</p><button class="button" onclick="location.reload()">Try again</button></main>`;
    app.querySelector('button').removeAttribute('onclick');
    app.querySelector('button').onclick = () => location.reload();
  }
}
init();
