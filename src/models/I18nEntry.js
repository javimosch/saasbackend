const mongoose = require('mongoose');

const i18nEntrySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    locale: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      default: '',
    },
    valueFormat: {
      type: String,
      enum: ['text', 'html'],
      default: 'text',
    },
    source: {
      type: String,
      enum: ['seed', 'admin', 'ai'],
      default: 'admin',
    },
    seeded: {
      type: Boolean,
      default: false,
    },
    seedHash: {
      type: String,
      default: null,
    },
    seedVersion: {
      type: String,
      default: null,
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    editedBy: {
      type: String,
      default: null,
    },
    lastAiProvider: {
      type: String,
      default: null,
    },
    lastAiModel: {
      type: String,
      default: null,
    },
    lastAiPromptHash: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

i18nEntrySchema.index({ key: 1, locale: 1 }, { unique: true });
// i18nEntrySchema.index({ locale: 1, key: 1 }); // Removed duplicate index
i18nEntrySchema.index({ edited: 1 });
i18nEntrySchema.index({ seeded: 1 });

module.exports = mongoose.model('I18nEntry', i18nEntrySchema);
