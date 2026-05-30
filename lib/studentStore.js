const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const supabase = require("../supabaseClient");
const {
  buildCourseSyllabus,
  mergeProgressIntoSyllabus,
} = require("./courseContent");
const {
  parsePhone,
  phoneDigitsMatch,
  writeLocalPhone,
  getLocalPhone,
} = require("./phone");

const LOCAL_ENROLLMENTS = path.join(process.cwd(), "data", "enrollments.json");
const isServerless = Boolean(process.env.VERCEL || process.env.NETLIFY);

const DEFAULT_COURSE_META = {
  "computer-basics": {
    m1: {
      en: "Module 1: Getting Started",
      ar: "الوحدة 1: البداية",
      time: "45 Min",
    },
    m2: {
      en: "Module 2: The Internet",
      ar: "الوحدة 2: الإنترنت",
      time: "1 Hr",
    },
    m3: { en: "Module 3: Security", ar: "الوحدة 3: الأمان", time: "30 Min" },
  },
  icdl: {
    m1: { en: "Module 1: Word", ar: "الوحدة 1: Word", time: "2 Hrs" },
    m2: { en: "Module 2: Excel", ar: "الوحدة 2: Excel", time: "3 Hrs" },
    m3: {
      en: "Module 3: Presentations",
      ar: "الوحدة 3: عروض",
      time: "1.5 Hrs",
    },
  },
  "graphic-design": {
    m1: { en: "Module 1: Photoshop", ar: "الوحدة 1: فوتوشوب", time: "4 Hrs" },
    m2: {
      en: "Module 2: Illustrator",
      ar: "الوحدة 2: إليستريتور",
      time: "5 Hrs",
    },
    m3: { en: "Module 3: Branding", ar: "الوحدة 3: هوية", time: "2 Hrs" },
  },
  german: {
    m1: { en: "Module 1: Grammar", ar: "الوحدة 1: قواعد", time: "3 Hrs" },
    m2: { en: "Module 2: Conversation", ar: "الوحدة 2: محادثة", time: "6 Hrs" },
    m3: { en: "Module 3: Writing", ar: "الوحدة 3: كتابة", time: "4 Hrs" },
  },
};

function isMissingTableError(error) {
  if (!error) return false;
  const msg = (error.message || error.details || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  );
}

function isMissingColumnError(error) {
  if (!error) return false;
  const msg = (error.message || error.details || "").toLowerCase();
  return (
    msg.includes("column") ||
    msg.includes("does not exist") ||
    error.code === "42703" ||
    error.code === "PGRST204"
  );
}

function attachPhoneToUser(user, phoneFallback) {
  if (!user) return user;
  user.username = user.name;
  user.phone = user.phone || phoneFallback || getLocalPhone(user.id) || null;
  return user;
}

async function selectUserById(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return attachPhoneToUser(data);
}

function readLocalEnrollments() {
  try {
    if (!fs.existsSync(LOCAL_ENROLLMENTS)) return [];
    return JSON.parse(fs.readFileSync(LOCAL_ENROLLMENTS, "utf8"));
  } catch {
    return [];
  }
}

function enrollmentPairKey(row) {
  if (!row?.user_id || row.course_id == null) return null;
  return `${row.user_id}:${row.course_id}`;
}

function pickPreferredEnrollment(a, b) {
  const sa = normalizeEnrollmentStatus(a.status);
  const sb = normalizeEnrollmentStatus(b.status);
  if (sa === "active" && sb !== "active") return a;
  if (sb === "active" && sa !== "active") return b;
  const ta = new Date(a.enrolled_at || 0).getTime();
  const tb = new Date(b.enrolled_at || 0).getTime();
  return tb >= ta ? b : a;
}

function mergeEnrollmentRows(remoteRows, localRows) {
  const map = new Map();
  for (const row of [...(remoteRows || []), ...(localRows || [])]) {
    const key = enrollmentPairKey(row);
    if (!key) continue;
    const prev = map.get(key);
    map.set(key, prev ? pickPreferredEnrollment(prev, row) : row);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.enrolled_at || 0) - new Date(a.enrolled_at || 0),
  );
}

async function queryRemoteEnrollments(filters = {}) {
  let q = supabase
    .from("enrollments")
    .select(
      "id, user_id, course_id, status, progress, enrolled_at, phone, applicant_name, applicant_email, form_data",
    );

  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.courseId != null) {
    q = q.eq("course_id", parseInt(filters.courseId, 10));
  }
  if (filters.status) q = q.eq("status", filters.status);

  const { data, error } = await q.order("enrolled_at", { ascending: false });
  if (!error) return data || [];
  if (isMissingTableError(error)) return null;
  throw error;
}

function filterLocalEnrollments(filters = {}) {
  let rows = readLocalEnrollments();
  if (filters.userId) rows = rows.filter((e) => e.user_id === filters.userId);
  if (filters.courseId != null) {
    const cid = parseInt(filters.courseId, 10);
    rows = rows.filter((e) => e.course_id === cid);
  }
  if (filters.status) {
    rows = rows.filter(
      (e) => normalizeEnrollmentStatus(e.status) === filters.status,
    );
  }
  return rows;
}

/** Single source: Supabase enrollments + local JSON (deduped). */
async function listMergedEnrollments(filters = {}) {
  const remote = await queryRemoteEnrollments(filters);
  const local = isServerless ? [] : filterLocalEnrollments(filters);
  if (remote === null) return local;
  return mergeEnrollmentRows(remote, local);
}

async function upsertEnrollmentToSupabase(row) {
  if (!row?.user_id || row.course_id == null) return null;

  const payload = {
    user_id: row.user_id,
    course_id: parseInt(row.course_id, 10),
    status: normalizeEnrollmentStatus(row.status) || "pending",
    progress: row.progress || {
      completedLessons: [],
      quizCompleted: false,
      quizScore: 0,
    },
    enrolled_at: row.enrolled_at || new Date().toISOString(),
    phone: row.phone || null,
    applicant_name: row.applicant_name || null,
    applicant_email: row.applicant_email || null,
    form_data: row.form_data || {},
  };

  const { data: existing, error: findErr } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", payload.user_id)
    .eq("course_id", payload.course_id)
    .maybeSingle();

  if (findErr && isMissingTableError(findErr)) return null;
  if (findErr) throw findErr;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("enrollments")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error && isMissingColumnError(error)) {
      const slim = { ...payload };
      delete slim.applicant_name;
      delete slim.applicant_email;
      delete slim.form_data;
      const retry = await supabase
        .from("enrollments")
        .update(slim)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("enrollments")
    .insert([payload])
    .select("*")
    .single();

  if (error && isMissingColumnError(error)) {
    const slim = { ...payload };
    delete slim.applicant_name;
    delete slim.applicant_email;
    delete slim.form_data;
    const retry = await supabase.from("enrollments").insert([slim]).select("*").single();
    if (retry.error) throw retry.error;
    return retry.data;
  }
  if (error && isMissingTableError(error)) return null;
  if (error) throw error;
  return data;
}

function writeLocalEnrollmentRow(row) {
  const rows = readLocalEnrollments().filter(
    (e) =>
      !(
        e.user_id === row.user_id &&
        e.course_id === parseInt(row.course_id, 10)
      ),
  );
  const saved = {
    ...row,
    id: row.id || crypto.randomUUID(),
    course_id: parseInt(row.course_id, 10),
  };
  rows.unshift(saved);
  writeLocalEnrollments(rows);
  return saved;
}

async function persistEnrollment(row) {
  let saved = row;
  if (!isServerless) {
    saved = writeLocalEnrollmentRow(row);
  }
  try {
    const remote = await upsertEnrollmentToSupabase(saved);
    if (remote?.id) {
      saved = { ...saved, ...remote, id: remote.id };
      if (!isServerless) writeLocalEnrollmentRow(saved);
    }
  } catch (err) {
    console.warn("[persistEnrollment] remote sync:", err.message);
  }
  return saved;
}

function writeLocalEnrollments(rows) {
  try {
    const dir = path.dirname(LOCAL_ENROLLMENTS);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_ENROLLMENTS, JSON.stringify(rows, null, 2));
  } catch (err) {
    console.warn("Failed to write local enrollments (expected on read-only serverless like Vercel):", err.message);
  }
}

async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, role, password_hash")
    .eq("email", email.trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return attachPhoneToUser(data?.[0] || null);
}

async function findUserByUsername(username) {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("name", username)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return attachPhoneToUser(data?.[0] || null);
}

function normalizeEnrollmentStatus(status) {
  return String(status || "").trim().toLowerCase();
}

async function persistUserPhone(userId, phone) {
  const parsed = parsePhone(phone);
  if (!parsed || !userId) return false;

  const { error } = await supabase
    .from("users")
    .update({ phone: parsed.display })
    .eq("id", userId);

  if (!error) return true;
  if (isMissingColumnError(error)) {
    writeLocalPhone(userId, parsed.display);
    return true;
  }
  return false;
}

async function findUserByPhone(phoneInput) {
  const parsed = parsePhone(phoneInput);
  if (!parsed) return null;

  let users = null;
  let error = null;
  ({ data: users, error } = await supabase
    .from("users")
    .select("id, email, name, role, phone")
    .not("phone", "is", null)
    .limit(100));

  if (error && isMissingColumnError(error)) {
    ({ data: users, error } = await supabase
      .from("users")
      .select("id, email, name, role")
      .limit(100));
  }
  if (error && !isMissingColumnError(error)) throw error;

  let match = (users || []).find((u) =>
    phoneDigitsMatch(u.phone, parsed.digits),
  );
  if (!match) {
    for (const u of users || []) {
      const local = getLocalPhone(u.id);
      if (phoneDigitsMatch(local, parsed.digits)) {
        match = { ...u, phone: local };
        break;
      }
    }
  }
  if (match) {
    match.username = match.name;
    return match;
  }

  const { data: enrollRows, error: enrErr } = await supabase
    .from("enrollments")
    .select("user_id, phone, users(id, email, name, role)")
    .not("phone", "is", null)
    .order("enrolled_at", { ascending: false })
    .limit(100);

  if (enrErr && !isMissingTableError(enrErr)) throw enrErr;
  if (!enrErr && enrollRows?.length) {
    const row = enrollRows.find((e) =>
      phoneDigitsMatch(e.phone, parsed.digits),
    );
    if (row?.users) {
      const u = row.users;
      u.username = u.name;
      if (!u.phone) u.phone = row.phone;
      return u;
    }
  }

  return null;
}

async function getApprovedCourse(courseId) {
  const id = parseInt(courseId, 10);
  if (Number.isNaN(id)) return null;
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw error;
  if (data) data.name = data.title || data.name;
  return data;
}

/** Course record for enrolled students (any status). */
async function getCourseById(courseId) {
  const id = parseInt(courseId, 10);
  if (Number.isNaN(id)) return null;
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (data) data.name = data.title || data.name;
  return data;
}

async function resolveCourseForEnrollment(enrollment) {
  if (enrollment?.courses) return enrollment.courses;
  const approved = await getApprovedCourse(enrollment.course_id);
  if (approved) return approved;
  return getCourseById(enrollment.course_id);
}

/** Resolve DB user from JWT (supports id, email, or legacy name in sub). */
async function resolveUserFromToken(payload) {
  if (!payload?.sub) return null;
  const sub = String(payload.sub).trim();

  try {
    const byId = await selectUserById(sub);
    if (byId) return byId;
  } catch (err) {
    console.warn("[resolveUserFromToken] by id:", err.message);
  }

  if (payload.email) {
    const byEmail = await findUserByEmail(String(payload.email).trim().toLowerCase());
    if (byEmail) return byEmail;
  }

  if (sub.includes("@")) {
    const byEmail = await findUserByEmail(sub.toLowerCase());
    if (byEmail) return byEmail;
  }

  return findUserByUsername(sub);
}

function mapInternalMeta(course) {
  const name = (course.title || course.name || "").trim().toLowerCase();
  const map = {
    "اساسيات كمبيوتر": "computer-basics",
    "أساسيات كمبيوتر": "computer-basics",
    icdl: "icdl",
    "جرافي ديزاين": "graphic-design",
    "جرافيك ديزاين": "graphic-design",
    "لغة المانية": "german",
    "لغة ألمانية": "german",
  };
  return DEFAULT_COURSE_META[map[course.title?.trim()] || map[name]] || null;
}

/** Legacy optional column — enrollments table is the source of truth. */
async function syncUserEnrolledCourses(userId, courseId) {
  const cid = parseInt(courseId, 10);
  if (Number.isNaN(cid)) return;

  const { data: user, error: readErr } = await supabase
    .from("users")
    .select("enrolled_courses")
    .eq("id", userId)
    .maybeSingle();

  if (readErr) {
    if (isMissingColumnError(readErr)) return;
    console.warn("[syncUserEnrolledCourses] read:", readErr.message);
    return;
  }

  const ids = new Set(
    Array.isArray(user?.enrolled_courses) ? user.enrolled_courses : [],
  );
  ids.add(cid);
  const { error: updateErr } = await supabase
    .from("users")
    .update({ enrolled_courses: [...ids] })
    .eq("id", userId);

  if (updateErr && !isMissingColumnError(updateErr)) {
    console.warn("[syncUserEnrolledCourses] update:", updateErr.message);
  }
}

function buildEnrollmentRecord(userId, courseId, status, meta = {}) {
  const formData = {
    email: meta.email || null,
    fullName: meta.applicantName || null,
    phone: meta.phone || null,
    courseId: parseInt(courseId, 10),
    submittedAt: new Date().toISOString(),
    ...(meta.formData || {}),
  };
  return {
    user_id: userId,
    course_id: parseInt(courseId, 10),
    status,
    progress: { completedLessons: [], quizCompleted: false, quizScore: 0 },
    enrolled_at: new Date().toISOString(),
    phone: meta.phone || null,
    applicant_name: meta.applicantName || null,
    applicant_email: meta.email || null,
    form_data: formData,
  };
}

async function enrollUser(userId, courseId, status = "active", meta = {}) {
  const course = await getApprovedCourse(courseId);
  if (!course) return { error: "Course not found" };

  const payload = buildEnrollmentRecord(userId, courseId, status, meta);

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", payload.course_id)
    .maybeSingle();

  let data;
  let error;

  const fullUpdate = {
    status,
    phone: payload.phone,
    applicant_name: payload.applicant_name,
    applicant_email: payload.applicant_email,
    form_data: payload.form_data,
    enrolled_at: payload.enrolled_at,
  };

  if (existing?.id) {
    if (existing.status === "active" && status === "pending") {
      return {
        enrollment: { ...existing, courses: course },
        alreadyActive: true,
      };
    }
    ({ data, error } = await supabase
      .from("enrollments")
      .update(fullUpdate)
      .eq("id", existing.id)
      .select("*")
      .single());
  } else {
    ({ data, error } = await supabase
      .from("enrollments")
      .insert([payload])
      .select("*")
      .single());
  }

  if (!error && data) {
    if (status === "active") await syncUserEnrolledCourses(userId, courseId);
    data.courses = course;
    if (!isServerless) await persistEnrollment(data);
    return { enrollment: data };
  }

  if (isMissingColumnError(error)) {
    const slim = { ...payload };
    delete slim.applicant_name;
    delete slim.applicant_email;
    delete slim.form_data;
    if (existing?.id) {
      ({ data, error } = await supabase
        .from("enrollments")
        .update({
          status,
          phone: payload.phone,
          enrolled_at: payload.enrolled_at,
        })
        .eq("id", existing.id)
        .select("*")
        .single());
    } else {
      ({ data, error } = await supabase
        .from("enrollments")
        .insert([slim])
        .select("*")
        .single());
    }
    if (!error && data) {
      if (status === "active") await syncUserEnrolledCourses(userId, courseId);
      data.courses = course;
      data._form_data = payload.form_data;
      if (!isServerless) await persistEnrollment({ ...data, form_data: payload.form_data });
      return { enrollment: data };
    }
  }

  if (isMissingTableError(error) && !isServerless) {
    const row = await persistEnrollment({
      ...payload,
      id: crypto.randomUUID(),
    });
    row.courses = course;
    if (status === "active") await syncUserEnrolledCourses(userId, courseId);
    return { enrollment: row };
  }

  if (isMissingTableError(error)) {
    if (status === "active") await syncUserEnrolledCourses(userId, courseId);
    return { enrollment: { ...payload, courses: course } };
  }

  throw error;
}

/**
 * Course registration form — NOT account signup.
 * Existing email → pending enrollment only (no error).
 */
async function submitCourseEnrollment({
  email,
  fullName,
  phone,
  courseId,
  req,
  forceUserId,
}) {
  const course = await getApprovedCourse(courseId);
  if (!course) return { error: "Course not found or not available" };

  const phoneStr = String(phone || "").trim();
  const parsedPhone = parsePhone(phoneStr);
  const phoneDisplay = parsedPhone?.display || phoneStr;
  const phoneDigits = phoneDisplay.replace(/\D/g, "");
  if (!phoneDigits || phoneDigits.length < 8) {
    return { error: "Phone number is required (at least 8 digits)." };
  }

  let normalizedEmail = email.trim().toLowerCase();
  let user = null;
  let createdAccount = false;

  if (forceUserId) {
    user = await selectUserById(forceUserId);
    if (!user) return { error: "Session expired. Please sign in again." };
    normalizedEmail = user.email;
    if (fullName) {
      await supabase.from("users").update({ name: fullName }).eq("id", user.id);
      user.name = fullName;
    }
    await persistUserPhone(user.id, phoneDisplay);
    user.phone = phoneDisplay;
  } else {
    user = await findUserByEmail(normalizedEmail);
  }

  if (!user) {
    const password = crypto.randomBytes(10).toString("hex");
    const passwordHash = await bcrypt.hash(password, 12);
    const insertRow = {
      email: normalizedEmail,
      name: fullName,
      role: "user",
      password_hash: passwordHash,
      ...(req ? getRequestMetadata(req) : {}),
    };

    const { data: newUser, error } = await supabase
      .from("users")
      .insert([insertRow])
      .select("id, email, name, role")
      .single();

    if (error) throw error;
    await persistUserPhone(newUser.id, phoneDisplay);
    user = attachPhoneToUser(newUser, phoneDisplay);
    createdAccount = true;
  } else if (!forceUserId) {
    if (fullName) {
      await supabase.from("users").update({ name: fullName }).eq("id", user.id);
      user.name = fullName;
    }
    await persistUserPhone(user.id, phoneDisplay);
    user.phone = phoneDisplay;
  }

  const enrollResult = await enrollUser(user.id, courseId, "pending", {
    phone: phoneDisplay,
    applicantName: fullName || user.name,
    email: normalizedEmail,
    formData: { source: "course_registration_form", phone: phoneDisplay },
  });

  if (enrollResult.error) return enrollResult;
  if (enrollResult.alreadyActive) {
    return {
      success: true,
      alreadyActive: true,
      user,
      enrollment: enrollResult.enrollment,
      courseId,
      message: "You already have access to this course",
    };
  }

  return {
    success: true,
    user,
    enrollment: enrollResult.enrollment,
    courseId,
    createdAccount,
    existingAccount: !createdAccount,
    message: "Enrollment request submitted",
  };
}

function getRequestMetadata(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : req.ip || "";
  const userAgent = req.get("User-Agent") || "";
  return { ip, userAgent };
}

async function listEnrollmentsForUser(userId) {
  const merged = await listMergedEnrollments({ userId });
  const rows = merged.filter((e) => {
    const s = normalizeEnrollmentStatus(e.status);
    return s === "active" || s === "pending";
  });

  return Promise.all(
    rows.map(async (row) => {
      row.courses = await resolveCourseForEnrollment(row);
      row.status = normalizeEnrollmentStatus(row.status);
      return row;
    }),
  );
}

async function updateEnrollmentProgress(userId, courseId, progress) {
  const { data: existing, error: fetchErr } = await supabase
    .from("enrollments")
    .select("id, progress")
    .eq("user_id", userId)
    .eq("course_id", parseInt(courseId, 10))
    .maybeSingle();

  if (!fetchErr && existing) {
    const merged = { ...(existing.progress || {}), ...progress };
    const { data, error } = await supabase
      .from("enrollments")
      .update({ progress: merged })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  if (isMissingTableError(fetchErr) && !isServerless) {
    const rows = readLocalEnrollments();
    const idx = rows.findIndex(
      (e) => e.user_id === userId && e.course_id === parseInt(courseId, 10),
    );
    if (idx >= 0) {
      rows[idx].progress = { ...(rows[idx].progress || {}), ...progress };
      writeLocalEnrollments(rows);
      return rows[idx];
    }
  }

  throw fetchErr || new Error("Enrollment not found");
}

async function activateEnrollmentByUserAndCourse(userId, courseId) {
  const cid = parseInt(courseId, 10);
  if (!userId || Number.isNaN(cid)) {
    return { error: "userId and courseId are required" };
  }

  const { data: rows, error: findErr } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", cid)
    .order("enrolled_at", { ascending: false })
    .limit(1);

  if (findErr) throw findErr;
  const existing = rows?.[0];
  if (!existing) return { error: "Enrollment not found for this user and course" };

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "active" })
    .eq("id", existing.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return { error: "Failed to activate enrollment" };

  await syncUserEnrolledCourses(data.user_id, data.course_id);
  data.courses = await resolveCourseForEnrollment(data);
  data.status = "active";
  if (!isServerless) await persistEnrollment(data);
  return { enrollment: data };
}

async function resolveEnrollmentOwnerIds(row, opts = {}) {
  let userId = opts.userId || row?.user_id || null;
  let courseId = opts.courseId || row?.course_id || null;

  if (!userId && row?.applicant_email) {
    const u = await findUserByEmail(String(row.applicant_email).trim().toLowerCase());
    if (u) userId = u.id;
  }

  return { userId, courseId };
}

async function approveEnrollment(enrollmentId, opts = {}) {
  const id = String(enrollmentId || "").trim();
  let userId = opts.userId;
  let courseId = opts.courseId;

  let row = null;
  if (id) {
    const { data: found, error: findErr } = await supabase
      .from("enrollments")
      .select("id, user_id, course_id, status, applicant_email")
      .eq("id", id)
      .maybeSingle();
    if (findErr && !isMissingTableError(findErr)) throw findErr;
    row = found;
    ({ userId, courseId } = await resolveEnrollmentOwnerIds(row, {
      userId,
      courseId,
    }));
  }

  if (id) {
    const { data, error } = await supabase
      .from("enrollments")
      .update({ status: "active" })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      await syncUserEnrolledCourses(data.user_id, data.course_id);
      data.courses = await resolveCourseForEnrollment(data);
      data.status = "active";
      if (!isServerless) await persistEnrollment(data);
      return { enrollment: data };
    }

    if (!error && !data && userId && courseId) {
      const byPair = await activateEnrollmentByUserAndCourse(userId, courseId);
      if (byPair.enrollment) return byPair;
      if (byPair.error) throw new Error(byPair.error);
    }

    if (error && isMissingTableError(error) && !isServerless) {
      const rows = readLocalEnrollments();
      const idx = rows.findIndex((e) => String(e.id) === id);
      if (idx >= 0) {
        rows[idx].status = "active";
        const saved = await persistEnrollment(rows[idx]);
        await syncUserEnrolledCourses(saved.user_id, saved.course_id);
        saved.courses = await getApprovedCourse(saved.course_id);
        saved.status = "active";
        return { enrollment: saved };
      }
    }

    if (error) throw error;
  }

  if (userId && courseId) {
    const byPair = await activateEnrollmentByUserAndCourse(userId, courseId);
    if (byPair.enrollment) return byPair;
    if (byPair.error) throw new Error(byPair.error);
  }

  throw new Error("Enrollment not found");
}

function mapLeadRow(row, user, course) {
  const form = row.form_data || row._form_data || {};
  return {
    id: row.id,
    userId: row.user_id || user?.id,
    name: row.applicant_name || user?.name || form.fullName || "—",
    email: row.applicant_email || user?.email || form.email || "—",
    phone:
      row.phone ||
      user?.phone ||
      form.phone ||
      getLocalPhone(user?.id || row.user_id) ||
      "—",
    courseId: row.course_id,
    courseTitle:
      course?.title ||
      course?.name ||
      form.courseTitle ||
      `Course #${row.course_id}`,
    enrolledAt: row.enrolled_at,
    formData: form,
    status: row.status,
  };
}

async function listPendingEnrollmentLeads() {
  const rows = await listMergedEnrollments({ status: "pending" });
  const leads = [];
  for (const row of rows) {
    let user = null;
    if (row.user_id) {
      const { data } = await supabase
        .from("users")
        .select("id, email, name, phone")
        .eq("id", row.user_id)
        .maybeSingle();
      user = attachPhoneToUser(data);
    }
    let course = await getApprovedCourse(row.course_id);
    if (course) course = { ...course, name: course.title || course.name };
    leads.push(mapLeadRow(row, user, course));
  }
  return leads;
}

async function listEnrollmentsByCourse(courseId) {
  const rows = await listMergedEnrollments({ courseId });
  const out = [];
  for (const row of rows) {
    let user = null;
    if (row.user_id) {
      user = await selectUserById(row.user_id);
    }
    const form = row.form_data || {};
    out.push({
      enrollmentId: row.id,
      userId: row.user_id,
      courseId: row.course_id,
      name: row.applicant_name || user?.name || form.fullName || "—",
      email: row.applicant_email || user?.email || form.email || "—",
      phone:
        row.phone ||
        user?.phone ||
        getLocalPhone(row.user_id) ||
        form.phone ||
        "—",
      status: normalizeEnrollmentStatus(row.status),
      enrolledAt: row.enrolled_at,
    });
  }
  return out;
}

async function listApprovedEnrollmentsForAdmin() {
  const rows = await listMergedEnrollments();
  const activeOrPending = rows.filter((e) => {
    const s = normalizeEnrollmentStatus(e.status);
    return s === "active" || s === "pending";
  });

  const leads = [];
  for (const row of activeOrPending) {
    let user = null;
    if (row.user_id) user = await selectUserById(row.user_id);
    let course = await getApprovedCourse(row.course_id);
    if (course) course = { ...course, name: course.title || course.name };
    const mapped = mapLeadRow(row, user, course);
    leads.push(mapped);
  }
  return leads;
}

async function getClassroomPayload(userId, courseId) {
  const enrollments = await listEnrollmentsForUser(userId);
  const match = enrollments.find(
    (e) => String(e.course_id) === String(courseId),
  );

  if (match && normalizeEnrollmentStatus(match.status) === "pending") {
    const course = match.courses || (await getApprovedCourse(courseId));
    return {
      enrolled: false,
      pending: true,
      course: course
        ? {
            id: course.id,
            title: course.title || course.name,
            description: course.description,
          }
        : null,
    };
  }

  const enrollment = enrollments.find(
    (e) =>
      String(e.course_id) === String(courseId) &&
      normalizeEnrollmentStatus(e.status) === "active",
  );
  if (!enrollment) return { enrolled: false, pending: false };

  const course = await resolveCourseForEnrollment(enrollment);
  if (!course) return { enrolled: false, pending: false };

  const meta = mapInternalMeta(course);
  const syllabus = buildCourseSyllabus(course, meta);
  const merged = mergeProgressIntoSyllabus(syllabus, enrollment.progress || {});

  return {
    enrolled: true,
    enrollment,
    course: {
      id: course.id,
      title: course.title || course.name,
      description: course.description,
      link: course.link,
    },
    progress: merged.percent,
    progressDetail: merged,
    syllabus: merged.syllabus,
    mainEmbed: syllabus.mainEmbed,
    quiz: syllabus.quiz,
  };
}

async function getDashboardPayload(userId) {
  const enrollments = await listEnrollmentsForUser(userId);
  const active = enrollments.filter(
    (e) => normalizeEnrollmentStatus(e.status) === "active",
  );
  const pending = enrollments.filter(
    (e) => normalizeEnrollmentStatus(e.status) === "pending",
  );
  const items = [];

  for (const en of active) {
    const course = await resolveCourseForEnrollment(en);
    let progress = 0;
    if (course) {
      try {
        const meta = mapInternalMeta(course);
        const syllabus = buildCourseSyllabus(course, meta);
        ({ percent: progress } = mergeProgressIntoSyllabus(
          syllabus,
          en.progress || {},
        ));
      } catch (courseErr) {
        console.warn(
          "[getDashboardPayload] progress for course",
          en.course_id,
          courseErr.message,
        );
      }
    }
    items.push({
      courseId: course?.id || en.course_id,
      title: course?.title || course?.name || `Course #${en.course_id}`,
      description: course?.description || "",
      progress,
      status: en.status,
      enrolledAt: en.enrolled_at,
    });
  }

  const { data: suggested } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(6);

  const enrolledIds = new Set(items.map((i) => String(i.courseId)));
  const suggestions = (suggested || [])
    .map((c) => ({ ...c, name: c.title || c.name }))
    .filter((c) => !enrolledIds.has(String(c.id)));

  return {
    enrollments: items,
    pending: pending.map((en) => ({
      courseId: en.course_id,
      title: en.courses?.title || en.courses?.name || `Course #${en.course_id}`,
    })),
    suggestions,
    hasEnrollments: items.length > 0,
    hasPending: pending.length > 0,
  };
}
async function rejectEnrollment(enrollmentId) {
  const id = String(enrollmentId || "").trim();
  if (!id) throw new Error("Invalid enrollment ID");

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (!error && data) {
    return { enrollment: data };
  }

  if (isMissingTableError(error) && !isServerless) {
    const rows = readLocalEnrollments();
    const idx = rows.findIndex((e) => e.id === enrollmentId);
    if (idx >= 0) {
      rows[idx].status = "rejected";
      writeLocalEnrollments(rows);
      return { enrollment: rows[idx] };
    }
  }

  throw error || new Error("Enrollment not found");
}

module.exports = {
  findUserByEmail,
  findUserByUsername,
  findUserByPhone,
  resolveUserFromToken,
  persistUserPhone,
  parsePhone,
  submitCourseEnrollment,
  listEnrollmentsForUser,
  listMergedEnrollments,
  listEnrollmentsByCourse,
  listApprovedEnrollmentsForAdmin,
  persistEnrollment,
  upsertEnrollmentToSupabase,
  enrollUser,
  approveEnrollment,
  activateEnrollmentByUserAndCourse,
  rejectEnrollment,
  listPendingEnrollmentLeads,
  updateEnrollmentProgress,
  getClassroomPayload,
  getDashboardPayload,
  getApprovedCourse,
  getCourseById,
  mapInternalMeta,
};
