// ================================
// CLASSY - Main App JavaScript
// Connected to Backend API (with local fallback)
// ================================

function getPublicApiUrl() {
   return 'https://classy-backend.vercel.app/api';
}

// ===== DEMO DATA (disabled - real products now come from the backend only) =====
const DEMO_PRODUCTS = [];

// أيقونة اختيارية لكل تصنيف معروف (شكل بس، مش بيانات وهمية)
const CATEGORY_ICONS = {
  'كتب تلوين': '🎨',
  'بوكسات ورد': '🌹',
  'نوتات مخصصة': '📓',
  'تغريسات تخرج': '🎓',
  'براويز مواليد': '👶',
};

// ===== HELPERS =====
let cachedProducts = null;

async function getProducts() {
  if (cachedProducts) return cachedProducts;
  try {
    const res = await fetch(`${getPublicApiUrl()}/products`);
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      // Backend responded successfully - use its data even if empty (no fake demo fallback)
      cachedProducts = result.data;
      return cachedProducts;
    }
  } catch (e) {
    console.warn('تعذر الاتصال بالباك اند، هيتم استخدام بيانات تجريبية', e);
  }
  cachedProducts = DEMO_PRODUCTS;
  return cachedProducts;
}

function getCart() {
  return JSON.parse(localStorage.getItem('classy_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('classy_cart', JSON.stringify(cart));
  updateCartCount();
}

function formatPrice(price) {
  return price + ' EGP';
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ===== CART =====
function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cartCount');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

async function addToCart(productId, qty = 1) {
  const products = await getProducts();
  const product = products.find(p => p._id === productId);
  if (!product) return;

  let cart = getCart();
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: qty
    });
  }
  saveCart(cart);
  showToast('تم إضافة المنتج للسلة! 🛒', 'success');
}

function removeFromCart(productId) {
  let cart = getCart().filter(item => item.productId !== productId);
  saveCart(cart);
  renderCart();
  renderCheckoutSummary();
}

function updateQuantity(productId, delta) {
  let cart = getCart();
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.productId !== productId);
  }
  saveCart(cart);
  renderCart();
  renderCheckoutSummary();
}

function clearCart() {
  localStorage.removeItem('classy_cart');
  updateCartCount();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  const cart = getCart();
  if (!cart.length) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="text-6xl mb-4">🛒</div>
        <h3 class="text-xl font-bold mb-2">سلة التسوق فارغة</h3>
        <p class="text-gray-500 mb-6">ابدأ التسوق واكتشف منتجاتنا الرائعة</p>
        <a href="products.html" class="btn-primary">تصفح المنتجات</a>
      </div>
    `;
    updateCartSummary(0);
    return;
  }

  let html = '<div class="space-y-4">';
  let subtotal = 0;
  cart.forEach(item => {
    const total = item.price * item.quantity;
    subtotal += total;
    html += `
      <div class="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm">
        <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded-xl" onerror="this.src='https://placehold.co/100'">
        <div class="flex-1">
          <h4 class="font-bold">${item.name}</h4>
          <p class="text-primary-dark font-bold">${formatPrice(item.price)}</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="updateQuantity('${item.productId}', -1)" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">-</button>
          <span class="w-8 text-center font-bold">${item.quantity}</span>
          <button onclick="updateQuantity('${item.productId}', 1)" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">+</button>
        </div>
        <div class="font-bold text-lg">${formatPrice(total)}</div>
        <button onclick="removeFromCart('${item.productId}')" class="text-red-400 hover:text-red-600 p-2"><i class="fas fa-trash"></i></button>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
  updateCartSummary(subtotal);
}

function updateCartSummary(subtotal) {
  const shipping = subtotal > 500 ? 0 : 0; // Free shipping
  const total = subtotal + shipping;
  const subEl = document.getElementById('subtotal');
  const totalEl = document.getElementById('total');
  if (subEl) subEl.textContent = formatPrice(subtotal);
  if (totalEl) totalEl.textContent = formatPrice(total);
}

// ===== CHECKOUT =====
function renderCheckoutSummary() {
  const container = document.getElementById('checkoutItems');
  const subtotalEl = document.getElementById('checkoutSubtotal');
  const shippingEl = document.getElementById('checkoutShipping');
  const totalEl = document.getElementById('checkoutTotal');
  if (!container) return;

  const cart = getCart();
  const shippingRadio = document.querySelector('input[name="shippingMethod"]:checked');
  const shippingCost = shippingRadio && shippingRadio.value === 'express' ? 50 : 0;

  let subtotal = 0;
  let html = '';
  cart.forEach(item => {
    const total = item.price * item.quantity;
    subtotal += total;
    html += `
      <div class="flex justify-between items-center py-2 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <img src="${item.image}" class="w-12 h-12 rounded-lg object-cover" onerror="this.src='https://placehold.co/100'">
          <div>
            <div class="font-semibold text-sm">${item.name}</div>
            <div class="text-gray-400 text-xs">x${item.quantity}</div>
          </div>
        </div>
        <div class="font-bold">${formatPrice(total)}</div>
      </div>
    `;
  });
  container.innerHTML = html;
  const total = subtotal + shippingCost;
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (shippingEl) shippingEl.textContent = shippingCost === 0 ? 'مجاني' : formatPrice(shippingCost);
  if (totalEl) totalEl.textContent = formatPrice(total);
}

async function submitOrder(e) {
  e.preventDefault();
  const cart = getCart();
  if (!cart.length) {
    showToast('السلة فارغة!', 'error');
    return;
  }
  const form = e.target;
  const formData = new FormData(form);
  const order = {
    customer: {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email') || '',
      address: formData.get('address')
    },
    items: cart.map(item => ({
      productName: item.name,
      quantity: item.quantity,
      price: item.price
    })),
    totalPrice: cart.reduce((sum, item) => sum + item.price * item.quantity, 0) + (formData.get('shippingMethod') === 'express' ? 50 : 0),
    paymentMethod: formData.get('paymentMethod'),
    shippingMethod: formData.get('shippingMethod'),
    status: 'pending',
    notes: formData.get('notes') || ''
  };

  const apiUrl = getPublicApiUrl();
  if (!apiUrl) {
    showToast('تعذر إرسال الطلب: رابط الخادم غير مضبوط.', 'error');
    return;
  }

  const button = document.getElementById('submitBtn');
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ إرسال الطلب...';
  try {
    const response = await fetch(`${apiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.message || 'لم يقبل الخادم الطلب');
    }
    const savedOrder = result.data;
    localStorage.setItem('classy_last_order', JSON.stringify(savedOrder));
    clearCart();
    window.location.href = 'order-success.html';
  } catch (error) {
    showToast(`تعذر إرسال الطلب: ${error.message}`, 'error');
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد الطلب';
  }
}

function renderOrderSuccess() {
  const container = document.getElementById('orderDetails');
  const order = JSON.parse(localStorage.getItem('classy_last_order') || '{}');
  if (!container || !order.orderNumber) return;
  container.innerHTML = `
    <div class="space-y-3 text-right">
      <div class="flex justify-between"><span class="text-gray-500">رقم الطلب:</span><span class="font-bold">${order.orderNumber}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">العميل:</span><span class="font-bold">${order.customer?.name}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">الهاتف:</span><span class="font-bold">${order.customer?.phone}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">العنوان:</span><span class="font-bold">${order.customer?.address}</span></div>
      <div class="flex justify-between"><span class="text-gray-500">الإجمالي:</span><span class="font-bold text-primary-dark">${formatPrice(order.totalPrice)}</span></div>
    </div>
  `;
}

// ===== PRODUCTS =====
function renderProductCard(product) {
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  return `
    <div class="product-card fade-in">
      <div class="relative">
        <img src="${product.image}" alt="${product.name}" onerror="this.src='https://placehold.co/400'">
        ${discount > 0 ? `<span class="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">-${discount}%</span>` : ''}
        <button onclick="addToCart('${product._id}')" class="absolute bottom-3 left-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-primary-dark hover:bg-primary hover:text-white transition-colors">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div class="product-card-body">
        <div class="text-xs text-gray-400 mb-1">${product.category}</div>
        <h3 class="product-card-title">${product.name}</h3>
        <div class="flex items-center gap-2 mb-3">
          <span class="product-card-price">${formatPrice(product.price)}</span>
          ${product.oldPrice ? `<span class="product-card-old-price">${formatPrice(product.oldPrice)}</span>` : ''}
        </div>
        <a href="product-detail.html?id=${product._id}" class="btn-outline w-full justify-center text-sm">عرض التفاصيل</a>
      </div>
    </div>
  `;
}

async function loadFeaturedProducts() {
  const container = document.getElementById('productsContainer');
  if (!container) return;
  const products = (await getProducts()).filter(p => p.status === 'active').slice(0, 8);
  container.innerHTML = products.map(renderProductCard).join('');
}

async function loadAllProducts() {
  const container = document.getElementById('productsContainer');
  if (!container) return;
  const products = (await getProducts()).filter(p => p.status === 'active');
  container.innerHTML = products.map(renderProductCard).join('');
  loadCategoryFilters();
}

async function loadCategoryFilters() {
  const container = document.getElementById('categoryFilters');
  if (!container) return;
  const products = await getProducts();
  const categories = [...new Set(products.map(p => p.category))];
  let html = `<button class="filter-btn active" onclick="filterProducts('all')">الكل</button>`;
  categories.forEach(cat => {
    html += `<button class="filter-btn" onclick="filterProducts('${cat}')">${cat}</button>`;
  });
  container.innerHTML = html;
}

async function filterProducts(category) {
  const products = (await getProducts()).filter(p => p.status === 'active');
  const filtered = category === 'all' ? products : products.filter(p => p.category === category);
  const container = document.getElementById('productsContainer');
  if (container) container.innerHTML = filtered.map(renderProductCard).join('');

  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
}

async function searchProducts() {
  const query = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const products = (await getProducts()).filter(p => p.status === 'active');
  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.category.toLowerCase().includes(query) ||
    p.description.toLowerCase().includes(query)
  );
  const container = document.getElementById('productsContainer');
  if (container) {
    container.innerHTML = filtered.length 
      ? filtered.map(renderProductCard).join('') 
      : '<div class="col-span-full text-center py-10 text-gray-400">لا توجد نتائج مطابقة</div>';
  }
}

// ===== PRODUCT DETAIL =====
async function loadProductDetail() {
  const container = document.getElementById('productDetail');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const products = await getProducts();
  const product = products.find(p => p._id === id);
  if (!product) {
    container.innerHTML = '<div class="text-center py-20 text-gray-400">المنتج غير موجود</div>';
    return;
  }

  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  container.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-10">
      <div class="bg-white rounded-3xl p-6 shadow-lg">
        <img src="${product.image}" alt="${product.name}" class="w-full rounded-2xl" onerror="this.src='https://placehold.co/600'">
      </div>
      <div>
        <div class="text-sm text-gray-400 mb-2">${product.category}</div>
        <h1 class="text-3xl font-bold mb-4">${product.name}</h1>
        <div class="flex items-center gap-3 mb-4">
          <span class="rating-stars">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}</span>
          <span class="text-gray-500">(${product.reviews} تقييم)</span>
        </div>
        <div class="flex items-center gap-3 mb-6">
          <span class="text-3xl font-bold text-primary-dark">${formatPrice(product.price)}</span>
          ${product.oldPrice ? `<span class="text-xl text-gray-400 line-through">${formatPrice(product.oldPrice)}</span>` : ''}
          ${discount > 0 ? `<span class="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-bold">وفر ${discount}%</span>` : ''}
        </div>
        <p class="text-gray-600 mb-8 leading-relaxed">${product.description}</p>
        <div class="flex gap-4">
          <button onclick="addToCart('${product._id}')" class="btn-primary flex-1 justify-center"><i class="fas fa-shopping-bag"></i> أضف للسلة</button>
          <a href="https://wa.me/201226832747?text=${encodeURIComponent('مرحباً CLASSY، عندي سؤال عن منتج: ' + product.name)}" target="_blank" class="btn-secondary justify-center"><i class="fab fa-whatsapp"></i> استفسر</a>
        </div>
        <div class="mt-8 p-4 bg-gray-50 rounded-xl">
          <div class="flex items-center gap-3 text-sm text-gray-600">
            <i class="fas fa-check-circle text-green-500"></i> متوفر في المخزن (${product.stock} قطعة)
          </div>
        </div>
      </div>
    </div>
  `;

  // Load related products
  const relatedContainer = document.getElementById('relatedProducts');
  if (relatedContainer) {
    const related = products.filter(p => p.category === product.category && p._id !== product._id).slice(0, 4);
    relatedContainer.innerHTML = related.map(renderProductCard).join('') || '<div class="col-span-full text-center text-gray-400">لا توجد منتجات مشابهة</div>';
  }
}

// ===== CATEGORIES =====
// التصنيفات بتتحسب دلوقتي من المنتجات الحقيقية القادمة من الباك اند - مفيش بيانات وهمية
async function loadCategories() {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;

  const products = await getProducts();

  if (!products.length) {
    container.innerHTML = '<p class="text-center text-gray-400 col-span-full py-10">لا توجد تصنيفات متاحة حالياً</p>';
    return;
  }

  // تجميع المنتجات حسب التصنيف، مع أخذ عدد المنتجات وصورة حقيقية من أول منتج بكل تصنيف
  const categoriesMap = {};
  products.forEach(p => {
    if (!p.category) return;
    if (!categoriesMap[p.category]) {
      categoriesMap[p.category] = { name: p.category, image: p.image, count: 0 };
    }
    categoriesMap[p.category].count++;
  });

  const categories = Object.values(categoriesMap);

  container.innerHTML = categories.map(cat => `
    <a href="products.html" class="group relative rounded-3xl overflow-hidden shadow-lg h-64">
      <img src="${cat.image}" alt="${cat.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onerror="this.src='https://placehold.co/400'">
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-6">
        <div class="text-3xl mb-2">${CATEGORY_ICONS[cat.name] || '🎁'}</div>
        <h3 class="text-white text-xl font-bold">${cat.name}</h3>
        <p class="text-white/70 text-sm">${cat.count} منتج</p>
      </div>
    </a>
  `).join('');
}

function loadCategoriesPage() {
  loadCategories();
}

// ===== GALLERY =====
let cachedGallery = null;

async function getGalleryItems() {
  if (cachedGallery) return cachedGallery;
  try {
    const res = await fetch(`${getPublicApiUrl()}/gallery`);
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      cachedGallery = result.data;
      return cachedGallery;
    }
  } catch (e) {
    console.warn('تعذر الاتصال بالباك اند لجلب معرض الأعمال', e);
  }
  cachedGallery = [];
  return cachedGallery;
}

async function renderGallery() {
  const container = document.getElementById('galleryContainer');
  if (!container) return;

  const items = await getGalleryItems();

  if (!items.length) {
    container.innerHTML = '<p class="text-center text-gray-400 col-span-full py-10">لا توجد أعمال لعرضها حالياً</p>';
    return;
  }

  container.innerHTML = items.map(g => `
    <div class="gallery-item" data-category="${g.category || ''}">
      <img src="${g.image}" alt="${g.title || ''}" onerror="this.src='https://placehold.co/400'">
      <div class="gallery-overlay"><h4>${g.title || ''}</h4><p>${g.desc || g.description || ''}</p></div>
    </div>
  `).join('');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
});
