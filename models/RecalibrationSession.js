const mongoose = require('mongoose');

const recalibrationSessionSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: String,
    message: String,
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
