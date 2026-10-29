/* Promiden Pharmaceuticals Ltd — M04 admin dashboard prototype.
 * Browser storage is only a local draft convenience, not shared persistence or access control.
 * Connect authenticated Express endpoints and Supabase before production use.
 */
(() => {
  'use strict';
  const STORAGE = {
    homepage: 'promiden.m04.homepageDraft',
    products: 'promiden.m04.productsDraft',
    services: 'promiden.m04.servicesDraft',
    contact: 'promiden.m04.contactDraft'
  };
  const DEFAULTS = {
    homepage: {
      brandName: 'PROMIDEN',
      heroTitle: 'Better health starts with trusted care.',
      heroDescription: 'Your partner in pharmaceutical products, responsible medicine distribution, and healthcare consultancy.'
    },
    products: [
      { id: 'sample-wellness', name: 'Vitamin & wellness range', description: 'Wellness products selected to support everyday health needs.', category: 'Wellness', price: '', imageUrl: '', published: true },
      { id: 'sample-first-aid', name: 'First-aid essentials', description: 'Everyday care supplies for appropriate first-aid preparedness.', category: 'First aid', price: '', imageUrl: '', published: true },
      { id: 'sample-everyday', name: 'Everyday care essentials', description: 'Practical personal-care products for daily routines and wellbeing.', category: 'Everyday care', price: '', imageUrl: '', published: true }
    ],
    services: [
      { id: 'sample-distribution', title: 'Pharmaceutical distribution', description: 'Support for responsible supply and distribution of pharmaceutical and OTC products.', imageUrl: '', published: true },
      { id: 'sample-consultancy', title: 'Medical consultancy', description: 'Connect with our team to discuss healthcare consultancy needs and available support.', imageUrl: '', published: true },
      { id: 'sample-guidance', title: 'Healthcare product guidance', description: 'Help finding relevant product information and directing enquiries to the appropriate team.', imageUrl: '', published: true }
    ],
    contact: { email: 'info@promidenpharma.com', phone: '', facebook: '', twitter: '', instagram: '' }
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let state = {
    homepage: readDraft('homepage'),
    products: readDraft('products'),
    services: readDraft('services'),
    contact: readDraft('contact')
  };
  let editorKind = 'products';
  let editingId = null;
  const API_BASE = (window.PROMIDEN_API_BASE || '').replace(/\/$/, '');
  const ORDER_PAGE_SIZE = 25;
  let ordersOffset = 0;
  let ordersTotal = 0;
  let selectedOrderId = null;

  function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
  function readDraft(key) {
    try {
      const raw = localStorage.getItem(STORAGE[key]);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (key === 'products' || key === 'services') return Array.isArray(parsed) ? parsed : deepCopy(DEFAULTS[key]);
        return parsed && typeof parsed === 'object' ? { ...deepCopy(DEFAULTS[key]), ...parsed } : deepCopy(DEFAULTS[key]);
      }
    } catch (_) { /* Storage may be disabled; continue with in-memory defaults. */ }
    return deepCopy(DEFAULTS[key]);
  }
  function persistDraft(key) {
    try {
      localStorage.setItem(STORAGE[key], JSON.stringify(state[key]));
      notify('Draft saved in this browser. It is not yet published or shared with other visitors.', 'success');
    } catch (_) {
      notify('The draft is in memory only because browser storage is unavailable. Copy or save your changes before leaving this page.', 'error');
    }
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function safeImageUrl(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    try {
      const url = new URL(trimmed, window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function notify(text, kind = 'info') {
    const box = $('#dashboard-notice');
    box.textContent = text;
    box.className = `dashboard-notice ${kind}`;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function navigate(panel) {
    const target = $(`#panel-${panel}`);
    if (!target) return;
    $$('.dashboard-panel').forEach(section => {
      section.hidden = section !== target;
      section.classList.toggle('active', section === target);
    });
    $$('.sidebar-link').forEach(button => button.classList.toggle('active', button.dataset.panel === panel));
    const warning = $('#prototype-warning');
    warning.hidden = panel === 'admins' || panel === 'orders';
    if (panel === 'orders') loadOrders();
    document.title = `${target.dataset.title || 'Dashboard'} | Promiden Pharmaceuticals Ltd`;
    if (window.matchMedia('(max-width: 760px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function fillForms() {
    $('#brand-name-input').value = state.homepage.brandName || '';
    $('#hero-title-input').value = state.homepage.heroTitle || '';
    $('#hero-description-input').value = state.homepage.heroDescription || '';
    $('#contact-email-input').value = state.contact.email || '';
    $('#contact-phone-input').value = state.contact.phone || '';
    $('#facebook-input').value = state.contact.facebook || '';
    $('#twitter-input').value = state.contact.twitter || '';
    $('#instagram-input').value = state.contact.instagram || '';
    updateDescriptionCount();
  }
  function updateOverview() {
    $('#overview-product-count').textContent = String(state.products.length);
    $('#overview-service-count').textContent = String(state.services.length);
    $('#product-list-count').textContent = `${state.products.length} ${state.products.length === 1 ? 'item' : 'items'}`;
    $('#service-list-count').textContent = `${state.services.length} ${state.services.length === 1 ? 'item' : 'items'}`;
  }
  function updateDescriptionCount() {
    const field = $('#hero-description-input');
    $('#hero-description-count').textContent = `${field.value.length} / 500`;
  }
  function renderItems(kind) {
    const items = state[kind];
    const isProduct = kind === 'products';
    const list = $(`#${kind}-list`);
    if (!items.length) {
      list.innerHTML = `<div class="empty-list"><strong>No ${isProduct ? 'products' : 'services'} added yet.</strong>Use the “Add ${isProduct ? 'product' : 'service'}” button to create the first item.</div>`;
      updateOverview();
      return;
    }
    list.innerHTML = items.map((item, index) => {
      const name = isProduct ? item.name : item.title;
      const image = safeImageUrl(item.imageUrl);
      const meta = isProduct
        ? `<span class="managed-tag">${escapeHtml(item.category || 'Uncategorised')}</span>${item.price ? `<span class="managed-tag">${escapeHtml(item.price)}</span>` : '<span class="managed-tag">Price not set</span>'}`
        : `<span class="managed-tag">Service ${String(index + 1).padStart(2, '0')}</span>`;
      return `<article class="managed-item" data-id="${escapeHtml(item.id)}">
        <div class="managed-item-mark" aria-hidden="true">${image ? '▧' : (isProduct ? '▦' : '✚')}</div>
        <div class="managed-item-main"><h3>${escapeHtml(name || (isProduct ? 'Untitled product' : 'Untitled service'))}</h3><p>${escapeHtml(item.description || 'No description provided.')}</p><div class="managed-item-meta">${meta}<span class="managed-tag">${item.published === false ? 'Hidden' : 'Visible in draft'}</span>${image ? '<span class="managed-tag">Image URL set</span>' : ''}</div></div>
        <div class="managed-actions"><button class="small-action" type="button" data-edit-kind="${kind}" data-id="${escapeHtml(item.id)}">Edit</button><button class="small-action" type="button" data-toggle-kind="${kind}" data-id="${escapeHtml(item.id)}">${item.published === false ? 'Show' : 'Hide'}</button><button class="small-action danger" type="button" data-delete-kind="${kind}" data-id="${escapeHtml(item.id)}">Remove</button></div>
      </article>`;
    }).join('');
    updateOverview();
  }
  function openEditor(kind, id = null) {
    editorKind = kind;
    editingId = id;
    const isProduct = kind === 'products';
    const item = id ? state[kind].find(entry => entry.id === id) : null;
    $('#item-dialog-kicker').textContent = isProduct ? 'PRODUCT CATALOGUE' : 'SERVICE CATALOGUE';
    $('#item-dialog-title').textContent = `${item ? 'Edit' : 'Add'} ${isProduct ? 'product' : 'service'}`;
    const nameLabel = isProduct ? 'Product name' : 'Service title';
    const nameValue = item ? (isProduct ? item.name : item.title) : '';
    const categoryField = isProduct ? `<div class="dashboard-field"><label for="item-category">Category</label><select id="item-category" name="category" required><option value="Wellness">Wellness</option><option value="First aid">First aid</option><option value="Everyday care">Everyday care</option><option value="Prescription medicines">Prescription medicines</option><option value="OTC medicines">OTC medicines</option><option value="Other">Other</option></select></div><div class="dashboard-field"><label for="item-price">Price (optional)</label><input id="item-price" name="price" maxlength="80" placeholder="Leave blank until verified"></div>` : '';
    $('#item-fields').innerHTML = `<div class="dashboard-field"><label for="item-name">${nameLabel}</label><input id="item-name" name="name" required maxlength="140" value="${escapeHtml(nameValue)}"></div>
      <div class="dashboard-field"><label for="item-description">Description</label><textarea id="item-description" name="description" rows="4" required maxlength="700">${escapeHtml(item ? item.description : '')}</textarea><small>Keep the wording accurate and avoid unsupported medical claims.</small></div>
      ${categoryField}
      <div class="dashboard-field"><label for="item-image">Image URL (optional)</label><input id="item-image" name="imageUrl" type="url" maxlength="1000" value="${escapeHtml(item ? item.imageUrl : '')}" placeholder="https://…"><small>Image upload/storage is part of backend integration. For this prototype, use a public HTTPS image URL.</small></div>
      <label class="visibility-option"><input id="item-published" name="published" type="checkbox" ${!item || item.published !== false ? 'checked' : ''}> Show this item on the website draft</label>`;
    if (isProduct && item) $('#item-category').value = item.category || 'Other';
    if (isProduct && !item) $('#item-category').value = 'Wellness';
    const dialog = $('#item-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', 'open');
    $('#item-name').focus();
  }
  function closeEditor() {
    const dialog = $('#item-dialog');
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }
  function deleteItem(kind, id) {
    const item = state[kind].find(entry => entry.id === id);
    if (!item) return;
    const name = kind === 'products' ? item.name : item.title;
    if (!window.confirm(`Remove “${name || 'this item'}” from the local draft?`)) return;
    state[kind] = state[kind].filter(entry => entry.id !== id);
    renderItems(kind);
    persistDraft(kind);
  }
  function resetDraft(key) {
    const label = key === 'homepage' ? 'homepage content' : key === 'contact' ? 'contact details' : key;
    if (!window.confirm(`Reset ${label} to the original starter values? This only affects this browser draft.`)) return;
    state[key] = deepCopy(DEFAULTS[key]);
    try { localStorage.removeItem(STORAGE[key]); } catch (_) { /* Ignore unavailable storage. */ }
    if (key === 'homepage' || key === 'contact') fillForms();
    if (key === 'products' || key === 'services') renderItems(key);
    notify(`${label[0].toUpperCase() + label.slice(1)} reset to starter values.`, 'info');
  }
  function validOptionalUrl(value) {
    if (!value.trim()) return true;
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch (_) { return false; }
  }
  function moneyMinor(value, currency = 'NGN') {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(number / 100);
  }
  function statusLabel(value) { return String(value || 'unknown').replaceAll('_', ' '); }
  async function adminRequest(path, options = {}) {
    const response = await fetch(API_BASE + path, { ...options, credentials: 'include', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.assign('admin-login.html'); throw new Error('Your administrator session has expired. Sign in again.'); }
    if (!response.ok || payload.success === false) throw new Error(payload.message || 'The request could not be completed.');
    return payload;
  }
  async function loadOrders() {
    const list = $('#orders-list');
    if (!list) return;
    list.innerHTML = '<div class="empty-list">Loading orders…</div>';
    const params = new URLSearchParams({ limit: String(ORDER_PAGE_SIZE), offset: String(ordersOffset) });
    const orderStatus = $('#orders-status-filter').value;
    const paymentStatus = $('#payments-status-filter').value;
    if (orderStatus) params.set('order_status', orderStatus);
    if (paymentStatus) params.set('payment_status', paymentStatus);
    try {
      const result = await adminRequest('/api/admin/orders?' + params.toString());
      ordersTotal = result.pagination.total;
      $('#orders-count').textContent = `${ordersTotal} ${ordersTotal === 1 ? 'order' : 'orders'}`;
      $('#orders-page-label').textContent = ordersTotal ? `Showing ${ordersOffset + 1}–${Math.min(ordersOffset + ORDER_PAGE_SIZE, ordersTotal)} of ${ordersTotal}` : 'No orders';
      $('#orders-prev-button').disabled = ordersOffset <= 0;
      $('#orders-next-button').disabled = ordersOffset + ORDER_PAGE_SIZE >= ordersTotal;
      if (!result.orders.length) { list.innerHTML = '<div class="empty-list"><strong>No matching orders.</strong>Orders will appear here after customers submit checkout orders.</div>'; return; }
      list.innerHTML = result.orders.map(order => `<article class="order-row"><div class="order-main"><strong>${escapeHtml(order.orderNumber)} · ${escapeHtml(order.customerName)}</strong><small>${escapeHtml(order.customerEmail)} · ${escapeHtml(order.customerPhone)}<br>${escapeHtml(new Date(order.createdAt).toLocaleString())}</small></div><div><div class="order-money">${escapeHtml(moneyMinor(order.totalMinor, order.currency))}</div><div class="order-badges"><span class="order-badge ${escapeHtml(order.orderStatus)}">${escapeHtml(statusLabel(order.orderStatus))}</span><span class="order-badge ${escapeHtml(order.paymentStatus)}">${escapeHtml(statusLabel(order.paymentStatus))}</span></div></div><div class="order-main"><small>Type</small><strong>${escapeHtml(order.orderType)}</strong></div><button class="small-action" type="button" data-view-order="${escapeHtml(order.id)}">View details</button></article>`).join('');
    } catch (error) {
      list.innerHTML = `<div class="empty-list"><strong>Orders could not be loaded.</strong>${escapeHtml(error.message)}<br>Confirm the API base URL and backend session configuration.</div>`;
      $('#orders-count').textContent = 'Unavailable';
    }
  }
  async function loadOrderDetail(id) {
    selectedOrderId = id;
    const card = $('#order-detail-card');
    card.hidden = false;
    $('#order-detail-content').innerHTML = '<p>Loading order details…</p>';
    try {
      const result = await adminRequest('/api/admin/orders/' + encodeURIComponent(id));
      const order = result.order;
      $('#order-detail-title').textContent = `${order.orderNumber} · ${order.customerName}`;
      $('#order-detail-meta').textContent = `${order.customerEmail} · ${order.customerPhone} · Created ${new Date(order.createdAt).toLocaleString()}`;
      const items = result.items.length ? `<div class="order-detail-section"><h3>Items</h3><table class="order-detail-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>${result.items.map(item => `<tr><td>${escapeHtml(item.name)}<br><small>${escapeHtml(item.type)}</small></td><td>${item.quantity}</td><td>${escapeHtml(moneyMinor(item.unitPriceMinor, order.currency))}</td><td>${escapeHtml(moneyMinor(item.lineTotalMinor, order.currency))}</td></tr>`).join('')}</tbody></table></div>` : '<p>No item records found.</p>';
      const txs = result.transactions.length ? `<div class="order-detail-section"><h3>Payment attempts</h3><table class="order-detail-table"><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Channel</th><th>Verified</th></tr></thead><tbody>${result.transactions.map(tx => `<tr><td>${escapeHtml(tx.reference)}<br><small>${escapeHtml(tx.transactionId || '')}</small></td><td>${escapeHtml(moneyMinor(tx.amountMinor, tx.currency))}</td><td><span class="order-badge ${escapeHtml(tx.status)}">${escapeHtml(statusLabel(tx.status))}</span></td><td>${escapeHtml(tx.channel || '—')}</td><td>${escapeHtml(tx.verifiedAt ? new Date(tx.verifiedAt).toLocaleString() : 'Not verified')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="order-detail-section"><h3>Payment attempts</h3><p>No payment initialization records yet.</p></div>';
      const note = order.customerNote ? `<div class="order-detail-section"><h3>Customer note</h3><div class="order-detail-note">${escapeHtml(order.customerNote)}</div></div>` : '';
      const canProcess = order.paymentStatus === 'successful' && !['cancelled','fulfilled'].includes(order.orderStatus);
      const canCancel = order.paymentStatus !== 'successful' && order.orderStatus !== 'cancelled';
      const actions = canProcess || canCancel ? `<form id="order-status-form" class="order-status-actions"><label for="order-next-status">Fulfilment status<select id="order-next-status">${canProcess ? '<option value="processing">Processing</option><option value="fulfilled">Fulfilled</option>' : ''}${canCancel ? '<option value="cancelled">Cancel unpaid order</option>' : ''}</select></label><button class="button button-primary" type="submit">Update order</button></form>` : '';
      $('#order-detail-content').innerHTML = `<div class="order-badges"><span class="order-badge ${escapeHtml(order.orderStatus)}">Order: ${escapeHtml(statusLabel(order.orderStatus))}</span><span class="order-badge ${escapeHtml(order.paymentStatus)}">Payment: ${escapeHtml(statusLabel(order.paymentStatus))}</span><span class="order-badge">Total: ${escapeHtml(moneyMinor(order.totalMinor, order.currency))}</span></div>${items}${txs}${note}<p class="order-detail-note">Payment status is read-only. It can only be changed by verified Paystack transaction processing. A paid order cannot be cancelled here; handle refunds through Paystack separately.</p>${actions}`;
      const form = $('#order-status-form');
      if (form) form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]'); button.disabled = true;
        try {
          await adminRequest('/api/admin/orders/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ orderStatus: $('#order-next-status').value }) });
          notify('Order status updated.', 'success'); await loadOrders(); await loadOrderDetail(id);
        } catch (error) { notify(error.message, 'error'); button.disabled = false; }
      });
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      $('#order-detail-content').innerHTML = `<div class="empty-list"><strong>Order details unavailable.</strong>${escapeHtml(error.message)}</div>`;
    }
  }

  function init() {
    $('#today-label').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date());
    $('#orders-refresh-button').addEventListener('click', loadOrders);
    $('#orders-filter-button').addEventListener('click', () => { ordersOffset = 0; loadOrders(); });
    $('#orders-prev-button').addEventListener('click', () => { ordersOffset = Math.max(0, ordersOffset - ORDER_PAGE_SIZE); loadOrders(); });
    $('#orders-next-button').addEventListener('click', () => { if (ordersOffset + ORDER_PAGE_SIZE < ordersTotal) ordersOffset += ORDER_PAGE_SIZE; loadOrders(); });
    $('#orders-list').addEventListener('click', event => { const button = event.target.closest('[data-view-order]'); if (button) loadOrderDetail(button.dataset.viewOrder); });
    $('#order-detail-close').addEventListener('click', () => { $('#order-detail-card').hidden = true; selectedOrderId = null; });
    fillForms();
    renderItems('products');
    renderItems('services');

    $$('.sidebar-link').forEach(button => button.addEventListener('click', () => navigate(button.dataset.panel)));
    $$('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
    $$('[data-reset]').forEach(button => button.addEventListener('click', () => resetDraft(button.dataset.reset)));
    $('#hero-description-input').addEventListener('input', updateDescriptionCount);

    $('#homepage-form').addEventListener('submit', event => {
      event.preventDefault();
      state.homepage = {
        brandName: $('#brand-name-input').value.trim(),
        heroTitle: $('#hero-title-input').value.trim(),
        heroDescription: $('#hero-description-input').value.trim()
      };
      if (!state.homepage.brandName || !state.homepage.heroTitle || !state.homepage.heroDescription) {
        notify('Complete all brand and hero fields before saving.', 'error'); return;
      }
      persistDraft('homepage');
    });
    $('#contact-form').addEventListener('submit', event => {
      event.preventDefault();
      const contact = {
        email: $('#contact-email-input').value.trim(), phone: $('#contact-phone-input').value.trim(),
        facebook: $('#facebook-input').value.trim(), twitter: $('#twitter-input').value.trim(), instagram: $('#instagram-input').value.trim()
      };
      if (contact.email && !$('#contact-email-input').checkValidity()) { notify('Enter a valid email address.', 'error'); $('#contact-email-input').focus(); return; }
      for (const key of ['facebook', 'twitter', 'instagram']) {
        if (!validOptionalUrl(contact[key])) { notify(`Enter a valid HTTP or HTTPS URL for ${key}.`, 'error'); $(`#${key}-input`).focus(); return; }
      }
      state.contact = contact;
      persistDraft('contact');
    });

    $('#add-product-button').addEventListener('click', () => openEditor('products'));
    $('#add-service-button').addEventListener('click', () => openEditor('services'));
    $('#save-products-button').addEventListener('click', () => persistDraft('products'));
    $('#save-services-button').addEventListener('click', () => persistDraft('services'));
    $('#products-list').addEventListener('click', handleListAction);
    $('#services-list').addEventListener('click', handleListAction);
    function handleListAction(event) {
      const button = event.target.closest('button');
      if (!button) return;
      const kind = button.dataset.editKind || button.dataset.toggleKind || button.dataset.deleteKind;
      const id = button.dataset.id;
      if (!kind || !id) return;
      if (button.dataset.editKind) openEditor(kind, id);
      else if (button.dataset.deleteKind) deleteItem(kind, id);
      else if (button.dataset.toggleKind) {
        const item = state[kind].find(entry => entry.id === id);
        if (!item) return;
        item.published = item.published === false;
        renderItems(kind);
        persistDraft(kind);
      }
    }
    $('#item-form').addEventListener('submit', event => {
      event.preventDefault();
      const name = $('#item-name').value.trim();
      const description = $('#item-description').value.trim();
      const imageUrl = $('#item-image').value.trim();
      if (!name || !description) { notify('A title and description are required.', 'error'); return; }
      if (imageUrl && !validOptionalUrl(imageUrl)) { notify('Use a valid HTTP or HTTPS image URL.', 'error'); $('#item-image').focus(); return; }
      const item = {
        id: editingId || `${editorKind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description, imageUrl: safeImageUrl(imageUrl), published: $('#item-published').checked
      };
      if (editorKind === 'products') {
        item.name = name;
        item.category = $('#item-category').value;
        item.price = $('#item-price').value.trim();
      } else item.title = name;
      const index = state[editorKind].findIndex(entry => entry.id === editingId);
      if (index >= 0) state[editorKind][index] = item; else state[editorKind].push(item);
      closeEditor();
      renderItems(editorKind);
      persistDraft(editorKind);
    });
    $('#dialog-close').addEventListener('click', closeEditor);
    $('#dialog-cancel').addEventListener('click', closeEditor);
    $('#item-dialog').addEventListener('click', event => { if (event.target === $('#item-dialog')) closeEditor(); });

    $('#logout-button').addEventListener('click', async () => {
      try {
        await fetch(API_BASE + '/api/admin/logout', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } });
      } catch (_) { /* A redirect is still useful in frontend-only mode. */ }
      window.location.assign('admin-login.html');
    });
    $('#create-admin-form').addEventListener('submit', event => {
      event.preventDefault();
      notify('Administrator management is disabled until the authenticated backend is implemented.', 'info');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
