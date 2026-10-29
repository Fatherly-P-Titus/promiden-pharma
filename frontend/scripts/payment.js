/* Promiden M07 order review. Payment is intentionally disabled until M08 backend endpoints exist. */
(function ($) {
  "use strict";
  const API_BASE = (window.PROMIDEN_API_BASE || "").replace(/\/$/, "");
  const CART_KEY = "promiden_checkout_cart_v1";
  const state = { catalogue: [], cart: readCart(), type: "all", query: "" };
  const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 });

  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
  function safeImage(value) { if (!value) return ""; try { const u = new URL(value, window.location.origin); return ["http:","https:"].includes(u.protocol) ? u.href : ""; } catch (_) { return ""; } }
  function readCart() { try { const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(parsed) ? parsed.filter(x => x && typeof x.id === "string" && ["product","service"].includes(x.type) && Number.isInteger(x.quantity) && x.quantity > 0 && x.quantity <= 1000) : []; } catch (_) { return []; } }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (_) {} }
  function formatPrice(minor) { return Number.isSafeInteger(Number(minor)) && Number(minor) > 0 ? money.format(Number(minor) / 100) : ""; }
  function itemKey(type, id) { return type + ":" + id; }
  function itemFor(line) { return state.catalogue.find(x => x.type === line.type && x.id === line.id); }
  function totalCount() { return state.cart.reduce((sum, line) => sum + line.quantity, 0); }
  function totalMinor() { return state.cart.reduce((sum, line) => { const item = itemFor(line); return sum + (item && Number.isSafeInteger(Number(item.price_minor)) ? Number(item.price_minor) * line.quantity : 0); }, 0); }

  async function loadCatalogue() {
    const results = await Promise.allSettled([
      $.ajax({ url: API_BASE + "/api/public/products", method: "GET", dataType: "json", timeout: 6000 }),
      $.ajax({ url: API_BASE + "/api/public/services", method: "GET", dataType: "json", timeout: 6000 })
    ]);
    const products = results[0].status === "fulfilled" && Array.isArray(results[0].value) ? results[0].value : [];
    const services = results[1].status === "fulfilled" && Array.isArray(results[1].value) ? results[1].value : [];
    state.catalogue = products.map(p => ({ id: String(p.id), type: "product", name: p.name || "Product", description: p.description || "", category: p.category || "Product", image: p.imageUrl || p.image_url || "", price_minor: p.price_minor == null ? null : Number(p.price_minor), published: p.published !== false }))
      .concat(services.map(s => ({ id: String(s.id), type: "service", name: s.title || s.name || "Service", description: s.description || "", category: "Service", image: s.imageUrl || s.image_url || "", price_minor: s.price_minor == null ? null : Number(s.price_minor), published: s.published !== false })))
      .filter(x => x.published);
    renderCatalogue(); renderCart();
    const failed = results.every(r => r.status === "rejected");
    if (failed) {
      $("#catalogue-list").html('<div class="empty-results"><strong>Catalogue could not be loaded.</strong><p>Please refresh or contact Promiden for assistance.</p></div>');
      $("#catalogue-count").text("Unavailable");
    }
  }

  function renderCatalogue() {
    const q = state.query.trim().toLowerCase();
    const visible = state.catalogue.filter(item => (state.type === "all" || item.type === state.type) && (!q || [item.name,item.description,item.category].join(" ").toLowerCase().includes(q)));
    $("#catalogue-count").text(state.catalogue.length + (state.catalogue.length === 1 ? " item" : " items"));
    if (!visible.length) {
      $("#catalogue-list").html('<div class="empty-results"><strong>No matching items.</strong><p>Try another search or check back later.</p></div>'); return;
    }
    $("#catalogue-list").html(visible.map(item => {
      const price = formatPrice(item.price_minor);
      const image = safeImage(item.image);
      const thumb = image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">' : (item.type === "product" ? "▣" : "✚");
      const available = Boolean(price);
      return '<article class="catalogue-item"><div class="catalogue-thumb">' + thumb + '</div><div class="catalogue-copy"><span class="item-type">' + (item.type === "product" ? "Product" : "Service") + '</span><h3>' + escapeHtml(item.name) + '</h3><p>' + escapeHtml(item.description) + '</p><div class="catalogue-price">' + (available ? escapeHtml(price) : '<span class="not-priced">Price available on enquiry</span>') + '</div></div><button class="add-button" type="button" data-add-type="' + item.type + '" data-add-id="' + escapeHtml(item.id) + '" ' + (available ? '' : 'disabled title="This item is not yet configured for online payment"') + '>' + (available ? '＋ Add' : 'Enquire') + '</button></article>';
    }).join(""));
  }

  function renderCart() {
    state.cart = state.cart.filter(line => itemFor(line) && Number.isSafeInteger(Number(itemFor(line).price_minor)) && Number(itemFor(line).price_minor) > 0);
    saveCart();
    $("#cart-count").text(totalCount());
    $("#subtotal, #total").text(money.format(totalMinor() / 100));
    if (!state.cart.length) {
      $("#order-items").html('<div class="empty-cart"><span class="empty-cart-icon">＋</span><strong>Your order is empty</strong><p>Add a priced product or service from the catalogue.</p></div>'); return;
    }
    $("#order-items").html(state.cart.map(line => {
      const item = itemFor(line); const lineTotal = Number(item.price_minor) * line.quantity;
      return '<div class="order-line"><div><div class="order-line-title">' + escapeHtml(item.name) + '</div><div class="order-line-meta">' + (item.type === "product" ? "Product" : "Service") + ' · ' + escapeHtml(formatPrice(item.price_minor)) + ' each</div><div class="line-controls"><button class="qty-button" type="button" data-qty="-1" data-key="' + escapeHtml(itemKey(line.type,line.id)) + '" aria-label="Decrease quantity of ' + escapeHtml(item.name) + '">−</button><span class="qty-value">' + line.quantity + '</span><button class="qty-button" type="button" data-qty="1" data-key="' + escapeHtml(itemKey(line.type,line.id)) + '" aria-label="Increase quantity of ' + escapeHtml(item.name) + '">＋</button><button class="remove-button" type="button" data-remove="' + escapeHtml(itemKey(line.type,line.id)) + '">Remove</button></div></div><div class="line-price">' + escapeHtml(money.format(lineTotal / 100)) + '</div></div>';
    }).join(""));
  }

  function addItem(type, id) {
    const item = state.catalogue.find(x => x.type === type && x.id === id);
    if (!item || !Number.isSafeInteger(Number(item.price_minor)) || Number(item.price_minor) <= 0) return;
    const line = state.cart.find(x => x.type === type && x.id === id);
    if (line) { if (line.quantity < 1000) line.quantity += 1; }
    else state.cart.push({ type, id, quantity: 1 });
    saveCart(); renderCart();
  }

  function showMessage(text, kind) { $("#form-message").removeClass("error info").addClass(kind || "info").text(text).prop("hidden", false); }
  function clearMessage() { $("#form-message").prop("hidden", true).text("").removeClass("error info"); }

  $(function () {
    $("#current-year").text(new Date().getFullYear());
    const query = new URLSearchParams(window.location.search);
    if (query.has("reference")) {
      const reference = query.get("reference") || "";
      showMessage("Verifying your payment securely with Paystack…", "info");
      $("#integration-notice").find("strong").text("Checking payment status").end().find("p").text("Please keep this page open while Promiden checks the transaction directly with Paystack. Returning from checkout alone is not proof of payment.");
      if (!/^pmd_[a-zA-Z0-9_-]{8,100}$/.test(reference)) {
        showMessage("The payment reference is missing or invalid. Please contact Promiden so the transaction can be checked.", "error");
      } else {
        $.ajax({ url: API_BASE + "/api/payments/verify/" + encodeURIComponent(reference), method: "GET", dataType: "json", timeout: 18000 })
          .done(function (result) {
            if (result && result.success && result.status === "successful") {
              try { localStorage.removeItem(CART_KEY); state.cart = []; renderCart(); } catch (_) {}
              showMessage("Payment confirmed for order " + (result.orderNumber || "") + ". Thank you. Promiden has verified the transaction.", "info");
              $("#integration-notice").find("strong").text("Payment confirmed").end().find("p").text("The server verified the transaction status, amount, currency, and reference with Paystack. Keep your order number for enquiries.");
            } else {
              showMessage((result && result.message) || "Payment is not confirmed as successful yet. If you completed checkout, wait briefly and refresh this page to check again.", "info");
              $("#integration-notice").find("strong").text("Payment not yet confirmed").end().find("p").text("Do not submit another payment if you believe you were charged. Retry verification later or contact Promiden with your order details.");
            }
          }).fail(function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.message;
            showMessage(message || "We could not verify the transaction right now. If you believe you were charged, do not pay again; contact Promiden or refresh to retry verification.", "error");
            $("#integration-notice").find("strong").text("Verification unavailable").end().find("p").text("The website could not confirm the transaction at this time. Do not treat the redirect as proof of payment.");
          });
      }
    }
    $(".type-tab").on("click", function () { state.type = $(this).data("type"); $(".type-tab").removeClass("active").attr("aria-pressed","false"); $(this).addClass("active").attr("aria-pressed","true"); renderCatalogue(); });
    $("#catalogue-search").on("input", function () { state.query = $(this).val() || ""; renderCatalogue(); });
    $("#catalogue-list").on("click", "[data-add-id]", function () { addItem($(this).data("add-type"), String($(this).data("add-id"))); });
    $("#order-items").on("click", "[data-qty]", function () {
      const key = String($(this).data("key")); const delta = Number($(this).data("qty"));
      const line = state.cart.find(x => itemKey(x.type,x.id) === key); if (!line) return;
      line.quantity = Math.max(1, Math.min(1000, line.quantity + delta)); saveCart(); renderCart();
    });
    $("#order-items").on("click", "[data-remove]", function () { const key = String($(this).data("remove")); state.cart = state.cart.filter(x => itemKey(x.type,x.id) !== key); saveCart(); renderCart(); });
    $("#checkout-form").on("submit", function (event) {
      event.preventDefault(); clearMessage();
      if (!state.cart.length) { showMessage("Add at least one priced product or service before continuing.", "error"); return; }
      const form = this;
      if (!form.reportValidity()) return;
      if (!$("#terms-check").is(":checked")) { showMessage("Please confirm that your order details are correct.", "error"); return; }
      const button = $("#continue-button");
      button.prop("disabled", true).find("span").text("Preparing secure checkout…");
      const idempotencyKey = "pmd_" + (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + "_" + Math.random().toString(16).slice(2));
      const items = state.cart.map(line => ({ type: line.type, id: line.id, quantity: line.quantity }));
      $.ajax({
        url: API_BASE + "/api/orders", method: "POST", contentType: "application/json", dataType: "json", timeout: 15000,
        headers: { "Idempotency-Key": idempotencyKey },
        data: JSON.stringify({ customer: { name: $("#customer-name").val(), email: $("#customer-email").val(), phone: $("#customer-phone").val(), note: $("#customer-note").val() }, items })
      }).done(function (orderResult) {
        if (!orderResult || !orderResult.success || !orderResult.order || !orderResult.order.id) throw new Error("The order response was incomplete.");
        $.ajax({ url: API_BASE + "/api/payments/initialize", method: "POST", contentType: "application/json", dataType: "json", timeout: 18000, data: JSON.stringify({ orderId: orderResult.order.id }) })
          .done(function (paymentResult) {
            const target = paymentResult && paymentResult.payment && paymentResult.payment.authorizationUrl;
            if (!paymentResult.success || typeof target !== "string") { showMessage("Your order was saved, but secure checkout could not be started. Keep order number " + orderResult.order.orderNumber + " and contact Promiden for assistance.", "error"); restoreButton(); return; }
            let checkoutUrl;
            try { checkoutUrl = new URL(target); } catch (_) { showMessage("Secure checkout returned an invalid link. Please contact Promiden with order number " + orderResult.order.orderNumber + ".", "error"); restoreButton(); return; }
            if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.paystack.com") { showMessage("Secure checkout returned an untrusted destination. Please contact Promiden.", "error"); restoreButton(); return; }
            showMessage("Order " + orderResult.order.orderNumber + " is ready. Redirecting to Paystack secure checkout…", "info");
            window.location.assign(checkoutUrl.href);
          }).fail(function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.message;
            showMessage((message || "Your order was saved, but secure checkout could not be started.") + " Order number: " + orderResult.order.orderNumber + ". You can retry or contact Promiden.", "error");
            restoreButton();
          });
      }).fail(function (xhr) {
        showMessage((xhr.responseJSON && xhr.responseJSON.message) || "We could not save your order. Please check your connection and try again.", "error");
        restoreButton();
      });
      function restoreButton() { button.prop("disabled", false).find("span").text("Continue to payment"); }
    });
    loadCatalogue().catch(function () { $("#catalogue-list").html('<div class="empty-results"><strong>Catalogue could not be loaded.</strong><p>Please refresh or contact Promiden for assistance.</p></div>'); $("#catalogue-count").text("Unavailable"); });
  });
})(jQuery);
