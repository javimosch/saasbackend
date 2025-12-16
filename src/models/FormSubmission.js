const mongoose = require('mongoose');

const formSubmissionSchema = new mongoose.Schema({
  formKey: {
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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  fields: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: true,
});

formSubmissionSchema.index({ formKey: 1, createdAt: -1 });
formSubmissionSchema.index({ actorType: 1, actorId: 1, createdAt: -1 });

module.exports = mongoose.model('FormSubmission', formSubmissionSchema);
