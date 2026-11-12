(function () {
  "use strict";

  function storageKey() {
    return "howitworks:list:" + location.pathname + location.search;
  }

  function readState() {
    try {
      var raw = sessionStorage.getItem(storageKey());
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function writeState(focusId) {
    try {
      sessionStorage.setItem(
        storageKey(),
        JSON.stringify({
          scrollY: window.scrollY || 0,
          focusId: typeof focusId === "string" ? focusId : "",
        }),
      );
    } catch (err) {
      /* Keep reading even when storage is blocked. */
    }
  }

  function clearRestoredMarks(except) {
    var marked = document.querySelectorAll("[data-restored-focus]");
    for (var i = 0; i < marked.length; i += 1) {
      if (marked[i] !== except) marked[i].removeAttribute("data-restored-focus");
    }
  }

  function focusElement(el) {
    clearRestoredMarks();
    try {
      el.focus({ preventScroll: true, focusVisible: true });
    } catch (err) {
      try {
        el.focus({ preventScroll: true });
      } catch (err2) {
        el.focus();
      }
    }
    el.setAttribute("data-restored-focus", "true");
  }

  function applyState(data) {
    if (data.focusId) {
      var el = document.getElementById(data.focusId);
      if (el && typeof el.focus === "function" && el.getClientRects().length) focusElement(el);
    }
    var y = typeof data.scrollY === "number" && isFinite(data.scrollY) ? data.scrollY : 0;
    window.scrollTo(0, y);
  }

  function isHistoryNavigation(event) {
    if (event && event.persisted) return true;
    var entries = performance.getEntriesByType("navigation");
    var nav = entries && entries[0];
    return !!(nav && nav.type === "back_forward");
  }

  function pinReloadToTop() {
    var entries = performance.getEntriesByType("navigation");
    var nav = entries && entries[0];
    if (!nav || nav.type !== "reload" || location.hash) return;
    window.scrollTo(0, 0);
    window.requestAnimationFrame(function () {
      window.scrollTo(0, 0);
    });
  }

  function restore(event) {
    if (!isHistoryNavigation(event)) {
      pinReloadToTop();
      return;
    }
    var data = readState();
    if (!data) return;
    applyState(data);
    window.requestAnimationFrame(function () {
      applyState(data);
      window.requestAnimationFrame(function () {
        applyState(data);
      });
    });
  }

  document.addEventListener(
    "click",
    function (event) {
      var node = event.target;
      if (!node || typeof node.closest !== "function") return;
      var link = node.closest("a[href]");
      if (!link) return;
      var dest;
      try {
        dest = new URL(link.getAttribute("href"), location.href);
      } catch (err) {
        return;
      }
      if (dest.origin !== location.origin) return;
      if (dest.pathname === location.pathname && dest.search === location.search) return;
      writeState(link.id || "");
    },
    true,
  );

  window.addEventListener("pageshow", restore);
  document.addEventListener("pointerdown", function () {
    clearRestoredMarks();
  });
  document.addEventListener("focusin", function (event) {
    clearRestoredMarks(event.target);
  });

  function init() {
    var topic = document.documentElement.getAttribute("data-topic") || "";
    var links = document.querySelectorAll("[data-topic-link]");
    var selectedLabel = "";
    for (var i = 0; i < links.length; i += 1) {
      var value = links[i].getAttribute("data-topic-link") || "";
      var selected = topic ? value === topic : value === "all";
      if (selected) {
        links[i].setAttribute("aria-current", "page");
        selectedLabel = (links[i].textContent || "").replace(/\s+/g, " ").trim();
      } else {
        links[i].removeAttribute("aria-current");
      }
    }
    if (links.length && topic && selectedLabel) document.title = selectedLabel + "の記事 · Howitworks";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
