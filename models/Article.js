const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  thumbnail: {
    type: String,
    default: '',
  },
  shortDescription: {
    type: String,
    default: '',
    trim: true,
  },
  content: {
    type: String,
    default: '',
  },
  excerpt: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

articleSchema.pre('save', function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Article', articleSchema);
