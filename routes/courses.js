const express = require('express');
const Course = require('../models/Course');

const router = express.Router();

const CLOUDFLARE_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, '') || 'https://pub-66a3335a61d046f1bdf3f81c9e8d8bf0.r2.dev';

function formatCourseUrls(course) {
  const obj = course.toObject ? course.toObject() : { ...course };
  if (obj.pdfUrl && !obj.pdfUrl.startsWith('http')) {
    obj.pdfUrl = CLOUDFLARE_PUBLIC_URL + obj.pdfUrl;
  }
  if (obj.thumbnail && !obj.thumbnail.startsWith('http')) {
    obj.thumbnail = CLOUDFLARE_PUBLIC_URL + obj.thumbnail;
  }
  return obj;
}

// GET /api/courses - Public list of published courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({ status: 'published' })
      .sort({ updatedAt: -1 })
      .select('title slug description price pdfUrl thumbnail updatedAt')
      .lean();
    const formattedCourses = courses.map(formatCourseUrls);
    res.json(formattedCourses);
  } catch (err) {
    console.error('List public courses error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/courses/:slug - Public single published course by slug
router.get('/:slug', async (req, res) => {
  try {
    const course = await Course.findOne({
      slug: req.params.slug,
      status: 'published',
    })
      .select('title slug description price pdfUrl thumbnail updatedAt createdAt')
      .lean();

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(formatCourseUrls(course));
  } catch (err) {
    console.error('Get public course error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

