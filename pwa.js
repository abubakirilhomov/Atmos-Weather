// Регистрация service worker и окошко установки приложения
(() => {
  // 1. SERVICE WORKER
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Service worker не зарегистрирован:", err);
      });
    });
  }

  // 2. ЭЛЕМЕНТЫ И СОСТОЯНИЕ
  const banner = document.getElementById("installBanner");
  if (!banner) return;

  const text = document.getElementById("installText");
  const installBtn = document.getElementById("installBtn");
  const laterBtn = document.getElementById("installLater");
  const closeBtn = document.getElementById("installClose");

  const DISMISS_KEY = "atmos-install-dismissed";
  const DISMISS_DAYS = 7;
  let deferredPrompt = null;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Уже установлено — ничего не показываем
  if (isStandalone) return;

  function wasDismissedRecently() {
    try {
      const time = Number(localStorage.getItem(DISMISS_KEY));
      return time && Date.now() - time < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function showBanner() {
    if (wasDismissedRecently()) return;
    banner.hidden = false;
    if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(banner, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" });
    }
  }

  function hideBanner(remember = false) {
    banner.hidden = true;
    if (remember) {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    }
  }

  // 3. ANDROID И DESKTOP (Chrome, Edge, Samsung Internet и др.)
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showBanner();
  });

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideBanner(outcome !== "accepted");
    } else {
      // iOS: автоматической установки нет, поэтому просто закрываем подсказку
      hideBanner(true);
    }
  });

  [laterBtn, closeBtn].forEach((btn) => btn.addEventListener("click", () => hideBanner(true)));

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideBanner(false);
  });

  // 4. iOS (Safari не поддерживает beforeinstallprompt)
  if (isIOS) {
    text.innerHTML =
      "Нажми кнопку «Поделиться» <b>⎋</b> внизу экрана, затем выбери " +
      "<b>«На экран Домой»</b>.";
    installBtn.textContent = "Понятно";
    laterBtn.hidden = true;
    setTimeout(showBanner, 2500);
  }
})();
