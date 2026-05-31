require('dotenv').config();

// Log startup info
console.log('Starting E-Tracks server...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 10000);
console.log('Supabase URL configured:', !!process.env.SUPABASE_URL);
console.log('Supabase Key configured:', !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY));

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const xss = require("xss");
const ejs = require("ejs");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

// Import routes with error handling
let authRouter, authenticateJWT, courseRouter, adminRouter, studentRouter, viewsRouter, logError, backupMiddleware;

try {
  const authModule = require("./routes/auth");
  authRouter = authModule.router;
  authenticateJWT = authModule.authenticateJWT;
  courseRouter = require("./routes/courses").router;
  adminRouter = require("./routes/admin").router;
  studentRouter = require("./routes/student").router;
  viewsRouter = require("./routes/views").router;
  logError = require("./logger").logError;
  backupMiddleware = require("./backupMiddleware");
  console.log('✓ All routes loaded successfully');
} catch (err) {
  console.error('⚠️  Error loading routes:', err.message);
  console.error('Server will start with limited functionality');
  // Create dummy middleware to prevent crashes
  authRouter = express.Router();
  courseRouter = express.Router();
  adminRouter = express.Router();
  studentRouter = express.Router();
  viewsRouter = express.Router();
  authenticateJWT = (req, res, next) => next();
  logError = (err) => console.error(err);
  backupMiddleware = (req, res, next) => next();
}

const app = express();
// Railway provides PORT automatically, fallback to 10000 for local dev
const PORT = process.env.PORT || 10000;

console.log(`✓ Using PORT: ${PORT}`);
console.log(`✓ NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

// Health check endpoint FIRST - before any middleware
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// View engine setup
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layout");
app.set("views", path.join(process.cwd(), "templates"));

// Trust proxy
app.set("trust proxy", 1);

// Security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http://localhost:3000"],
        frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
        connectSrc: [
          "'self'",
          "https://*.supabase.co",
          "https://*.vercel.app",
          "https://*.netlify.app",
          "https://*.railway.app",
          "http://localhost:3000",
        ],
      },
    },
  }),
);

app.disable("x-powered-by");

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
});

/** Public enrollment — no CSRF (validated server-side). */
app.use((req, res, next) => {
  if (req.method !== "POST") return csrfProtection(req, res, next);
  const path = req.path || "";
  const url = req.originalUrl || "";
  const openPost =
    path === "/register/submit" ||
    url.startsWith("/register/submit") ||
    path.endsWith("/enroll-course") ||
    url.includes("/api/auth/enroll-course");
  if (openPost) return next();
  return csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  try {
    res.locals.csrfToken = typeof req.csrfToken === "function" ? req.csrfToken() : "";
  } catch {
    res.locals.csrfToken = "";
  }
  next();
});

app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    const sanitize = (value) => {
      if (typeof value === "string") return xss(value);
      if (Array.isArray(value)) return value.map(sanitize);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, sanitize(v)]),
        );
      }
      return value;
    };
    req.body = sanitize(req.body);
  }
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== "production") return callback(null, origin);
      const whitelist = (process.env.CORS_WHITELIST || "http://localhost:3000")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const appUrl = (process.env.APP_URL || "").trim();
      const ok =
        whitelist.some((d) => origin === d || origin.startsWith(d)) ||
        (appUrl && origin.startsWith(appUrl)) ||
        origin.includes("vercel.app") ||
        origin.includes("netlify.app") ||
        origin.includes("railway.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1");
      return callback(null, ok ? origin : false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-XSRF-TOKEN",
    ],
    credentials: true,
  }),
);

// Serve static files BEFORE rate limiting so assets don't exhaust the limit
app.use(express.static(path.join(process.cwd(), "frontend"), { dotfiles: "deny" }));
app.use(
  "/static",
  express.static(path.join(process.cwd(), "public"), { dotfiles: "deny" }),
);

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3000, // Allow up to 3000 requests per minute from a single IP (e.g., a school network)
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100, // Allow 100 login/register attempts per minute from the same IP
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts, please try again later.",
});

// Automatic Backups Middleware (Intercepts mutations)
app.use(backupMiddleware);

// Routes
app.use("/", viewsRouter);

app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/courses", courseRouter);
app.use("/api/student", studentRouter);
app.use("/api/admin", adminRouter);

// 404 — HTML pages for browser navigation, JSON for API
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not Found" });
  }
  res.status(404).render("404", {
    title: "Page Not Found | E-Tracks",
    path: req.path,
    lang: "en",
    isLoggedIn: false,
    userRole: "",
  });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    logError(err, req);
    if (req.path === "/register/submit" || req.accepts("html")) {
      return res.redirect(
        `/register?error=${encodeURIComponent("Session expired. Please try again.")}`,
      );
    }
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  logError(err, req);
  console.error(err);
  const isProd = process.env.NODE_ENV === "production";
  const message = isProd
    ? "Internal Server Error"
    : err.message || "Internal Server Error";
  if (req.path === "/register/submit" || req.accepts("html")) {
    return res.redirect(`/register?error=${encodeURIComponent(message)}`);
  }
  res.status(err.status || 500).json({ error: message });
});

// Start server (Railway, Render, local, etc.)
// Skip only for serverless platforms (Vercel, Netlify)
if (!process.env.NETLIFY && !process.env.VERCEL) {
  // Always use 0.0.0.0 for Railway and production, localhost for local dev
  const isProduction = process.env.NODE_ENV === 'production';
  const host = isProduction ? '0.0.0.0' : 'localhost';
  
  const server = app.listen(PORT, host, () => {
    console.log(`✓ Server running at http://${host}:${PORT}`);
    console.log(`✓ Health check available at http://${host}:${PORT}/health`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Host binding: ${host}`);
  });

  // Handle server errors
  server.on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
  });
}

module.exports = app;
