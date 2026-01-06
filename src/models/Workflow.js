const mongoose = require('mongoose');

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  entrypoint: {
    type: { type: String, default: 'webhook' },
    allowedMethods: { type: [String], default: ['POST', 'GET'] },
    auth: {
      type: { type: String, enum: ['none', 'header', 'bearer'], default: 'none' },
      headerName: String,
      headerValue: String
    },
    awaitResponse: { type: Boolean, default: false }
  },
  testDataset: {
    method: { type: String, default: 'POST' },
    body: { type: Object, default: {} },
    query: { type: Object, default: {} },
    headers: { type: Object, default: {} }
  },
  webhookSlug: { type: String, unique: true, sparse: true },
  nodes: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Workflow', workflowSchema);
