const express = require('express');
const Inquiry = require('../models/Inquiry');

const router = express.Router();

// POST /api/inquiries - Public form submission
router.post('/', async (req, res) => {
  try {
    const { source, name, email, message } = req.body;
    if (!source || !['contact', 'private-work', 'for-law-firms'].includes(source)) {
      return res.status(400).json({ error: 'Invalid source' });
    }
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
    const inquiry = await Inquiry.create({
      source,
      name: name.trim(),
      email: email.trim(),
      message: (message || '').trim(),
    });
    res.status(201).json({ success: true, id: inquiry._id });
  } catch (err) {
    console.error('Create inquiry error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
