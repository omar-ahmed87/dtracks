const express = require("express");
const { authenticateJWT } = require("./auth");
const studentStore = require("../lib/studentStore");
const notificationsStore = require("../lib/notificationsStore");
const { mergeProgressIntoSyllabus, buildCourseSyllabus } = require("../lib/courseContent");
const supabase = require("../supabaseClient");

const router = express.Router();

async function resolveUser(req) {
  return studentStore.resolveUserFromToken(req.user);
}

router.get("/me", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name || user.username,
        role: user.role,
        phone: user.phone || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/dashboard", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    const payload = await studentStore.getDashboardPayload(user.id);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get("/enrollments", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    const rows = await studentStore.listEnrollmentsForUser(user.id);
    res.json({ enrollments: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/enroll", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });

    const courseId = req.body?.courseId || req.body?.course_id;
    if (!courseId) return res.status(400).json({ error: "courseId is required" });

    const result = await studentStore.enrollUser(user.id, courseId, "pending");
    if (result.error) return res.status(404).json({ error: result.error });
    res.status(201).json({ message: "Enrolled successfully", enrollment: result.enrollment });
  } catch (err) {
    next(err);
  }
});

router.get("/classroom/:courseId", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    const payload = await studentStore.getClassroomPayload(user.id, req.params.courseId);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post("/classroom/:courseId/progress", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { lessonId, quizCompleted, quizScore } = req.body || {};
    const enrollments = await studentStore.listEnrollmentsForUser(user.id);
    const enrollment = enrollments.find(
      (e) => String(e.course_id) === String(req.params.courseId) && e.status === "active",
    );
    if (!enrollment) return res.status(403).json({ error: "Not enrolled in this course" });

    const progress = { ...(enrollment.progress || {}) };
    if (lessonId) {
      const set = new Set(progress.completedLessons || []);
      set.add(lessonId);
      progress.completedLessons = [...set];
    }
    if (quizCompleted) {
      progress.quizCompleted = true;
      progress.quizScore = quizScore ?? progress.quizScore ?? 0;
    }

    const updated = await studentStore.updateEnrollmentProgress(
      user.id,
      req.params.courseId,
      progress,
    );

    const course = enrollment.courses || (await studentStore.getApprovedCourse(req.params.courseId));
    const meta = studentStore.mapInternalMeta(course);
    const syllabus = buildCourseSyllabus(course, meta);
    const merged = mergeProgressIntoSyllabus(syllabus, updated.progress || progress);

    res.json({ progress: merged.percent, progressDetail: merged });
  } catch (err) {
    next(err);
  }
});

async function enrichNotifications(notifications) {
  const courseIds = [
    ...new Set(
      (notifications || [])
        .map((n) => n.course_id)
        .filter((id) => id != null),
    ),
  ];
  const titles = {};
  if (courseIds.length) {
    const { data } = await supabase
      .from("courses")
      .select("id, title, name")
      .in("id", courseIds);
    (data || []).forEach((c) => {
      titles[c.id] = c.title || c.name || `Course #${c.id}`;
    });
  }
  return (notifications || []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    courseId: n.course_id,
    courseTitle: titles[n.course_id] || null,
    readAt: n.read_at,
    createdAt: n.created_at,
    unread: !n.read_at,
  }));
}

router.get("/notifications", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    const courseId = req.query.courseId || null;
    const rows = await notificationsStore.listForUser(user.id, courseId);
    const notifications = await enrichNotifications(rows);
    const unreadCount = notifications.filter((n) => n.unread).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

router.get("/notifications/unread-count", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    const count = await notificationsStore.countUnread(user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.patch("/notifications/:id/read", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    const updated = await notificationsStore.markRead(req.params.id, user.id);
    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json({ notification: updated });
  } catch (err) {
    next(err);
  }
});

router.post("/notifications/read-all", authenticateJWT, async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });
    const courseId = req.body?.courseId || null;
    await notificationsStore.markAllRead(user.id, courseId);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

router.get("/suggested-courses", authenticateJWT, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) return next(error);
    res.json({
      courses: (data || []).map((c) => ({ ...c, name: c.title || c.name })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { router };
