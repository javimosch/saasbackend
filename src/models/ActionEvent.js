const mongoose = require('mongoose');

const actionEventSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    index: true,
  },
  actorType: {
    type: String,
    enum: ['user', 'anonymous', 'system'],
    required: true,
    index: true,
  },
  actorId: {
    type: String,
    required: true,
    index: true,
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: true,
});

actionEventSchema.index({ action: 1, createdAt: -1 });
actionEventSchema.index({ actorType: 1, actorId: 1, createdAt: -1 });

module.exports = mongoose.model('ActionEvent', actionEventSchema);
