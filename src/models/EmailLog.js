const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  to: [String],
  subject: String,
  type: {
    type: String,
    default: 'other',
    index: true
  },
  providerId: String,
  status: {
    type: String,
    enum: ['sent', 'failed'],
    default: 'sent'
  },
  error: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
