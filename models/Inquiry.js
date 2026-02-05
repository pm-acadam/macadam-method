const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    enum: ['contact', 'private-work', 'for-law-firms'],
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    default: '',
    trim: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Inquiry', inquirySchema);
