const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    actorType: {
      type: String,
      required: true,
      enum: ['admin', 'user', 'system'],
    },
    actorId: {
      type: String,
      default: null,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: false,
      default: null,
      index: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

auditEventSchema.index({ action: 1, createdAt: -1 });
auditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

auditEventSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('AuditEvent', auditEventSchema);
