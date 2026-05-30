import { refreshAnimations } from "./ui.js";
import { translatePage } from "./i18n.js";
import { getCsrfToken, apiPost } from "./auth-shared.js";

async function apiGet(path) {
  const res = await fetch(path, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function renderEnrollmentCard(item, lang) {
  const card = document.createElement("article");
  card.className = "dashboard-course-card reveal-up";
  card.innerHTML = `
    <div class="dcc-progress-ring" style="--p: ${item.progress}">
      <span>${item.progress}%</span>
    </div>
    <div class="dcc-body">
      <h3>${item.title}</h3>
      <p>${(item.description || "").slice(0, 100)}${item.description?.length > 100 ? "…" : ""}</p>
      <div class="dcc-actions">
        <a href="/classroom?course=${item.courseId}" class="btn btn-primary btn-sm">
          <span class="material-symbols-rounded">play_lesson</span>
          ${lang === "ar" ? "متابعة" : "Continue"}
        </a>
      </div>
    </div>`;
  return card;
}

function renderSuggestionCard(course, lang) {
  const card = document.createElement("div");
  card.className = "course-card reveal-up";
  card.innerHTML = `
    <div class="card-content" style="padding: 24px;">
      <h3>${course.title || course.name}</h3>
      <p style="color: var(--text-muted); font-size: 14px; margin: 12px 0;">${(course.description || "").slice(0, 90)}…</p>
      <a href="/course/${course.id}" class="btn btn-primary w-100">${lang === "ar" ? "التفاصيل" : "View details"}</a>
    </div>`;
  return card;
}

async function init() {
  const loading = document.getElementById("dashboard-loading");
  const empty = document.getElementById("dashboard-empty");
  const grid = document.getElementById("dashboard-courses");
  const sugWrap = document.getElementById("dashboard-suggestions-wrap");
  const sugGrid = document.getElementById("dashboard-suggestions");

  if (!grid) return;

  const lang = localStorage.getItem("lang") || "en";

  try {
    const data = await apiGet("/api/student/dashboard");
    loading?.classList.add("hidden");

    if (!data.hasEnrollments) {
      empty?.classList.remove("hidden");
      if (data.suggestions?.length && sugWrap && sugGrid) {
        sugWrap.classList.remove("hidden");
        sugGrid.innerHTML = "";
        data.suggestions.slice(0, 4).forEach((c) => sugGrid.appendChild(renderSuggestionCard(c, lang)));
      }
    } else {
      grid.classList.remove("hidden");
      grid.innerHTML = "";
      data.enrollments.forEach((item) => grid.appendChild(renderEnrollmentCard(item, lang)));
    }

    if (data.suggestions?.length && data.hasEnrollments && sugWrap && sugGrid) {
      sugWrap.classList.remove("hidden");
      sugGrid.innerHTML = "";
      data.suggestions.slice(0, 3).forEach((c) => sugGrid.appendChild(renderSuggestionCard(c, lang)));
    }

    translatePage();
    refreshAnimations();
  } catch (err) {
    console.error(err);
    loading?.classList.add("hidden");
    empty?.classList.remove("hidden");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
