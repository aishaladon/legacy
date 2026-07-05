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

  var flashes = document.querySelectorAll('.flash');
  flashes.forEach(function (el) {
    setTimeout(function () {
      el.style.transition = 'opacity .5s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 500);
    }, 4000);
  });
});
