const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  billingOwnerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: {
    type: String,
    trim: true
  },
  allowPublicJoin: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// organizationSchema.index({ slug: 1 }, { unique: true }); // Removed duplicate index
organizationSchema.index({ ownerUserId: 1, createdAt: -1 });
organizationSchema.index({ status: 1 });

organizationSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Organization', organizationSchema);
