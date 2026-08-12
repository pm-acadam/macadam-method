const express = require('express');
const Course = require('../models/Course');

const router = express.Router();

const CLOUDFLARE_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, '') || 'https://pub-66a3335a61d046f1bdf3f81c9e8d8bf0.r2.dev';

// Public course responses must never include the paid pdfUrl.
function formatPublicCourse(course) {
  const obj = course.toObject ? course.toObject() : { ...course };
  delete obj.pdfUrl;
  if (obj.thumbnail && !obj.thumbnail.startsWith('http')) {
    obj.thumbnail = CLOUDFLARE_PUBLIC_URL + obj.thumbnail;
  }
  return obj;
}

// GET /api/courses - Public list of published courses (pdfUrl intentionally omitted)
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({ status: 'published' })
      .sort({ updatedAt: -1 })
      .select('-pdfUrl')
      .lean();
    const formattedCourses = courses.map(formatPublicCourse);
    res.json(formattedCourses);
  } catch (err) {
    console.error('List public courses error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/courses/:slug - Public single published course by slug (pdfUrl intentionally omitted)
router.get('/:slug', async (req, res) => {
  try {
    const course = await Course.findOne({
      slug: req.params.slug,
      status: 'published',
    })
      .select('-pdfUrl')
      .lean();

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(formatPublicCourse(course));
  } catch (err) {
    console.error('Get public course error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

