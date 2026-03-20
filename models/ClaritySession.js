const mongoose = require('mongoose');

const claritySessionSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  message: {
    type: String,
    default: '',
    trim: true,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ClaritySession', claritySessionSchema);