/**
 * Courses Nav Dropdown
 */
import { getCourses } from "./api.js";
import { translatePage } from "./i18n.js";
import { translations } from "./translations.js";

let coursesLoaded = false;
let coursesLoading = null;

export async function fillCoursesMenu(container) {
  if (!container) return;
  const courses = await getCourses();
  const lang = localStorage.getItem("lang") || "en";
  const keys = Object.keys(courses || {});

  if (!keys.length) {
    container.innerHTML = '<div class="dropdown-loading">No courses available</div>';
    return;
  }

  container.innerHTML = keys
    .map((id) => {
      const c = courses[id];
      const title =
        (translations[lang] && c.titleStr && translations[lang][c.titleStr]) ||
        c.title ||
        c.name ||
        `Course ${id}`;
      // Fallback to course.link or default register page
      const link = c.link || `/register?course=${encodeURIComponent(id)}`;
      return `<a href="${link}" class="dropdown-course-item">${title}</a>`;
    })
    .join("");
  translatePage();
}

export async function ensureCoursesMenu(container) {
  if (coursesLoaded) return;
  if (coursesLoading) return coursesLoading;
  coursesLoading = fillCoursesMenu(container)
    .then(() => {
      coursesLoaded = true;
    })
    .catch((err) => {
      console.error("Courses dropdown error:", err);
      if (container) {
        container.innerHTML = '<div class="dropdown-loading" style="color: #ef4444;">Could not load courses</div>';
      }
    })
    .finally(() => {
      coursesLoading = null;
    });
  return coursesLoading;
}

export function initCoursesNavMenu() {
  const item = document.querySelector('.nav-courses-item');
  const dropdown = document.querySelector('.courses-dropdown');
  const listContainer = document.getElementById('nav-courses-list');
  
  if (!item || !dropdown || !listContainer) return;

  const showDropdown = async () => {
    await ensureCoursesMenu(listContainer);
    item.classList.add('active');
  };

  const hideDropdown = () => {
    item.classList.remove('active');
  };

  // Hover for desktop
  item.addEventListener('mouseenter', showDropdown);
  item.addEventListener('mouseleave', hideDropdown);

  // Click for mobile/desktop fallback using the toggle arrow
  const toggleBtn = item.querySelector('.nav-courses-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (item.classList.contains('active')) {
        hideDropdown();
      } else {
        await showDropdown();
      }
    });
  }

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!item.contains(e.target)) {
      hideDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideDropdown();
  });
}
