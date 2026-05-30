const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const supabase = require("../supabaseClient");
const { sendResetMessage, sendResetEmail } = require("../lib/notify");
const studentStore = require("../lib/studentStore");
const passwordResetStore = require("../lib/passwordResetStore");
const { parsePhone } = require("../lib/phone");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
if (
  process.env.NODE_ENV === "production" &&
  JWT_SECRET === "change-this-secret"
) {
  throw new Error(
    "FATAL: JWT_SECRET must be set to a strong secret in production",
  );
}
const JWT_ISSUER = process.env.JWT_ISSUER || "etracks";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "etracks-users";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "7d";
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "authToken";
const COOKIE_MAX_AGE =
  parseInt(process.env.AUTH_COOKIE_MAX_AGE, 10) || 1000 * 60 * 60 * 24 * 7; // 7 days

const JWT_OPTIONS = {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  algorithm: "HS256",
};

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: COOKIE_MAX_AGE,
  path: "/",
};

function validateUserPayload(req, res, next) {
  const { email, username, password } = req.body || {};
  const isRegister =
    req.path === "/register" ||
    req.path === "/register-teacher" ||
    req.path === "/register-admin";
  //console.log(email, username, password);
  if (isRegister) {
    if (
      !email ||
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email.trim())
    ) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (
      !username ||
      typeof username !== "string" ||
      username.trim().length < 3 ||
      username.trim().length > 30
    ) {
      return res.status(400).json({ error: "Invalid username (3-30 chars)" });
    }
    // For enrollment requests (which include a phone field) allow missing password
    if (req.body.phone && (!password || typeof password !== "string")) {
      // No password provided; will generate later
      req.safePayload = {
        email: email.trim().toLowerCase(),
        username: username.trim(),
        // password omitted intentionally
      };
      return next();
    }
    // Standard registration requires a password
    if (
      !password ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 100
    ) {
      return res.status(400).json({ error: "Invalid password (8-100 chars)" });
    }

    req.safePayload = {
      email: email.trim().toLowerCase(),
      username: username.trim(),
      password,
    };
    return next();
  }

  if (
    !email ||
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email.trim())
  ) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (
    !password ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 100
  ) {
    return res.status(400).json({ error: "Invalid password (8-100 chars)" });
  }

  req.safePayload = { email: email.trim().toLowerCase(), password };
  next();
}

async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, role, password_hash")
    .eq("email", email.trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const user = data?.[0] || null;
  if (user) {
    user.username = user.name;
  }

  return user;
}

async function generateToken(user) {
  const userId = user.id ? String(user.id) : user.email;
  return jwt.sign(
    {
      sub: userId,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      ...JWT_OPTIONS,
      expiresIn: JWT_EXPIRATION,
      jwtid: `${userId}-${Date.now()}`,
    },
  );
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    if (req.accepts("html")) {
      return res.redirect("/admin-login?error=admin_required");
    }
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
}

function readAuthToken(req) {
  const authHeader = req.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
}

function authenticateJWT(req, res, next) {
  const token = readAuthToken(req);

  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      ...JWT_OPTIONS,
      maxAge: JWT_EXPIRATION,
      clockTolerance: 5,
    });
    req.user = payload;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Invalid or expired token", details: err.message });
  }
}

function optionalAuthenticateJWT(req, res, next) {
  const token = readAuthToken(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET, {
      ...JWT_OPTIONS,
      maxAge: JWT_EXPIRATION,
      clockTolerance: 5,
    });
  } catch {
    /* ignore invalid session */
  }
  next();
}

function parseUserAgent(userAgent) {
  const ua = userAgent || "";
  const device = /mobile/i.test(ua)
    ? "mobile"
    : /tablet|ipad/i.test(ua)
      ? "tablet"
      : "desktop";

  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : /MSIE|Trident\//i.test(ua)
              ? "Internet Explorer"
              : "Unknown";

  return { browser, device };
}

function getRequestMetadata(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : req.ip || req.socket?.remoteAddress || "";
  const userAgent = req.get("User-Agent") || "";
  const { browser, device } = parseUserAgent(userAgent);
  return { ip, browser, device, userAgent };
}

function normalizePhone(phone) {
  const parsed = parsePhone(phone);
  return parsed ? parsed.display : null;
}

async function registerUser(email, username, password, role, req, extra = {}) {
  const { data: existingEmail, error: emailError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (emailError) {
    console.error("Registration Email Check Error:", emailError);
    throw emailError;
  }

  if (existingEmail && existingEmail.id) {
    //console.log(`Conflict: Email "${email}" already exists (ID: ${existingEmail.id})`);
    return { conflict: true, reason: "email" };
  }

  // If password is missing (enrollment case), generate a random one
  if (!password) {
    password = crypto.randomBytes(8).toString("hex");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const insertRow = {
    email,
    name: username,
    role,
    password_hash: passwordHash,
    ...getRequestMetadata(req),
  };
  const { data: newUser, error } = await supabase
    .from("users")
    .insert([insertRow])
    .select("id, email, name, role")
    .single();

  if (error) {
    console.error("Registration Insert Error:", error);
    throw error;
  }

  if (newUser) {
    newUser.username = newUser.name;
    if (extra.phone) {
      await studentStore.persistUserPhone(newUser.id, extra.phone);
      newUser.phone = extra.phone;
    }
  }

  return { success: true, user: newUser };
}

router.post("/register", validateUserPayload, async (req, res, next) => {
  try {
    const { email, username, password } = req.safePayload;
    const phone = normalizePhone(req.body?.phone);
    if (!phone) {
      return res
        .status(400)
        .json({
          error: "Please enter a valid phone number (at least 8 digits).",
        });
    }

    const result = await registerUser(email, username, password, "user", req, {
      phone,
    });
    if (result.conflict) {
      const errorMessage =
        result.reason === "username"
          ? "Username already taken"
          : "Email already registered";
      return res.status(409).json({ error: errorMessage });
    }

    const token = await generateToken(result.user);
    res.cookie(COOKIE_NAME, token, authCookieOptions);
    res.status(201).json({
      message: "User registered",
      role: result.user.role,
      phone: result.user.phone || phone,
    });
  } catch (err) {
    next(err);
  }
});

/** Course registration form only — does not fail if email already exists */
router.post(
  "/enroll-course",
  optionalAuthenticateJWT,
  async (req, res, next) => {
    try {
      const email = (req.body?.email || "").trim().toLowerCase();
      const fullName = (req.body?.fullName || req.body?.username || "").trim();
      const phoneRaw = String(req.body?.phone || "").trim();
      const courseId = req.body?.courseId || req.body?.course;

      if (!email) return res.status(400).json({ error: "Email is required" });
      if (!fullName)
        return res.status(400).json({ error: "Full name is required" });
      if (!phoneRaw)
        return res.status(400).json({ error: "Phone is required" });
      if (!courseId)
        return res.status(400).json({ error: "Please select a course" });

      let forceUserId = null;
      if (req.user?.sub) {
        try {
        const sessionUser = await studentStore.resolveUserFromToken(req.user);
          if (sessionUser) forceUserId = sessionUser.id;
        } catch {
          /* continue without session link */
        }
      }

      const result = await studentStore.submitCourseEnrollment({
        email,
        fullName,
        phone: phoneRaw,
        courseId,
        req,
        forceUserId,
      });

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      const token = await generateToken(result.user);
      res.cookie(COOKIE_NAME, token, authCookieOptions);

      if (result.alreadyActive) {
        return res.json({
          success: true,
          alreadyActive: true,
          message: result.message,
          courseId,
          redirect: `/classroom?course=${courseId}`,
        });
      }

      res.status(201).json({
        success: true,
        message:
          result.message ||
          "Registration submitted. You will get access after admin approval.",
        existingAccount: result.existingAccount,
        courseId,
        redirect: `/classroom?course=${courseId}&enrolled=1`,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/login", validateUserPayload, async (req, res, next) => {
  try {
    const { email, password } = req.safePayload;
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { ip, browser, device, userAgent } = getRequestMetadata(req);
    const token = await generateToken(user);

    res.cookie(COOKIE_NAME, token, authCookieOptions);
    const redirect =
      user.role === "admin"
        ? "/admin"
        : user.role === "teacher"
          ? "/courses"
          : "/classroom";
    res.json({
      success: true,
      role: user.role,
      redirect,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const channel = ["sms", "email"].includes(req.body?.channel)
      ? req.body.channel
      : "sms";
    const phone = normalizePhone(req.body?.phone);
    const email = (req.body?.email || "").trim().toLowerCase();
    const isDev = process.env.NODE_ENV !== "production";

    let user = null;
    let contact = "";

    if (channel === "email") {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      user = await studentStore.findUserByEmail(email);
      if (!user) {
        return res
          .status(404)
          .json({ error: "No account found with this email address" });
      }
      contact = email;
    } else {
      if (!phone) {
        return res
          .status(400)
          .json({
            error: "Please enter a valid phone number (at least 8 digits).",
          });
      }
      user = await studentStore.findUserByPhone(phone);
      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "No account found with this phone number. Use the same number from sign up or course registration.",
          });
      }
      contact = phone;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const resetLink = `${baseUrl}/forgot-password?step=code&channel=${channel}&contact=${encodeURIComponent(contact)}`;

    const resetRow = {
      user_id: user.id,
      phone: channel === "email" ? "" : phone,
      email: channel === "email" ? email : null,
      channel,
      code_hash: codeHash,
      expires_at: expiresAt,
    };

    const stored = await passwordResetStore.createReset(resetRow);

    let notify;
    if (channel === "email") {
      notify = await sendResetEmail({ email, code, resetLink });
    } else {
      notify = await sendResetMessage({ phone, channel, code, resetLink });
      // If SMS/WhatsApp failed but user has email, try email as fallback
      if (!notify.sent && user.email) {
        const emailFallback = await sendResetEmail({
          email: user.email,
          code,
          resetLink,
        });
        if (emailFallback.sent) {
          notify = {
            ...emailFallback,
            sent: true,
            provider: `${notify.provider}+email-fallback`,
            fallbackChannel: "email",
          };
        }
      }
    }

    const payload = {
      message: notify.sent
        ? notify.fallbackChannel === "email"
          ? "SMS could not be sent; code was sent to your email instead."
          : "Verification code sent"
        : "Verification code created. Use the code shown below (configure SMS/email in server .env for automatic delivery).",
      channel,
      sent: Boolean(notify.sent),
      provider: notify.provider,
      storage: stored.storage,
      ...(notify.fallbackChannel
        ? { fallbackChannel: notify.fallbackChannel }
        : {}),
    };

    if (!notify.sent) {
      payload.devCode = code;
      payload.deliveryError =
        notify.error || "Messaging not configured on server";
    } else if (isDev) {
      payload.devCode = code;
    }

    res.json(payload);
  } catch (err) {
    console.error("[forgot-password]", err);
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const channel = req.body?.channel || "sms";
    const phone = normalizePhone(req.body?.phone);
    const email = (req.body?.email || req.body?.contact || "")
      .trim()
      .toLowerCase();
    const code = String(req.body?.code || "").trim();
    const newPassword = req.body?.newPassword || req.body?.password;

    if (!code) {
      return res.status(400).json({ error: "Verification code is required" });
    }
    if (
      !newPassword ||
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    let user = null;
    if (channel === "email") {
      if (!email) return res.status(400).json({ error: "Email is required" });
      user = await studentStore.findUserByEmail(email);
    } else {
      if (!phone) return res.status(400).json({ error: "Phone is required" });
      user = await studentStore.findUserByPhone(phone);
    }
    if (!user) return res.status(404).json({ error: "Account not found" });

    const resets = await passwordResetStore.listActiveForUser(user.id);

    let matched = null;
    for (const row of resets || []) {
      if (await bcrypt.compare(code, row.code_hash)) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification code" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await supabase
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", user.id);
    await passwordResetStore.markUsed(matched.id);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, authCookieOptions);
  res.json({ message: "Logged out successfully" });
});

router.post(
  "/register-teacher",
  authenticateJWT,
  requireAdmin,
  validateUserPayload,
  async (req, res, next) => {
    try {
      const { email, username, password } = req.safePayload;
      const result = await registerUser(
        email,
        username,
        password,
        "teacher",
        req,
      );

      if (result.conflict) {
        return res.status(409).json({ error: "User already exists" });
      }

      res.status(201).json({ message: "Teacher registered" });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/login-teacher", validateUserPayload, async (req, res, next) => {
  try {
    const { email, password } = req.safePayload;
    const user = await findUserByEmail(email);

    if (!user || user.role !== "teacher") {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { ip, browser, device, userAgent } = getRequestMetadata(req);
    const token = await generateToken(user);

    res.cookie(COOKIE_NAME, token, authCookieOptions);
    res.json({
      success: true,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  router,
  authenticateJWT,
  optionalAuthenticateJWT,
  requireAdmin,
  generateToken,
};
