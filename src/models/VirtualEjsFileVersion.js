const mongoose = require('mongoose');

const virtualEjsFileVersionSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VirtualEjsFile',
      required: true,
      index: true,
    },
    path: {
      type: String,
      required: true,
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
    description: {
      type: String,
      default: '',
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VirtualEjsGroupChange',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

virtualEjsFileVersionSchema.index({ fileId: 1, createdAt: -1 });
virtualEjsFileVersionSchema.index({ path: 1, createdAt: -1 });

module.exports = mongoose.model('VirtualEjsFileVersion', virtualEjsFileVersionSchema);
