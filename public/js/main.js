document.addEventListener('DOMContentLoaded', function () {
  var toggle   = document.getElementById('menuToggle');
  var sidebar  = document.getElementById('sidebar');
  var overlay  = document.getElementById('sidebarOverlay');

  if (toggle && sidebar && overlay) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Mark the sidebar link matching the current path as active — longest
  // matching href wins so "/opportunities" doesn't also light up for
  // "/opportunities/5" when a more specific link exists.
  var navLinks = document.querySelectorAll('.nav-link');
  var path = window.location.pathname;
  var best = null;
  navLinks.forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var matches = href === '/' ? path === '/' : path === href || path.indexOf(href + '/') === 0;
    if (matches && (!best || href.length > best.getAttribute('href').length)) best = link;
  });
  if (best) best.classList.add('active');

  var flashes = document.querySelectorAll('.flash');
  flashes.forEach(function (el) {
    setTimeout(function () {
      el.style.transition = 'opacity .5s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 500);
    }, 4000);
  });
});
