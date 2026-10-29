/* Promiden Pharmaceuticals Ltd — homepage interactions.
 * The API integration is deliberately optional in this frontend milestone.
 * Configure window.PROMIDEN_API_BASE when the Express backend is available.
 */
(function ($) {
  "use strict";

  const API_BASE = (window.PROMIDEN_API_BASE || "").replace(/\/$/, "");
  const FALLBACK_SETTINGS = {
    brandName: "PROMIDEN",
    heroTitle: "Better health starts with trusted care.",
    heroDescription: "Your partner in pharmaceutical products, responsible medicine distribution, and healthcare consultancy.",
    email: "info@promidenpharma.com",
    phone: "",
    socialLinks: { facebook: "", twitter: "", instagram: "" }
  };

  const fallbackProducts = [
    { id: "sample-wellness", name: "Vitamin & wellness range", description: "Wellness products selected to support everyday health needs.", category: "wellness", categoryLabel: "Wellness", image: "", published: true },
    { id: "sample-first-aid", name: "First-aid essentials", description: "Everyday care supplies for appropriate first-aid preparedness.", category: "first-aid", categoryLabel: "First aid", image: "", published: true },
    { id: "sample-everyday", name: "Everyday care essentials", description: "Practical personal-care products for daily routines and wellbeing.", category: "everyday", categoryLabel: "Everyday care", image: "", published: true }
  ];

  const fallbackServices = [
    { id: "sample-distribution", title: "Pharmaceutical distribution", description: "Support for responsible supply and distribution of pharmaceutical and OTC products." },
    { id: "sample-consultancy", title: "Medical consultancy", description: "Connect with our team to discuss healthcare consultancy needs and available support." },
    { id: "sample-guidance", title: "Healthcare product guidance", description: "Help finding relevant product information and directing enquiries to the appropriate team." }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function getJson(path) {
    return $.ajax({
      url: API_BASE + path,
      method: "GET",
      dataType: "json",
      timeout: 5000,
      headers: { "Accept": "application/json" }
    });
  }

  function renderProducts(products) {
    const $grid = $("#product-grid");
    if (!Array.isArray(products) || !products.length) {
      $grid.html('<div class="empty-state"><strong>No products to display yet.</strong><p>Contact our team for product enquiries.</p></div>');
      $("#product-count").text("0 products");
      return;
    }

    const cards = products.filter(function (p) { return p.published !== false; }).map(function (p) {
      const category = String(p.category || "everyday").toLowerCase();
      const title = escapeHtml(p.name || p.title || "Product");
      const description = escapeHtml(p.description || "");
      const image = safeUrl(p.imageUrl || p.image_url || p.image || "");
      const imageMarkup = image
        ? '<img class="managed-product-image" src="' + escapeHtml(image) + '" alt="' + title + '" loading="lazy">'
        : '<div class="managed-product-placeholder" aria-hidden="true"><span>+</span><small>PROMIDEN</small></div>';
      return '<article class="product-card" data-category="' + escapeHtml(category) + '">' +
        '<div class="product-image managed-product-image-wrap">' + imageMarkup +
        '<span class="product-tag">' + escapeHtml(p.categoryLabel || p.category || "Product") + '</span></div>' +
        '<div class="product-info"><div class="product-category">PROMIDEN PRODUCT RANGE</div>' +
        '<h3>' + title + '</h3><p>' + description + '</p>' +
        '<a class="product-link" href="#contact" data-product="' + title + '">Enquire about this product <span>→</span></a></div></article>';
    }).join("");

    $grid.html(cards);
    $("#product-count").text(products.length + (products.length === 1 ? " item" : " items"));
  }

  function renderServices(services) {
    const $grid = $("#service-grid");
    if (!Array.isArray(services) || !services.length) {
      $grid.html('<div class="service-card"><h3>Service information coming soon</h3><p>Contact our team to discuss your enquiry.</p></div>');
      return;
    }
    const icons = [
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s8-4 8-11V5l-8-3-8 3v5c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg>'
    ];
    $grid.html(services.map(function (service, index) {
      const title = escapeHtml(service.title || service.name || "Service");
      const description = escapeHtml(service.description || "");
      const number = String(index + 1).padStart(2, "0");
      return '<article class="service-card"><div class="service-icon">' + icons[index % icons.length] + '</div>' +
        '<span class="service-index">' + number + ' / PROMIDEN SERVICES</span><h3>' + title + '</h3><p>' + description + '</p>' +
        '<a href="#contact" class="service-link" data-service="' + title + '">Discuss your needs <span>↗</span></a></article>';
    }).join(""));
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== "object") return;
    const title = settings.heroTitle || settings.hero_title;
    const description = settings.heroDescription || settings.hero_description;
    const brandName = settings.brandName || settings.brand_name;
    const email = settings.email || settings.contact_email;
    const phone = settings.phone || settings.phone_number;
    if (brandName) $("#brand-name").text(brandName);
    if (title) {
      const parts = String(title).split(/trusted care/i);
      if (parts.length > 1) $("#hero-title").html(escapeHtml(parts[0]) + '<span>trusted care.</span>' + escapeHtml(parts.slice(1).join("trusted care")));
      else $("#hero-title").text(title);
    }
    if (description) $("#hero-description").text(description);
    if (email) {
      const cleanEmail = String(email).trim();
      $("#contact-email").text(cleanEmail).attr("href", "mailto:" + cleanEmail);
      $(".button-white[href^='mailto:']").attr("href", "mailto:" + cleanEmail);
    }
    if (phone) {
      const cleanPhone = String(phone).trim();
      $("#contact-phone").text(cleanPhone).attr("href", "tel:" + cleanPhone.replace(/[^\d+]/g, ""));
    }
    const social = settings.socialLinks || settings.social_links || {};
    const socialMap = [
      { key: "facebook", label: "Facebook", text: "f" },
      { key: "twitter", label: "Twitter or X", text: "𝕏" },
      { key: "instagram", label: "Instagram", text: "◎" }
    ];
    const links = socialMap.map(function (item) {
      const url = safeUrl(social[item.key]);
      return url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + item.label + '">' + item.text + '</a>' : "";
    }).filter(Boolean).join("");
    if (links) $("#social-links").html(links);
  }

  function setUpNavigation() {
    const $toggle = $(".menu-toggle");
    const $nav = $("#primary-nav");
    $toggle.on("click", function () {
      const isOpen = $nav.toggleClass("open").hasClass("open");
      $toggle.attr("aria-expanded", String(isOpen)).attr("aria-label", isOpen ? "Close navigation" : "Open navigation");
    });
    $nav.on("click", "a", function () {
      $nav.removeClass("open");
      $toggle.attr("aria-expanded", "false").attr("aria-label", "Open navigation");
    });

    $(".filter-button").on("click", function () {
      const filter = $(this).data("filter");
      $(".filter-button").removeClass("active").attr("aria-pressed", "false");
      $(this).addClass("active").attr("aria-pressed", "true");
      let shown = 0;
      $(".product-card").each(function () {
        const category = String($(this).data("category") || "all");
        const visible = filter === "all" || category === filter;
        $(this).toggle(visible);
        if (visible) shown++;
      });
      $("#product-count").text(shown + (shown === 1 ? " item" : " items"));
    }).attr("aria-pressed", function () { return $(this).hasClass("active") ? "true" : "false"; });

    $(document).on("click", ".product-link", function () {
      const product = $(this).data("product");
      if (product) {
        const subject = encodeURIComponent("Product enquiry: " + product);
        $(".button-white[href^='mailto:']").attr("href", "mailto:" + ($("#contact-email").text() || FALLBACK_SETTINGS.email) + "?subject=" + subject);
      }
    });

    const $top = $(".back-to-top");
    $(window).on("scroll", function () { $top.toggleClass("visible", window.scrollY > 450); });
    $top.on("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

    const sections = $("main section[id]");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            $(".nav-link").removeClass("active");
            $('.nav-link[href="#' + entry.target.id + '"]').addClass("active");
          }
        });
      }, { rootMargin: "-35% 0px -55% 0px" });
      sections.each(function () { observer.observe(this); });
    }
  }

  function init() {
    $("#current-year").text(new Date().getFullYear());
    setUpNavigation();
    applySettings(FALLBACK_SETTINGS);
    renderProducts(fallbackProducts);
    renderServices(fallbackServices);

    // Expected future endpoints:
    // GET /api/public/site-settings
    // GET /api/public/products
    // GET /api/public/services
    // The page remains useful when the API is not yet implemented.
    getJson("/api/public/site-settings").done(applySettings);
    getJson("/api/public/products").done(function (data) {
      renderProducts(Array.isArray(data) ? data : (data.products || []));
    });
    getJson("/api/public/services").done(function (data) {
      renderServices(Array.isArray(data) ? data : (data.services || []));
    });
  }

  $(init);
})(jQuery);
