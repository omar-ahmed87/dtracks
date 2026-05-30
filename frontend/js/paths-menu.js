/**
 * Paths nav dropdown — same course list as /courses (getCourses / approved API).
 */
import { getCourses } from "./api.js";
import { translatePage } from "./i18n.js";
import { translations } from "./translations.js";

let pathsMenuLoaded = false;
let pathsMenuLoading = null;

export async function fillPathsMenu(menu) {
  if (!menu) return;
  const courses = await getCourses();
  const lang = localStorage.getItem("lang") || "en";
  const keys = Object.keys(courses || {});

  if (!keys.length) {
    menu.innerHTML =
      '<span class="dropdown-empty" role="menuitem">No courses available</span>';
    return;
  }

  menu.innerHTML = keys
    .map((id) => {
      const c = courses[id];
      const title =
        (translations[lang] && c.titleStr && translations[lang][c.titleStr]) ||
        c.title ||
        `Course ${id}`;
      return `<a href="/register?course=${encodeURIComponent(id)}" role="menuitem">${title}</a>`;
    })
    .join("");
  translatePage();
}

export async function ensurePathsMenu(menu) {
  if (pathsMenuLoaded) return;
  if (pathsMenuLoading) return pathsMenuLoading;
  pathsMenuLoading = fillPathsMenu(menu)
    .then(() => {
      pathsMenuLoaded = true;
    })
    .catch((err) => {
      console.warn("Paths menu:", err.message);
      if (menu) {
        menu.innerHTML =
          '<span class="dropdown-empty" role="menuitem">Could not load courses</span>';
      }
    })
    .finally(() => {
      pathsMenuLoading = null;
    });
  return pathsMenuLoading;
}

export function initPathsNavMenu() {
  const dropdown = document.querySelector(".nav-paths-dropdown");
  const menu = document.querySelector(".nav-paths-menu");
  const trigger = document.querySelector(".nav-paths-trigger");
  if (!dropdown || !menu || !trigger) return;

  ensurePathsMenu(menu);

  const openMenu = async () => {
    await ensurePathsMenu(menu);
    document.querySelectorAll(".nav-paths-dropdown.open").forEach((el) => {
      if (el !== dropdown) el.classList.remove("open");
    });
    dropdown.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    dropdown.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };

  trigger.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropdown.classList.contains("open")) {
      closeMenu();
    } else {
      await openMenu();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-paths-dropdown")) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}
