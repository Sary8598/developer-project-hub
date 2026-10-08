"use strict";
// Presentation-only improvements. Does not modify saved project data.
(() => {
  const menuButton = document.getElementById("mobile-menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("mobile-nav-backdrop");
  const modal = document.getElementById("project-modal");
  const newProjectButton = document.getElementById("new-project-btn");
  const narrow = window.matchMedia("(max-width: 760px)");
  if (!menuButton || !sidebar || !backdrop) return;

  function closeMenu(restoreFocus = false) {
    document.body.classList.remove("mobile-nav-open");
    menuButton.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
    if (restoreFocus && narrow.matches) menuButton.focus();
  }
  function openMenu() {
    document.body.classList.add("mobile-nav-open");
    menuButton.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
    sidebar.querySelector(".nav-link")?.focus();
  }
  menuButton.addEventListener("click", () => {
    document.body.classList.contains("mobile-nav-open") ? closeMenu(true) : openMenu();
  });
  backdrop.addEventListener("click", () => closeMenu(true));
  sidebar.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => closeMenu()));
  narrow.addEventListener("change", () => closeMenu());
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("mobile-nav-open")) closeMenu(true);
    if (event.key !== "Tab" || !modal || modal.hidden) return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')]
      .filter(el => el.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // Restore focus when the create-project dialog closes.
  const observer = new MutationObserver(() => {
    if (modal.hidden && modal.dataset.wasOpen === "true") {
      modal.dataset.wasOpen = "false";
      newProjectButton?.focus();
    } else if (!modal.hidden) modal.dataset.wasOpen = "true";
  });
  if (modal) observer.observe(modal, { attributes: true, attributeFilter: ["hidden"] });
})();
