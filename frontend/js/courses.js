/**
 * Courses Page Module
 * Handles dynamic course listing on the dedicated courses page.
 */
import { getCourses } from "./api.js";
import { translatePage } from "./i18n.js";
import { refreshAnimations } from "./ui.js";

async function renderCourses(courses, lang = "en") {
  const container = document.getElementById("courses-container");
  if (!container) return;

  const enrollLabel = lang === "ar" ? "سجّل الآن" : "Enroll Now";
  const detailsLabel = lang === "ar" ? "التفاصيل" : "Details";

  container.innerHTML = "";
  Object.keys(courses).forEach((id) => {
    const course = courses[id];
    const courseId = course.id || id;
    const title = course.title || course.titleStr || "Course";
    const card = document.createElement("article");
    card.className = "course-card reveal-up courses-page-card course-card-animated";
    card.innerHTML = `
      <a href="/classroom?course=${courseId}" class="card-link-overlay" aria-label="${title}"></a>
      <div class="card-hover-explore" role="presentation">
        <span class="material-symbols-rounded">play_arrow</span>
      </div>
      <div class="card-img">
        <img src="${course.img}" alt="${title}" loading="lazy" />
        <div class="tag" data-i18n="${course.tagStr || "tag_course"}">${course.tagStr || ""}</div>
      </div>
      <div class="card-content">
        <div class="card-meta">
          <span><span class="material-symbols-rounded">schedule</span> ${course.weeks || "8"} ${lang === "ar" ? "أسابيع" : "weeks"}</span>
          <span><span class="material-symbols-rounded star">star</span> ${course.rating || "4.8"}</span>
        </div>
        <h3 data-i18n="${course.titleStr || ""}">${title}</h3>
        <p class="course-card-desc">${(course.description || "").slice(0, 100)}${course.description?.length > 100 ? "…" : ""}</p>
        <div class="course-card-actions">
          <a class="btn btn-outline btn-sm" href="/course/${courseId}">${detailsLabel}</a>
          <a class="btn btn-primary btn-card-register" href="/register?course=${courseId}">${enrollLabel}</a>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("courses-container");
  if (!container) return;

  // Show loading
  const loadingEl = document.getElementById('loading-courses');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const lang = localStorage.getItem("lang") || "en";
    const courses = await getCourses();
    await renderCourses(courses, lang);

    // Handle initial state
    translatePage();
    refreshAnimations();
  } catch (error) {
    console.error('Failed to load courses:', error);
    // Fallback render with static data
    const fallback = await import("./api.js").then((m) => m.DEFAULT_COURSES || {});
    renderCourses(fallback);
  } finally {
    // Hide loading
    if (loadingEl) loadingEl.style.display = 'none';
  }
});

