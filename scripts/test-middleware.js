// Quick test script for middleware mode
const express = require('express');
const { middleware } = require('./index');

const app = express();

console.log('🧪 Testing middleware mode...\n');

// Simple parent app route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Parent Application',
    saasBackend: 'Mounted at /saas'
  });
});

// Mount SaaS backend middleware
app.use('/saas', middleware({
  mongodbUri: process.env.MONGODB_URI,
  corsOrigin: '*'
}));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`\n✅ Test server running on http://localhost:${PORT}`);
  console.log(`📦 Parent app: http://localhost:${PORT}/`);
  console.log(`📦 SaaS backend health: http://localhost:${PORT}/saas/health`);
  console.log(`📦 SaaS backend admin: http://localhost:${PORT}/saas/admin/test`);
  console.log('\n⏸️  Server will keep running. Press Ctrl+C to stop.');
});
