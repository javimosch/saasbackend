const mongoose = require('mongoose');

const workflowExecutionSchema = new mongoose.Schema({
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  context: { type: Object, default: {} },
  log: { type: Array, default: [] },
  executedAt: { type: Date, default: Date.now },
  duration: Number
});

module.exports = mongoose.model('WorkflowExecution', workflowExecutionSchema);
