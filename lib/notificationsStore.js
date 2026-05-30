const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const supabase = require("../supabaseClient");
const studentStore = require("./studentStore");

const LOCAL_FILE = path.join(process.cwd(), "data", "notifications.json");
const isServerless = Boolean(process.env.VERCEL || process.env.NETLIFY);

function isMissingTableError(error) {
  if (!error) return false;
  const msg = (error.message || error.details || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  );
}

function readLocal() {
  try {
    if (!fs.existsSync(LOCAL_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeLocal(rows) {
  try {
    const dir = path.dirname(LOCAL_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(rows, null, 2));
  } catch (err) {
    console.warn("[notifications] local write:", err.message);
  }
}

async function listCourseStudents(courseId) {
  return studentStore.listEnrollmentsByCourse(courseId);
}

async function insertNotification(row) {
  const { data, error } = await supabase
    .from("student_notifications")
    .insert([row])
    .select("*")
    .single();

  if (!error && data) return data;

  if (isMissingTableError(error)) {
    const rows = readLocal();
    const local = {
      ...row,
      id: row.id || crypto.randomUUID(),
      created_at: row.created_at || new Date().toISOString(),
    };
    rows.unshift(local);
    try {
      writeLocal(rows);
    } catch {
      /* read-only FS on serverless */
    }
    return local;
  }

  throw error;
}

async function sendToStudents({
  senderId,
  courseId,
  title,
  body,
  audience = "all",
  userIds = [],
}) {
  const students = await listCourseStudents(courseId);
  let targets = students;

  if (audience === "active") {
    targets = students.filter((s) => s.status === "active");
  } else if (audience === "pending") {
    targets = students.filter((s) => s.status === "pending");
  } else if (userIds?.length) {
    const set = new Set(userIds.map(String));
    targets = students.filter((s) => set.has(String(s.userId)));
  }

  if (!targets.length) {
    return { sent: 0, error: "No students match this selection" };
  }

  const cid = parseInt(courseId, 10);
  const created = [];

  for (const student of targets) {
    if (!student.userId) continue;
    const note = await insertNotification({
      user_id: student.userId,
      course_id: cid,
      title: String(title).trim(),
      body: String(body).trim(),
      sender_id: senderId || null,
    });
    created.push(note);
  }

  return { sent: created.length, notifications: created };
}

async function listForUser(userId, courseId = null) {
  let query = supabase
    .from("student_notifications")
    .select("id, user_id, course_id, title, body, read_at, created_at, sender_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (courseId) {
    query = query.eq("course_id", parseInt(courseId, 10));
  }

  const { data, error } = await query;

  if (!error) return data || [];

  if (isMissingTableError(error)) {
    let rows = readLocal().filter((n) => String(n.user_id) === String(userId));
    if (courseId) {
      rows = rows.filter((n) => String(n.course_id) === String(courseId));
    }
    return rows.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
  }

  throw error;
}

async function countUnread(userId) {
  const { count, error } = await supabase
    .from("student_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (!error) return count || 0;

  if (isMissingTableError(error)) {
    return readLocal().filter(
      (n) => String(n.user_id) === String(userId) && !n.read_at,
    ).length;
  }

  return 0;
}

async function markRead(notificationId, userId) {
  const { data, error } = await supabase
    .from("student_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (!error && data) return data;

  if (isMissingTableError(error)) {
    const rows = readLocal();
    const idx = rows.findIndex(
      (n) =>
        String(n.id) === String(notificationId) &&
        String(n.user_id) === String(userId),
    );
    if (idx >= 0) {
      rows[idx].read_at = new Date().toISOString();
      writeLocal(rows);
      return rows[idx];
    }
    return null;
  }

  throw error;
}

async function markAllRead(userId, courseId = null) {
  let query = supabase
    .from("student_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (courseId) {
    query = query.eq("course_id", parseInt(courseId, 10));
  }

  const { error } = await query;
  if (!error) return { ok: true };

  if (isMissingTableError(error)) {
    const rows = readLocal();
    const now = new Date().toISOString();
    rows.forEach((n) => {
      if (String(n.user_id) !== String(userId)) return;
      if (courseId && String(n.course_id) !== String(courseId)) return;
      if (!n.read_at) n.read_at = now;
    });
    writeLocal(rows);
    return { ok: true };
  }

  throw error;
}

module.exports = {
  listCourseStudents,
  sendToStudents,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
};
