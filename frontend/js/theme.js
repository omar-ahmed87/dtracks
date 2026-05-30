/**
 * Theme Module
 * Handles light/dark mode switching and persistence.
 */

export const initTheme = () => {
  const themeIcon = document.querySelector(
    "#theme-toggle .material-symbols-rounded",
  );
  const searchInput = document.querySelector(".search-input");
  const savedTheme = localStorage.getItem("theme");

  const updateThemeUI = (isDark) => {
    document.body.classList.toggle("dark-mode", isDark);
    if (themeIcon) themeIcon.textContent = isDark ? "light_mode" : "dark_mode";
    if (searchInput) searchInput.style.color = isDark ? "white" : "black";

    const themeWrapper = document.getElementById("theme-switch-wrapper");
    if (themeWrapper) {
      themeWrapper.setAttribute("data-theme", isDark ? "dark" : "light");
      themeWrapper.querySelectorAll(".pro-toggle-btn").forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.id === `theme-${isDark ? "dark" : "light"}-btn`,
        );
      });
    }
  };

  const toggleTheme = () => {
    const isDark = !document.body.classList.contains("dark-mode");
    updateThemeUI(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  // Initial load
  updateThemeUI(savedTheme === "dark");

  // Event listeners
  document.getElementById("theme-light-btn")?.addEventListener("click", () => {
    if (document.body.classList.contains("dark-mode")) toggleTheme();
  });

  document.getElementById("theme-dark-btn")?.addEventListener("click", () => {
    if (!document.body.classList.contains("dark-mode")) toggleTheme();
  });

  document.querySelectorAll("#theme-toggle").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });
};
