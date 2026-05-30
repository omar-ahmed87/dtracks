const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { authenticateJWT } = require('./auth');
const supabase = require('../supabaseClient');
const studentStore = require('../lib/studentStore');
const notificationsStore = require('../lib/notificationsStore');
const { getLocalPhone } = require('../lib/phone');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required' });
  }
  next();
}

async function getUserStats() {
  const { data, error } = await supabase.from('users').select('role');
  if (error) {
    throw error;
  }

  const stats = data.reduce(
    (acc, user) => {
      if (user.role === 'admin') {
        acc.admins += 1;
      } else if (user.role === 'user') {
        acc.students += 1;
      }
      acc.totalUsers += 1;
      return acc;
    },
    { totalUsers: 0, admins: 0, students: 0 }
  );

  return stats;
}

async function getCourseStats() {
  const [total, published] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
  ]);

  if (total.error) {
    throw total.error;
  }
  if (published.error) {
    throw published.error;
  }

  const totalCourses = total.count || 0;
  const publishedCourses = published.count || 0;
  const unpublishedCourses = totalCourses - publishedCourses;

  return { totalCourses, publishedCourses, unpublishedCourses };
}

function getId(req) {
  const id = req.params.id;
  if (!id) return null;
  // Support both numeric IDs (courses) and UUID strings (users)
  return /^\d+$/.test(id) ? parseInt(id, 10) : id;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

function validateUserUpdate(req, res, next) {
  const { email, username, role } = req.body || {};
  const updates = {};

  if (email !== undefined) {
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    updates.email = email.trim().toLowerCase();
  }

  if (username !== undefined) {
    if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
      return res.status(400).json({ error: 'Invalid username (3-30 chars)' });
    }
    updates.name = username.trim();
  }

  if (role !== undefined) {
    if (!['user', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    updates.role = role;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  req.updateUserPayload = updates;
  next();
}

function validateCourseUpdate(req, res, next) {
  const { name, description, link, status } = req.body || {};
  const updates = {};

  if (name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Invalid course name (3-100 chars)' });
    }
    updates.title = name.trim();
  }

  if (description !== undefined) {
    if (description && typeof description === 'string') {
      updates.description = description.trim();
    }
  }

  if (link !== undefined) {
    if (link && typeof link === 'string') {
      updates.link = link.trim();
    }
  }

  if (status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid course status' });
    }
    updates.status = status;
    if (status === 'approved') {
      updates.approved_at = new Date().toISOString();
      updates.rejected_at = null;
    } else if (status === 'rejected') {
      updates.rejected_at = new Date().toISOString();
      updates.approved_at = null;
    } else {
      updates.approved_at = null;
      updates.rejected_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  req.updateCoursePayload = updates;
  next();
}

router.get('/users', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, created_at, phone, ip, browser, device, role')
      .order('created_at', { ascending: false });

    if (error) {
      const { data: fallback, error: err2 } = await supabase
        .from('users')
        .select('id, email, name, created_at, ip, browser, device, role')
        .order('created_at', { ascending: false });
      if (err2) return next(err2);
      const users = (fallback || []).map((u) => ({
        ...u,
        username: u.name,
        phone: u.phone || getLocalPhone(u.id) || null,
      }));
      return res.json({ users });
    }
    const users = (data || []).map((u) => ({
      ...u,
      username: u.name,
      phone: u.phone || getLocalPhone(u.id) || null,
    }));
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.get('/enrollment-leads', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const leads = await studentStore.listPendingEnrollmentLeads();
    res.json({ leads });
  } catch (err) {
    next(err);
  }
});

router.post('/enrollments/:id/approve', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const { courseId, userId } = req.body || {};

    const result = await studentStore.approveEnrollment(leadId, { userId, courseId });
    const enrollment = result?.enrollment;

    res.json({
      message: 'Enrollment approved — student can access the course in Classroom',
      enrollment,
      classroomUrl: `/classroom?course=${enrollment?.course_id || courseId}`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/enrollments/:id/reject', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const result = await studentStore.rejectEnrollment(leadId);

    res.json({
      message: 'Enrollment request rejected successfully',
      enrollment: result.enrollment,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/enrolled-students', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const students = await studentStore.listApprovedEnrollmentsForAdmin();
    res.json({ students });
  } catch (err) {
    next(err);
  }
});

router.get('/course-students', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const courseId = req.query.courseId;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId query parameter is required' });
    }

    const students = await studentStore.listEnrollmentsByCourse(courseId);
    let courseTitle = null;
    const { data: course } = await supabase
      .from('courses')
      .select('id, title, name')
      .eq('id', parseInt(courseId, 10))
      .maybeSingle();
    if (course) courseTitle = course.title || course.name;

    res.json({ students, courseId: parseInt(courseId, 10), courseTitle });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/send', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { courseId, title, body, audience, userIds } = req.body || {};
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: 'message body is required' });
    }

    const adminUser = await studentStore.resolveUserFromToken(req.user);
    const result = await notificationsStore.sendToStudents({
      senderId: adminUser?.id || req.user?.sub,
      courseId,
      title: String(title).trim(),
      body: String(body).trim(),
      audience: audience || 'all',
      userIds: Array.isArray(userIds) ? userIds : [],
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: `Notification sent to ${result.sent} student(s)`,
      sent: result.sent,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/stats', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const data = await getUserStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/courses/stats', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const data = await getCourseStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  const id = getId(req);
  if (!id) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'User not found' });
    
    data.username = data.name;
    res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', authenticateJWT, requireAdmin, validateUserUpdate, async (req, res, next) => {
  const id = getId(req);
  if (!id) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const { data, error } = await supabase
      .from('users')
      .update(req.updateUserPayload)
      .eq('id', id)
      .select('id, email, name, created_at')
      .single();

    if (error) return next(error);
    
    if (data) {
      data.username = data.name;
    }
    res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  const id = getId(req);
  if (!id) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) return next(error);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/courses', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return next(error);
    const mappedCourses = data.map(c => ({
      ...c,
      name: c.title
    }));
    res.json({ courses: mappedCourses });
  } catch (err) {
    next(err);
  }
});

router.post('/courses', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, link, status } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'Course name is required (min 3 chars)' });
    }

    const courseData = {
      title: name.trim(),
      status: status || 'approved',
      created_at: new Date().toISOString(),
      created_by: req.user.sub,
    };

    if (description) courseData.description = description.trim();
    if (link) courseData.link = link.trim();

    if (status === 'approved' || !status) {
      courseData.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('courses')
      .insert(courseData)
      .select('*')
      .single();

    if (error) return next(error);
    data.name = data.title;
    res.status(201).json({ course: data });
  } catch (err) {
    next(err);
  }
});

router.get('/courses/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  const id = getId(req);
  if (!id) return res.status(400).json({ error: 'Invalid course ID' });

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Course not found' });
    data.name = data.title;
    res.json({ course: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/courses/:id', authenticateJWT, requireAdmin, validateCourseUpdate, async (req, res, next) => {
  const id = getId(req);
  if (!id) return res.status(400).json({ error: 'Invalid course ID' });

  try {
    const { data, error } = await supabase
      .from('courses')
      .update(req.updateCoursePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return next(error);
    data.name = data.title;
    res.json({ course: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/courses/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  const id = getId(req);
  if (!id) return res.status(400).json({ error: 'Invalid course ID' });

  try {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) return next(error);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
});


router.post('/approve/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  const courseId = getId(req);
  if (!courseId) {
    return res.status(400).json({ error: 'Invalid course ID' });
  }

  try {
    const { data: course, error: findError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .maybeSingle();

    if (findError) {
      return next(findError);
    }
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (course.status === 'approved') {
      return res.status(400).json({ error: 'Course already approved' });
    }

    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', courseId)
      .select('*')
      .single();

    if (updateError) {
      return next(updateError);
    }

    updatedCourse.name = updatedCourse.title;
    res.json({ message: 'Course approved', course: updatedCourse });
  } catch (err) {
    next(err);
  }
});

router.post('/reject/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  const courseId = getId(req);
  if (!courseId) {
    return res.status(400).json({ error: 'Invalid course ID' });
  }

  try {
    const { data: course, error: findError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .maybeSingle();

    if (findError) {
      return next(findError);
    }
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (course.status === 'rejected') {
      return res.status(400).json({ error: 'Course already rejected' });
    }

    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', courseId)
      .select('*')
      .single();

    if (updateError) {
      return next(updateError);
    }

    updatedCourse.name = updatedCourse.title;
    res.json({ message: 'Course rejected', course: updatedCourse });
  } catch (err) {
    next(err);
  }
});

router.delete('/delete/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  const courseId = getId(req);
  if (!courseId) {
    return res.status(400).json({ error: 'Invalid course ID' });
  }

  try {
    const { data: course, error: findError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .maybeSingle();

    if (findError) {
      return next(findError);
    }
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (req.user.role !== 'admin' && course.created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized to delete this course' });
    }

    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (deleteError) {
      return next(deleteError);
    }

    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
});


const { readLogs, clearLogs } = require('../logger');
const { listBackupsData, runBackup, restoreBackup } = require('../backup');

router.get('/monitor', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const [{ data: users }, { data: courses }] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact' }),
      supabase.from('courses').select('status'),
    ]);

    if (!users || !courses) {
      return next(new Error('Monitoring data unavailable'));
    }

    const roleCounts = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    const statusCounts = courses.reduce((acc, course) => {
      acc[course.status] = (acc[course.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalUsers: users.length,
      totalStudents: roleCounts['user'] || 0,
      totalTeachers: roleCounts['teacher'] || 0,
      totalAdmins: roleCounts['admin'] || 0,
      totalCourses: courses.length,
      courseStatusCounts: statusCounts,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const logs = await readLogs(100);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

router.delete('/logs', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    await clearLogs();
    res.json({ message: 'Logs cleared' });
  } catch (err) {
    next(err);
  }
});

// ── Backups ───────────────────────────────────────────────────────
router.get('/backups', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const backups = listBackupsData();
    res.json({ backups });
  } catch (err) {
    next(err);
  }
});

router.post('/backups/create', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const summary = await runBackup();
    res.json({ message: 'Backup created successfully', summary });
  } catch (err) {
    next(err);
  }
});

router.post('/backups/restore/:folder', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { folder } = req.params;
    await restoreBackup(folder);
    res.json({ message: 'Restore completed successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/backups/download/:folder', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { folder } = req.params;
    const backupPath = path.join(__dirname, '../backups', folder);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    res.attachment(`${folder}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(res);
    archive.directory(backupPath, false);
    archive.finalize();
  } catch (err) {
    next(err);
  }
});

router.delete('/backups/:folder', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { folder } = req.params;
    const backupPath = path.join(__dirname, '../backups', folder);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    fs.rmSync(backupPath, { recursive: true, force: true });
    res.json({ message: 'Backup deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  router,
};
