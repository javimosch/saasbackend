const mongoose = require('mongoose');

const virtualEjsFileSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      default: 'manual',
      enum: ['filesystem_snapshot', 'manual', 'llm', 'rollback'],
      index: true,
    },
    baseSha: {
      type: String,
      default: null,
    },
    inferred: {
      type: Boolean,
      default: false,
      index: true,
    },
    integrated: {
      type: Boolean,
      default: false,
      index: true,
    },
    renderCount: {
      type: Number,
      default: 0,
    },
    lastRenderedAt: {
      type: Date,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// virtualEjsFileSchema.index({ path: 1 }); // Removed duplicate index
virtualEjsFileSchema.index({ inferred: 1, integrated: 1 });
virtualEjsFileSchema.index({ enabled: 1, updatedAt: -1 });

module.exports = mongoose.model('VirtualEjsFile', virtualEjsFileSchema);
