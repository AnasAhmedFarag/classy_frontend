// ================================
// CLASSY Admin Dashboard JavaScript
// Connected to Backend API
// ================================

// API URL - can be configured via localStorage or defaults to production backend
function getApiUrl() {
  return localStorage.getItem('classy_api_url') || 'https://classy-backend.vercel.app/api';
}
let API_URL = getApiUrl();

// مهلة زمنية للطلبات: لو السيرفر معلّق، نوقف الانتظار ونرجّع رسالة واضحة
// بدل ما الصفحة تفضل بتحمّل للأبد من غير أي رسالة توضح السبب
async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function describeFetchError(e) {
  if (e.name === 'AbortError') {
    return 'انتهت المهلة: السيرفر أخد وقت طويل ولم يرد. لو بترفع صورة، جرب صورة أصغر أو استخدم رابط خارجي.';
  }
  return 'تعذر الاتصال بالسيرفر: ' + e.message;
}

// ===== AUTH =====
function getToken() { return localStorage.getItem('classy_admin_token'); }
function getAuthHeaders() {
  const token = getToken();
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Check auth on load
(function checkAuth() {
  const token = getToken();
  if (!token) { window.location.href = 'login.html'; return; }
  const user = JSON.parse(localStorage.getItem('classy_admin_user') || '{}');
  if (user.name) {
    document.getElementById('sidebarName').textContent = user.name;
    document.getElementById('sidebarAvatar').textContent = user.name.charAt(0);
  }
})();

function logout() {
  localStorage.removeItem('classy_admin_token');
  localStorage.removeItem('classy_admin_user');
  window.location.href = 'login.html';
}

// ===== API HELPERS =====
async function apiGet(endpoint) {
  try {
    const res = await fetchWithTimeout(getApiUrl() + endpoint, { headers: getAuthHeaders() });
    return await res.json();
  } catch (e) { return { success: false, error: describeFetchError(e) }; }
}
async function apiPostForm(endpoint, formData) {
  try {
    const res = await fetchWithTimeout(getApiUrl() + endpoint, {
      method: 'POST',
      headers: getAuthHeaders(), // Don't set Content-Type - browser sets it with boundary for FormData
      body: formData
    });
    return await res.json();
  } catch (e) { return { success: false, error: describeFetchError(e) }; }
}
async function apiPutForm(endpoint, formData) {
  try {
    const res = await fetchWithTimeout(getApiUrl() + endpoint, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: formData
    });
    return await res.json();
  } catch (e) { return { success: false, error: describeFetchError(e) }; }
}
async function apiDelete(endpoint) {
  try {
    const res = await fetchWithTimeout(getApiUrl() + endpoint, { method: 'DELETE', headers: getAuthHeaders() });
    return await res.json();
  } catch (e) { return { success: false, error: describeFetchError(e) }; }
}
// FIX: لإرسال بيانات فيها object متداخل (زي customer) لازم تتبعت JSON مش
// URLSearchParams. URLSearchParams بيحول أي object جواه لنص "[object Object]"
// وده كان بيسبب خطأ الـ Cast في الباك اند عند تعديل الطلب.
async function apiPutJSON(endpoint, bodyObj) {
  try {
    const res = await fetchWithTimeout(getApiUrl() + endpoint, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    });
    return await res.json();
  } catch (e) { return { success: false, error: describeFetchError(e) }; }
}

// ===== DATA (populated from the real backend; no demo fallback) =====
let products = [], orders = [], customers = [], galleryItems = [];
let categories = [];

// ===== STATUS CONFIG =====
const STATUS_CONFIG = {
  pending:    { label: 'قيد المراجعة', class: 'status-badge pending', icon: '⏳' },
  processing: { label: 'قيد المعالجة', class: 'status-badge processing', icon: '🔧' },
  delivered:  { label: 'تم التسليم',   class: 'status-badge delivered', icon: '✅' },
  cancelled:  { label: 'إلغاء',        class: 'status-badge cancelled', icon: '❌' },
};
const PAYMENT_LABELS = { cash_on_delivery: 'الدفع عند الاستلام', online: 'دفع إلكتروني' };
const SHIPPING_LABELS = { standard: 'شحن عادي', express: 'شحن سريع' };

// ===== SIDEBAR =====
// FIX: فنكشن واحدة موحدة بتفرق بين وضع الموبايل ووضع الديسكتوب
// بدل ما كان فيه toggleSidebar() (بتستخدم كلاس collapsed) و toggleMobileSidebar()
// (بتستخدم كلاس open) منفصلين عن بعض، والزرار في الهيدر كان بينده على
// toggleSidebar() بس، فعلى الموبايل الكلاس اللي بيتضاف (collapsed) مالوش
// أي تأثير في الـ CSS الخاص بالموبايل، فالقائمة كانت بتفضل مقفولة.
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function showSection(sectionName) {
  const sections = ['dashboard', 'products', 'orders', 'customers', 'gallery', 'settings'];
  sections.forEach(s => { const el = document.getElementById(s + 'Section'); if (el) el.style.display = 'none'; });
  const selected = document.getElementById(sectionName + 'Section');
  if (selected) selected.style.display = 'block';
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  if (event && event.target) event.target.closest('.sidebar-item').classList.add('active');
  const titles = { 'dashboard': 'لوحة التحكم', 'products': 'المنتجات', 'orders': 'الطلبات', 'customers': 'العملاء', 'gallery': 'معرض الأعمال', 'settings': 'الإعدادات' };
  const breadcrumb = document.getElementById('pageBreadcrumb');
  if (breadcrumb) breadcrumb.textContent = titles[sectionName] || sectionName;
  if (sectionName === 'products') loadProducts();
  if (sectionName === 'orders') loadOrders();
  if (sectionName === 'customers') loadCustomers();
  if (sectionName === 'gallery') loadGallery();
  if (sectionName === 'settings') loadSettingsToForm();

  // FIX: على الموبايل نقفل القائمة تلقائيًا بعد اختيار قسم عشان المستخدم يشوف المحتوى فورًا
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }
}

// ===== MODALS =====
function openModal(modalId) { document.getElementById(modalId).classList.add('open'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
});

// ===== TOAST =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ===== IMAGE UPLOAD HELPERS =====
function handleImagePreview(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('حجم الصورة كبير جداً! الحد الأقصى 5MB', 'error'); input.value = ''; return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('imagePreview').src = e.target.result;
    document.getElementById('imagePreview').style.display = 'block';
    document.getElementById('imagePreviewArea').style.display = 'none';
    document.getElementById('removeImageBtn').style.display = 'inline-block';
    // Clear URL field since we have a file
    document.getElementById('prodImageUrl').value = '';
  };
  reader.readAsDataURL(file);
}

function removeImagePreview() {
  document.getElementById('prodImageFile').value = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('imagePreviewArea').style.display = 'block';
  document.getElementById('removeImageBtn').style.display = 'none';
}

function handleUrlPreview(url) {
  if (!url) return;
  document.getElementById('imagePreview').src = url;
  document.getElementById('imagePreview').style.display = 'block';
  document.getElementById('imagePreviewArea').style.display = 'none';
  document.getElementById('removeImageBtn').style.display = 'inline-block';
  // Clear file input since we have URL
  document.getElementById('prodImageFile').value = '';
}

// ===== LOAD DATA =====
// FIX: مفيش أي بيانات وهمية (Demo) بديلة بعد دلوقتي. لو السيرفر فشل، الجدول
// بيفضل فاضي وبتظهر رسالة خطأ واضحة بدل ما يوهمك إن فيه طلبات/منتجات حقيقية.
async function loadAllData() {
  const prodRes = await apiGet('/products');
  if (prodRes.success && prodRes.data) {
    products = prodRes.data;
  } else {
    products = [];
    showToast('تعذر تحميل المنتجات: ' + (prodRes.error || prodRes.message || 'خطأ غير معروف'), 'error');
  }

  const ordRes = await apiGet('/orders');
  if (ordRes.success && ordRes.data) {
    orders = ordRes.data;
  } else {
    orders = [];
    showToast('تعذر تحميل الطلبات: ' + (ordRes.error || ordRes.message || 'خطأ غير معروف'), 'error');
  }

  const catRes = await apiGet('/categories');
  categories = catRes.success && catRes.data ? catRes.data : [];

  const galRes = await apiGet('/gallery');
  galleryItems = galRes.success && galRes.data ? galRes.data : [];

  customers = extractCustomersFromOrders();

  renderDashboardOrders();
  renderProductsTable();
  renderOrdersTable();
  renderCustomersTable();
  renderGalleryGrid();
  updateDashboardStats();
  initCharts();
}

function extractCustomersFromOrders() {
  const map = {};
  orders.forEach(o => {
    const key = o.customer.phone;
    if (!map[key]) {
      map[key] = { _id: 'c_' + key, name: o.customer.name, email: o.customer.email || '', phone: o.customer.phone, address: o.customer.address, orders: 0, total: 0, date: o.date };
    }
    map[key].orders++;
    map[key].total += o.totalPrice;
  });
  return Object.values(map);
}

// ===== DASHBOARD =====
function renderDashboardOrders() {
  const tbody = document.getElementById('dashboardOrdersBody');
  if (!tbody) return;
  const recent = orders.slice(0, 5);
  if (!recent.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">لا توجد طلبات</td></tr>'; return; }
  tbody.innerHTML = recent.map(o => `
    <tr>
      <td><span class="font-bold text-primary-dark">${o.orderNumber}</span></td>
      <td>${o.customer.name}</td>
      <td>${o.items.map(i => i.productName).join(' + ')}</td>
      <td class="font-bold">${o.totalPrice} EGP</td>
      <td><span class="${STATUS_CONFIG[o.status]?.class || 'status-badge pending'}">${STATUS_CONFIG[o.status]?.label || o.status}</span></td>
      <td>${formatDate(o.createdAt || o.date)}</td>
      <td>
        <button class="action-btn view" onclick="viewOrder('${o._id}')" title="عرض"><i class="fas fa-eye"></i></button>
        <button class="action-btn edit" onclick="editOrder('${o._id}')" title="تعديل"><i class="fas fa-edit"></i></button>
      </td>
    </tr>
  `).join('');
}

function updateDashboardStats() {
  const totalOrders = orders.length;
  const totalProducts = products.filter(p => p.status === 'active').length;
  const totalCustomers = customers.length;
  const totalSales = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totalPrice || 0), 0);
  if (document.getElementById('dashTotalOrders')) animateNumber(document.getElementById('dashTotalOrders'), totalOrders);
  if (document.getElementById('dashTotalCustomers')) animateNumber(document.getElementById('dashTotalCustomers'), totalCustomers);
  if (document.getElementById('dashTotalProducts')) animateNumber(document.getElementById('dashTotalProducts'), totalProducts);
  if (document.getElementById('dashTotalSales')) animateNumber(document.getElementById('dashTotalSales'), totalSales);
}

function animateNumber(el, target) {
  let current = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current.toLocaleString();
  }, 20);
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ===== PRODUCTS =====
async function loadProducts() {
  const res = await apiGet('/products');
  if (res.success && res.data) {
    products = res.data;
  } else {
    products = [];
    showToast('تعذر تحميل المنتجات: ' + (res.error || res.message || 'خطأ غير معروف'), 'error');
  }
  renderProductsTable();
}

function renderProductsTable(filter = '') {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
  let list = products;
  if (filter) list = products.filter(p => p.name.includes(filter) || p.category.includes(filter));
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">لا توجد منتجات</td></tr>'; return; }

  tbody.innerHTML = list.map(p => `
    <tr>
      <td>
        <div class="table-product">
          <img src="${p.image || 'https://placehold.co/100'}" alt="${p.name}" onerror="this.src='https://placehold.co/100'">
          <div class="table-product-info"><h4>${p.name}</h4><p>ID: #${String(p._id).slice(-4)}</p></div>
        </div>
      </td>
      <td>${p.category}</td>
      <td class="font-bold">${p.price} EGP</td>
      <td>${p.stock}</td>
      <td><span class="status-badge ${p.status === 'active' ? 'active' : 'inactive'}">${p.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
      <td><span class="rating-stars">${'★'.repeat(Math.floor(p.rating || 0))}${'☆'.repeat(5 - Math.floor(p.rating || 0))}</span> ${p.rating || 0}</td>
      <td>
        <button class="action-btn view" onclick="viewProduct('${p._id}')" title="عرض"><i class="fas fa-eye"></i></button>
        <button class="action-btn edit" onclick="editProduct('${p._id}')" title="تعديل"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" onclick="promptDelete('product', '${p._id}')" title="حذف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function filterProductsTable() { renderProductsTable(document.getElementById('productSearch')?.value || ''); }

function openProductModal() {
  document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد';
  document.getElementById('productEditId').value = '';
  ['prodName','prodPrice','prodStock','prodCategory','prodDesc','prodImageUrl'].forEach(id => document.getElementById(id).value = '');
  removeImagePreview();
  openModal('productModal');
}

function viewProduct(id) {
  const p = products.find(x => x._id == id);
  if (!p) return;
  document.getElementById('productViewBody').innerHTML = `
    <div class="text-center mb-4"><img src="${p.image || 'https://placehold.co/150'}" alt="${p.name}" style="width:150px;height:150px;object-fit:cover;border-radius:16px;" onerror="this.src='https://placehold.co/150'"></div>
    <div class="space-y-3">
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">الاسم:</span><span class="font-bold">${p.name}</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">التصنيف:</span><span class="font-bold">${p.category}</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">السعر:</span><span class="font-bold text-primary-dark">${p.price} EGP</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">المخزون:</span><span class="font-bold">${p.stock}</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">التقييم:</span><span class="font-bold">${p.rating || 0} ★</span></div>
      <div class="p-3 bg-gray-50 rounded-xl"><span class="text-gray-500 block mb-1">الوصف:</span><span>${p.description || '—'}</span></div>
    </div>
  `;
  openModal('productViewModal');
}

function editProduct(id) {
  const p = products.find(x => x._id == id);
  if (!p) return;
  document.getElementById('productModalTitle').textContent = 'تعديل المنتج';
  document.getElementById('productEditId').value = p._id;
  document.getElementById('prodName').value = p.name;
  document.getElementById('prodPrice').value = p.price;
  document.getElementById('prodStock').value = p.stock;
  document.getElementById('prodCategory').value = p.category;
  document.getElementById('prodDesc').value = p.description || '';

  // Show existing image
  if (p.image) {
    document.getElementById('imagePreview').src = p.image;
    document.getElementById('imagePreview').style.display = 'block';
    document.getElementById('imagePreviewArea').style.display = 'none';
    document.getElementById('removeImageBtn').style.display = 'inline-block';
    document.getElementById('prodImageUrl').value = p.image.startsWith('http') ? p.image : '';
  } else {
    removeImagePreview();
  }
  openModal('productModal');
}

// FIX: منع الضغط المتكرر على "حفظ المنتج" أثناء انتظار الرد. كان بيسمح بإرسال
// نفس الطلب أكتر من مرة (لو المستخدم ضغط تاني وهو مستني)، فبيتحفظ نفس المنتج
// كذا نسخة. دلوقتي الزرار بيتقفل ويتحول لـ "جاري الحفظ..." لحد ما الرد يوصل.
async function saveProduct() {
  const saveBtn = document.getElementById('saveProductBtn');
  if (saveBtn && saveBtn.disabled) return;

  const id = document.getElementById('productEditId').value;
  const name = document.getElementById('prodName').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value);
  const category = document.getElementById('prodCategory').value.trim();
  const description = document.getElementById('prodDesc').value.trim();
  const imageFile = document.getElementById('prodImageFile').files[0];
  const imageUrl = document.getElementById('prodImageUrl').value.trim();

  if (!name || !price || !stock || !category) {
    showToast('يرجى ملء جميع الحقول المطلوبة!', 'error');
    return;
  }

  const originalBtnText = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  }

  // Build FormData for multipart upload
  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('stock', stock);
  formData.append('category', category);
  formData.append('description', description);
  formData.append('status', 'active');

  // If user selected a file, upload it. Otherwise use URL if provided
  if (imageFile) {
    formData.append('image', imageFile);
  } else if (imageUrl) {
    formData.append('image', imageUrl);
  }

  try {
    let res;
    if (id) {
      res = await apiPutForm('/products/' + id, formData);
      if (res.success) showToast('تم تعديل المنتج بنجاح!', 'success');
    } else {
      res = await apiPostForm('/products', formData);
      if (res.success) showToast('تم إضافة المنتج بنجاح!', 'success');
    }
    if (!res.success) {
      showToast(res.message || res.error || 'حدث خطأ', 'error');
    } else {
      closeModal('productModal');
      removeImagePreview();
    }
    await loadProducts();
    updateDashboardStats();
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnText;
    }
  }
}

// ===== ORDERS =====
async function loadOrders() {
  const res = await apiGet('/orders');
  if (res.success && res.data) {
    orders = res.data;
  } else {
    orders = [];
    showToast('تعذر تحميل الطلبات: ' + (res.error || res.message || 'خطأ غير معروف'), 'error');
  }
  customers = extractCustomersFromOrders();
  renderOrdersTable();
}

function renderOrdersTable(filterText = '', statusFilter = 'all') {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  let list = orders;
  if (filterText) list = list.filter(o => (o.orderNumber || '').includes(filterText) || o.customer.name.includes(filterText) || o.customer.phone.includes(filterText));
  if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400">لا توجد طلبات</td></tr>'; return; }

  tbody.innerHTML = list.map(o => `
    <tr>
      <td class="font-bold text-primary-dark">${o.orderNumber}</td>
      <td>${o.customer.name}</td>
      <td>${o.customer.phone}</td>
      <td>${o.items.map(i => i.productName + ' x' + i.quantity).join(', ')}</td>
      <td class="font-bold">${o.totalPrice} EGP</td>
      <td>${PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod}</td>
      <td><span class="${STATUS_CONFIG[o.status]?.class || 'status-badge pending'}">${STATUS_CONFIG[o.status]?.label || o.status}</span></td>
      <td>${formatDate(o.createdAt || o.date)}</td>
      <td>
        <button class="action-btn view" onclick="viewOrder('${o._id}')" title="عرض"><i class="fas fa-eye"></i></button>
        <button class="action-btn edit" onclick="editOrder('${o._id}')" title="تعديل"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" onclick="promptDelete('order', '${o._id}')" title="حذف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function filterOrdersTable() { renderOrdersTable(document.getElementById('orderSearch')?.value || '', document.getElementById('orderStatusFilter')?.value || 'all'); }

let currentViewOrderId = null;

function viewOrder(id) {
  const o = orders.find(x => x._id == id);
  if (!o) return;
  currentViewOrderId = id;
  const status = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
  document.getElementById('viewOrderNumber').textContent = o.orderNumber;
  document.getElementById('orderViewBody').innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center gap-3 mb-4">
        <span class="${status.class}" style="font-size:1rem;padding:8px 18px;">${status.icon} ${status.label}</span>
        <span class="text-gray-400">|</span>
        <span class="text-gray-500">${formatDate(o.createdAt || o.date)}</span>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="p-4 bg-gray-50 rounded-xl">
          <h4 class="font-bold mb-3 text-primary-dark"><i class="fas fa-user ml-2"></i>بيانات العميل</h4>
          <div class="space-y-2 text-sm">
            <div><span class="text-gray-500">الاسم:</span> <span class="font-semibold">${o.customer.name}</span></div>
            <div><span class="text-gray-500">الهاتف:</span> <span class="font-semibold">${o.customer.phone}</span></div>
            <div><span class="text-gray-500">البريد:</span> <span class="font-semibold">${o.customer.email || '—'}</span></div>
            <div><span class="text-gray-500">العنوان:</span> <span class="font-semibold">${o.customer.address}</span></div>
          </div>
        </div>
        <div class="p-4 bg-gray-50 rounded-xl">
          <h4 class="font-bold mb-3 text-primary-dark"><i class="fas fa-truck ml-2"></i>الشحن والدفع</h4>
          <div class="space-y-2 text-sm">
            <div><span class="text-gray-500">الدفع:</span> <span class="font-semibold">${PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod}</span></div>
            <div><span class="text-gray-500">الشحن:</span> <span class="font-semibold">${SHIPPING_LABELS[o.shippingMethod] || o.shippingMethod}</span></div>
            <div><span class="text-gray-500">الطلب:</span> <span class="font-semibold">${o.orderNumber}</span></div>
          </div>
        </div>
      </div>
      <div class="p-4 bg-gray-50 rounded-xl">
        <h4 class="font-bold mb-3 text-primary-dark"><i class="fas fa-box ml-2"></i>المنتجات</h4>
        <div class="space-y-2">
          ${o.items.map((item, i) => `
            <div class="flex justify-between items-center p-3 bg-white rounded-lg">
              <span class="font-semibold">${i + 1}. ${item.productName} <span class="text-gray-400">x${item.quantity}</span></span>
              <span class="font-bold">${(item.price * item.quantity)} EGP</span>
            </div>
          `).join('')}
        </div>
        <div class="border-t mt-3 pt-3 flex justify-between items-center">
          <span class="font-bold text-lg">الإجمالي:</span>
          <span class="font-bold text-primary-dark text-xl">${o.totalPrice} EGP</span>
        </div>
      </div>
      ${o.notes ? `<div class="p-4 bg-yellow-50 rounded-xl border border-yellow-200"><h4 class="font-bold mb-1 text-yellow-700"><i class="fas fa-sticky-note ml-2"></i>ملاحظات</h4><p class="text-sm text-yellow-800">${o.notes}</p></div>` : ''}
    </div>
  `;
  openModal('orderViewModal');
}

function editOrder(id) {
  const o = orders.find(x => x._id == id);
  if (!o) return;
  currentViewOrderId = id;
  document.getElementById('editOrderId').value = o._id;
  document.getElementById('editOrderNumber').textContent = o.orderNumber;
  document.getElementById('editCustName').value = o.customer.name;
  document.getElementById('editCustPhone').value = o.customer.phone;
  document.getElementById('editCustEmail').value = o.customer.email || '';
  document.getElementById('editCustAddress').value = o.customer.address;
  document.getElementById('editPaymentMethod').value = o.paymentMethod;
  document.getElementById('editShippingMethod').value = o.shippingMethod;
  document.getElementById('editOrderStatus').value = o.status;
  document.getElementById('editOrderNotes').value = o.notes || '';
  document.getElementById('editOrderTotal').textContent = o.totalPrice + ' EGP';
  document.getElementById('editOrderItems').innerHTML = o.items.map((item, i) => `
    <div class="flex justify-between p-2 bg-white rounded-lg">
      <span>${i + 1}. ${item.productName} <span class="text-gray-400">x${item.quantity}</span> @ ${item.price} EGP</span>
      <span class="font-bold">${item.price * item.quantity} EGP</span>
    </div>
  `).join('');
  openModal('orderEditModal');
}

function openEditFromView() { closeModal('orderViewModal'); if (currentViewOrderId) editOrder(currentViewOrderId); }

async function saveOrderEdit() {
  const id = document.getElementById('editOrderId').value;
  const custName = document.getElementById('editCustName').value.trim();
  const custPhone = document.getElementById('editCustPhone').value.trim();
  const custAddress = document.getElementById('editCustAddress').value.trim();

  // FIX: تحقق قبل الإرسال بدل ما نسيب السيرفر يرفض الطلب بخطأ Validation
  // لو الطلب أصلاً كان محفوظ من غير بيانات عميل كاملة (زي الطلبات المخصصة)
  if (!custName || !custPhone || !custAddress) {
    showToast('يرجى ملء اسم العميل ورقم الهاتف والعنوان قبل الحفظ!', 'error');
    return;
  }

  const body = {
    customer: {
      name: custName,
      phone: custPhone,
      email: document.getElementById('editCustEmail').value.trim(),
      address: custAddress
    },
    paymentMethod: document.getElementById('editPaymentMethod').value,
    shippingMethod: document.getElementById('editShippingMethod').value,
    status: document.getElementById('editOrderStatus').value,
    notes: document.getElementById('editOrderNotes').value.trim()
  };
  const res = await apiPutJSON('/orders/' + id, body); // JSON عشان customer object متداخل يتحفظ صح
  if (res.success) {
    showToast('تم تحديث الطلب بنجاح!', 'success');
    closeModal('orderEditModal');
    await loadOrders();
    renderDashboardOrders();
    updateDashboardStats();
  } else {
    showToast(res.message || 'حدث خطأ', 'error');
  }
}

// ===== CUSTOMERS =====
function loadCustomers() { customers = extractCustomersFromOrders(); renderCustomersTable(); }

function renderCustomersTable(filter = '') {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;
  let list = customers;
  if (filter) list = customers.filter(c => c.name.includes(filter) || c.phone.includes(filter));
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-400">لا يوجد عملاء</td></tr>'; return; }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td><div class="table-product"><div class="user-avatar" style="width:40px;height:40px;border-radius:10px;">${c.name.charAt(0)}</div><div class="table-product-info"><h4>${c.name}</h4></div></div></td>
      <td>${c.email || '—'}</td>
      <td>${c.phone}</td>
      <td>${c.address}</td>
      <td>${c.orders}</td>
      <td class="font-bold">${c.total.toLocaleString()} EGP</td>
      <td>${c.date}</td>
      <td>
        <button class="action-btn view" onclick="viewCustomer('${c._id}')" title="عرض"><i class="fas fa-eye"></i></button>
        <button class="action-btn delete" onclick="promptDelete('customer', '${c._id}')" title="حذف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function filterCustomersTable() { renderCustomersTable(document.getElementById('customerSearch')?.value || ''); }

function viewCustomer(id) {
  const c = customers.find(x => x._id == id);
  if (!c) return;
  document.getElementById('customerViewBody').innerHTML = `
    <div class="text-center mb-4"><div class="user-avatar mx-auto" style="width:80px;height:80px;font-size:2rem;">${c.name.charAt(0)}</div><h3 class="font-bold text-xl mt-3">${c.name}</h3></div>
    <div class="space-y-3">
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">البريد:</span><span class="font-bold">${c.email || '—'}</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">الهاتف:</span><span class="font-bold">${c.phone}</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">العنوان:</span><span class="font-bold">${c.address}</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">الطلبات:</span><span class="font-bold">${c.orders}</span></div>
      <div class="flex justify-between p-3 bg-gray-50 rounded-xl"><span class="text-gray-500">المشتريات:</span><span class="font-bold text-primary-dark">${c.total.toLocaleString()} EGP</span></div>
    </div>
  `;
  openModal('customerViewModal');
}

// ===== GALLERY =====
async function loadGallery() {
  const res = await apiGet('/gallery');
  if (res.success && res.data) {
    galleryItems = res.data;
  } else {
    galleryItems = [];
  }
  renderGalleryGrid();
}

function renderGalleryGrid() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  if (!galleryItems.length) { grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-400">لا توجد صور</div>'; return; }
  grid.innerHTML = galleryItems.map(g => `
    <div class="gallery-item" style="position:relative;">
      <img src="${g.image || g.img}" alt="${g.title}" style="width:100%;height:220px;object-fit:cover;border-radius:16px;" onerror="this.src='https://placehold.co/400'">
      <div class="gallery-overlay" style="border-radius:16px;"><h4>${g.title}</h4><p>${g.desc || g.description} — ${g.category}</p></div>
      <div style="position:absolute;top:10px;left:10px;display:flex;gap:6px;">
        <button class="action-btn edit" onclick="editGalleryItem('${g._id}')" title="تعديل" style="background:rgba(255,255,255,0.9);"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" onclick="promptDelete('gallery', '${g._id}')" title="حذف" style="background:rgba(255,255,255,0.9);"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function openGalleryModal() {
  document.getElementById('galleryModalTitle').textContent = 'إضافة صورة للمعرض';
  document.getElementById('galleryEditId').value = '';
  ['galTitle','galDesc','galCategory','galImage'].forEach(id => document.getElementById(id).value = '');
  openModal('galleryModal');
}

function editGalleryItem(id) {
  const g = galleryItems.find(x => x._id == id);
  if (!g) return;
  document.getElementById('galleryModalTitle').textContent = 'تعديل صورة';
  document.getElementById('galleryEditId').value = g._id;
  document.getElementById('galTitle').value = g.title;
  document.getElementById('galDesc').value = g.desc || g.description || '';
  document.getElementById('galCategory').value = g.category;
  document.getElementById('galImage').value = g.image || g.img || '';
  openModal('galleryModal');
}

async function saveGalleryItem() {
  const id = document.getElementById('galleryEditId').value;
  const body = { title: document.getElementById('galTitle').value.trim(), description: document.getElementById('galDesc').value.trim(), category: document.getElementById('galCategory').value.trim(), image: document.getElementById('galImage').value.trim() };
  if (!body.title || !body.category) { showToast('يرجى ملء الحقول المطلوبة!', 'error'); return; }

  let res;
  if (id) { res = await apiPutForm('/gallery/' + id, new URLSearchParams(body)); if (res.success) showToast('تم تعديل الصورة!', 'success'); }
  else { res = await apiPostForm('/gallery', new URLSearchParams(body)); if (res.success) showToast('تم إضافة الصورة!', 'success'); }
  if (!res.success) showToast(res.message || 'حدث خطأ', 'error');

  closeModal('galleryModal');
  await loadGallery();
}

// ===== DELETE =====
let deleteTarget = { type: null, id: null };
function promptDelete(type, id) {
  deleteTarget = { type, id };
  const names = { product: 'المنتج', order: 'الطلب', customer: 'العميل', gallery: 'الصورة' };
  document.getElementById('deleteConfirmText').textContent = `سيتم حذف ${names[type]} نهائياً.`;
  openModal('deleteConfirmModal');
}

async function confirmDelete() {
  const { type, id } = deleteTarget;
  let res;
  if (type === 'product') {
    res = await apiDelete('/products/' + id);
    if (res.success) { products = products.filter(p => p._id != id); renderProductsTable(); }
  } else if (type === 'order') {
    res = await apiDelete('/orders/' + id);
    if (res.success) { orders = orders.filter(o => o._id != id); renderOrdersTable(); renderDashboardOrders(); }
  } else if (type === 'customer') {
    customers = customers.filter(c => c._id != id);
    renderCustomersTable();
    closeModal('deleteConfirmModal');
    showToast('تم الحذف من العرض فقط', 'success');
    return;
  } else if (type === 'gallery') {
    res = await apiDelete('/gallery/' + id);
    if (res.success) { galleryItems = galleryItems.filter(g => g._id != id); renderGalleryGrid(); }
  }
  updateDashboardStats();
  closeModal('deleteConfirmModal');
  showToast(res?.success ? 'تم الحذف بنجاح!' : (res?.message || 'حدث خطأ'), res?.success ? 'success' : 'error');
}

// ===== CHARTS =====
let salesChartInstance = null;
let ordersChartInstance = null;

// FIX: بيانات المبيعات كانت مكتوبة يدويًا (hardcoded) بدل ما تتحسب من orders
// الحقيقية. الفنكشن دي بتجمع مبيعات آخر 6 شهور من array الطلبات الفعلي
// (بتستبعد الطلبات الملغاة) وترجع labels + data جاهزين للشارت.
function getMonthlySalesData() {
  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: monthNames[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), total: 0 });
  }
  orders.forEach(o => {
    if (o.status === 'cancelled') return;
    const d = new Date(o.createdAt || o.date);
    if (isNaN(d)) return; // تاريخ غير صالح (نص عربي مثلاً) بيتجاهل بدل ما يبوظ الحساب
    const bucket = months.find(m => m.month === d.getMonth() && m.year === d.getFullYear());
    if (bucket) bucket.total += (o.totalPrice || 0);
  });
  return { labels: months.map(m => m.label), data: months.map(m => m.total) };
}

function initCharts() {
  const salesCtx = document.getElementById('salesChart');
  if (salesCtx) {
    if (salesChartInstance) salesChartInstance.destroy();
    const monthly = getMonthlySalesData();
    salesChartInstance = new Chart(salesCtx, {
      type: 'line',
      data: {
        labels: monthly.labels,
        datasets: [{
          label: 'المبيعات (EGP)',
          data: monthly.data,
          borderColor: '#C8A2C8',
          backgroundColor: 'rgba(200, 162, 200, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#C8A2C8',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Cairo' } } },
          x: { grid: { display: false }, ticks: { font: { family: 'Cairo' } } }
        }
      }
    });
  }

  const ordersCtx = document.getElementById('ordersChart');
  if (ordersCtx) {
    if (ordersChartInstance) ordersChartInstance.destroy();
    const counts = { pending: orders.filter(o => o.status === 'pending').length, processing: orders.filter(o => o.status === 'processing').length, delivered: orders.filter(o => o.status === 'delivered').length, cancelled: orders.filter(o => o.status === 'cancelled').length };
    ordersChartInstance = new Chart(ordersCtx, {
      type: 'doughnut',
      data: { labels: ['قيد المراجعة', 'قيد المعالجة', 'تم التسليم', 'إلغاء'], datasets: [{ data: [counts.pending, counts.processing, counts.delivered, counts.cancelled], backgroundColor: ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 12 }, padding: 20, usePointStyle: true } } } }
    });
  }
}


// ===== SETTINGS API =====
async function loadSettings() {
  const res = await apiGet('/settings');
  if (res.success && res.data) {
    const settings = res.data;
    // Update WhatsApp number in all links
    if (settings.whatsapp_number) {
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link => {
        link.href = `https://wa.me/${settings.whatsapp_number}`;
      });
    }
    return settings;
  }
  return {};
}

async function saveSetting(key, value) {
  const res = await apiPutForm('/settings', new URLSearchParams({ key, value }));
  if (res.success) showToast('تم حفظ الإعداد!', 'success');
  else showToast(res.message || 'حدث خطأ', 'error');
  return res;
}


// ===== API CONFIG =====
function saveApiUrl() {
  const url = document.getElementById('apiUrlInput')?.value.trim();
  if (!url) { showToast('يرجى إدخال رابط السيرفر!', 'error'); return; }
  localStorage.setItem('classy_api_url', url);
  API_URL = url;
  showToast('تم حفظ رابط السيرفر! جاري إعادة التحميل...', 'success');
  setTimeout(() => location.reload(), 1000);
}

async function testApiConnection() {
  const resultDiv = document.getElementById('apiTestResult');
  if (!resultDiv) return;
  resultDiv.innerHTML = '<span class="text-blue-500">جاري الاختبار...</span>';
  try {
    const res = await fetchWithTimeout(getApiUrl().replace('/api', '') + '/api/health', {}, 15000);
    const data = await res.json();
    if (data.success) {
      resultDiv.innerHTML = '<span class="text-green-500"><i class="fas fa-check-circle"></i> الاتصال ناجح! السيرفر يعمل.</span>';
    } else {
      resultDiv.innerHTML = '<span class="text-yellow-500">⚠️ السيرفر رد بس فيه مشكلة.</span>';
    }
  } catch (e) {
    resultDiv.innerHTML = '<span class="text-red-500"><i class="fas fa-times-circle"></i> ' + describeFetchError(e) + '</span>';
  }
}

async function saveAllSettings() {
  const settings = {
    store_name: document.getElementById('settingsStoreName')?.value || 'CLASSY',
    store_email: document.getElementById('settingsStoreEmail')?.value || '',
    store_phone: document.getElementById('settingsStorePhone')?.value || '',
    store_address: document.getElementById('settingsStoreAddress')?.value || '',
    whatsapp_number: document.getElementById('settingsWhatsapp')?.value || '201226832747',
    facebook_url: document.getElementById('settingsFacebook')?.value || '',
    instagram_url: document.getElementById('settingsInstagram')?.value || '',
    tiktok_url: document.getElementById('settingsTiktok')?.value || '',
    shipping_standard_cost: document.getElementById('settingsShippingStandardCost')?.value || '0',
    shipping_express_cost: document.getElementById('settingsShippingExpressCost')?.value || '50',
    shipping_standard_days: document.getElementById('settingsShippingStandardDays')?.value || '3',
    shipping_express_days: document.getElementById('settingsShippingExpressDays')?.value || '1',
  };

  const res = await apiPutForm('/settings/bulk', new URLSearchParams(settings));
  if (res.success) {
    showToast('تم حفظ جميع الإعدادات بنجاح!', 'success');
  } else {
    // Fallback: save to localStorage
    Object.entries(settings).forEach(([k, v]) => localStorage.setItem('classy_setting_' + k, v));
    showToast('تم حفظ الإعدادات محلياً (لا يوجد سيرفر)', 'success');
  }
}

async function loadSettingsToForm() {
  const res = await apiGet('/settings');
  if (res.success && res.data) {
    const s = res.data;
    if (document.getElementById('settingsStoreName')) document.getElementById('settingsStoreName').value = s.store_name || '';
    if (document.getElementById('settingsStoreEmail')) document.getElementById('settingsStoreEmail').value = s.store_email || '';
    if (document.getElementById('settingsStorePhone')) document.getElementById('settingsStorePhone').value = s.store_phone || '';
    if (document.getElementById('settingsStoreAddress')) document.getElementById('settingsStoreAddress').value = s.store_address || '';
    if (document.getElementById('settingsWhatsapp')) document.getElementById('settingsWhatsapp').value = s.whatsapp_number || '201226832747';
    if (document.getElementById('settingsFacebook')) document.getElementById('settingsFacebook').value = s.facebook_url || '';
    if (document.getElementById('settingsInstagram')) document.getElementById('settingsInstagram').value = s.instagram_url || '';
    if (document.getElementById('settingsTiktok')) document.getElementById('settingsTiktok').value = s.tiktok_url || '';
    if (document.getElementById('settingsShippingStandardCost')) document.getElementById('settingsShippingStandardCost').value = s.shipping_standard_cost || '0';
    if (document.getElementById('settingsShippingExpressCost')) document.getElementById('settingsShippingExpressCost').value = s.shipping_express_cost || '50';
    if (document.getElementById('settingsShippingStandardDays')) document.getElementById('settingsShippingStandardDays').value = s.shipping_standard_days || '3';
    if (document.getElementById('settingsShippingExpressDays')) document.getElementById('settingsShippingExpressDays').value = s.shipping_express_days || '1';
  } else {
    // Load from localStorage fallback
    if (document.getElementById('settingsWhatsapp')) document.getElementById('settingsWhatsapp').value = localStorage.getItem('classy_setting_whatsapp_number') || '201226832747';
  }

  // Load API URL
  const savedApi = localStorage.getItem('classy_api_url');
  if (savedApi && document.getElementById('apiUrlInput')) {
    document.getElementById('apiUrlInput').value = savedApi;
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() { loadAllData(); });
