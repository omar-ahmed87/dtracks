const express = require('express');
const { authenticateJWT } = require('./auth');
const supabase = require('../supabaseClient');
const { listApprovedCourses } = require('../lib/coursesCatalog');

const router = express.Router();

function requireTeacher(req, res, next) {
  if (!req.user || req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher role required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required' });
  }
  next();
}

function validateCoursePayload(req, res, next) {
  const { name, description, link } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Invalid course name (3-100 chars)' });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 1000) {
    return res.status(400).json({ error: 'Invalid course description (10-1000 chars)' });
  }
  if (!link || typeof link !== 'string') {
    return res.status(400).json({ error: 'Course link is required' });
  }

  try {
    new URL(link);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid course link URL' });
  }

  req.coursePayload = {
    title: name.trim(),
    description: description.trim(),
    link: link.trim(),
    created_by: req.user.sub,
    created_at: new Date().toISOString(),
    status: 'pending',
  };
  next();
}

router.post('/add', authenticateJWT, requireAdmin, validateCoursePayload, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .insert([
        {
          ...req.coursePayload,
          status: 'pending',
        },
      ])
      .select('*')
      .single();

    if (error) {
      return next(error);
    }

    if (data) {
      data.name = data.title;
    }
    res.status(201).json({ message: 'Course added', course: data });
  } catch (err) {
    next(err);
  }
});

router.get('/all', async (req, res, next) => {
  try {
    const approved = await listApprovedCourses();
    const mapped = approved.map((c) => ({
      id: c.id,
      title: c.title,
      name: c.title,
      description: c.description,
      link: c.link,
      status: 'approved',
    }));
    res.json({ courses: mapped });
  } catch (err) {
    next(err);
  }
});


// route for course details (public - only approved)
router.get('/:id', async (req, res, next) => {
  const courseId = parseInt(req.params.id, 10);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'Invalid course ID' });
  }

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) {
      return next(error);
    }

    if (!data) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (data) {
      data.name = data.title;
    }
    res.json({ course: data });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  router,
};
