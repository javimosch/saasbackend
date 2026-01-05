const mongoose = require('mongoose');

const virtualEjsGroupChangeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
    },
    summary: {
      type: String,
      default: '',
    },
    filePaths: {
      type: [String],
      default: [],
    },
    versionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'VirtualEjsFileVersion',
      default: [],
    },
    createdBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

virtualEjsGroupChangeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VirtualEjsGroupChange', virtualEjsGroupChangeSchema);
