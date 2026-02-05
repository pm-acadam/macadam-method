const express = require('express');
const Testimonial = require('../models/Testimonial');

const router = express.Router();

// GET /api/testimonials - Public list of testimonials
router.get('/', async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ order: 1, createdAt: 1 }).select('name image quote').lean();
    res.json({ testimonials });
  } catch (err) {
    console.error('List public testimonials error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
