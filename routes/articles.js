const express = require('express');
const Article = require('../models/Article');

const router = express.Router();

// GET /api/articles?limit=6&page=1 - Public list of published articles
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 48);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * limit;
    const query = { status: 'published' };
    const total = await Article.countDocuments(query);
    const articles = await Article.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title shortDescription excerpt thumbnail updatedAt')
      .lean();
    res.json({ articles, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (err) {
    console.error('List public articles error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/articles/:id - Public single published article
router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,
      status: 'published',
    }).lean();
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    console.error('Get public article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
