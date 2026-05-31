const express = require("express");
const path = require("path");
const router = express.Router();
const { authenticateJWT, requireAdmin, generateToken } = require("./auth");
const jwt = require("jsonwebtoken");
const supabase = require("../supabaseClient");
const studentStore = require("../lib/studentStore");
const { listApprovedCourses } = require("../lib/coursesCatalog");

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "authToken";
const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: parseInt(process.env.AUTH_COOKIE_MAX_AGE, 10) || 1000 * 60 * 60 * 24 * 7,
  path: "/",
};

const frontendPath = path.join(__dirname, "../frontend");

const loginRedirectAuth = (req, res, next) => {
  if (!req.user) {
    return res.redirect("/login");
  }
  next();
};

const softAuth = (req, res, next) => {
  let token = null;
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    token = req.cookies[COOKIE_NAME];
  }
  const authHeader = req.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (token) {
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "change-this-secret",
        {
          issuer: process.env.JWT_ISSUER || "etracks",
          audience: process.env.JWT_AUDIENCE || "etracks-users",
          algorithm: "HS256",
          maxAge: process.env.JWT_EXPIRATION || "7d",
          clockTolerance: 5,
        },
      );
      req.user = payload;
    } catch (err) {
      // Invalid token, just proceed without setting req.user
    }
  }
  next();
};

router.use(softAuth);

async function loadNavCourses(req, res, next) {
  try {
    const supabase = require("../supabaseClient");
    if (!supabase) {
      console.warn('[navCourses] Supabase not configured, skipping courses load');
      res.locals.navCourses = [];
      res.locals.csrfToken = res.locals.csrfToken || "";
      return next();
    }
    res.locals.navCourses = await listApprovedCourses();
  } catch (err) {
    console.warn("[navCourses]", err.message);
    res.locals.navCourses = [];
  }
  res.locals.csrfToken = res.locals.csrfToken || "";
  next();
}

router.use(loadNavCourses);

router.get("/", (req, res) => {
  console.log('✓ Rendering home page (frontend/index)');
  try {
    res.render("frontend/index", {
      title: "Home | E-Tracks",
      description:
        "E-Tracks is a premium learning management system offering expert-led courses in technology, design, and business.",
      path: "/",
      lang: "en",
      isLoggedIn: !!req.user,
      userRole: req.user ? req.user.role : "",
      pageScripts: [],
    });
  } catch (err) {
    console.error('❌ Error rendering home page:', err);
    throw err;
  }
});

router.get("/login", (req, res) => {
  if (req.user) {
    const dest = req.user.role === "admin" ? "/admin" : "/classroom";
    return res.redirect(dest);
  }
  res.render("frontend/login", {
    title: "Log in | E-Tracks",
    description:
      "Sign in to your E-Tracks account to continue your learning journey.",
    path: "/login",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: ["/js/auth.js"],
  });
});

router.get("/signup", (req, res) => {
  res.render("frontend/signup", {
    title: "Sign Up | E-Tracks",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: ["/js/auth.js"],
  });
});

router.get("/about", (req, res) => {
  res.render("frontend/about", {
    title: "About Us | E-Tracks",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: [],
  });
});

router.get("/register", (req, res) => {
  res.render("frontend/register", {
    title: "Register | E-Tracks",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: ["/js/auth.js?v=5.2"],
    formError: req.query.error || "",
    preselectCourse: req.query.course || "",
    navCourses: res.locals.navCourses || [],
  });
});

/** Course registration — server POST (no fetch required). */
router.post("/register/submit", async (req, res, next) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const fullName = (req.body?.fullName || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const courseId = req.body?.course || req.body?.courseId;

    if (!email || !fullName || !phone || !courseId) {
      return res.redirect(
        `/register?error=${encodeURIComponent("Please fill all fields")}&course=${courseId || ""}`,
      );
    }

    let forceUserId = null;
    if (req.user?.sub) {
      try {
        const sessionUser = await studentStore.resolveUserFromToken(req.user);
        if (sessionUser) forceUserId = sessionUser.id;
      } catch {
        /* ignore */
      }
    }

    const result = await studentStore.submitCourseEnrollment({
      email,
      fullName,
      phone,
      courseId,
      req,
      forceUserId,
    });

    if (result.error) {
      return res.redirect(
        `/register?error=${encodeURIComponent(result.error)}&course=${courseId}`,
      );
    }

    const token = await generateToken(result.user);
    res.cookie(COOKIE_NAME, token, authCookieOptions);
    res.redirect(`/classroom?course=${courseId}&enrolled=1`);
  } catch (err) {
    console.error("[register/submit]", err);
    next(err);
  }
});

router.get("/admin-login", (req, res) => {
  res.render("frontend/admin_login", {
    title: "Admin Login | E-Tracks",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: ["/js/admin-login.js"],
  });
});

router.get("/dashboard", loginRedirectAuth, (req, res) => {
  if (req.user?.role === "admin") return res.redirect("/admin");
  return res.redirect("/classroom");
});

router.get("/forgot-password", (req, res) => {
  res.render("frontend/forgot-password", {
    title: "Reset Password | E-Tracks",
    path: "/forgot-password",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: ["/js/forgot-password.js"],
  });
});

router.get("/courses", (req, res) => {
  res.render("frontend/courses", {
    title: "Explore Courses | E-Tracks",
    description:
      "Browse our catalog of professional courses and start learning today.",
    path: "/courses",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: ["/js/courses.js"],
  });
});

router.get("/classroom", loginRedirectAuth, (req, res) => {
  if (req.user?.role === "admin") return res.redirect("/admin");
  res.render("frontend/classroom", {
    title: "My Classroom | E-Tracks",
    description: "Your courses, lessons, and progress.",
    path: "/classroom",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: ["/js/classroom.js?v=6.2"],
    hideFooter: true,
  });
});

router.get("/payment", (req, res) => {
  res.render("frontend/payment", {
    title: "Payment | E-Tracks",
    lang: "en",
    isLoggedIn: !!req.user,
    userRole: req.user ? req.user.role : "",
    pageScripts: [],
  });
});

router.get("/course/:id", loginRedirectAuth, async (req, res) => {
  try {
    const supabase = require("../supabaseClient");
    const courseId = req.params.id;

    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .eq("status", "approved")
      .single();

    if (error || !data) {
      return res
        .status(404)
        .render("404", {
          title: "Course Not Found",
          lang: "en",
          pageScripts: [],
        });
    }

    res.render("frontend/course_details", {
      title: `${data.name} | E-Tracks`,
      lang: "en",
      pageScripts: ["/js/course_details.js"],
      course: data,
      isLoggedIn: !!req.user,
      userRole: req.user ? req.user.role : "",
    });
  } catch (error) {
    console.error("Course fetch error:", error);
    res
      .status(404)
      .render("404", {
        title: "Course Not Found",
        lang: "en",
        pageScripts: [],
      });
  }
});

router.get("/admin", loginRedirectAuth, requireAdmin, (req, res) => {
  res.render("frontend/admin_dashboard", {
    title: "Admin Dashboard | E-Tracks",
    lang: "en",
    isLoggedIn: true,
    userRole: "admin",
    pageScripts: ["/js/admin.js"],
    pageStyles: ["/css/admin.css"],
  });
});

router.get("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.redirect("/login");
});

module.exports = { router };
