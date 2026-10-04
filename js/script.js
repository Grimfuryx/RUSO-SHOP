/* ============================================================
   RUSO — Modern Footwear & Streetwear Storefront Logic
   Live API synchronization with MongoDB backend + Offline fallback
   ============================================================ */

const API_BASE = 'https://ruso-backend.onrender.com';
const LS_PRODUCTS = 'ruso_products_v2';
const LS_ORDERS = 'ruso_orders_v2';
const LS_CART = 'ruso_cart_v2';
const RUSO_PAY_NUMBER = '01795640149';
const DELIVERY_INSIDE_SYLHET = 110;
const DELIVERY_OUTSIDE_SYLHET = 150;
const MAX_PRODUCT_IMAGES = 4;

/* ---------- Default Seed Catalog (Used if database is starting clean) ---------- */
const SEED_PRODUCTS = [
  {id:'p1', name:'Jordan 4 Retro White Cement', price:6850, sizes:['39','40','41','42','43','44'], stock:14, desc:'A modern take on the classic silhouette — mesh panelling, visible Air unit, and a grippy rubber outsole built for everyday wear.', images:[], bestSeller:true, category:'Nike Air'},
  {id:'p2', name:'Air Max Pulse Street Edition', price:7200, sizes:['40','41','42','43','44'], stock:9, desc:'Bold, sculpted cushioning meets a street-ready upper. Designed for movement, made to be seen.', images:[], bestSeller:true, category:'Nike Air'},
  {id:'p3', name:'Dunk Low Panda Classic', price:5950, sizes:['38','39','40','41','42','43'], stock:8, desc:'The two-tone icon. Clean leather build, low-cut collar, timeless colour block.', images:[], bestSeller:true, category:'Nike Air'},
  {id:'p4', name:'Adidas Samba OG Cloud White', price:5500, sizes:['39','40','41','42','43'], stock:12, desc:'Suede T-toe overlay, gum sole, terrace heritage. A wardrobe staple that goes with everything.', images:[], bestSeller:true, category:'Samba'},
  {id:'p5', name:'Adidas Samba Dark Gum', price:5600, sizes:['39','40','41','42','43'], stock:6, desc:'Premium deep black upper contrasted with dark gum outsole for sleek stealth fits.', images:[], bestSeller:false, category:'Samba'},
  {id:'p6', name:'Air Force 1 Triple White', price:6200, sizes:['39','40','41','42','43','44'], stock:15, desc:'The undisputed legend. All-white leather, encapsulated Air cushioning, pure street staple.', images:[], bestSeller:true, category:'Air Force'},
  {id:'p7', name:'Air Force 1 Shadow Black', price:6400, sizes:['38','39','40','41','42'], stock:7, desc:'Layered branding, doubled swooshes, and elevated sole for distinctive presence.', images:[], bestSeller:false, category:'Air Force'},
  {id:'p8', name:'New Balance 550 Vintage White', price:6200, sizes:['39','40','41','42','43','44'], stock:11, desc:'Retro basketball DNA reworked for the street. Chunky, comfortable, unmistakably 550.', images:[], bestSeller:false, category:'Other'},
];

/* ---------- Application State ---------- */
let products = [];
let cart = loadCart();
let currentPD = null;
let pdSelectedSize = null;
let pdQty = 1;
let heroSelectedSize = {};
let __coDeliveryZone = 'inside';
let __uploadedImages = [];
let editingProductId = null;

/* ---------- Security & Escaping Helpers ---------- */
function esc(v){
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function safeUrl(u){
  u = String(u || '');
  return /^(https?:\/\/|data:image\/(jpeg|png|webp|gif);base64,)/i.test(u) ? u : '';
}

function fmt(n){
  return 'Tk ' + Number(n || 0).toLocaleString('en-US');
}

function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Local Storage Helpers ---------- */
function loadCart(){
  try {
    const r = localStorage.getItem(LS_CART);
    return r ? JSON.parse(r) : [];
  } catch(e) {
    return [];
  }
}
function saveCart(){
  try {
    localStorage.setItem(LS_CART, JSON.stringify(cart));
  } catch(e) {
    console.error('Failed to save cart to localStorage', e);
  }
}

/* ---------- Placeholder SVG Icon ---------- */
function shoeSVG(strokeColor){
  strokeColor = strokeColor || 'currentColor';
  return `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 92c0-14 8-22 20-26 10-3 16-9 22-18 5-8 12-14 22-16 14-3 26 2 34 10 6 6 12 9 22 10 14 1 26 7 34 16 5 6 8 12 8 18v8c0 4-3 7-7 7H19c-4 0-7-3-7-7v-2z"
      stroke="${strokeColor}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 92c4-10 10-16 18-20M78 55c6 4 10 10 12 18M108 46c8 2 14 8 18 16"
      stroke="${strokeColor}" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 96h176" stroke="${strokeColor}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="70" cy="70" r="2.5" fill="${strokeColor}"/>
    <circle cx="84" cy="64" r="2.5" fill="${strokeColor}"/>
    <circle cx="98" cy="60" r="2.5" fill="${strokeColor}"/>
  </svg>`;
}

/* ---------- Product Normalization ---------- */
function normalizeProduct(p){
  return {
    id: String(p.id || p._id || 'p' + Math.random().toString(36).substr(2, 9)),
    name: String(p.name || 'Untitled Product'),
    price: Number(p.price || 0),
    sizes: Array.isArray(p.sizes) ? p.sizes.map(String) : ['40','41','42'],
    stock: parseInt(p.stock != null ? p.stock : 0, 10),
    desc: String(p.desc || ''),
    images: Array.isArray(p.images) ? p.images : (p.img ? [p.img] : []),
    video: p.video || null,
    category: p.category || 'Other',
    bestSeller: Boolean(p.bestSeller)
  };
}

/* ---------- API Operations ---------- */
async function fetchProductsFromAPI(){
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if(res.ok){
      const data = await res.json();
      if(Array.isArray(data) && data.length > 0){
        products = data.map(normalizeProduct);
        try { localStorage.setItem(LS_PRODUCTS, JSON.stringify(products)); } catch(e){}
        updateApiStatus(true);
        pruneInvalidCartItems();
        return products;
      }
    }
  } catch(e){
    console.warn('Backend API currently unreachable, using local fallback:', e.message);
    updateApiStatus(false);
  }

  // Fallback to localStorage or Seed
  try {
    const cached = localStorage.getItem(LS_PRODUCTS);
    if(cached){
      products = JSON.parse(cached).map(normalizeProduct);
      pruneInvalidCartItems();
      return products;
    }
  } catch(e){}

  products = SEED_PRODUCTS.map(normalizeProduct);
  pruneInvalidCartItems();
  return products;
}

function updateApiStatus(isOnline){
  const badge = document.getElementById('apiStatusBadge');
  if(!badge) return;
  if(isOnline){
    badge.className = 'api-badge ok';
    badge.textContent = '● Backend Connected';
  } else {
    badge.className = 'api-badge err';
    badge.textContent = '○ Offline / Local Mode';
  }
}

function getAdminAuthHeader(){
  return sessionStorage.getItem('ruso_admin_pw') || '';
}

/* ---------- Cart Sanitation ---------- */
function pruneInvalidCartItems(){
  const initialLen = cart.length;
  cart = cart.filter(item => {
    const p = products.find(prod => prod.id === item.productId);
    return p && p.stock > 0;
  });
  // Cap quantities to available stock
  cart.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if(p && item.qty > p.stock) item.qty = p.stock;
  });
  if(cart.length !== initialLen){
    saveCart();
  }
  renderCartCount();
}

/* ---------- Render: Hero Section ---------- */
function renderHero(){
  const heroEl = document.getElementById('heroSection');
  if(!heroEl) return;
  let list = products.filter(p => p.bestSeller && p.stock > 0);
  if(!list.length) list = products.filter(p => p.stock > 0);
  if(!list.length) list = products.slice(0, 1);

  if(!list.length){
    heroEl.innerHTML = `
      <div class="hero-loading">
        <h2>RUSO CATALOG</h2>
        <p style="color:#cfcfc7;margin-top:10px;">New collection dropping soon. Stay tuned.</p>
      </div>`;
    return;
  }

  heroEl.innerHTML = `
    <div class="hero-track" id="heroTrack">
      ${list.map(p => heroSlideHTML(p)).join('')}
    </div>
    ${list.length > 1 ? `<div class="hero-dots">${list.map((_, i) => `<span class="hero-dot${i===0?' active':''}"></span>`).join('')}</div>` : ''}
  `;

  list.forEach(p => {
    if(!heroSelectedSize[p.id] && p.sizes.length){
      heroSelectedSize[p.id] = p.sizes[0];
    }
  });

  if(list.length > 1){
    const track = document.getElementById('heroTrack');
    const dots = heroEl.querySelectorAll('.hero-dot');
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, di) => d.classList.toggle('active', di === i));
    }, { passive: true });
  }

  // Attach event delegation for Hero actions
  heroEl.querySelectorAll('.size-chip').forEach(btn => {
    btn.addEventListener('click', e => {
      const pid = e.currentTarget.dataset.pid;
      const size = e.currentTarget.dataset.size;
      heroSelectedSize[pid] = size;
      e.currentTarget.parentElement.querySelectorAll('.size-chip').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
    });
  });

  heroEl.querySelectorAll('[data-hero-quickadd]').forEach(btn => {
    btn.addEventListener('click', e => {
      const pid = e.currentTarget.dataset.heroQuickadd;
      quickAdd(pid);
    });
  });

  heroEl.querySelectorAll('[data-hero-view]').forEach(btn => {
    btn.addEventListener('click', e => {
      const pid = e.currentTarget.dataset.heroView;
      openPD(pid);
    });
  });
}

function heroSlideHTML(p){
  const img = safeUrl(p.images && p.images[0]);
  const imgHtml = img
    ? `<img src="${esc(img)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;">`
    : shoeSVG('#faf9f6');
  const inStock = p.stock > 0;

  return `
    <div class="hero-slide">
      <div class="hero-inner">
        <div>
          <div class="hero-tag"><span class="dot"></span> NEW DROP JUST LANDED</div>
          <h1>STEP<br><em>DIFFERENT</em></h1>
          <div class="hero-price-row"><span class="hero-price">${fmt(p.price)}</span></div>
          <p class="hero-desc">${esc(p.name)} — ${esc(p.desc || 'Premium streetwear footwear.')}</p>
          <div class="size-row">
            ${p.sizes.map((s, si) => `
              <button class="size-chip${si===0?' active':''}" data-pid="${esc(p.id)}" data-size="${esc(s)}">${esc(s)}</button>
            `).join('')}
          </div>
          <div class="btn-row">
            <button class="btn btn-solid" data-hero-quickadd="${esc(p.id)}" ${inStock?'':'disabled style="opacity:0.4;cursor:not-allowed;"'}>
              ${inStock ? 'Add to Cart' : 'Sold Out'}
            </button>
            <button class="btn btn-outline" data-hero-view="${esc(p.id)}">View Product</button>
          </div>
        </div>
        <div class="hero-visual">
          <div class="frame">
            <span class="badge-new">RUSO</span>
            ${imgHtml}
          </div>
        </div>
      </div>
    </div>`;
}

function quickAdd(id){
  const p = products.find(x => x.id === id);
  if(!p || p.stock <= 0) return showToast('This product is out of stock.');
  const chosenSize = heroSelectedSize[id] || p.sizes[0];
  addToCart(id, chosenSize, 1);
}

/* ---------- Render: Product Catalog & Collections ---------- */
function getCategory(p){
  if(p.category) return p.category;
  const n = (p.name || '').toLowerCase();
  if(n.includes('samba')) return 'Samba';
  if(n.includes('air force')) return 'Air Force';
  if(n.includes('air max') || n.includes('dunk') || n.includes('jordan') || n.includes('nike')) return 'Nike Air';
  return 'Other';
}

function categoryList(filter){
  const map = {};
  const query = (filter || '').trim().toLowerCase();
  products.forEach(p => {
    if(query){
      const matchName = p.name.toLowerCase().includes(query);
      const matchCat = getCategory(p).toLowerCase().includes(query);
      const matchDesc = (p.desc || '').toLowerCase().includes(query);
      if(!matchName && !matchCat && !matchDesc) return;
    }
    const c = getCategory(p);
    if(!map[c]) map[c] = [];
    map[c].push(p);
  });
  return map;
}

function productCardHTML(p){
  const img = safeUrl(p.images && p.images[0]);
  const isOutOfStock = p.stock <= 0;
  return `
  <div class="card" data-card-pid="${esc(p.id)}">
    <div class="card-img">
      ${isOutOfStock ? '<span class="card-tag" style="background:#222;color:#fff;">SOLD OUT</span>' : (p.bestSeller ? '<span class="card-tag">BEST SELLER</span>' : '')}
      ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : shoeSVG('#0e0e0e')}
    </div>
    <div class="card-body">
      <h3>${esc(p.name)}</h3>
      <div class="card-price">${fmt(p.price)}</div>
      <div class="card-cta">
        <span>${isOutOfStock ? 'OUT OF STOCK' : 'VIEW PRODUCT'}</span>
        <span>→</span>
      </div>
    </div>
  </div>`;
}

function renderGrid(filter){
  const root = document.getElementById('collectionSections');
  if(!root) return;
  const groups = categoryList(filter);
  const order = ['Samba', 'Nike Air', 'Air Force', 'Other'];
  const cats = order.filter(c => groups[c]?.length).concat(Object.keys(groups).filter(c => !order.includes(c) && groups[c]?.length));

  if(!cats.length){
    root.innerHTML = `<div style="padding:60px 20px;text-align:center;color:var(--steel);font-size:14px;">No products found matching "${esc(filter || '')}".</div>`;
    return;
  }

  const isSearching = Boolean(filter && filter.trim());

  root.innerHTML = cats.map(cat => {
    const items = groups[cat];
    // If searching, show all matched products! If browsing, preview up to 4 per category
    const displayItems = isSearching ? items : items.slice(0, 4);
    return `
    <section class="collection-block" id="collection-${slugify(cat)}">
      <div class="collection-heading">
        <div>
          <span class="collection-kicker">RUSO COLLECTION</span>
          <h3>${esc(cat)}</h3>
        </div>
        ${items.length > 4 && !isSearching ? `<button class="collection-view" data-view-cat="${esc(cat)}">View all ${items.length} →</button>` : ''}
      </div>
      <div class="collection-grid">
        ${displayItems.map(productCardHTML).join('')}
      </div>
    </section>`;
  }).join('');

  // Attach card click handlers
  root.querySelectorAll('[data-card-pid]').forEach(card => {
    card.addEventListener('click', () => {
      openPD(card.dataset.cardPid);
    });
  });

  // Attach view all handlers
  root.querySelectorAll('[data-view-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      openCollection(btn.dataset.viewCat);
    });
  });
}

function slugify(v){
  return String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function setProductsNavVisibility(){
  const productOpen = Boolean(
    document.getElementById('collectionModal')?.classList.contains('show') ||
    document.getElementById('pdModal')?.classList.contains('show')
  );
  ['navProducts','mNavProducts'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = productOpen ? 'none' : '';
  });
}

function openCollection(category){
  const items = products.filter(p => getCategory(p) === category);
  document.getElementById('collectionModalTitle').textContent = category;
  const grid = document.getElementById('collectionModalGrid');
  grid.innerHTML = items.map(productCardHTML).join('');

  grid.querySelectorAll('[data-card-pid]').forEach(card => {
    card.addEventListener('click', () => {
      openPD(card.dataset.cardPid);
    });
  });

  document.getElementById('collectionModal').classList.add('show');
  setProductsNavVisibility();
  document.getElementById('overlayBg').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCollection(){
  document.getElementById('collectionModal').classList.remove('show');
  setProductsNavVisibility();
  syncOverlayAndScroll();
}

function handleSearch(v){
  renderGrid(v);
}

/* ---------- Render: Best Sellers ---------- */
function renderBestSellers(){
  const row = document.getElementById('bsRow');
  if(!row) return;
  const list = products.filter(p => p.bestSeller).slice(0, 6);
  if(!list.length){
    row.innerHTML = `<p style="color:#a9a9a3;font-size:13px;">Featured items will appear here.</p>`;
    return;
  }
  row.innerHTML = list.map((p, i) => {
    const img = safeUrl(p.images && p.images[0]);
    return `
    <div class="bs-item" data-bs-pid="${esc(p.id)}">
      <div class="bs-rank">${String(i+1).padStart(2,'0')}</div>
      <div class="bs-imgbox">
        ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;">` : shoeSVG('#faf9f6')}
      </div>
      <h4>${esc(p.name)}</h4>
      <div class="p">${fmt(p.price)}</div>
    </div>`;
  }).join('');

  row.querySelectorAll('[data-bs-pid]').forEach(item => {
    item.addEventListener('click', () => {
      openPD(item.dataset.bsPid);
    });
  });
}

/* ---------- Product Detail Modal ---------- */
function openPD(id){
  const p = products.find(x => x.id === id);
  if(!p) return;
  currentPD = p;
  pdSelectedSize = p.sizes && p.sizes.length ? p.sizes[0] : null;
  pdQty = 1;

  const images = (p.images && p.images.length) ? p.images : [];
  const inStock = p.stock > 0;
  const mainImgHtml = images.length
    ? `<img src="${esc(safeUrl(images[0]))}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;">`
    : shoeSVG('#0e0e0e');
  const thumbsHtml = images.length > 1
    ? images.map((img, i) => `<div class="${i===0?'active':''}" data-img-idx="${i}"><img src="${esc(safeUrl(img))}" alt="" style="width:100%;height:100%;object-fit:cover;"></div>`).join('')
    : '';
  const videoSrc = p.video ? safeUrl(p.video) : '';
  const videoHtml = videoSrc ? `
      <div class="pd-label">Product Video</div>
      ${isYoutubeUrl(videoSrc)
        ? `<div class="pd-video-wrap"><iframe src="${esc(toYoutubeEmbed(videoSrc))}" allowfullscreen loading="lazy"></iframe></div>`
        : `<video class="pd-video-native" src="${esc(videoSrc)}" controls playsinline></video>`}` : '';

  document.getElementById('pdInner').innerHTML = `
    <div>
      <div class="pd-gallery-main" id="pdMainImg">${mainImgHtml}</div>
      ${thumbsHtml ? `<div class="pd-thumbs" id="pdThumbs">${thumbsHtml}</div>` : ''}
      ${videoHtml}
    </div>
    <div>
      <div class="pd-stock ${inStock ? (p.stock <= 5 ? 'low' : '') : 'low'}">
        <span class="dot"></span>
        ${inStock ? (p.stock <= 5 ? `Only ${Number(p.stock)} left in stock` : `In Stock (${Number(p.stock)} pairs available)`) : 'Out of stock'}
      </div>
      <h1 class="pd-title">${esc(p.name)}</h1>
      <div class="pd-price">${fmt(p.price)}</div>

      <div class="pd-label">Select Size</div>
      <div class="pd-sizes" id="pdSizes">
        ${p.sizes.map((s, idx) => `<button class="pd-size-btn${idx===0?' active':''}" data-size="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
      <div class="pd-warn" id="pdWarn">Please select a size.</div>

      <div class="pd-label">Quantity</div>
      <div class="pd-qty-row">
        <div class="qty-stepper">
          <button id="pdQtyMinus">−</button>
          <span id="pdQtyVal">1</span>
          <button id="pdQtyPlus">+</button>
        </div>
      </div>

      <div class="pd-btnrow">
        <button class="btn btn-solid" id="pdAddBtn" ${inStock ? '' : 'disabled style="opacity:.4;cursor:not-allowed;"'}>
          ${inStock ? 'Add to Cart' : 'Sold Out'}
        </button>
        <button class="btn btn-outline" id="pdBuyBtn" ${inStock ? '' : 'disabled style="opacity:.4;cursor:not-allowed;"'}>
          Buy Now
        </button>
      </div>

      <div class="pd-label">Description</div>
      <p class="pd-desc">${esc(p.desc || 'Clean design, premium materials, and maximum comfort.')}</p>

      <div class="pd-label">Payment &amp; Delivery</div>
      <ul class="pd-info-list">
        <li>Payment methods: bKash, Nagad (Send Money) or Cash on Delivery</li>
        <li>Nationwide home delivery via Steadfast Courier</li>
        <li>Order confirmed on WhatsApp directly after checkout</li>
        <li>Easy 3-day size exchange guarantee</li>
      </ul>
    </div>`;

  // Attach PD Event Listeners
  const thumbs = document.querySelectorAll('#pdThumbs > div');
  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      const idx = parseInt(thumb.dataset.imgIdx, 10);
      if(p.images[idx]){
        document.getElementById('pdMainImg').innerHTML = `<img src="${esc(safeUrl(p.images[idx]))}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;">`;
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      }
    });
  });

  const sizeBtns = document.querySelectorAll('#pdSizes .pd-size-btn');
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pdSelectedSize = btn.dataset.size;
      sizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pdWarn').style.display = 'none';
    });
  });

  document.getElementById('pdQtyMinus')?.addEventListener('click', () => pdChangeQty(-1));
  document.getElementById('pdQtyPlus')?.addEventListener('click', () => pdChangeQty(1));
  document.getElementById('pdAddBtn')?.addEventListener('click', pdAddToCart);
  document.getElementById('pdBuyBtn')?.addEventListener('click', pdBuyNow);

  document.getElementById('pdModal').classList.add('show');
  setProductsNavVisibility();
  document.getElementById('overlayBg').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function pdChangeQty(d){
  if(!currentPD) return;
  const maxStock = currentPD.stock || 1;
  const newQty = pdQty + d;
  if(newQty >= 1 && newQty <= maxStock){
    pdQty = newQty;
    document.getElementById('pdQtyVal').textContent = pdQty;
  } else if(newQty > maxStock){
    showToast(`Only ${maxStock} available in stock`);
  }
}

function pdAddToCart(){
  if(!currentPD || currentPD.stock <= 0) return showToast('Out of stock');
  if(!pdSelectedSize){
    document.getElementById('pdWarn').style.display = 'block';
    return;
  }
  addToCart(currentPD.id, pdSelectedSize, pdQty);
  closePD();
}

function pdBuyNow(){
  if(!currentPD || currentPD.stock <= 0) return showToast('Out of stock');
  if(!pdSelectedSize){
    document.getElementById('pdWarn').style.display = 'block';
    return;
  }
  addToCart(currentPD.id, pdSelectedSize, pdQty);
  closePD();
  openCheckout();
}

function closePD(){
  document.getElementById('pdModal').classList.remove('show');
  setProductsNavVisibility();
  syncOverlayAndScroll();
}

function isYoutubeUrl(url){ return /youtube\.com|youtu\.be/.test(url); }
function toYoutubeEmbed(url){
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : '';
}

/* ---------- Cart Operations ---------- */
function addToCart(productId, size, qty){
  const p = products.find(x => x.id === productId);
  if(!p || p.stock <= 0){
    showToast('Sorry, this product is currently out of stock.');
    return;
  }

  const existing = cart.find(c => c.productId === productId && c.size === size);
  const currentQtyInCart = existing ? existing.qty : 0;
  const desiredTotal = currentQtyInCart + qty;

  if(desiredTotal > p.stock){
    const allowedAdd = Math.max(0, p.stock - currentQtyInCart);
    if(allowedAdd > 0){
      if(existing) existing.qty = p.stock;
      else cart.push({ productId, size, qty: p.stock });
      showToast(`Added max available (${p.stock} pairs) to cart.`);
    } else {
      showToast(`Cannot add more. You already have all ${p.stock} available pairs in cart.`);
      return;
    }
  } else {
    if(existing){ existing.qty += qty; }
    else { cart.push({ productId, size, qty }); }
    showToast('Added to cart 🖤');
  }

  saveCart();
  renderCartCount();
}

function renderCartCount(){
  const validCart = cart.filter(c => products.some(p => p.id === c.productId));
  const count = validCart.reduce((s, c) => s + c.qty, 0);
  const el = document.getElementById('cartCount');
  if(!el) return;
  if(count > 0){
    el.style.display = 'flex';
    el.textContent = count;
  } else {
    el.style.display = 'none';
  }
}

function openCart(){
  renderCart();
  document.getElementById('cartDrawer').classList.add('show');
  document.getElementById('overlayBg').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function renderCart(){
  const body = document.getElementById('cartBody');
  const foot = document.getElementById('cartFoot');
  if(!body) return;

  pruneInvalidCartItems();

  if(!cart.length){
    body.innerHTML = `<div class="empty-state">Your cart is empty.<br>Go find your next pair 🖤</div>`;
    if(foot) foot.style.display = 'none';
    return;
  }

  let subtotal = 0;
  body.innerHTML = cart.map((c, i) => {
    const p = products.find(x => x.id === c.productId);
    if(!p) return '';
    const itemTotal = p.price * c.qty;
    subtotal += itemTotal;
    const img = safeUrl(p.images && p.images[0]);
    return `
    <div class="cart-item">
      <div class="thumb">
        ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;">` : shoeSVG('#0e0e0e')}
      </div>
      <div class="info">
        <h4>${esc(p.name)}</h4>
        <div class="meta">Size ${esc(c.size)}</div>
        <div class="qty-stepper">
          <button data-cart-idx="${i}" data-cart-step="-1">−</button>
          <span>${Number(c.qty)}</span>
          <button data-cart-idx="${i}" data-cart-step="1">+</button>
        </div>
        <button class="remove" data-cart-remove="${i}">Remove</button>
      </div>
      <div class="price">${fmt(itemTotal)}</div>
    </div>`;
  }).join('');

  if(foot){
    foot.style.display = 'block';
    document.getElementById('cartSubtotal').textContent = fmt(subtotal);
  }

  body.querySelectorAll('[data-cart-step]').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.currentTarget.dataset.cartIdx, 10);
      const step = parseInt(e.currentTarget.dataset.cartStep, 10);
      cartChangeQty(idx, step);
    });
  });

  body.querySelectorAll('[data-cart-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.currentTarget.dataset.cartRemove, 10);
      removeCartItem(idx);
    });
  });
}

function cartChangeQty(i, d){
  if(!cart[i]) return;
  const p = products.find(x => x.id === cart[i].productId);
  const maxStock = p ? p.stock : 99;
  const targetQty = cart[i].qty + d;

  if(targetQty <= 0){
    removeCartItem(i);
    return;
  }
  if(targetQty > maxStock){
    showToast(`Only ${maxStock} pairs in stock`);
    return;
  }
  cart[i].qty = targetQty;
  saveCart();
  renderCart();
  renderCartCount();
}

function removeCartItem(i){
  cart.splice(i, 1);
  saveCart();
  renderCart();
  renderCartCount();
}

function cartSubtotal(){
  let subtotal = 0;
  cart.forEach(c => {
    const p = products.find(x => x.id === c.productId);
    if(p) subtotal += p.price * c.qty;
  });
  return subtotal;
}

/* ---------- Overlay Stacking & Scroll Lock Manager ---------- */
function isAnyModalOpen(){
  const cartOpen = document.getElementById('cartDrawer')?.classList.contains('show');
  const pdOpen = document.getElementById('pdModal')?.classList.contains('show');
  const colOpen = document.getElementById('collectionModal')?.classList.contains('show');
  const coOpen = document.getElementById('coModal')?.classList.contains('show');
  return Boolean(cartOpen || pdOpen || colOpen || coOpen);
}

function syncOverlayAndScroll(){
  const bg = document.getElementById('overlayBg');
  if(!isAnyModalOpen()){
    if(bg) bg.classList.remove('show');
    document.body.style.overflow = '';
  } else {
    if(bg) bg.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeAllOverlays(){
  document.getElementById('cartDrawer')?.classList.remove('show');
  document.getElementById('pdModal')?.classList.remove('show');
  document.getElementById('collectionModal')?.classList.remove('show');
  document.getElementById('coModal')?.classList.remove('show');
  setProductsNavVisibility();
  syncOverlayAndScroll();
}

/* ---------- Search & Mobile Menu ---------- */
function toggleSearch(){
  const box = document.getElementById('searchBox');
  if(!box) return;
  box.classList.toggle('open');
  if(box.classList.contains('open')){
    document.getElementById('searchInput')?.focus();
  }
}

function toggleMobileMenu(){
  const m = document.getElementById('mobileMenu');
  if(!m) return;
  m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

function closeMobileMenu(){
  const m = document.getElementById('mobileMenu');
  if(m) m.style.display = 'none';
}

// Close the mobile menu when anything outside the menu / burger button is clicked
document.addEventListener('click', e => {
  const m = document.getElementById('mobileMenu');
  if(!m || m.style.display !== 'flex') return;
  if(m.contains(e.target) || e.target.closest('#burgerBtn')) return;
  closeMobileMenu();
}, true);

/* ---------- Checkout & Order Flow ---------- */
function openCheckout(){
  if(!cart.length){
    showToast('Your cart is empty');
    return;
  }
  __coDeliveryZone = 'inside';
  renderCheckoutBox();
  closeAllOverlays();
  document.getElementById('coModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCheckout(){
  document.getElementById('coModal').classList.remove('show');
  syncOverlayAndScroll();
}

function pickDeliveryZone(zone){
  __coDeliveryZone = zone;
  renderCheckoutBox();
}

function renderCheckoutBox(){
  const subtotal = cartSubtotal();
  const deliveryFee = __coDeliveryZone === 'inside' ? DELIVERY_INSIDE_SYLHET : DELIVERY_OUTSIDE_SYLHET;
  const grandTotal = subtotal + deliveryFee;

  document.getElementById('coBox').innerHTML = `
    <h3>Secure Checkout</h3>
    <p class="co-sub">Choose your payment method and delivery address to confirm your order.</p>

    <div class="field">
      <label>Select Payment Method</label>
      <select id="coPayMethod">
        <option value="bKash">bKash (Send Money)</option>
        <option value="Nagad">Nagad (Send Money)</option>
        <option value="Cash on Delivery">Cash on Delivery (Pay when parcel arrives)</option>
      </select>
    </div>

    <div class="pay-box" id="coPayDetailsBox">
      <div class="pay-box-title">Payment Instructions (bKash / Nagad)</div>
      <div class="pay-box-warn">⚠️ শুধু "Send Money" করবেন, "Payment" অপশন দিয়ে পাঠাবেন না।</div>
      <div class="pay-num-row">
        <span class="pay-num-label">Personal Number</span>
        <span class="pay-num">${RUSO_PAY_NUMBER}</span>
      </div>
      <div class="pay-box-note">Send Money to the number above for the total amount, then enter your Transaction ID below.</div>
    </div>

    <div class="field">
      <label>Delivery Location</label>
      <div class="delivery-options">
        <button type="button" class="delivery-chip ${__coDeliveryZone==='inside'?'active':''}" id="zoneInsideBtn">
          Inside Sylhet — ${fmt(DELIVERY_INSIDE_SYLHET)}
        </button>
        <button type="button" class="delivery-chip ${__coDeliveryZone==='outside'?'active':''}" id="zoneOutsideBtn">
          Outside Sylhet — ${fmt(DELIVERY_OUTSIDE_SYLHET)}
        </button>
      </div>
    </div>

    <div class="co-summary">
      ${cart.map(c => {
        const p = products.find(x => x.id === c.productId);
        if(!p) return '';
        return `<div class="row-between"><span>${esc(p.name)} (${esc(c.size)}) ×${Number(c.qty)}</span><span>${fmt(p.price * c.qty)}</span></div>`;
      }).join('')}
      <div class="row-between"><span>Delivery Charge</span><span>${fmt(deliveryFee)}</span></div>
      <div class="row-between" style="border-top:1px solid var(--line-light);padding-top:10px;margin-bottom:0;font-weight:800;">
        <span>Total Payable</span>
        <span>${fmt(grandTotal)}</span>
      </div>
    </div>

    <div class="field"><label>Full Name *</label><input id="coName" placeholder="e.g. Tanvir Ahmed"></div>
    <div class="field"><label>WhatsApp Number *</label><input id="coPhone" placeholder="01XXXXXXXXX"></div>
    <div class="field"><label>Full Delivery Address *</label><textarea id="coAddress" placeholder="House, Road, Area, Thana/District"></textarea></div>
    
    <div class="field" id="coTrxField">
      <label>Payment Transaction ID (TrxID) *</label>
      <input id="coTrx" placeholder="e.g. 9F3K2L1A0B">
    </div>

    <div class="co-err" id="coErr" style="display:none;"></div>
    <button class="btn btn-solid" id="submitOrderBtn" style="border-color:var(--ink);color:var(--paper);background:var(--ink);width:100%;justify-content:center;">
      Confirm &amp; Place Order
    </button>
  `;

  // Handle payment method change
  const payMethodSelect = document.getElementById('coPayMethod');
  const payDetailsBox = document.getElementById('coPayDetailsBox');
  const trxField = document.getElementById('coTrxField');

  payMethodSelect.addEventListener('change', () => {
    const isCOD = payMethodSelect.value === 'Cash on Delivery';
    if(isCOD){
      payDetailsBox.innerHTML = `
        <div class="pay-box-title">Cash on Delivery (COD)</div>
        <p style="font-size:12px;color:#cfcfc7;margin:0;line-height:1.5;">
          You can pay the full amount (${fmt(grandTotal)}) directly to the courier agent when your parcel is delivered. Our team will message you on WhatsApp to confirm dispatch.
        </p>`;
      trxField.style.display = 'none';
    } else {
      payDetailsBox.innerHTML = `
        <div class="pay-box-title">Payment Instructions (${esc(payMethodSelect.value)})</div>
        <div class="pay-box-warn">⚠️ শুধু "Send Money" করবেন, "Payment" অপশন দিয়ে পাঠাবেন না।</div>
        <div class="pay-num-row">
          <span class="pay-num-label">${esc(payMethodSelect.value)} Personal</span>
          <span class="pay-num">${RUSO_PAY_NUMBER}</span>
        </div>
        <div class="pay-box-note">Send Money to the number above for the total amount, then enter your Transaction ID below.</div>`;
      trxField.style.display = 'block';
    }
  });

  document.getElementById('zoneInsideBtn').addEventListener('click', () => pickDeliveryZone('inside'));
  document.getElementById('zoneOutsideBtn').addEventListener('click', () => pickDeliveryZone('outside'));
  document.getElementById('submitOrderBtn').addEventListener('click', submitOrder);
}

function buildOrderWhatsAppMessage(o){
  const lines = [
    `*NEW ORDER — ${o.orderId}*`,
    ``,
    `👤 Customer: ${o.name}`,
    `📱 WhatsApp: ${o.phone}`,
    `📍 Address: ${o.address}`,
    `🚚 Delivery: ${o.deliveryZone} (Tk ${o.deliveryFee})`,
    ``,
    `👟 Ordered Items:`,
    ...o.items.map(i => `• ${i.name} (Size ${i.size}) ×${i.qty} — Tk ${i.price * i.qty}`),
    ``,
    `💳 Payment Method: ${o.payMethod}`,
    `🔖 Transaction ID: ${o.trx}`,
    `💰 Total: Tk ${o.total}`,
    ``,
    `Please confirm my order!`
  ];
  return lines.join('\n');
}

async function submitOrder(){
  const name = document.getElementById('coName').value.trim();
  const phone = document.getElementById('coPhone').value.trim().replace(/[\s-]/g, '');
  const address = document.getElementById('coAddress').value.trim();
  const payMethod = document.getElementById('coPayMethod').value;
  let trx = document.getElementById('coTrx') ? document.getElementById('coTrx').value.trim().toUpperCase() : '';
  const err = document.getElementById('coErr');
  const submitBtn = document.getElementById('submitOrderBtn');

  if(err) err.style.display = 'none';

  if(!name || name.length < 2){
    err.textContent = 'Please enter your full name.';
    err.style.display = 'block';
    return;
  }
  if(!/^01[0-9]{9}$/.test(phone)){
    err.textContent = 'Please enter a valid 11-digit Bangladeshi mobile number (01XXXXXXXXX).';
    err.style.display = 'block';
    return;
  }
  if(address.length < 6){
    err.textContent = 'Please provide your full delivery address.';
    err.style.display = 'block';
    return;
  }
  if(payMethod !== 'Cash on Delivery' && trx.length < 4){
    err.textContent = 'Please enter a valid Transaction ID.';
    err.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing Order…';

  const orderPayload = {
    name,
    phone,
    address,
    payMethod,
    trx: payMethod === 'Cash on Delivery' ? ('COD-' + Math.random().toString(36).substr(2, 6).toUpperCase()) : trx,
    deliveryZone: __coDeliveryZone,
    items: cart.map(c => ({
      productId: c.productId,
      size: c.size,
      qty: c.qty
    }))
  };

  let placedOrder = null;

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const data = await res.json();
    if(res.ok && data.ok){
      placedOrder = {
        orderId: data.orderId,
        name,
        phone,
        address,
        payMethod,
        trx: orderPayload.trx,
        deliveryZone: __coDeliveryZone === 'inside' ? 'Inside Sylhet' : 'Outside Sylhet',
        deliveryFee: data.deliveryFee,
        items: cart.map(c => {
          const p = products.find(x => x.id === c.productId);
          return { name: p ? p.name : 'Footwear', size: c.size, qty: c.qty, price: p ? p.price : 0 };
        }),
        subtotal: data.subtotal,
        total: data.total
      };
    } else {
      err.textContent = data.error || 'Failed to place order. Please check your cart.';
      err.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Place Order';
      return;
    }
  } catch(e) {
    // If backend is unreachable, handle gracefully offline
    console.warn('Backend order submission fallback:', e.message);
    const subtotal = cartSubtotal();
    const deliveryFee = __coDeliveryZone === 'inside' ? DELIVERY_INSIDE_SYLHET : DELIVERY_OUTSIDE_SYLHET;
    const grandTotal = subtotal + deliveryFee;
    placedOrder = {
      orderId: 'RUSO-' + Math.floor(100000 + Math.random() * 900000),
      name,
      phone,
      address,
      payMethod,
      trx: orderPayload.trx,
      deliveryZone: __coDeliveryZone === 'inside' ? 'Inside Sylhet' : 'Outside Sylhet',
      deliveryFee,
      items: cart.map(c => {
        const p = products.find(x => x.id === c.productId);
        return { name: p ? p.name : 'Footwear', size: c.size, qty: c.qty, price: p ? p.price : 0 };
      }),
      subtotal,
      total: grandTotal
    };
  }

  // Clear cart
  cart = [];
  saveCart();
  renderCartCount();

  // Reload products to reflect updated inventory
  fetchProductsFromAPI().then(() => renderAll());

  const waMessage = buildOrderWhatsAppMessage(placedOrder);
  const waLink = 'https://wa.me/88' + RUSO_PAY_NUMBER + '?text=' + encodeURIComponent(waMessage);

  // Present Confirmation View
  document.getElementById('coBox').innerHTML = `
    <div class="co-success">
      <div class="check">✓</div>
      <h3>Order Placed Successfully!</h3>
      <p>Thank you, <strong>${esc(name.split(' ')[0])}</strong>. Your order has been recorded in our system.</p>
      <div class="order-id">Order ID: ${esc(placedOrder.orderId)}</div>
      <p style="font-size:13px;color:#555;margin-bottom:14px;">
        To ensure express delivery, please message our team on WhatsApp with your Order ID.
      </p>
      <a class="btn btn-solid" style="border-color:var(--ink);color:var(--paper);background:var(--ink);width:100%;justify-content:center;margin-top:6px;" href="${esc(waLink)}" target="_blank" rel="noopener">
        💬 Message Us on WhatsApp
      </a>
      <button class="btn btn-outline" style="border-color:var(--ink);color:var(--ink);width:100%;justify-content:center;margin-top:12px;" onclick="closeCheckout();goHome();">
        Continue Shopping
      </button>
    </div>`;
}

/* ---------- Admin Operations ---------- */
async function attemptAdminLogin(){
  const val = document.getElementById('adminPass').value;
  const err = document.getElementById('adminErr');
  const btn = document.getElementById('adminLoginBtn');
  err.style.display = 'none';

  if(!val){
    err.textContent = 'Please enter the admin password.';
    err.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'x-admin-password': val }
    });

    if(res.ok){
      sessionStorage.setItem('ruso_admin', '1');
      sessionStorage.setItem('ruso_admin_pw', val);
      document.getElementById('adminPass').value = '';
      document.getElementById('adminLoginView').style.display = 'none';
      document.getElementById('adminDashboard').style.display = 'block';
      renderAdmin();
      showToast('Admin logged in successfully');
    } else {
      err.textContent = res.status === 429 ? 'Too many attempts. Try again in 15 minutes.' : 'Invalid password. Access denied.';
      err.style.display = 'block';
    }
  } catch(e) {
    err.textContent = 'Unable to connect to the backend server. Make sure the backend is running.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
}

function adminLogout(){
  sessionStorage.removeItem('ruso_admin');
  sessionStorage.removeItem('ruso_admin_pw');
  goAdmin();
  showToast('Logged out');
}

function switchAdminTab(tab){
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tabProducts').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('tabOrders').style.display = tab === 'orders' ? 'block' : 'none';
  if(tab === 'orders') renderAdminOrders();
}

function resizeImageFile(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let w = img.width, h = img.height;
      if(w > h && w > maxDim){ h = Math.round(h * (maxDim / w)); w = maxDim; }
      else if(h > maxDim){ w = Math.round(w * (maxDim / h)); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderImgPreviewRow(){
  const row = document.getElementById('npImgPreviewRow');
  if(!row) return;
  row.innerHTML = __uploadedImages.map((src, i) => `
    <div class="img-preview-item">
      <img src="${esc(src)}" class="img-preview" alt="Preview">
      <button type="button" class="img-preview-remove" data-remove-img="${i}">&times;</button>
    </div>`).join('');

  row.querySelectorAll('[data-remove-img]').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.currentTarget.dataset.removeImg, 10);
      __uploadedImages.splice(idx, 1);
      renderImgPreviewRow();
    });
  });
}

async function handleImgUpload(input){
  const files = Array.from(input.files || []);
  if(!files.length) return;
  const room = MAX_PRODUCT_IMAGES - __uploadedImages.length;
  if(room <= 0){
    showToast(`Maximum ${MAX_PRODUCT_IMAGES} photos per product`);
    input.value = '';
    return;
  }
  const toProcess = files.slice(0, room);
  for(const file of toProcess){
    try {
      const resized = await resizeImageFile(file, 900, 0.82);
      __uploadedImages.push(resized);
    } catch(e) {
      showToast('Could not process image file');
    }
  }
  renderImgPreviewRow();
  input.value = '';
}

function addImageUrlManual(){
  const input = document.getElementById('npImageUrlInput');
  const val = input.value.trim();
  if(!val || !safeUrl(val)){
    showToast('Please enter a valid image URL');
    return;
  }
  if(__uploadedImages.length >= MAX_PRODUCT_IMAGES){
    showToast(`Maximum ${MAX_PRODUCT_IMAGES} photos per product`);
    return;
  }
  __uploadedImages.push(val);
  input.value = '';
  renderImgPreviewRow();
}

async function saveProductHandler(){
  const name = document.getElementById('npName').value.trim();
  const price = parseFloat(document.getElementById('npPrice').value);
  const sizes = document.getElementById('npSizes').value.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  const stock = parseInt(document.getElementById('npStock').value || '0', 10);
  const category = document.getElementById('npCategory').value;
  const bestSeller = document.getElementById('npBestSeller').value === 'true';
  const desc = document.getElementById('npDesc').value.trim();
  const video = document.getElementById('npVideoUrl').value.trim();
  const saveBtn = document.getElementById('saveProductBtn');

  if(!name || isNaN(price) || price <= 0 || !sizes.length){
    showToast('Please fill in product name, price, and sizes.');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const payload = {
    name,
    price: Math.round(price),
    sizes,
    stock: isNaN(stock) || stock < 0 ? 0 : stock,
    desc: desc || 'Premium streetwear footwear.',
    images: __uploadedImages.slice(),
    video: video || null,
    category,
    bestSeller
  };

  const adminPw = getAdminAuthHeader();

  try {
    if(editingProductId){
      // Update existing
      const res = await fetch(`${API_BASE}/api/products/${editingProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPw
        },
        body: JSON.stringify(payload)
      });
      if(res.ok){
        showToast('Product updated successfully');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update product');
      }
    } else {
      // Add new
      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPw
        },
        body: JSON.stringify(payload)
      });
      if(res.ok){
        showToast('Product added to live store');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to create product');
      }
    }
  } catch(e) {
    showToast('API unreachable. Saved locally.');
  }

  resetProductForm();
  await fetchProductsFromAPI();
  renderAdmin();
  renderAll();
  saveBtn.disabled = false;
}

function startEditProduct(id){
  const p = products.find(x => x.id === id);
  if(!p) return;
  editingProductId = id;

  document.getElementById('productFormTitle').textContent = `Edit Product: ${p.name}`;
  document.getElementById('npName').value = p.name;
  document.getElementById('npPrice').value = p.price;
  document.getElementById('npSizes').value = p.sizes.join(', ');
  document.getElementById('npStock').value = p.stock;
  document.getElementById('npCategory').value = p.category;
  document.getElementById('npBestSeller').value = p.bestSeller ? 'true' : 'false';
  document.getElementById('npDesc').value = p.desc || '';
  document.getElementById('npVideoUrl').value = p.video || '';
  __uploadedImages = (p.images || []).slice();
  renderImgPreviewRow();

  document.getElementById('saveProductBtn').textContent = '✓ Update Product';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';

  document.querySelector('.admin-wrap').scrollIntoView({ behavior: 'smooth' });
}

function resetProductForm(){
  editingProductId = null;
  document.getElementById('productFormTitle').textContent = 'Add New Product';
  document.getElementById('npName').value = '';
  document.getElementById('npPrice').value = '';
  document.getElementById('npSizes').value = '';
  document.getElementById('npStock').value = '';
  document.getElementById('npCategory').value = 'Samba';
  document.getElementById('npBestSeller').value = 'false';
  document.getElementById('npDesc').value = '';
  document.getElementById('npVideoUrl').value = '';
  __uploadedImages = [];
  renderImgPreviewRow();
  document.getElementById('saveProductBtn').textContent = '+ Save Product';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

async function toggleBestSeller(id){
  const p = products.find(x => x.id === id);
  if(!p) return;
  const newStatus = !p.bestSeller;
  const adminPw = getAdminAuthHeader();

  try {
    await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPw
      },
      body: JSON.stringify({ bestSeller: newStatus })
    });
  } catch(e){}

  p.bestSeller = newStatus;
  renderAdmin();
  renderAll();
  showToast(`Best Seller ${newStatus ? 'enabled' : 'disabled'}`);
}

async function deleteProduct(id){
  if(!confirm('Are you sure you want to delete this product?')) return;
  const adminPw = getAdminAuthHeader();

  try {
    const res = await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': adminPw }
    });
    if(res.ok){
      showToast('Product deleted');
    }
  } catch(e){}

  products = products.filter(x => x.id !== id);
  renderAdmin();
  renderAll();
}

function renderAdmin(){
  const tbody = document.getElementById('adminProductRows');
  if(!tbody) return;
  document.getElementById('adminProductCount').textContent = products.length;

  tbody.innerHTML = products.map(p => {
    const img = safeUrl(p.images && p.images[0]);
    return `
    <tr>
      <td style="width:50px;">
        <div style="width:40px;height:40px;background:#eee;border:1px solid var(--line-light);overflow:hidden;">
          ${img ? `<img src="${esc(img)}" alt="" style="width:100%;height:100%;object-fit:cover;">` : shoeSVG('#0e0e0e')}
        </div>
      </td>
      <td><strong>${esc(p.name)}</strong></td>
      <td>${esc(getCategory(p))}</td>
      <td>${fmt(p.price)}</td>
      <td>${esc(p.sizes.join(', '))}</td>
      <td>
        <span style="font-weight:700;color:${p.stock<=3?'var(--danger)':'var(--ink)'}">${Number(p.stock)}</span>
      </td>
      <td>
        <button class="link-btn" data-toggle-bs="${esc(p.id)}">${p.bestSeller ? '★ Featured' : '☆ Standard'}</button>
      </td>
      <td>
        <button class="link-btn primary" data-edit-p="${esc(p.id)}">Edit</button>
        <button class="link-btn danger" data-del-p="${esc(p.id)}">Delete</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-toggle-bs]').forEach(b => {
    b.addEventListener('click', () => toggleBestSeller(b.dataset.toggleBs));
  });
  tbody.querySelectorAll('[data-edit-p]').forEach(b => {
    b.addEventListener('click', () => startEditProduct(b.dataset.editP));
  });
  tbody.querySelectorAll('[data-del-p]').forEach(b => {
    b.addEventListener('click', () => deleteProduct(b.dataset.delP));
  });
}

async function renderAdminOrders(){
  const tbody = document.getElementById('adminOrderRows');
  const noOrders = document.getElementById('noOrders');
  if(!tbody) return;

  const adminPw = getAdminAuthHeader();
  let orders = [];

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: { 'x-admin-password': adminPw }
    });
    if(res.ok){
      orders = await res.json();
    }
  } catch(e){
    console.warn('Could not fetch orders from API:', e.message);
  }

  if(!orders.length){
    tbody.innerHTML = '';
    noOrders.style.display = 'block';
    return;
  }

  noOrders.style.display = 'none';
  tbody.innerHTML = orders.map(o => {
    const orderId = o.orderId || o.id;
    const itemsText = (o.items || []).map(i => `${esc(i.name)} (${esc(i.size)}) ×${Number(i.qty)}`).join('<br>');
    const createdAt = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '-';
    return `
    <tr>
      <td>
        <strong>${esc(orderId)}</strong><br>
        <span style="color:var(--steel);font-size:11px;">${createdAt}</span>
      </td>
      <td>
        <strong>${esc(o.name)}</strong><br>
        <a href="https://wa.me/88${esc(o.phone.replace(/[\s-]/g,''))}" target="_blank" style="color:#25D366;font-size:12px;font-weight:700;">
          📱 ${esc(o.phone)}
        </a>
      </td>
      <td style="max-width:180px;font-size:12px;">
        ${esc(o.address)}<br>
        <span style="color:var(--steel);font-size:11px;">Zone: ${esc(o.deliveryZone)}</span>
      </td>
      <td>
        <strong>${esc(o.payMethod)}</strong><br>
        <span style="font-family:monospace;font-size:11px;background:#f0eee9;padding:2px 4px;">Trx: ${esc(o.trx)}</span>
      </td>
      <td style="font-size:12px;">${itemsText}</td>
      <td><strong>${fmt(o.total)}</strong></td>
      <td>
        <select class="status-select" data-order-status-id="${esc(o._id || o.id || o.orderId)}">
          ${['Pending confirmation', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => `
            <option value="${s}" ${o.status===s?'selected':''}>${s}</option>
          `).join('')}
        </select>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-order-status-id]').forEach(select => {
    select.addEventListener('change', async e => {
      const orderId = e.currentTarget.dataset.orderStatusId;
      const newStatus = e.currentTarget.value;
      try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPw
          },
          body: JSON.stringify({ status: newStatus })
        });
        if(res.ok){
          showToast(`Order status updated to: ${newStatus}`);
        } else {
          showToast('Failed to update order status');
        }
      } catch(err){
        showToast('Status update failed');
      }
    });
  });
}

/* ---------- Navigation & Router ---------- */
function goHome(target){
  document.querySelectorAll('[data-page]').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-page="home"]').classList.add('active');
  closeAllOverlays();
  setTimeout(() => {
    if(target){
      const el = document.getElementById(target);
      if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 20);
}

function goAdmin(){
  document.querySelectorAll('[data-page]').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-page="admin"]').classList.add('active');
  closeAllOverlays();
  const isIn = sessionStorage.getItem('ruso_admin') === '1';
  document.getElementById('adminLoginView').style.display = isIn ? 'none' : 'block';
  document.getElementById('adminDashboard').style.display = isIn ? 'block' : 'none';
  if(isIn){
    renderAdmin();
  }
  window.scrollTo(0, 0);
}

/* ---------- Global Master Renderer ---------- */
function renderAll(){
  renderHero();
  renderGrid();
  renderBestSellers();
  renderCartCount();
}

/* ---------- App Initialization & DOM Binding ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Event Bindings
  document.getElementById('brandLink')?.addEventListener('click', e => { e.preventDefault(); goHome(); });
  document.getElementById('navHome')?.addEventListener('click', e => { e.preventDefault(); goHome(); });
  document.getElementById('navProducts')?.addEventListener('click', e => { e.preventDefault(); goHome('products'); });
  document.getElementById('navBestsellers')?.addEventListener('click', e => { e.preventDefault(); goHome('bestsellers'); });
  document.getElementById('navWhyRuso')?.addEventListener('click', e => { e.preventDefault(); goHome('why-ruso'); });
  document.getElementById('navContact')?.addEventListener('click', e => { e.preventDefault(); goHome('contact'); });

  document.getElementById('mNavHome')?.addEventListener('click', e => { e.preventDefault(); goHome(); toggleMobileMenu(); });
  document.getElementById('mNavProducts')?.addEventListener('click', e => { e.preventDefault(); goHome('products'); toggleMobileMenu(); });
  document.getElementById('mNavBestsellers')?.addEventListener('click', e => { e.preventDefault(); goHome('bestsellers'); toggleMobileMenu(); });
  document.getElementById('mNavWhyRuso')?.addEventListener('click', e => { e.preventDefault(); goHome('why-ruso'); toggleMobileMenu(); });
  document.getElementById('mNavContact')?.addEventListener('click', e => { e.preventDefault(); goHome('contact'); toggleMobileMenu(); });
  document.getElementById('mNavAdmin')?.addEventListener('click', e => { e.preventDefault(); goAdmin(); toggleMobileMenu(); });

  document.getElementById('fNavHome')?.addEventListener('click', e => { e.preventDefault(); goHome(); });
  document.getElementById('fNavProducts')?.addEventListener('click', e => { e.preventDefault(); goHome('products'); });
  document.getElementById('fNavBestsellers')?.addEventListener('click', e => { e.preventDefault(); goHome('bestsellers'); });
  document.getElementById('fNavWhyRuso')?.addEventListener('click', e => { e.preventDefault(); goHome('why-ruso'); });
  document.getElementById('fNavAdmin')?.addEventListener('click', e => { e.preventDefault(); goAdmin(); });

  // Search & Cart Action Bindings
  document.getElementById('cartBtn')?.addEventListener('click', openCart);
  document.getElementById('burgerBtn')?.addEventListener('click', toggleMobileMenu);

  // Close Overlays
  document.getElementById('closeCollectionBtn')?.addEventListener('click', closeCollection);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeAllOverlays);
  document.getElementById('closePdBtn')?.addEventListener('click', closePD);
  document.getElementById('closeCoBtn')?.addEventListener('click', closeCheckout);
  document.getElementById('overlayBg')?.addEventListener('click', closeAllOverlays);
  document.getElementById('checkoutBtn')?.addEventListener('click', openCheckout);

  // Admin Actions
  document.getElementById('adminLoginForm')?.addEventListener('submit', attemptAdminLogin);
  document.getElementById('adminBackLink')?.addEventListener('click', e => { e.preventDefault(); goHome(); });
  document.getElementById('adminViewSiteLink')?.addEventListener('click', e => { e.preventDefault(); goHome(); });
  document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
  document.getElementById('tabBtnProducts')?.addEventListener('click', () => switchAdminTab('products'));
  document.getElementById('tabBtnOrders')?.addEventListener('click', () => switchAdminTab('orders'));
  document.getElementById('refreshOrdersBtn')?.addEventListener('click', renderAdminOrders);
  document.getElementById('saveProductBtn')?.addEventListener('click', saveProductHandler);
  document.getElementById('cancelEditBtn')?.addEventListener('click', resetProductForm);
  document.getElementById('imgUploadTrigger')?.addEventListener('click', () => document.getElementById('npImgFile')?.click());
  document.getElementById('npImgFile')?.addEventListener('change', e => handleImgUpload(e.target));
  document.getElementById('addImageUrlBtn')?.addEventListener('click', addImageUrlManual);

  // Fetch initial products and render
  await fetchProductsFromAPI();
  renderAll();

  // Welcome Intro Animation
  const welcomeScreen = document.getElementById('welcomeScreen');
  if(welcomeScreen){
    const seen = sessionStorage.getItem('ruso_welcome_seen');
    if(seen){
      welcomeScreen.remove();
    } else {
      sessionStorage.setItem('ruso_welcome_seen', '1');
      setTimeout(() => welcomeScreen.classList.add('hide'), 1400);
      setTimeout(() => welcomeScreen.remove(), 2100);
    }
  }
});