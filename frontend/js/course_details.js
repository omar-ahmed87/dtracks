import { showToast } from "./toast.js";

window.shareCourse = function shareCourse() {
  const title = document.getElementById("course-title")?.textContent || "E-Tracks Course";
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => showToast("Link copied", "success"));
  }
};

window.startCourse = function startCourse() {
  const id = window.location.pathname.split("/").pop();
  window.location.href = `/classroom?course=${id}`;
};

window.enrollCourse = function enrollCourse() {
  const id = window.location.pathname.split("/").pop();
  window.location.href = `/register?course=${id}`;
};

document.addEventListener("DOMContentLoaded", () => {
  const linkBtn = document.getElementById("course-link-btn");
  const meta = document.querySelector(".course-details-page");
  if (!meta) return;

  const courseLink = meta.dataset?.courseLink;
  if (linkBtn && courseLink) {
    linkBtn.href = courseLink;
    linkBtn.style.display = "inline-flex";
  }
});
