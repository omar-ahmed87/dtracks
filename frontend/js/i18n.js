import { translations } from "./translations.js?v=3.2";

if (!window.translations) {
  window.translations = translations;
}

export const translatePage = (lang = localStorage.getItem("lang") || "en") => {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  const t = window.translations || translations;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[lang] && t[lang][key]) {
      el.textContent = t[lang][key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[lang] && t[lang][key]) {
      el.setAttribute("placeholder", t[lang][key]);
    }
  });

  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (t[lang] && t[lang][key]) {
      el.innerHTML = t[lang][key];
    }
  });

  localStorage.setItem("lang", lang);

  // Update toggle UI
  const langWrapper = document.getElementById("lang-switch-wrapper");
  if (langWrapper) {
    langWrapper.querySelectorAll(".pro-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.id === `lang-${lang}-btn`);
    });
  }
};

export const initI18n = () => {
  let currentLang = localStorage.getItem("lang") || "en";

  const handleSwitch = (lang) => {
    if (currentLang !== lang) {
      currentLang = lang;
      translatePage(currentLang);
    }
  };

  document
    .getElementById("lang-ar-btn")
    ?.addEventListener("click", () => handleSwitch("ar"));
  document
    .getElementById("lang-en-btn")
    ?.addEventListener("click", () => handleSwitch("en"));

  document.querySelectorAll("#lang-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentLang = currentLang === "en" ? "ar" : "en";
      translatePage(currentLang);
    });
  });

  // Initial load
  translatePage(currentLang);
};
