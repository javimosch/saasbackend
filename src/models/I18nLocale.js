const mongoose = require('mongoose');

const i18nLocaleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// i18nLocaleSchema.index({ code: 1 }); // Removed duplicate index
i18nLocaleSchema.index({ enabled: 1 });
i18nLocaleSchema.index({ isDefault: 1 });

module.exports = mongoose.model('I18nLocale', i18nLocaleSchema);
