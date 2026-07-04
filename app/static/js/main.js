// Mobile nav toggle
const toggle = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("nav-overlay");

if (toggle && sidebar && overlay) {
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  });
}

// Auto-dismiss flash messages after 4s
document.querySelectorAll(".alert[data-autodismiss]").forEach(el => {
  setTimeout(() => el.remove(), 4000);
});

// Mark active nav link
const path = window.location.pathname.split("/")[1];
document.querySelectorAll(".sidebar-nav a").forEach(a => {
  const href = a.getAttribute("href");
  if (href && href !== "/" && href.startsWith("/" + path)) {
    a.classList.add("active");
  } else if (href === "/" && path === "") {
    a.classList.add("active");
  }
});
