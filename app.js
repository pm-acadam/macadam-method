const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const DIST_PATH = path.join(__dirname, '../client/dist');

const adminRoutes = require('./routes/admin');
const articlesRoutes = require('./routes/articles');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use('/api/admin', adminRoutes);
app.use('/api/articles', articlesRoutes);

// Serve static assets from client build
app.use(express.static(DIST_PATH));

// SPA fallback: serve index.html for all non-API routes
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});

mongoose.connect(process.env.MONGODB_URI, {
   
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

app.listen(3000);

module.exports = app;