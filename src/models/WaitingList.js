const mongoose = require('mongoose');

const waitingListSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    default: 'both'
  },
  status: {
    type: String,
    enum: ['active', 'subscribed', 'launched'],
    default: 'active'
  },
  referralSource: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// waitingListSchema.index({ email: 1 }); // Removed duplicate index
waitingListSchema.index({ type: 1 });
waitingListSchema.index({ status: 1 });

// Clean up response
waitingListSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('WaitingList', waitingListSchema);
