const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  allowAdminSignup: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Single document - use findOneAndUpdate
module.exports = mongoose.model('Settings', settingsSchema);
