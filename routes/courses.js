const express = require('express');
const Course = require('../models/Course');

const router = express.Router();

// GET /api/courses - Public list of published courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({ status: 'published' })
      .sort({ updatedAt: -1 })
      .select('title slug description price pdfUrl thumbnail updatedAt')
      .lean();
    res.json(courses);
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

    res.json(course);
  } catch (err) {
    console.error('Get public course error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

