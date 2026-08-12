const mongoose = require('mongoose');

const recalibrationSessionSchema = new mongoose.Schema(
  {
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
    },
    message: {
      type: String,
      maxlength: 2000,
      trim: true,
      default: '',
    },
    sessionType: {
      type: String,
      enum: ['recalibration', 'private-work'],
      default: 'recalibration',
    },
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    stripePaymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired'],
      default: 'pending',
    },
    amount: {
      type: Number,
      default: 50000,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'completed', 'cancelled'],
      default: 'pending',
    },
    sessionNotes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecalibrationSession', recalibrationSessionSchema);
