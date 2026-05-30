import { initUI, refreshAnimations } from "./ui.js?v=4.3";
import { initI18n, translatePage } from "./i18n.js?v=4.3";
import { initTheme } from "./theme.js?v=4.3";
import { getCourses, hydrateCoursePage } from "./api.js?v=4.3";
import { translations } from "./translations.js?v=4.3";

// Auth state management
function isAuthenticated() {
  const navRight = document.querySelector(".nav-right");
  // 1. Check data attribute
  if (navRight && navRight.dataset.isLoggedIn === "true") return true;
  // 2. Check server role
  const serverRole = navRight ? navRight.dataset.userRole : "";
  if (serverRole && serverRole.trim() !== "") return true;
  // 3. Fallback for SPA/Cache
  return (
    localStorage.getItem("userJustLoggedIn") === "true" ||
    document.cookie
      .split(";")
      .some((cookie) => cookie.trim().startsWith("authToken="))
  );
}

function updateNavbarAuthState() {
  const loginBtns = document.querySelectorAll(
    '.btn-login-only, .mockup-action-btn[data-i18n="btn_login"], .mockup-action-btn[data-i18n="btn_signup"]',
  );
  const authBtns = document.querySelectorAll(".btn-auth-only");

  const authenticated = isAuthenticated();
  const navRight = document.querySelector(".nav-right");
  const serverRole = navRight ? navRight.dataset.userRole : "";
  const userRole =
    serverRole && serverRole.trim() !== ""
      ? serverRole
      : localStorage.getItem("userRole") || "";

  loginBtns.forEach(
    (btn) => (btn.style.display = authenticated ? "none" : "flex"),
  );
  authBtns.forEach((btn) => {
    const isAdminOnly = btn.classList.contains("btn-admin-only");
    if (isAdminOnly && userRole !== "admin") {
      btn.style.display = "none";
      return;
    }

    const isHideDesktop = btn.classList.contains("hide-desktop");
    if (!authenticated) {
      btn.style.display = "none";
    } else {
      btn.style.display = isHideDesktop ? "flex" : "inline-block";
    }
  });
}

async function initMain() {
  console.log("E-Tracks Frontend V2.1.0 - Connection Check");
  // Initialize Modules
  initUI();
  initI18n();
  initTheme();
  updateNavbarAuthState();
  setTimeout(updateNavbarAuthState, 100); // Re-run for dynamic elements

  // Listen for storage changes (cross-tab sync)
  window.addEventListener("storage", updateNavbarAuthState);

  // Page Specific Logic
  const urlParams = new URLSearchParams(window.location.search);
  let courseId = urlParams.get("course");
  if (!courseId && window.location.pathname.startsWith("/course/")) {
    courseId = window.location.pathname.split("/").pop();
  }

  // Course Detail Hydration
  if (document.querySelector(".course-detail-hero") && courseId) {
    await hydrateCoursePage(courseId);
  }

  // Home Page Course Grid (Only if data-featured is present to avoid conflict with courses.js)
  const homeCoursesGrid = document.querySelector(
    "#courses-container[data-featured]",
  );
  if (homeCoursesGrid) {
    await renderHomeCourses(homeCoursesGrid);
  }

  // Payment Page Logic
  initPaymentLogic();

  // Scroll to top logic
  const scrollToTopBtn = document.getElementById("scrollToTopBtn");
  if (scrollToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) {
        scrollToTopBtn.classList.add("visible");
      } else {
        scrollToTopBtn.classList.remove("visible");
      }
    });

    scrollToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Smooth Navigation Scroll
  document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      let targetId = this.getAttribute("href");
      let target = null;

      if (targetId.startsWith("/#") && window.location.pathname === "/") {
        targetId = targetId.substring(1); // extract '#id'
        target = document.querySelector(targetId);
      } else if (targetId.startsWith("#")) {
        target = document.querySelector(targetId);
      }

      if (target) {
        e.preventDefault();

        // Close mobile menu if open
        const navMenu = document.querySelector(".nav-menu");
        const menuBtn = document.querySelector(".mobile-menu-btn");
        if (navMenu && navMenu.classList.contains("active")) {
          navMenu.classList.remove("active");
          if (menuBtn) menuBtn.classList.remove("active");
        }

        // Scroll with offset for header
        const headerOffset = 90;
        const targetPosition =
          target.getBoundingClientRect().top +
          window.pageYOffset -
          headerOffset;
        window.scrollTo({ top: targetPosition, behavior: "smooth" });
      }
    });
  });

  initStatCounters();
  initSearchDropdown();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMain);
} else {
  initMain();
}

async function renderHomeCourses(container) {
  const courses = await getCourses();
  const lang = localStorage.getItem("lang") || "en";

  if (!courses || Object.keys(courses).length === 0) {
    container.innerHTML = `<p class="empty-msg" data-i18n="no_courses">No courses found yet.</p>`;
    return;
  }

  container.innerHTML = "";

  const courseKeys = Object.keys(courses);
  const countPill = document.getElementById("dynamic-course-count-pill");
  const countStat = document.getElementById("dynamic-course-count");
  if (countPill) {
    countPill.textContent = `+${courseKeys.length}`;
    countPill.dataset.count = String(courseKeys.length);
  }
  if (countStat) {
    countStat.textContent = `+${courseKeys.length}`;
    countStat.dataset.count = String(courseKeys.length);
    countStat.dataset.prefix = "+";
  }

  const isFeatured = container.hasAttribute("data-featured");
  const displayIds = isFeatured ? courseKeys.slice(0, 4) : courseKeys;

  displayIds.forEach((id) => {
    const course = courses[id];

    // Get direct translation for immediate display
    const titleText =
      (translations[lang] && translations[lang][course.titleStr]) ||
      course.title ||
      id;
    const enrollText =
      (translations[lang] && translations[lang]["btn_enroll"]) ||
      "Register Now";
    const isLoggedIn = isAuthenticated();
    const exploreHref = isLoggedIn
      ? `/classroom?course=${id}`
      : `/register?course=${id}`;

    const card = document.createElement("div");
    card.className = "course-card reveal-up course-card-animated";
    card.innerHTML = `
      <a href="${exploreHref}" class="card-hover-explore" style="z-index: 100; cursor: pointer; display: flex; align-items: center; justify-content: center; text-decoration: none;">
        <span class="material-symbols-rounded">play_arrow</span>
      </a>
      <div class="card-link-overlay" onclick="window.location.href='${exploreHref}'"></div>
      <div class="card-img">
        <img src="${course.img}" alt="course">
        <div class="tag" data-i18n="${course.tagStr}"></div>
      </div>
      <div class="card-content">
        <div class="card-meta">
          <span><i class="material-symbols-rounded" style="font-size: 16px;">schedule</i> ${course.weeks} ${lang === "ar" ? "أسابيع" : "Weeks"}</span>
          <span><i class="material-symbols-rounded" style="font-size: 16px; color: #f59e0b;">star</i> ${course.rating || "4.8"}</span>
        </div>
        <h3 data-i18n="${course.titleStr}">${titleText}</h3>
        <button class="btn btn-primary btn-card-register" data-action="go-details" data-id="${id}" data-i18n="btn_enroll">${enrollText}</button>
      </div>
    `;
    container.appendChild(card);
  });

  // CSP-Compliant Event Delegation
  container.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === "go-classroom") {
      e.stopPropagation();
      window.location.href = `/classroom?course=${id}`;
    } else if (action === "go-details") {
      window.location.href = `/register?course=${id}`;
    }
  });

  // Critical: Trigger translation and animation refresh immediately after DOM update
  translatePage();
  refreshAnimations();
}

function initPaymentLogic() {
  const copyBtn = document.getElementById("copy-btn");
  const transferNum = document.getElementById("transfer-number");
  if (copyBtn && transferNum) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(transferNum.textContent).then(() => {
        const icon = copyBtn.querySelector(".material-symbols-rounded");
        if (icon) icon.textContent = "check";
        setTimeout(() => {
          if (icon) icon.textContent = "content_copy";
        }, 2000);
      });
    });
  }

  const receiptInput = document.getElementById("receipt-upload");
  if (receiptInput) {
    receiptInput.addEventListener("change", function () {
      const file = this.files[0];
      const previewImg = document.getElementById("preview-img");
      const fileName = document.getElementById("file-name");
      const filePreview = document.getElementById("file-preview");
      const uploadLabel = document.querySelector(".upload-label");

      if (file && previewImg && fileName && filePreview && uploadLabel) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          fileName.textContent = file.name;
          filePreview.classList.remove("hidden");
          uploadLabel.classList.add("hidden");
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

// Expose globally for onclick handlers
window.updateNavbarAuthState = updateNavbarAuthState;

// Reset autofill on non-auth pages only
window.addEventListener("load", () => {
  if (
    document.getElementById("login-form") ||
    document.getElementById("signup-form") ||
    document.getElementById("enrollment-form")
  ) {
    return;
  }
  setTimeout(() => {
    document
      .querySelectorAll(
        "form:not(#login-form):not(#signup-form):not(#enrollment-form)",
      )
      .forEach((form) => form.reset());
  }, 100);
});

function initStatCounters() {
  const counters = document.querySelectorAll(
    ".stat-number[data-count], .stat-pill-num[data-count]",
  );
  if (!counters.length) return;

  const animate = (el) => {
    const decimals = parseInt(el.dataset.decimal, 10) || 0;
    const target = parseFloat(el.dataset.count, 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = target * eased;
      el.textContent =
        decimals > 0
          ? `${prefix}${value.toFixed(decimals)}${suffix}`
          : `${prefix}${Math.floor(value)}${suffix}`;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 },
  );
  counters.forEach((el) => io.observe(el));
}

async function initSearchDropdown() {
  const searchBox = document.querySelector(".nav-search");
  const searchInput = document.querySelector(".nav-search input");
  if (!searchBox || !searchInput) return;

  // Create the dropdown results container
  const dropdown = document.createElement("div");
  dropdown.className = "search-results-dropdown";
  searchBox.appendChild(dropdown);

  let allCourses = null;
  let focusedIndex = -1;

  // Helper to get active results items
  const getItems = () => dropdown.querySelectorAll(".search-result-item");

  const performSearch = async () => {
    const query = searchInput.value.trim().toLowerCase();
    const lang = localStorage.getItem("lang") || "en";

    if (query === "") {
      dropdown.classList.remove("active");
      dropdown.innerHTML = "";
      focusedIndex = -1;
      return;
    }

    if (!allCourses) {
      allCourses = await getCourses();
    }

    const matches = [];
    for (const [id, course] of Object.entries(allCourses)) {
      // Get translated strings for search matching
      const titleEn = (translations.en[course.titleStr] || course.title || "").toLowerCase();
      const titleAr = (translations.ar[course.titleStr] || course.title || "").toLowerCase();
      const descEn = (translations.en[course.descStr] || course.description || "").toLowerCase();
      const descAr = (translations.ar[course.descStr] || course.description || "").toLowerCase();
      const tagEn = (translations.en[course.tagStr] || "").toLowerCase();
      const tagAr = (translations.ar[course.tagStr] || "").toLowerCase();

      if (
        titleEn.includes(query) ||
        titleAr.includes(query) ||
        descEn.includes(query) ||
        descAr.includes(query) ||
        tagEn.includes(query) ||
        tagAr.includes(query) ||
        id.toLowerCase().includes(query)
      ) {
        matches.push({ id, ...course });
      }
    }

    dropdown.innerHTML = "";
    focusedIndex = -1;

    if (matches.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "search-no-results";
      emptyMsg.setAttribute("data-i18n", "search_no_results");
      emptyMsg.textContent =
        (translations[lang] && translations[lang].search_no_results) ||
        "No courses found.";
      dropdown.appendChild(emptyMsg);
    } else {
      matches.forEach((course) => {
        const title =
          (translations[lang] && translations[lang][course.titleStr]) ||
          course.title ||
          course.id;
        const isLoggedIn = isAuthenticated();
        const exploreHref = isLoggedIn
          ? `/classroom?course=${course.id}`
          : `/register?course=${course.id}`;

        const item = document.createElement("a");
        item.href = exploreHref;
        item.className = "search-result-item";
        item.innerHTML = `
          <img src="${course.img}" alt="${title}" class="search-result-img" />
          <div class="search-result-info">
            <div class="search-result-title">${title}</div>
            <div class="search-result-meta">
              <span><span class="material-symbols-rounded" style="font-size: 14px;">schedule</span> ${course.weeks} ${lang === "ar" ? "أسابيع" : "weeks"}</span>
              <span><span class="material-symbols-rounded star" style="font-size: 14px;">star</span> ${course.rating || "4.8"}</span>
            </div>
          </div>
        `;
        
        item.addEventListener("click", () => {
          dropdown.classList.remove("active");
        });
        
        dropdown.appendChild(item);
      });
    }

    dropdown.classList.add("active");
  };

  // Keyboard navigation event handler
  searchInput.addEventListener("keydown", (e) => {
    const items = getItems();
    if (!dropdown.classList.contains("active") || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % items.length;
      updateFocus(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + items.length) % items.length;
      updateFocus(items);
    } else if (e.key === "Enter") {
      if (focusedIndex > -1 && items[focusedIndex]) {
        e.preventDefault();
        items[focusedIndex].click();
        window.location.href = items[focusedIndex].href;
      }
    } else if (e.key === "Escape") {
      dropdown.classList.remove("active");
      searchInput.blur();
    }
  });

  const updateFocus = (items) => {
    items.forEach((item, index) => {
      if (index === focusedIndex) {
        item.classList.add("focused");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("focused");
      }
    });
  };

  searchInput.addEventListener("input", performSearch);
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim() !== "") {
      dropdown.classList.add("active");
    }
  });

  document.addEventListener("click", (e) => {
    if (!searchBox.contains(e.target)) {
      dropdown.classList.remove("active");
    }
  });
}
