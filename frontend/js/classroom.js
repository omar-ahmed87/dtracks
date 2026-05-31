import { getCsrfToken } from "./auth-shared.js";
import { translatePage } from "./i18n.js";
import { refreshAnimations } from "./ui.js";
import { showToast } from "./toast.js";
import { translations } from "./translations.js";

console.log("[CLASSROOM] ========== MODULE LOADED ==========");
console.log("[CLASSROOM] File version: 6.2");

const $ = (sel, root = document) => root.querySelector(sel);

function tr(key, vars = {}) {
  const lang = localStorage.getItem("lang") || "en";
  let text = translations[lang]?.[key] || translations.en[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(`{${k}}`, String(v));
  });
  return text;
}

// Student gamification state
let studentXP = parseInt(localStorage.getItem("student_xp") || "350", 10);
let studentStreak = parseInt(localStorage.getItem("student_streak") || "5", 10);
let timeNotes = JSON.parse(localStorage.getItem("time_notes") || "[]");
let communityPosts = JSON.parse(localStorage.getItem("community_posts") || "[]");
let activeCourseId = null;
let activeEnrollments = [];

// Mock Community Posts initializer if empty
if (!communityPosts.length) {
  communityPosts = [
    {
      id: 1,
      title: "Best resources to learn Graphic Design?",
      body: "Hey guys! I just started the Graphic Design course and want to know which books or external blogs are best for visual theory. Thanks!",
      author: "Ahmed Sayed",
      likes: 12,
      comments: [
        { author: "Mahmoud Maher", text: "Check out The Elements of Typographic Style. It's awesome!" }
      ]
    },
    {
      id: 2,
      title: "Finished the first module of German! 🇩🇪",
      body: "Super excited to complete the grammar basics module today. The pronunciation tips were super helpful. Let me know if anyone wants to practice speaking together!",
      author: "Omar Ahmed",
      likes: 24,
      comments: []
    }
  ];
  localStorage.setItem("community_posts", JSON.stringify(communityPosts));
}

// Mock Exams Catalog
const EXAMS_CATALOG = {
  "computer-basics": {
    title: "Computer Basics Certification Exam",
    duration: 300, // 5 minutes
    questions: [
      {
        text: "What is the shortcut key to copy text?",
        options: ["Ctrl + C", "Ctrl + V", "Ctrl + X", "Ctrl + Z"],
        correct: 0
      },
      {
        text: "Which of the following is an Operating System?",
        options: ["Google Chrome", "Windows 11", "Microsoft Word", "Intel i7"],
        correct: 1
      }
    ]
  },
  "icdl": {
    title: "ICDL Office Skills Test",
    duration: 600,
    questions: [
      {
        text: "In Microsoft Excel, what starts a formula?",
        options: ["+", "=", "-", "*"],
        correct: 1
      }
    ]
  },
  "graphic-design": {
    title: "Graphic Design Mastery Quiz",
    duration: 300,
    questions: [
      {
        text: "Which color model is used for printing?",
        options: ["RGB", "CMYK", "HSL", "HEX"],
        correct: 1
      }
    ]
  },
  "german": {
    title: "German A1 Beginner Exam",
    duration: 300,
    questions: [
      {
        text: "How do you say 'Thank you very much' in German?",
        options: ["Bitte", "Vielen Dank", "Guten Tag", "Auf Wiedersehen"],
        correct: 1
      }
    ]
  }
};

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("course") || params.get("id");
}

function showPanel(name) {
  hideLoading();
  ["empty", "pending", "active"].forEach((key) => {
    const el = $(`#classroom-${key}`);
    if (!el) return;
    el.classList.toggle("hidden", key !== name);
  });
}

async function apiGet(path) {
  console.log("[CLASSROOM] apiGet() called with path:", path);
  try {
    const res = await fetch(path, { credentials: "include" });
    console.log("[CLASSROOM] apiGet() response status:", res.status, res.statusText);
    
    // Check if user is not authenticated
    if (res.status === 401 || res.status === 403) {
      console.error("[CLASSROOM] Authentication failed - redirecting to login");
      showToast("Please login to access classroom", "error");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
      throw new Error("Authentication required");
    }
    
    const data = await res.json().catch((err) => {
      console.error("[CLASSROOM] Failed to parse JSON response:", err);
      return {};
    });
    console.log("[CLASSROOM] apiGet() response data:", data);
    
    if (!res.ok) {
      console.error("[CLASSROOM] apiGet() request failed:", data.error || "Request failed");
      throw new Error(data.error || "Request failed");
    }
    return data;
  } catch (error) {
    console.error("[CLASSROOM] apiGet() exception:", error);
    throw error;
  }
}

async function apiPost(path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = await getCsrfToken();
  if (token) headers["X-CSRF-Token"] = token;
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiPatch(path, body = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = await getCsrfToken();
  if (token) headers["X-CSRF-Token"] = token;
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function updateNotificationBadge(count) {
  const badge = $("#lms-notif-badge");
  if (!badge) return;
  const n = parseInt(count, 10) || 0;
  if (n > 0) {
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadNotifications() {
  const list = $("#notifications-list");
  if (!list) return;

  try {
    const data = await apiGet("/api/student/notifications");
    const items = data.notifications || [];
    updateNotificationBadge(data.unreadCount ?? items.filter((n) => n.unread).length);

    if (!items.length) {
      list.innerHTML = `<p style="padding: 24px; color: var(--text-muted); font-size: 14px;">${tr("notifications_empty")}</p>`;
      return;
    }

    list.innerHTML = items
      .map((n) => {
        const date = n.createdAt
          ? new Date(n.createdAt).toLocaleString()
          : "";
        const courseLabel = n.courseTitle
          ? `<span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;">school</span> ${escapeHtml(n.courseTitle)}`
          : "";
        return `
        <article class="notif-card ${n.unread ? "unread" : ""}" data-notif-id="${n.id}" role="button" tabindex="0">
          <h4>${escapeHtml(n.title)}</h4>
          <p>${escapeHtml(n.body)}</p>
          <div class="notif-meta">
            ${courseLabel ? `<span>${courseLabel}</span>` : ""}
            <span>${date}</span>
            ${n.unread ? `<span style="color:var(--primary);">${localStorage.getItem("lang") === "ar" ? "جديد" : "New"}</span>` : ""}
          </div>
        </article>`;
      })
      .join("");

    list.querySelectorAll(".notif-card").forEach((card) => {
      const open = async () => {
        const id = card.dataset.notifId;
        if (!id || !card.classList.contains("unread")) return;
        try {
          await apiPatch(`/api/student/notifications/${id}/read`);
          card.classList.remove("unread");
          const refreshed = await apiGet("/api/student/notifications");
          updateNotificationBadge(
            refreshed.unreadCount ??
              (refreshed.notifications || []).filter((x) => x.unread).length,
          );
        } catch (e) {
          console.warn("mark read failed", e);
        }
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p style="padding: 24px; color: #ef4444; font-size: 14px;">${escapeHtml(err.message)}</p>`;
  }
}

async function markAllNotificationsRead() {
  try {
    await apiPost("/api/student/notifications/read-all", {});
    await loadNotifications();
    showToast(
      localStorage.getItem("lang") === "ar"
        ? "تم تعليم جميع الإشعارات كمقروءة"
        : "All notifications marked as read",
      "success",
    );
  } catch (err) {
    showToast(err.message, "error");
  }
}

function showLoading() {
  const el = $("#classroom-loading");
  if (!el) return;
  el.classList.remove("hidden");
  el.style.display = "flex";
  ["empty", "pending", "active"].forEach((key) => {
    const panel = $(`#classroom-${key}`);
    if (panel) panel.classList.add("hidden");
  });
}

function hideLoading() {
  const el = $("#classroom-loading");
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "none";
}

function showPending(courseTitle) {
  showPanel("pending");
  const text = $("#classroom-pending-text");
  if (text) {
    if (courseTitle) {
      text.textContent = tr("classroom_pending_named", { course: courseTitle });
    } else {
      text.textContent = tr("classroom_pending_desc");
    }
  }
  translatePage();
}

function showEmpty() {
  showPanel("empty");
}

// Sidebar SPA navigation toggling
function initLmsNavigation() {
  const links = document.querySelectorAll(".lms-nav-link");
  const panels = document.querySelectorAll(".tab-panel");
  const drawer = $("#lms-nav-drawer");

  // Force sidebar hidden on mobile immediately on init
  function applySidebarState() {
    if (!drawer) return;
    if (window.innerWidth <= 1024) {
      if (!drawer.classList.contains("open")) {
        drawer.style.left = "-280px";
        drawer.style.right = "";
      }
    } else {
      drawer.style.left = "0";
      drawer.style.right = "";
      // RTL
      if (document.documentElement.dir === "rtl") {
        drawer.style.left = "";
        drawer.style.right = "0";
      }
    }
  }

  applySidebarState();
  window.addEventListener("resize", applySidebarState);

  links.forEach((link) => {
    link.addEventListener("click", () => {
      links.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      
      const target = link.dataset.target;
      panels.forEach((panel) => {
        panel.classList.remove("active");
        if (panel.id === `panel-${target}`) {
          panel.classList.add("active");
        }
      });

      if (target === "notifications") {
        loadNotifications();
      }

      // Close mobile drawer on link click
      if (window.innerWidth <= 1024) closeMobileSidebar();
    });
  });

  // Create overlay for mobile sidebar
  let overlay = document.getElementById("lms-sidebar-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "lms-sidebar-overlay";
    overlay.style.cssText = [
      "display:none",
      "position:fixed",
      "top:0",
      "left:280px",
      "right:0",
      "bottom:0",
      "background:rgba(0,0,0,0.45)",
      "z-index:250",
      "opacity:0",
      "transition:opacity 0.3s ease",
    ].join(";");
    document.body.appendChild(overlay);
  }

  function openMobileSidebar() {
    if (!drawer) return;
    overlay.style.display = "block";
    requestAnimationFrame(() => { overlay.style.opacity = "1"; });
    drawer.style.left = "0";
    drawer.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeMobileSidebar() {
    if (!drawer) return;
    drawer.classList.remove("open");
    drawer.style.left = "-280px";
    overlay.style.opacity = "0";
    setTimeout(() => { overlay.style.display = "none"; }, 300);
    document.body.style.overflow = "";
  }

  // Expose globally
  window.closeMobileSidebar = closeMobileSidebar;

  // Only close when clicking OUTSIDE the sidebar
  overlay.addEventListener("click", (e) => {
    if (!e.target.closest("#lms-nav-drawer")) {
      closeMobileSidebar();
    }
  });

  const toggle = $("#lms-sidebar-toggle");
  if (toggle && drawer) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (drawer.classList.contains("open")) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  }
}

// Render active course grid
function renderActiveCoursesGrid(enrollments) {
  const container = $("#active-courses-grid");
  if (!container) return;

  if (!enrollments.length) {
    container.innerHTML = `<p style="padding: 24px; color: var(--text-muted);">You don't have any approved active courses yet. Go to Browse Courses to enroll.</p>`;
    return;
  }

  container.innerHTML = enrollments
    .map((e) => {
      const progress = e.progress || 0;
      return `
      <div class="mv-card" style="padding: 20px; display:flex; flex-direction:column; gap:12px;">
        <span class="material-symbols-rounded" style="font-size: 48px; color:var(--primary);">school</span>
        <h3 style="font-size:18px;">${e.title}</h3>
        <p style="font-size:13px; color: var(--text-muted);">Access your class lessons, quizzes, and digital certificates.</p>
        <div style="margin-top: 10px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
            <span>Progress</span>
            <strong>${progress}%</strong>
          </div>
          <div class="lms-progress-bar-bg" style="height:6px;">
            <div class="lms-progress-bar-fill" style="width: ${progress}%"></div>
          </div>
        </div>
        <button class="btn btn-primary w-100 btn-enter-classroom" style="margin-top:10px; height:36px; font-size:13px;" data-course-id="${e.courseId}">
          <span>Enter Classroom</span>
          <span class="material-symbols-rounded">login</span>
        </button>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".btn-enter-classroom").forEach((btn) => {
    btn.addEventListener("click", () => {
      enterCourseView(btn.dataset.courseId);
    });
  });
}

// Enter detailed course view SPA mode
async function enterCourseView(courseId) {
  // Check enrollment access
  const isEnrolled = activeEnrollments.some(
    (e) => String(e.courseId) === String(courseId)
  );
  if (!isEnrolled) {
    const lang = localStorage.getItem("lang") || "en";
    showToast(
      lang === "ar"
        ? "غير مسموح لك بالوصول لهذا الكورس"
        : "Access denied. You are not enrolled in this course.",
      "error"
    );
    return;
  }
  activeCourseId = courseId;
  $("#courses-list-view").classList.add("hidden");
  $("#course-classroom-view").classList.remove("hidden");
  await loadCourseClassroomData(courseId);
}

// Render lessons inside Curriculum list
function renderCurriculum(syllabus, lang, onLessonClick) {
  const accordion = $("#lms-curriculum-accordion");
  if (!accordion) return;

  accordion.innerHTML = syllabus.modules
    .map((mod, mi) => {
      const title = lang === "ar" ? mod.titleAr || mod.title : mod.title;
      const lessonsHtml = mod.lessons
        .map((lesson) => {
          const lt = lang === "ar" ? lesson.titleAr || lesson.title : lesson.title;
          const isCompleted = lesson.completed;
          const icon = isCompleted ? "check_circle" : "play_circle";
          return `
          <button type="button" class="lms-lesson-row ${isCompleted ? "completed" : ""}" data-lesson-id="${lesson.id}" data-embed="${lesson.embedUrl || ""}" style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:10px; border-bottom:1px solid var(--glass-border); background:transparent; border:none; text-align:left; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="color: ${isCompleted ? '#10b981' : 'var(--text-muted)'};">${icon}</span>
              <span style="font-size:13px; font-weight:600; color:var(--text-main);">${lt}</span>
            </div>
            <span style="font-size:11px; background:var(--bg-light); padding:2px 6px; border-radius:4px; color:var(--text-muted);">${lesson.duration}</span>
          </button>`;
        })
        .join("");

      return `
      <div class="lms-module open" style="margin-bottom:12px; border-radius:var(--radius-sm); overflow:hidden; border:1px solid var(--glass-border);">
        <button type="button" class="lms-module-header" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-light); border:none; text-align:left; cursor:pointer;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="color:var(--primary);">folder</span>
            <strong style="font-size:14px; color:var(--text-main);">${title}</strong>
          </div>
          <span class="material-symbols-rounded">expand_more</span>
        </button>
        <div class="lms-module-content" style="background:var(--bg-color);">${lessonsHtml}</div>
      </div>`;
    })
    .join("");

  accordion.querySelectorAll(".lms-lesson-row").forEach((row) => {
    row.addEventListener("click", () => onLessonClick(row));
  });
}

// Load Course Detailed Data
async function loadCourseClassroomData(courseId) {
  const lang = localStorage.getItem("lang") || "en";
  const payload = await apiGet(`/api/student/classroom/${courseId}`);

  if (payload.pending) {
    showPending(payload.course?.title);
    return;
  }

  if (!payload.enrolled || !payload.course) {
    showToast(
      localStorage.getItem("lang") === "ar"
        ? "لا يمكن فتح الكورس بعد. تأكد من موافقة الإدارة."
        : "Course access is not available yet. Please wait for admin approval.",
      "error",
    );
    return;
  }

  const { course, progress, syllabus, mainEmbed } = payload;

  $("#cls-nav-title").textContent = course.title;
  $("#cls-video-title").textContent = course.title;
  $("#cls-course-desc").textContent = course.description || "";
  $("#cls-progress-text").textContent = `${progress}% Complete`;
  $("#cls-progress-bar").style.width = `${progress}%`;

  const iframe = $("#cls-video-iframe");
  const firstLesson = syllabus.modules[0]?.lessons[0];
  const embed = firstLesson?.embedUrl || mainEmbed || "";
  if (iframe && embed) iframe.src = embed;

  const onLessonClick = async (row) => {
    const lessonId = row.dataset.lessonId;
    if (iframe && row.dataset.embed) iframe.src = row.dataset.embed;
    $("#cls-video-title").textContent = row.querySelector("span:last-child").textContent;

    try {
      await apiPost(`/api/student/classroom/${courseId}/progress`, { lessonId });
      row.classList.add("completed");
      const checkIcon = row.querySelector(".material-symbols-rounded");
      if (checkIcon) {
        checkIcon.textContent = "check_circle";
        checkIcon.style.color = "#10b981";
      }

      // Add Gamification XP
      addXP(10);

      // Refresh Classroom Data
      const updated = await apiGet(`/api/student/classroom/${courseId}`);
      $("#cls-progress-bar").style.width = `${updated.progress}%`;
      $("#cls-progress-text").textContent = `${updated.progress}% Complete`;
      
      // Auto Next Lesson Toggle
      showToast("Lesson completed! +10 XP earned.", "success");
    } catch (e) {
      console.warn(e);
    }
  };

  renderCurriculum(syllabus, lang, onLessonClick);
  renderTimeNotes();
}

// Gamification XP Add
function addXP(amount) {
  studentXP += amount;
  localStorage.setItem("student_xp", studentXP);
  
  // Update Level UI
  const xpBadge = $("#xp-count");
  if (xpBadge) {
    const level = Math.floor(studentXP / 200) + 1;
    xpBadge.textContent = `Level ${level} • ${studentXP} XP`;
  }
  const leaderboardXP = $("#leaderboard-student-xp");
  if (leaderboardXP) leaderboardXP.textContent = `${studentXP} XP`;
}

// Time-Anchored Notes Mechanics
function renderTimeNotes() {
  const container = $("#course-time-notes-container");
  if (!container) return;

  const filtered = timeNotes.filter((n) => String(n.courseId) === String(activeCourseId));
  if (!filtered.length) {
    container.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); text-align:center; padding:10px;">Add a note anchored to the video timeline.</p>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (n, i) => `
    <div class="time-note-row">
      <div>
        <span style="font-weight:700; font-size:12px; color:var(--primary); margin-right:6px;">[${n.timestamp}]</span>
        <span style="font-size:13px; color:var(--text-main);">${n.text}</span>
      </div>
      <button class="time-stamp-btn" style="background:#ef4444; padding:2px 6px;" data-index="${i}">Delete</button>
    </div>`
    )
    .join("");

  container.querySelectorAll(".time-stamp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      timeNotes.splice(idx, 1);
      localStorage.setItem("time_notes", JSON.stringify(timeNotes));
      renderTimeNotes();
    });
  });
}

function setupTimeNotes() {
  const addBtn = $("#btn-add-time-note");
  const input = $("#time-note-input");

  if (addBtn && input) {
    addBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) return;

      // Mock random video timestamp (e.g. 5:20) for simulation
      const minutes = Math.floor(Math.random() * 10);
      const seconds = Math.floor(Math.random() * 59);
      const timestamp = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

      timeNotes.push({
        courseId: activeCourseId,
        timestamp,
        text,
      });
      localStorage.setItem("time_notes", JSON.stringify(timeNotes));
      input.value = "";
      renderTimeNotes();
      addXP(5);
      showToast("Time-anchored note added! +5 XP", "success");
    });
  }
}

// Custom Live Quiz / Testing Center Engine
function renderExamsList() {
  const container = $("#available-exams-list");
  if (!container) return;

  const courses = Object.keys(EXAMS_CATALOG);
  container.innerHTML = courses
    .map((cid) => {
      const exam = EXAMS_CATALOG[cid];
      return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px; border:1px solid var(--glass-border); border-radius:var(--radius-sm); background:var(--bg-light);">
        <div>
          <h4 style="font-size:15px; font-weight:700;">${exam.title}</h4>
          <p style="font-size:12px; color:var(--text-muted);">${exam.questions.length} Questions • Limit 5 Mins</p>
        </div>
        <button class="btn btn-primary btn-start-exam" style="height:34px; font-size:12px;" data-exam-id="${cid}">Start Exam</button>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".btn-start-exam").forEach((btn) => {
    btn.addEventListener("click", () => {
      startExamPortal(btn.dataset.examId);
    });
  });
}

let activeExamTimer = null;

function startExamPortal(examId) {
  const exam = EXAMS_CATALOG[examId];
  if (!exam) return;

  $("#exam-list-container").classList.add("hidden");
  $("#active-exam-portal").classList.remove("hidden");
  $("#current-exam-title").textContent = exam.title;

  // Build Questions HTML
  const box = $("#exam-questions-box");
  box.innerHTML = exam.questions
    .map((q, qi) => {
      const opts = q.options
        .map(
          (o, oi) => `
        <label class="quiz-option" style="display:flex; align-items:center; gap:8px; padding:10px; margin:6px 0; border:1px solid var(--glass-border); border-radius:4px;">
          <input type="radio" name="q${qi}" value="${oi}" required />
          <span>${o}</span>
        </label>`
        )
        .join("");

      return `
      <div style="margin-bottom: 24px; padding:16px; background:var(--bg-light); border-radius:var(--radius-sm);">
        <p style="font-weight:700; margin-bottom:10px;">${qi + 1}. ${q.text}</p>
        <div>${opts}</div>
      </div>`;
    })
    .join("");

  // Start Timer Countdown (5 Mins)
  let timeLeft = 300;
  const timer = $("#exam-timer");
  
  if (activeExamTimer) clearInterval(activeExamTimer);
  
  activeExamTimer = setInterval(() => {
    timeLeft--;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timer.textContent = `Time remaining: ${mins}:${secs < 10 ? '0' + secs : secs}`;

    if (timeLeft <= 0) {
      clearInterval(activeExamTimer);
      submitExamAnswers(examId);
    }
  }, 1000);

  // Submit trigger
  const submitBtn = $("#btn-submit-active-exam");
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
  newSubmitBtn.addEventListener("click", () => {
    submitExamAnswers(examId);
  });
}

function submitExamAnswers(examId) {
  if (activeExamTimer) clearInterval(activeExamTimer);
  const exam = EXAMS_CATALOG[examId];
  if (!exam) return;

  let score = 0;
  exam.questions.forEach((q, qi) => {
    const picked = $(`input[name="q${qi}"]:checked`);
    if (picked && parseInt(picked.value, 10) === q.correct) {
      score++;
    }
  });

  const percent = Math.round((score / exam.questions.length) * 100);
  const passed = percent >= 50;

  // Add Dynamic XP
  if (passed) {
    addXP(100);
    showToast(`Congratulations! You passed the exam with ${percent}% score! +100 XP`, "success");
    unlockCertificate(examId);
  } else {
    showToast(`Exam completed. You scored ${percent}%. Minimum 50% is required to pass.`, "error");
  }

  $("#active-exam-portal").classList.add("hidden");
  $("#exam-list-container").classList.remove("hidden");
  renderExamsList();
}

// Certificate Generation QR Mockup
function unlockCertificate(courseId) {
  const completedList = JSON.parse(localStorage.getItem("completed_certificates") || "[]");
  if (!completedList.includes(courseId)) {
    completedList.push(courseId);
    localStorage.setItem("completed_certificates", JSON.stringify(completedList));
  }
  renderCertificates();
}

function renderCertificates() {
  const container = $("#certificates-container-lms");
  if (!container) return;

  const completedList = JSON.parse(localStorage.getItem("completed_certificates") || "[]");
  if (!completedList.length) {
    container.innerHTML = `<p style="padding: 16px; color: var(--text-muted);">Complete any certification exam to unlock your digital certificates here.</p>`;
    return;
  }

  container.innerHTML = completedList
    .map((cid) => {
      const title = EXAMS_CATALOG[cid]?.title || `Course #${cid}`;
      return `
      <div class="mv-card" style="padding: 24px; text-align:center; border: 2px solid var(--primary); border-radius:var(--radius-md);">
        <span class="material-symbols-rounded" style="font-size: 64px; color:#ff9800;">workspace_premium</span>
        <h3 style="font-size:18px; margin-top:12px; margin-bottom:8px;">${title} Certificate</h3>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">Issued on Completion of Exam with verified QR validation.</p>
        <button class="btn btn-primary btn-view-cert" style="height:36px; font-size:13px; width:100%;" data-cert-id="${cid}">View Certificate</button>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".btn-view-cert").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCertificateWindow(btn.dataset.certId);
    });
  });
}

function openCertificateWindow(certId) {
  const w = window.open("", "_blank");
  const title = EXAMS_CATALOG[certId]?.title || `Certification`;
  // Get real student name
  const studentName = $("#sidebar-student-name")?.textContent?.trim() || "Student";
  w.document.write(`
  <html>
    <head>
      <title>${title} Certificate</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap" rel="stylesheet" />
      <style>
        body { font-family: 'Outfit', sans-serif; display: flex; align-items:center; justify-content:center; height: 100vh; margin:0; background:#f1f5f9; }
        .cert { width: 800px; height: 550px; background:#fff; border: 20px double #4f46e5; border-radius:12px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); padding: 40px; box-sizing:border-box; text-align:center; position:relative; }
        h1 { color: #4f46e5; font-size:42px; margin-bottom:10px; }
        h3 { font-size:24px; color:#1e293b; margin-top: 30px; }
        p { color: #64748b; font-size:16px; margin: 10px 0; }
        .signature { margin-top: 50px; display:flex; justify-content:space-around; }
        .sig-line { border-top: 1px solid #cbd5e1; width: 180px; padding-top:8px; font-size:14px; }
        .qr-mock { position:absolute; bottom:40px; right:40px; display:flex; flex-direction:column; align-items:center; }
        .qr-box { width: 80px; height: 80px; background:#000; border: 2px solid #000; padding:4px; }
      </style>
    </head>
    <body>
      <div class="cert">
        <p style="text-transform:uppercase; letter-spacing:4px; font-weight:700;">Certificate of Accomplishment</p>
        <h1>VERIFIED LMS CERTIFICATE</h1>
        <p>This is to proudly certify that</p>
        <h3>${studentName}</h3>
        <p>has successfully completed the curriculum and rigorous assessments for</p>
        <h2 style="color: #ec4899;">${title}</h2>
        <p>proving complete mastery of the core concepts and practical projects.</p>
        <div class="signature">
          <div class="sig-line">E-Tracks CEO Signature</div>
          <div class="sig-line">Director Signature</div>
        </div>
        <div class="qr-mock">
          <div class="qr-box">
            <svg width="100%" height="100%" viewBox="0 0 100 100" style="background:#fff;">
              <rect x="10" y="10" width="20" height="20" fill="#000"/>
              <rect x="70" y="10" width="20" height="20" fill="#000"/>
              <rect x="10" y="70" width="20" height="20" fill="#000"/>
              <rect x="35" y="35" width="30" height="30" fill="#000"/>
              <rect x="80" y="80" width="10" height="10" fill="#000"/>
            </svg>
          </div>
          <span style="font-size:10px; color:#94a3b8; margin-top:4px;">Verify QR Code</span>
        </div>
      </div>
    </body>
  </html>
  `);
}

// Live Community Board Feed mechanics
function renderCommunityFeed() {
  const container = $("#community-feed-container");
  if (!container) return;

  container.innerHTML = communityPosts
    .map((post, i) => {
      const commentsHtml = post.comments
        .map(
          (c) => `
        <div style="background:var(--bg-light); padding:10px; border-radius:var(--radius-sm); margin-top:6px; font-size:13px;">
          <strong>${c.author}:</strong> <span>${c.text}</span>
        </div>`
        )
        .join("");

      return `
      <div class="mv-card" style="padding: 20px;">
        <h3 style="font-size:18px; margin-bottom:8px; color:var(--text-main);">${post.title}</h3>
        <p style="font-size:14px; color:var(--text-muted); margin-bottom:16px;">${post.body}</p>
        <div style="font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:10px; margin-bottom:12px;">
          <span>Posted by: <strong>${post.author}</strong></span>
          <div style="display:flex; gap:16px; align-items:center;">
            <button class="btn-icon btn-like-post" data-index="${i}" style="padding:4px; color:#ec4899; display:flex; align-items:center; gap:4px;">
              <span class="material-symbols-rounded" style="font-size:18px;">favorite</span>
              <span>${post.likes}</span>
            </button>
          </div>
        </div>
        <div>
          <h4 style="font-size:13px; margin-bottom:6px; color:var(--text-main);">Comments</h4>
          <div style="margin-bottom:12px;">${commentsHtml || '<p style="font-size:12px; color:var(--text-muted);">No comments yet.</p>'}</div>
          <div style="display:flex; gap:8px;">
            <input type="text" placeholder="Write comment..." class="comment-input" style="flex:1; padding:6px; border-radius:var(--radius-sm); border:1px solid var(--glass-border); font-size:13px;" />
            <button class="btn btn-primary btn-add-comment" data-index="${i}" style="height:32px; font-size:12px; padding: 0 12px;">Comment</button>
          </div>
        </div>
      </div>`;
    })
    .join("");

  // Post Likes & Comment actions listeners
  container.querySelectorAll(".btn-like-post").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      communityPosts[idx].likes++;
      localStorage.setItem("community_posts", JSON.stringify(communityPosts));
      renderCommunityFeed();
    });
  });

  container.querySelectorAll(".btn-add-comment").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      const row = btn.parentNode;
      const input = row.querySelector(".comment-input");
      const commentText = input.value.trim();
      if (!commentText) return;

      communityPosts[idx].comments.push({
        author: "Omar Ahmed",
        text: commentText,
      });
      localStorage.setItem("community_posts", JSON.stringify(communityPosts));
      renderCommunityFeed();
      addXP(5);
    });
  });
}

function setupCommunityPublish() {
  const btn = $("#btn-submit-community-post");
  const titleInput = $("#community-post-title");
  const bodyText = $("#community-post-body");

  if (btn && titleInput && bodyText) {
    btn.addEventListener("click", () => {
      const title = titleInput.value.trim();
      const body = bodyText.value.trim();
      if (!title || !body) return;

      communityPosts.unshift({
        id: Date.now(),
        title,
        body,
        author: "Omar Ahmed",
        likes: 0,
        comments: [],
      });
      localStorage.setItem("community_posts", JSON.stringify(communityPosts));
      titleInput.value = "";
      bodyText.value = "";
      renderCommunityFeed();
      addXP(15);
      showToast("Post published successfully! +15 XP", "success");
    });
  }
}

// AI Video Summary simulation
function setupAiVideoSummary() {
  const summaryBtn = $("#btn-video-ai-summary");
  const summaryBox = $("#ai-summary-box");
  const summaryContent = $("#ai-summary-content");

  if (summaryBtn && summaryBox && summaryContent) {
    summaryBtn.addEventListener("click", () => {
      summaryBox.classList.remove("hidden");
      summaryContent.innerHTML = "Generating AI insights... Please wait.";

      setTimeout(() => {
        summaryContent.innerHTML = `
        <strong>💡 Key Concept Highlight:</strong> This lesson covers critical foundations. Main key points include:<br />
        1. <em>Context First:</em> Always structure design hierarchy based on user reading paths.<br />
        2. <em>Optimal Performance:</em> Minifying static resources directly boosts UX and search performance metrics.<br />
        3. <em>Core Applications:</em> Real-world implementation requires absolute attention to responsive spacing guidelines.`;
        addXP(5);
      }, 1000);
    });
  }
}

// Recommended / Suggestions catalog rendering
async function renderSuggestedCourses() {
  const container = $("#suggested-courses-lms");
  if (!container) return;

  const dashboard = await apiGet("/api/student/dashboard");
  const suggestions = dashboard.suggestions || [];

  if (!suggestions.length) {
    container.innerHTML = `<p style="font-size: 13px; color: var(--text-muted);">No suggestions available at the moment.</p>`;
    return;
  }

  container.innerHTML = suggestions
    .map(
      (c) => `
    <div class="suggested-course-card reveal-up">
      <h4>${c.name}</h4>
      <p style="font-size: 12px; color:var(--text-muted); margin: 6px 0 12px 0;">Syllabus features, verified project certification, modules.</p>
      <a href="/register?course=${c.id}" class="btn btn-outline" style="height:32px; font-size:12px; width:100%; text-decoration:none;">Enroll Track</a>
    </div>`
    )
    .join("");
}

// Theme customization
function setupLmsTheme() {
  const lightBtn = $("#lms-setting-light");
  const darkBtn = $("#lms-setting-dark");
  const body = document.body;

  if (lightBtn && darkBtn) {
    lightBtn.addEventListener("click", () => {
      body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
      showToast("Appearance switched to Light mode", "success");
    });
    darkBtn.addEventListener("click", () => {
      body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
      showToast("Appearance switched to Dark mode", "success");
    });
  }
}

async function init() {
  console.log("[CLASSROOM] ========== INIT STARTED ==========");
  if (window.pendingPollInterval) {
    clearInterval(window.pendingPollInterval);
    window.pendingPollInterval = null;
  }
  if (!$("#classroom-app")) {
    console.error("[CLASSROOM] ERROR: #classroom-app element not found!");
    return;
  }

  console.log("[CLASSROOM] Calling showLoading()");
  showLoading();
  initLmsNavigation();
  setupTimeNotes();
  renderExamsList();
  renderCertificates();
  renderCommunityFeed();
  setupCommunityPublish();
  setupAiVideoSummary();
  setupLmsTheme();

  try {
    console.log("[CLASSROOM] Fetching dashboard from /api/student/dashboard");
    const dashboard = await apiGet("/api/student/dashboard");
    console.log("[CLASSROOM] Dashboard received:", dashboard);
    
    const courseId = getCourseIdFromUrl();
    const justEnrolled = new URLSearchParams(window.location.search).get("enrolled") === "1";

    console.log("[CLASSROOM] courseId:", courseId, "justEnrolled:", justEnrolled);
    console.log("[CLASSROOM] dashboard.hasEnrollments:", dashboard.hasEnrollments);
    console.log("[CLASSROOM] dashboard.hasPending:", dashboard.hasPending);

    console.log("[CLASSROOM] Calling hideLoading()");
    hideLoading();

    const nameHeader = $("#sidebar-student-name");
    const welcomeHeader = $("#welcome-message");
    try {
      const me = await apiGet("/api/student/me");
      const displayName = me?.user?.name || me?.user?.username;
      if (displayName) {
        if (nameHeader) nameHeader.textContent = displayName;
        if (welcomeHeader) {
          welcomeHeader.textContent =
            localStorage.getItem("lang") === "ar"
              ? `مرحباً بعودتك، ${displayName} 👋`
              : `Welcome back, ${displayName} 👋`;
        }
      }
    } catch (meErr) {
      console.warn("Could not load student profile:", meErr.message);
    }

    if (dashboard.hasEnrollments) {
      console.log("[CLASSROOM] User HAS enrollments - showing active panel");
      activeEnrollments = dashboard.enrollments;
      showPanel("active");

      // Ensure dashboard tab is active by default
      document.querySelectorAll(".lms-nav-link").forEach(l => l.classList.remove("active"));
      const dashboardLink = document.querySelector("[data-target='dashboard']");
      if (dashboardLink) dashboardLink.classList.add("active");
      
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      const dashboardPanel = document.getElementById("panel-dashboard");
      if (dashboardPanel) dashboardPanel.classList.add("active");

      renderActiveCoursesGrid(dashboard.enrollments);

      const statCompleted = $("#stat-completed-courses");
      if (statCompleted) {
        statCompleted.textContent = `${dashboard.enrollments.length} Track${dashboard.enrollments.length === 1 ? "" : "s"}`;
      }

      const resumeBtn = $("#btn-continue-course-home");
      const resumeTitle = $("#continue-course-title");
      const firstActive = dashboard.enrollments[0];
      if (resumeBtn && firstActive) {
        if (resumeTitle) resumeTitle.textContent = firstActive.title;
        resumeBtn.onclick = () => {
          enterCourseView(firstActive.courseId);
          document.querySelector("[data-target='my-courses']")?.click();
        };
      }

      await renderSuggestedCourses();
      await loadNotifications();
      $("#btn-mark-all-notifications-read")?.addEventListener("click", markAllNotificationsRead);

      if (!window.notificationsPollInterval) {
        window.notificationsPollInterval = setInterval(() => {
          if (!$("#classroom-active")?.classList.contains("hidden")) {
            loadNotifications();
          }
        }, 60000);
      }

      $("#btn-back-to-courses-list")?.addEventListener("click", () => {
        $("#courses-list-view")?.classList.remove("hidden");
        $("#course-classroom-view")?.classList.add("hidden");
        activeCourseId = null;
      });

      const targetCourse =
        courseId && dashboard.enrollments.some((e) => String(e.courseId) === String(courseId))
          ? courseId
          : justEnrolled
            ? dashboard.enrollments[0]?.courseId
            : null;

      if (targetCourse) {
        enterCourseView(targetCourse);
        document.querySelector("[data-target='my-courses']")?.click();
      }
      return;
    }

    if (dashboard.hasPending) {
      console.log("[CLASSROOM] User has PENDING enrollments");
      const pending = courseId
        ? dashboard.pending.find((p) => String(p.courseId) === String(courseId))
        : dashboard.pending[0];
      console.log("[CLASSROOM] Showing pending for course:", pending);
      showPending(pending?.title);

      if (!window.pendingPollInterval) {
        window.pendingPollInterval = setInterval(async () => {
          try {
            const checkDashboard = await apiGet("/api/student/dashboard");
            if (checkDashboard.hasEnrollments) {
              clearInterval(window.pendingPollInterval);
              window.pendingPollInterval = null;
              showToast(
                localStorage.getItem("lang") === "ar"
                  ? "تمت الموافقة! مرحباً بك في الكلاس روم."
                  : "Enrollment approved! Welcome to the classroom.",
                "success",
              );
              init();
            }
          } catch (e) {
            console.error("LMS auto-approval check failed:", e);
          }
        }, 5000);
      }
      return;
    }

    console.log("[CLASSROOM] No enrollments and no pending - showing empty state");
    showEmpty();
  } catch (err) {
    console.error("[CLASSROOM] ========== ERROR IN INIT ==========");
    console.error("[CLASSROOM] Error:", err);
    console.error("[CLASSROOM] Error message:", err.message);
    console.error("[CLASSROOM] Error stack:", err.stack);
    hideLoading();
    showToast(err.message || "Could not load classroom", "error");
    showEmpty();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
