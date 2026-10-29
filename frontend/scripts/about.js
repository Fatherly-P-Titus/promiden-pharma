(function ($) {
  "use strict";
  $(function () {
    var $toggle = $(".menu-toggle");
    var $nav = $("#primary-nav");
    $toggle.on("click", function () {
      var isOpen = $nav.toggleClass("open").hasClass("open");
      $toggle.attr("aria-expanded", String(isOpen)).attr("aria-label", isOpen ? "Close navigation" : "Open navigation");
    });
    $nav.on("click", "a", function () {
      $nav.removeClass("open");
      $toggle.attr("aria-expanded", "false").attr("aria-label", "Open navigation");
    });
    $("#current-year").text(new Date().getFullYear());
  });
})(jQuery);
