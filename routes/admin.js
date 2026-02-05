const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const Article = require('../models/Article');
const { uploadThumbnail } = require('../utils/r2');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

function generateSecretKey() {
  return crypto.randomBytes(32).toString('hex');
}

async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({ allowAdminSignup: true });
  }
  return settings;
}

function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.adminToken;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// GET /api/admin/signup-allowed - Public check if signup is open
router.get('/signup-allowed', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ allowed: settings.allowAdminSignup });
  } catch (err) {
    res.status(500).json({ allowed: false });
  }
});

// POST /api/admin/signup - Create new admin
router.post('/signup', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.allowAdminSignup) {
      return res.status(403).json({ error: 'New admin signup is currently disabled.' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    const secretKey = generateSecretKey();
    const secretKeyHash = await bcrypt.hash(secretKey, 12);

    const admin = new Admin({
      email,
      password,
      secretKeyHash,
    });
    await admin.save();

    res.status(201).json({
      message: 'Admin created. Save your secret key — you will need it to complete setup.',
      secretKey,
      email: admin.email,
    });
  } catch (err) {
    console.error('Admin signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/confirm-secret - Verify secret key, issue JWT, set cookie
router.post('/confirm-secret', async (req, res) => {
  try {
    const { email, secretKey } = req.body;

    if (!email || !secretKey) {
      return res.status(400).json({ error: 'Email and secret key required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (admin.secretKeyUsed) {
      return res.status(400).json({ error: 'Secret key already used. Please log in.' });
    }

    const valid = await bcrypt.compare(secretKey, admin.secretKeyHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid secret key' });
    }

    admin.secretKeyUsed = true;
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.json({ success: true, message: 'Setup complete' });
  } catch (err) {
    console.error('Confirm secret error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/login - Email + password login for returning admins
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/logout - Clear admin cookie
router.post('/logout', (req, res) => {
  res.clearCookie('adminToken', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  res.json({ success: true });
});

// GET /api/admin/settings - Get settings (protected)
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ allowAdminSignup: settings.allowAdminSignup });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/settings - Update settings (protected)
router.patch('/settings', requireAuth, async (req, res) => {
  try {
    const { allowAdminSignup } = req.body;
    const settings = await getSettings();
    if (typeof allowAdminSignup === 'boolean') {
      settings.allowAdminSignup = allowAdminSignup;
      await settings.save();
    }
    res.json({ allowAdminSignup: settings.allowAdminSignup });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Upload images to R2 (protected) - thumbnail or content images ---
router.post('/upload-thumbnail', requireAuth, upload.single('thumbnail'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = await uploadThumbnail(req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (err) {
    console.error('Upload thumbnail error:', err);
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
});

router.post('/upload-image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = await uploadThumbnail(req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (err) {
    console.error('Upload image error:', err);
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
});

// --- Articles (protected) ---
const LIMIT = 20;

// GET /api/admin/articles?page=1&search=...&status=draft|published|all
router.get('/articles', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * LIMIT;
    const search = (req.query.search || '').trim();
    const status = req.query.status || 'all';
    const sort = req.query.sort || 'newest';

    const query = { author: req.admin.id };
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      query.$or = [
        { title: regex },
        { shortDescription: regex },
        { content: regex },
        { excerpt: regex },
      ];
    }
    if (status && status !== 'all') {
      query.status = status;
    }

    const sortOpt = sort === 'oldest' ? { updatedAt: 1 } : { updatedAt: -1 };
    const total = await Article.countDocuments(query);
    const articles = await Article.find(query)
      .sort(sortOpt)
      .skip(skip)
      .limit(LIMIT)
      .lean();
    res.json({
      articles,
      pagination: {
        page,
        limit: LIMIT,
        total,
        totalPages: Math.ceil(total / LIMIT) || 1,
      },
    });
  } catch (err) {
    console.error('List articles error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/articles - Create article
router.post('/articles', requireAuth, async (req, res) => {
  try {
    const { title, thumbnail, shortDescription, content, excerpt } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!shortDescription || !shortDescription.trim()) {
      return res.status(400).json({ error: 'Short description is required' });
    }
    const article = await Article.create({
      title: title.trim(),
      thumbnail: thumbnail || '',
      shortDescription: shortDescription.trim(),
      content: content || '',
      excerpt: excerpt || '',
      status: 'draft',
      author: req.admin.id,
    });
    res.status(201).json(article);
  } catch (err) {
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/articles/:id - Get single article
router.get('/articles/:id', requireAuth, async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,
      author: req.admin.id,
    });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    console.error('Get article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/articles/:id - Update article
router.put('/articles/:id', requireAuth, async (req, res) => {
  try {
    const { title, thumbnail, shortDescription, content, excerpt } = req.body;
    const article = await Article.findOne({
      _id: req.params.id,
      author: req.admin.id,
    });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (title !== undefined) article.title = String(title).trim();
    if (shortDescription !== undefined) {
      const sd = String(shortDescription).trim();
      if (!sd) return res.status(400).json({ error: 'Short description is required' });
      article.shortDescription = sd;
    }
    if (thumbnail !== undefined) article.thumbnail = String(thumbnail);
    if (content !== undefined) article.content = String(content);
    if (excerpt !== undefined) article.excerpt = String(excerpt);
    await article.save();
    res.json(article);
  } catch (err) {
    console.error('Update article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/articles/:id
router.delete('/articles/:id', requireAuth, async (req, res) => {
  try {
    const article = await Article.findOneAndDelete({
      _id: req.params.id,
      author: req.admin.id,
    });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/articles/:id/publish
router.patch('/articles/:id/publish', requireAuth, async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,
      author: req.admin.id,
    });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    article.status = 'published';
    await article.save();
    res.json(article);
  } catch (err) {
    console.error('Publish article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/articles/:id/unpublish
router.patch('/articles/:id/unpublish', requireAuth, async (req, res) => {
  try {
    const article = await Article.findOne({
      _id: req.params.id,
      author: req.admin.id,
    });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    article.status = 'draft';
    await article.save();
    res.json(article);
  } catch (err) {
    console.error('Unpublish article error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/verify - Verify admin token cookie (for protected routes)
router.get('/verify', (req, res) => {
  try {
    const token = req.cookies?.adminToken;
    if (!token) {
      return res.status(401).json({ valid: false });
    }
    jwt.verify(token, JWT_SECRET);
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
