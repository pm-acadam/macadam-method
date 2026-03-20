require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const DIST_PATH = path.join(__dirname, 'dist');

const adminRoutes = require('./routes/admin');
const articlesRoutes = require('./routes/articles');
const coursesRoutes = require('./routes/courses');
const checkoutRoutes = require('./routes/checkout');
const testimonialsRoutes = require('./routes/testimonials');
const inquiriesRoutes = require('./routes/inquiries');
const clarityRoutes = require('./routes/clarity');
const regulationResetRoutes = require('./routes/regulation-reset');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use('/api/admin', adminRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/inquiries', inquiriesRoutes);
app.use('/api/clarity', clarityRoutes);
app.use('/api/regulation-reset', regulationResetRoutes);

// Serve static assets from client build
app.use(express.static(DIST_PATH));

// SPA fallback: serve index.html for all non-API routes (Express 5 uses /{*splat} for catch-all)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});

mongoose.connect(process.env.MONGODB_URI, {
   
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

app.listen(3000);

module.exports = app;