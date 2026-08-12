const mongoose = require('mongoose');

const claritySessionSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 25,
    default: '',
  },
  message: {
    type: String,
    maxlength: 2000,
    trim: true,
    default: '',
  },
  stripeSessionId: {
    type: String,
    required: true,
    unique: true,
  },
  stripePaymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  amount: {
    type: Number,
    default: 30000, // $300 in cents
  },
  currency: {
    type: String,
    default: 'usd',
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed', 'cancelled'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ClaritySession', claritySessionSchema);